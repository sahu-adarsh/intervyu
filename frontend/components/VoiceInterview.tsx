'use client';

// Suppress ONNX Runtime warnings and VAD debug logs (harmless, noisy in production)
if (typeof window !== 'undefined') {
  const _log = console.log.bind(console);
  const _warn = console.warn.bind(console);
  const _error = console.error.bind(console);
  const isONNX = (s: unknown) => typeof s === 'string' && s.includes('onnxruntime');
  const isVADNoise = (s: unknown) => typeof s === 'string' && (
    s.startsWith('VAD | debug') ||
    s.includes('using default audio context')
  );
  console.log = (...args: unknown[]) => { if (isVADNoise(args[0])) return; _log(...args); };
  console.warn = (...args: unknown[]) => { if (isONNX(args[0])) return; _warn(...args); };
  console.error = (...args: unknown[]) => { if (isONNX(args[0])) return; _error(...args); };
}

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useMicVAD } from '@ricky0123/vad-react';
import {
  Code2, Mic, MicOff, PhoneOff, MessageSquare, FileText,
  Grid3X3, UserRound, X, BarChart2, MoreHorizontal
} from 'lucide-react';

// Dynamically import CodeEditor and CV components to avoid SSR issues
const CodeEditor = dynamic(() => import('./code-editor/CodeEditor'), { ssr: false });
const CVUpload = dynamic(() => import('./cv/CVUpload'), { ssr: false });
const CVAnalysisDisplay = dynamic(() => import('./cv/CVAnalysisDisplay'), { ssr: false });

type Message = {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
};

type VoiceInterviewProps = {
  sessionId: string;
  interviewType: string;
  candidateName: string;
};

function float32ToWav(samples: Float32Array, sampleRate = 16000): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const write = (o: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i)); };
  write(0, 'RIFF'); view.setUint32(4, 36 + samples.length * 2, true);
  write(8, 'WAVE'); write(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, 1, true); view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true);
  view.setUint16(34, 16, true); write(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    offset += 2;
  }
  return new Blob([buffer], { type: 'audio/wav' });
}

export default function VoiceInterview({ sessionId, interviewType, candidateName }: VoiceInterviewProps) {
  const router = useRouter();
  const [isActive, setIsActive] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentResponse, setCurrentResponse] = useState('');
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [error, setError] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isTTSSpeaking, setIsTTSSpeaking] = useState(false);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [showCodeEditor, setShowCodeEditor] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [showCV, setShowCV] = useState(false);
  const [cvAnalysis, setCvAnalysis] = useState<any>(null);
  const [codingQuestion, setCodingQuestion] = useState<{
    question: string;
    language?: string;
    testCases?: Array<{ input: string; expected: string }>;
    initialCode?: string;
  } | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioQueueRef = useRef<ArrayBuffer[]>([]);
  const isPlayingRef = useRef(false);
  const isTTSPlayingRef = useRef(false);  // true while TTS audio is in the queue or playing
  const currentAudioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const wordQueueRef = useRef<string[]>([]);
  const wordRevealRef = useRef<NodeJS.Timeout | null>(null);
  const speechEndTimeRef = useRef<number | null>(null);
  const transcriptReceivedAtRef = useRef<number | null>(null);
  const firstLLMChunkAtRef = useRef<number | null>(null);
  const firstAudioReceivedAtRef = useRef<number | null>(null);
  const firstAudioPlayedAtRef = useRef<boolean>(false);

  // Silero VAD — neural speech detection via ONNX model in a Web Worker
  const vad = useMicVAD({
    startOnLoad: true,
    model: 'legacy',
    baseAssetPath: '/',
    onnxWASMBasePath: '/',
    // 1800ms silence before speech_end fires — catches mid-thought pauses without sluggish UX
    redemptionMs: 1800,
    positiveSpeechThreshold: 0.6,
    negativeSpeechThreshold: 0.45,
    ortConfig: (ort) => {
      ort.env.logLevel = 'error';
      ort.env.wasm.numThreads = 1;
    },
    getStream: async () => navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: false } }),
    onSpeechStart: () => {
      if (isTTSPlayingRef.current) return;
      stopAudioPlayback();
      setIsRecording(true);
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'speech_start' }));
      }
    },
    onSpeechEnd: (audio: Float32Array) => {
      const t0 = performance.now();
      speechEndTimeRef.current = t0;
      transcriptReceivedAtRef.current = null;
      firstLLMChunkAtRef.current = null;
      firstAudioReceivedAtRef.current = null;
      firstAudioPlayedAtRef.current = false;
      const durationSec = (audio.length / 16000).toFixed(1);
      console.log(`[TIMING] ── speech_end sent ─────────────────────────`);
      console.log(`[TIMING] Audio: ${audio.length} samples (${durationSec}s @ 16kHz)`);
      const wavBlob = float32ToWav(audio);
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(wavBlob);
        wsRef.current.send(JSON.stringify({ type: 'speech_end' }));
      }
      setIsRecording(false);
    },
  });

  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000';
    wsRef.current = new WebSocket(`${wsUrl}/ws/interview/${sessionId}`);

    wsRef.current.onopen = () => {
      initializeInterview();
    };

    wsRef.current.onmessage = async (event) => {
      if (event.data instanceof Blob) {
        const audioBuffer = await event.data.arrayBuffer();
        if (firstAudioReceivedAtRef.current === null && speechEndTimeRef.current !== null) {
          firstAudioReceivedAtRef.current = performance.now();
          const sinceEnd = (firstAudioReceivedAtRef.current - speechEndTimeRef.current).toFixed(0);
          const sinceTranscript = transcriptReceivedAtRef.current
            ? (firstAudioReceivedAtRef.current - transcriptReceivedAtRef.current).toFixed(0)
            : '?';
          console.log(`[TIMING] [5] First audio received: +${sinceEnd}ms since speech_end  (+${sinceTranscript}ms since transcript)`);
        }
        audioQueueRef.current.push(audioBuffer);
        if (!isPlayingRef.current) {
          playNextAudioChunk();
        }
      } else {
        const data = JSON.parse(event.data);

        if (data.type === 'transcript' && data.role === 'user') {
          if (speechEndTimeRef.current !== null) {
            const sttMs = (performance.now() - speechEndTimeRef.current).toFixed(0);
            console.log(`[TIMING] [1] STT round-trip:       +${sttMs}ms (speech_end → transcript)`);
          }
          transcriptReceivedAtRef.current = performance.now();
          speechEndTimeRef.current = null;
          if (wordRevealRef.current) { clearInterval(wordRevealRef.current); wordRevealRef.current = null; }
          wordQueueRef.current = [];
          setMessages(prev => [...prev, { role: 'user', content: data.text, timestamp: new Date() }]);
          setCurrentTranscript('');
          setCurrentResponse('');
          setError('');
          setIsProcessing(true);
        } else if (data.type === 'llm_chunk') {
          if (firstLLMChunkAtRef.current === null && transcriptReceivedAtRef.current !== null) {
            firstLLMChunkAtRef.current = performance.now();
            const ms = (firstLLMChunkAtRef.current - transcriptReceivedAtRef.current).toFixed(0);
            console.log(`[TIMING] [2] First LLM chunk:      +${ms}ms since transcript`);
          }
          const words = data.text.split(/(\s+)/);
          wordQueueRef.current.push(...words.filter((w: string) => w.length > 0));
          setIsProcessing(true);
          if (!wordRevealRef.current) {
            wordRevealRef.current = setInterval(() => {
              if (wordQueueRef.current.length === 0) {
                clearInterval(wordRevealRef.current!);
                wordRevealRef.current = null;
                return;
              }
              const word = wordQueueRef.current.shift()!;
              setCurrentResponse(prev => prev + word);
            }, 40);
          }
        } else if (data.type === 'assistant_complete') {
          if (transcriptReceivedAtRef.current !== null) {
            const totalMs = (performance.now() - transcriptReceivedAtRef.current).toFixed(0);
            console.log(`[TIMING] [3] assistant_complete:   +${totalMs}ms since transcript (LLM+TTS pipeline)`);
          }
          if (wordRevealRef.current) { clearInterval(wordRevealRef.current); wordRevealRef.current = null; }
          if (wordQueueRef.current.length > 0) {
            const remaining = wordQueueRef.current.join('');
            wordQueueRef.current = [];
            setCurrentResponse(prev => prev + remaining);
          }
          setTimeout(() => {
            setMessages(prev => [...prev, { role: 'assistant', content: data.text, timestamp: new Date() }]);
            setCurrentResponse('');
            setIsProcessing(false);
          }, 200);
        } else if (data.type === 'coding_question') {
          const lang = data.language || 'python';
          const question = data.question || '';
          if (question) {
            setCodingQuestion({
              question,
              language: lang,
              testCases: data.testCases || [],
              initialCode: data.initialCode || ''
            });
          }
          setShowCodeEditor(true);
          setShowTranscript(false);
          setShowCV(false);
        } else if (data.type === 'error') {
          setError(data.message);
          setIsProcessing(false);
        }
      }
    };

    return () => {
      wsRef.current?.close();
      if (timerRef.current) clearInterval(timerRef.current);
      if (wordRevealRef.current) clearInterval(wordRevealRef.current);
      if (audioContextRef.current) audioContextRef.current.close();
      vad.pause();
    };
  }, [sessionId]);

  // Pre-load CV analysis if it was uploaded on the home page before the interview
  useEffect(() => {
    if (cvAnalysis) return;
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    fetch(`${apiUrl}/api/interviews/${sessionId}/cv-analysis`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.analysis) setCvAnalysis(data.analysis); })
      .catch(() => {});
  }, [sessionId]);

  useEffect(() => {
    if (isActive) {
      timerRef.current = setInterval(() => {
        setTimeElapsed(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isActive]);

  const initializeInterview = () => {
    setIsActive(true);
    setError('');
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'interview_ready' }));
    }
  };

  const stopAudioPlayback = () => {
    if (currentAudioSourceRef.current) {
      try {
        currentAudioSourceRef.current.stop();
        currentAudioSourceRef.current.disconnect();
      } catch {
        // AudioBufferSourceNode may already be stopped — ignore
      }
      currentAudioSourceRef.current = null;
    }
    audioQueueRef.current = [];
    isPlayingRef.current = false;
    isTTSPlayingRef.current = false;
    setIsTTSSpeaking(false);
  };

  const playNextAudioChunk = async () => {
    if (audioQueueRef.current.length === 0) {
      isPlayingRef.current = false;
      isTTSPlayingRef.current = false;
      setIsTTSSpeaking(false);
      currentAudioSourceRef.current = null;
      return;
    }

    isPlayingRef.current = true;
    isTTSPlayingRef.current = true;
    setIsTTSSpeaking(true);
    const audioBuffer = audioQueueRef.current.shift()!;

    try {
      if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        audioContextRef.current = new AudioContext();
      }
      const context = audioContextRef.current;
      if (context.state === 'suspended') await context.resume();

      const buffer = await context.decodeAudioData(audioBuffer);
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(context.destination);
      currentAudioSourceRef.current = source;
      source.onended = () => {
        currentAudioSourceRef.current = null;
        playNextAudioChunk();
      };
      if (!firstAudioPlayedAtRef.current && firstAudioReceivedAtRef.current !== null) {
        firstAudioPlayedAtRef.current = true;
        const sinceReceived = (performance.now() - firstAudioReceivedAtRef.current).toFixed(0);
        const sinceEnd = speechEndTimeRef.current !== null
          ? (performance.now() - speechEndTimeRef.current).toFixed(0)
          : transcriptReceivedAtRef.current !== null
            ? (performance.now() - transcriptReceivedAtRef.current).toFixed(0) + 'ms since transcript'
            : '?';
        console.log(`[TIMING] [6] First audio PLAYING:   +${sinceReceived}ms decode+schedule  (total ~${sinceEnd}ms since speech_end)`);
      }
      source.start();
    } catch (err) {
      setError('Failed to play audio: ' + (err as Error).message);
      currentAudioSourceRef.current = null;
      playNextAudioChunk();
    }
  };

  const handleEndInterview = async () => {
    if (!confirmEnd) {
      setConfirmEnd(true);
      setTimeout(() => setConfirmEnd(false), 3000);
      return;
    }
    setConfirmEnd(false);
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/interviews/${sessionId}/end`, {
        method: 'POST',
      });
      try {
        const stored = JSON.parse(localStorage.getItem('intervyu_sessions') || '[]');
        const entry = { sessionId, interviewType, candidateName, date: new Date().toISOString() };
        const updated = [entry, ...stored.filter((s: any) => s.sessionId !== sessionId)].slice(0, 20);
        localStorage.setItem('intervyu_sessions', JSON.stringify(updated));
      } catch {}
      router.push(`/report?session=${sessionId}`);
    } catch {
      router.push(`/report?session=${sessionId}`);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, currentResponse, currentTranscript]);

  const displayType = interviewType.replace(/-/g, ' ').toUpperCase();
  const neerjaActive = isProcessing || isTTSSpeaking;

  return (
    <div className="flex flex-col h-screen bg-black text-white overflow-hidden">

      {/* ── Top Bar ── */}
      <div className="flex-shrink-0 flex items-center justify-between px-5 py-2.5 bg-black border-b border-slate-800/50 z-20">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <Grid3X3 size={16} className="text-blue-400" />
          <span className="text-sm font-semibold text-white tracking-wide">intervyu</span>
        </div>
        {/* Interview type */}
        <span className="text-slate-200 text-xs font-semibold tracking-widest uppercase">
          {displayType}
        </span>
        {/* Status + Timer */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-emerald-400 text-xs font-medium">ONLINE</span>
          </div>
          <span className="font-mono text-xs text-slate-300 bg-slate-800 px-2.5 py-1 rounded">
            {formatTime(timeElapsed)}
          </span>
        </div>
      </div>

      {/* ── Main Area ── */}
      <div className="flex-1 relative overflow-hidden bg-slate-950">

        {/* User avatar — centered */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="relative flex items-center justify-center">
            {/* pulsing rings when recording */}
            {isRecording && (
              <>
                <div className="absolute w-56 h-56 rounded-full bg-emerald-500/10 animate-ping" />
                <div className="absolute w-48 h-48 rounded-full bg-emerald-500/10 animate-pulse" />
              </>
            )}
            {/* Avatar circle */}
            <div className={`w-36 h-36 rounded-full flex items-center justify-center text-5xl font-bold select-none transition-all duration-500 ${
              isRecording
                ? 'bg-teal-600 ring-4 ring-emerald-400/70 shadow-2xl shadow-emerald-500/20'
                : neerjaActive
                ? 'bg-slate-700 ring-4 ring-purple-500/40 shadow-2xl shadow-purple-500/10'
                : 'bg-slate-700 ring-2 ring-slate-600'
            }`}>
              {candidateName.charAt(0).toUpperCase()}
            </div>
          </div>
        </div>

        {/* Neerja PiP — top right */}
        <div className={`absolute top-4 right-4 w-48 rounded-xl overflow-hidden border shadow-2xl transition-all duration-300 ${
          neerjaActive ? 'border-purple-500/60 shadow-purple-500/20' : 'border-slate-700/50'
        }`}>
          <div className="bg-slate-800/90 aspect-video relative flex flex-col items-center justify-center">
            {/* Speaking animation overlay */}
            {neerjaActive && (
              <div className="absolute inset-0 border-2 border-purple-400/40 rounded-xl animate-pulse" />
            )}
            {/* Avatar icon */}
            <div className="w-12 h-12 rounded-full bg-slate-600 flex items-center justify-center mb-1">
              <UserRound size={28} className="text-slate-200" />
            </div>
            {/* Label bar */}
            <div className="absolute bottom-0 left-0 right-0 bg-black/70 backdrop-blur-sm px-2.5 py-1.5 flex items-center justify-between">
              <span className="text-white text-xs font-medium">Neerja</span>
              {/* Speaking bars */}
              {neerjaActive && (
                <div className="flex items-end gap-px h-4">
                  {[10, 14, 8, 12, 7].map((h, i) => (
                    <div
                      key={i}
                      className="w-0.5 bg-purple-400 rounded-full animate-pulse"
                      style={{ height: `${h}px`, animationDelay: `${i * 0.13}s` }}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Candidate name tag — bottom left of main area */}
        <div className="absolute bottom-4 left-4">
          <span className="bg-slate-900/80 backdrop-blur-sm text-white text-xs px-3 py-1.5 rounded-lg border border-slate-700/40 font-medium">
            {candidateName}
          </span>
        </div>

        {/* Initialization message */}
        {!isActive && !error && (
          <div className="absolute bottom-16 left-1/2 -translate-x-1/2">
            <p className="text-blue-400 text-xs animate-pulse whitespace-nowrap">
              Connecting — please allow microphone access
            </p>
          </div>
        )}

        {/* Error overlay */}
        {(error || vad.errored) && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div className="bg-red-950/90 border border-red-800 rounded-2xl px-6 py-5 max-w-sm w-full mx-4 space-y-3 backdrop-blur-sm shadow-2xl">
              <p className="text-sm font-semibold text-red-400">Connection Error</p>
              <p className="text-sm text-red-300">{error || String(vad.errored)}</p>
              <button
                onClick={initializeInterview}
                className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {/* ── Transcript slide-in panel — from left ── */}
        <div className={`absolute top-0 left-0 bottom-0 w-80 bg-white z-30 flex flex-col shadow-2xl transition-transform duration-300 ease-in-out ${
          showTranscript ? 'translate-x-0' : '-translate-x-full'
        }`}>
          {/* Header */}
          <div className="flex-shrink-0 flex items-center justify-between px-4 py-3.5 border-b border-gray-200">
            <span className="font-semibold text-slate-800 text-sm">Transcription</span>
            <button
              onClick={() => setShowTranscript(false)}
              className="p-1 rounded-md hover:bg-gray-100 text-slate-500 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex items-end gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                {/* Avatar */}
                <div className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold ${
                  msg.role === 'user' ? 'bg-teal-600 text-white' : 'bg-gray-200 text-slate-600'
                }`}>
                  {msg.role === 'user'
                    ? candidateName.charAt(0).toUpperCase()
                    : <UserRound size={14} />
                  }
                </div>
                {/* Bubble */}
                <div className={`max-w-[75%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-purple-600 text-white rounded-br-sm'
                    : 'bg-gray-100 text-slate-800 rounded-bl-sm'
                }`}>
                  {msg.content}
                </div>
              </div>
            ))}

            {/* In-progress user speech */}
            {currentTranscript && (
              <div className="flex items-end gap-2 flex-row-reverse">
                <div className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold bg-teal-500 text-white">
                  {candidateName.charAt(0).toUpperCase()}
                </div>
                <div className="max-w-[75%] px-3.5 py-2.5 rounded-2xl rounded-br-sm text-sm bg-purple-400/70 text-white italic">
                  {currentTranscript}
                </div>
              </div>
            )}

            {/* In-progress assistant response */}
            {currentResponse && (
              <div className="flex items-end gap-2 flex-row">
                <div className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center bg-gray-200 text-slate-600">
                  <UserRound size={14} />
                </div>
                <div className="max-w-[75%] px-3.5 py-2.5 rounded-2xl rounded-bl-sm text-sm bg-gray-100 text-slate-800">
                  {currentResponse}
                  <span className="inline-block w-1 h-3.5 bg-purple-500 ml-1 animate-pulse rounded-sm align-middle" />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* ── CV slide-in panel — from right ── */}
        <div className={`absolute top-0 right-0 bottom-0 w-96 bg-white z-30 flex flex-col shadow-2xl transition-transform duration-300 ease-in-out ${
          showCV ? 'translate-x-0' : 'translate-x-full'
        }`}>
          <div className="flex-shrink-0 flex items-center justify-between px-4 py-3.5 border-b border-gray-200">
            <span className="font-semibold text-slate-800 text-sm">Resume</span>
            <button
              onClick={() => setShowCV(false)}
              className="p-1 rounded-md hover:bg-gray-100 text-slate-500 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {cvAnalysis ? (
              <CVAnalysisDisplay analysis={cvAnalysis} onUpdate={setCvAnalysis} />
            ) : (
              <CVUpload
                sessionId={sessionId}
                onUploadSuccess={setCvAnalysis}
                onUploadError={() => {}}
              />
            )}
          </div>
        </div>

        {/* ── Code Editor full overlay ── */}
        {codingQuestion && (
          <div className={`absolute inset-0 z-40 bg-slate-950 flex flex-col ${showCodeEditor ? '' : 'hidden'}`}>
            {/* Header */}
            <div className="flex-shrink-0 flex items-center justify-between px-5 py-3 border-b border-slate-800 bg-slate-900">
              <span className="text-white font-semibold text-sm flex items-center gap-2">
                <Code2 size={16} className="text-blue-400" />
                Code Editor
              </span>
              <button
                onClick={() => setShowCodeEditor(false)}
                className="p-1.5 rounded-md hover:bg-slate-700 text-slate-400 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            {/* Body: problem statement left + Monaco right */}
            <div className="flex-1 flex min-h-0">
              {/* Problem statement panel */}
              <div className="w-64 flex-shrink-0 flex flex-col border-r border-slate-800 overflow-y-auto bg-slate-900/50">
                <div className="p-5 space-y-4">
                  <h3 className="text-white font-semibold text-sm">Problem Statement</h3>
                  <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">
                    {codingQuestion.question}
                  </p>
                  {codingQuestion.testCases && codingQuestion.testCases.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Test Cases</p>
                      {codingQuestion.testCases.map((tc, i) => (
                        <div key={i} className="bg-slate-800 rounded-lg px-3 py-2 font-mono text-xs text-slate-300 space-y-0.5">
                          <div><span className="text-slate-500">in: </span>{tc.input}</div>
                          <div><span className="text-slate-500">out: </span>{tc.expected}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              {/* Monaco editor */}
              <div className="flex-1 min-w-0">
                <CodeEditor
                  sessionId={sessionId}
                  initialCode={codingQuestion.initialCode}
                  language={codingQuestion.language}
                  testCases={codingQuestion.testCases}

                  onCodeSubmit={(code, result, language) => {
                    if (wsRef.current?.readyState === WebSocket.OPEN) {
                      wsRef.current.send(JSON.stringify({
                        type: 'code_submission',
                        code,
                        language,
                        allTestsPassed: result.allTestsPassed,
                        testResults: result.testResults,
                        executionTime: result.executionTime,
                        error: result.error
                      }));
                    }
                  }}
                />
              </div>
            </div>
          </div>
        )}

      </div>

      {/* ── Bottom Control Bar ── */}
      <div className="flex-shrink-0 bg-black border-t border-slate-800/50 py-3 px-6 flex items-center justify-between z-20">

        {/* Left: transcript + CV buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setShowTranscript(v => !v); setShowCV(false); }}
            className={`p-2.5 rounded-xl transition-all ${
              showTranscript
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
            }`}
            title="Transcription"
          >
            <MessageSquare size={18} />
          </button>
          <button
            onClick={() => { setShowCV(v => !v); setShowTranscript(false); }}
            className={`relative p-2.5 rounded-xl transition-all ${
              showCV
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
            }`}
            title="Resume"
          >
            <FileText size={18} />
            {cvAnalysis && (
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-emerald-400 rounded-full" />
            )}
          </button>
        </div>

        {/* Center: mic indicator + end call + code editor */}
        <div className="flex items-center gap-4">
          {/* Mic state indicator (non-interactive visual) */}
          <div className={`w-11 h-11 rounded-full flex items-center justify-center transition-all ${
            isRecording
              ? 'bg-emerald-500/20 ring-2 ring-emerald-500 text-emerald-400'
              : 'bg-slate-800 text-slate-500'
          }`}>
            {isRecording ? <Mic size={18} /> : <MicOff size={18} />}
          </div>

          {/* End call */}
          <div className="relative flex flex-col items-center">
            {confirmEnd && (
              <span className="absolute -top-7 text-xs text-red-400 whitespace-nowrap font-medium">
                Tap again to end
              </span>
            )}
            <button
              onClick={handleEndInterview}
              className={`w-14 h-14 rounded-full flex items-center justify-center transition-all shadow-lg ${
                confirmEnd
                  ? 'bg-red-400 ring-4 ring-red-400/40 scale-110 shadow-red-400/30'
                  : 'bg-red-600 hover:bg-red-500 shadow-red-500/20'
              }`}
            >
              <PhoneOff size={22} className="text-white" />
            </button>
          </div>

          {/* Code editor toggle / spacer */}
          {codingQuestion ? (
            <button
              onClick={() => setShowCodeEditor(v => !v)}
              className={`w-11 h-11 rounded-full flex items-center justify-center transition-all ${
                showCodeEditor
                  ? 'bg-blue-600 text-white ring-2 ring-blue-500 shadow-lg shadow-blue-500/20'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
              }`}
              title="Code Editor"
            >
              <Code2 size={18} />
            </button>
          ) : (
            <div className="w-11" />
          )}
        </div>

        {/* Right: signal indicator + more menu */}
        <div className="flex items-center gap-2">
          <BarChart2 size={16} className="text-slate-600" />
          <button className="p-2 rounded-xl bg-slate-800 text-slate-500 hover:bg-slate-700 hover:text-slate-300 transition-colors">
            <MoreHorizontal size={18} />
          </button>
        </div>

      </div>

    </div>
  );
}
