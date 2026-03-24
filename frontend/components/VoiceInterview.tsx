'use client';

// Suppress ONNX Runtime C++ WASM layer graph-optimizer warnings (harmless, dev-only noise)
if (typeof window !== 'undefined') {
  const _warn = console.warn.bind(console);
  const _error = console.error.bind(console);
  const isONNX = (s: unknown) => typeof s === 'string' && s.includes('onnxruntime');
  console.warn = (...args: unknown[]) => { if (isONNX(args[0])) return; _warn(...args); };
  console.error = (...args: unknown[]) => { if (isONNX(args[0])) return; _error(...args); };
}

import { useState, useRef, useEffect } from 'react';

import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useMicVAD } from '@ricky0123/vad-react';
import { Code2, ChevronDown, ChevronUp, Mic, Bot, User } from 'lucide-react';

// Dynamically import CodeEditor to avoid SSR issues
const CodeEditor = dynamic(() => import('./code-editor/CodeEditor'), { ssr: false });

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
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [showCodeEditor, setShowCodeEditor] = useState(false);
  const [problemStatementCollapsed, setProblemStatementCollapsed] = useState(false);
  const [currentLanguage, setCurrentLanguage] = useState('python');
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
  const wordQueueRef = useRef<string[]>([]);         // pending words to reveal
  const wordRevealRef = useRef<NodeJS.Timeout | null>(null); // interval dripping words onto screen

  // Silero VAD — neural speech detection via ONNX model in a Web Worker
  const vad = useMicVAD({
    startOnLoad: true,   // Must be true — avoids React Strict Mode destroy() crash on unstarted VAD
    model: 'legacy',     // legacy has ~20 ONNX warnings vs v5's 572; all suppressed by console filter above
    baseAssetPath: '/',
    onnxWASMBasePath: '/',
    ortConfig: (ort) => {
      ort.env.logLevel = 'error';    // Suppress ONNX Runtime info/warning logs
      ort.env.wasm.numThreads = 1;   // Avoid SharedArrayBuffer requirement (no COOP/COEP headers needed)
    },
    getStream: async () => navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: false } }),
    onSpeechStart: () => {
      // Ignore if TTS is playing — mic echo would otherwise interrupt Neerja mid-sentence
      if (isTTSPlayingRef.current) return;
      stopAudioPlayback();
      setIsRecording(true);
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'speech_start' }));
      }
    },
    onSpeechEnd: (audio: Float32Array) => {
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
        audioQueueRef.current.push(audioBuffer);
        if (!isPlayingRef.current) {
          playNextAudioChunk();
        }
      } else {
        const data = JSON.parse(event.data);

        if (data.type === 'transcript' && data.role === 'user') {
          // Flush any pending word reveals immediately
          if (wordRevealRef.current) { clearInterval(wordRevealRef.current); wordRevealRef.current = null; }
          wordQueueRef.current = [];
          setMessages(prev => [...prev, { role: 'user', content: data.text, timestamp: new Date() }]);
          setCurrentTranscript('');
          setCurrentResponse('');
          setError('');
          setIsProcessing(true);
        } else if (data.type === 'llm_chunk') {
          // Queue words for gradual reveal (~150ms/word) to match TTS speech pace
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
            }, 150);
          }
        } else if (data.type === 'assistant_complete') {
          // Flush remaining queued words immediately, then move to message list
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
          setCodingQuestion({
            question: data.question || data.text || '',
            language: lang,
            testCases: data.testCases || [],
            initialCode: data.initialCode || ''
          });
          setCurrentLanguage(lang);
          setShowCodeEditor(true);
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
  };

  const playNextAudioChunk = async () => {
    if (audioQueueRef.current.length === 0) {
      isPlayingRef.current = false;
      isTTSPlayingRef.current = false;
      currentAudioSourceRef.current = null;
      return;
    }

    isPlayingRef.current = true;
    isTTSPlayingRef.current = true;
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
      source.start();
    } catch (err) {
      setError('Failed to play audio: ' + (err as Error).message);
      currentAudioSourceRef.current = null;
      playNextAudioChunk();
    }
  };

  const handleEndInterview = async () => {
    if (confirm('Are you sure you want to end this interview?')) {
      try {
        await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/interviews/${sessionId}/end`, {
          method: 'POST',
        });
        router.push('/');
      } catch {
        router.push('/');
      }
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

  const statusConfig = isRecording
    ? { label: 'Listening', sublabel: 'Speak your answer...', ringColor: 'ring-emerald-400', bgColor: 'bg-emerald-500', icon: <Mic size={28} className="text-white" /> }
    : isProcessing
    ? { label: 'Processing', sublabel: 'Interviewer is responding...', ringColor: 'ring-blue-400', bgColor: 'bg-blue-500', icon: <Bot size={28} className="text-white" /> }
    : { label: 'Ready', sublabel: 'Speak when ready', ringColor: 'ring-slate-300', bgColor: 'bg-slate-400', icon: <User size={28} className="text-white" /> };

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100">

      {/* Header */}
      <header className="flex-shrink-0 bg-slate-900 border-b border-slate-800 px-4 sm:px-6 py-3">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
            <div className="min-w-0">
              <h1 className="text-sm font-semibold text-slate-100 tracking-wide">intervyu.io</h1>
              <p className="text-xs text-slate-400 truncate">{candidateName} · {interviewType}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
            <span className="font-mono text-sm text-slate-300 bg-slate-800 px-3 py-1 rounded-md">
              {formatTime(timeElapsed)}
            </span>
            <button
              onClick={handleEndInterview}
              className="px-3 sm:px-4 py-1.5 text-sm bg-red-600 hover:bg-red-500 text-white rounded-md transition-colors font-medium whitespace-nowrap"
            >
              <span className="hidden sm:inline">End Session</span>
              <span className="sm:hidden">End</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden flex-col md:flex-row">

        {/* Left — Transcript */}
        <div className="w-full md:w-1/2 flex flex-col border-b md:border-b-0 md:border-r border-slate-800 h-56 sm:h-64 md:h-auto flex-shrink-0 md:flex-shrink">
          <div className="flex-shrink-0 px-5 py-3 border-b border-slate-800 bg-slate-900">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Transcript</h2>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex flex-col gap-1 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                <span className="text-xs text-slate-500 px-1">
                  {msg.role === 'user' ? 'You' : 'Neerja'} · {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                <div className={`max-w-[85%] px-4 py-2.5 rounded-xl text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white rounded-br-sm'
                    : 'bg-slate-800 text-slate-100 rounded-bl-sm'
                }`}>
                  {msg.content}
                </div>
              </div>
            ))}

            {currentTranscript && (
              <div className="flex flex-col gap-1 items-end">
                <span className="text-xs text-slate-500 px-1">You · transcribing...</span>
                <div className="max-w-[85%] px-4 py-2.5 rounded-xl rounded-br-sm text-sm bg-blue-600/40 text-blue-200 border border-blue-500/30 italic">
                  {currentTranscript}
                </div>
              </div>
            )}

            {currentResponse && (
              <div className="flex flex-col gap-1 items-start">
                <span className="text-xs text-slate-500 px-1">Neerja · responding...</span>
                <div className="max-w-[85%] px-4 py-2.5 rounded-xl rounded-bl-sm text-sm bg-slate-800 text-slate-100 border border-slate-700/50">
                  {currentResponse}
                  <span className="inline-block w-1.5 h-3.5 bg-blue-400 ml-1 animate-pulse rounded-sm align-middle" />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Right — Voice + Problem Statement + Editor */}
        <div className="w-full md:w-1/2 flex flex-col bg-slate-900 overflow-hidden flex-1">

          {/* Problem Statement — persistent, collapsible */}
          {codingQuestion && (
            <div className="flex-shrink-0 border-b border-slate-800">
              <button
                onClick={() => setProblemStatementCollapsed(prev => !prev)}
                className="w-full flex items-center justify-between px-5 py-3 bg-slate-800/60 hover:bg-slate-800 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Code2 size={14} className="text-blue-400" />
                  <span className="text-xs font-semibold text-slate-300 uppercase tracking-widest">Problem Statement</span>
                  <span className="text-xs text-slate-500 bg-slate-700 px-2 py-0.5 rounded-full font-mono">
                    {currentLanguage}
                  </span>
                </div>
                {problemStatementCollapsed
                  ? <ChevronDown size={14} className="text-slate-400" />
                  : <ChevronUp size={14} className="text-slate-400" />
                }
              </button>

              {!problemStatementCollapsed && (
                <div className="px-5 py-4 bg-slate-950/40 max-h-52 overflow-y-auto">
                  <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
                    {codingQuestion.question}
                  </p>
                  {codingQuestion.testCases && codingQuestion.testCases.length > 0 && (
                    <div className="mt-4 space-y-2">
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Test Cases</p>
                      {codingQuestion.testCases.map((tc, i) => (
                        <div key={i} className="bg-slate-800 rounded-lg px-3 py-2 font-mono text-xs text-slate-300">
                          <span className="text-slate-500">Input: </span>{tc.input}
                          <span className="mx-2 text-slate-600">→</span>
                          <span className="text-slate-500">Expected: </span>{tc.expected}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Editor toggle bar — only shown when a coding question exists */}
          {codingQuestion && (
            <div className="flex-shrink-0 flex items-center justify-between px-5 py-2.5 bg-slate-900 border-b border-slate-800">
              <span className="text-xs text-slate-500">
                {showCodeEditor ? 'Code Editor is open' : 'Code Editor is hidden'}
              </span>
              <button
                onClick={() => setShowCodeEditor(prev => !prev)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  showCodeEditor
                    ? 'bg-slate-700 hover:bg-slate-600 text-slate-200'
                    : 'bg-blue-600 hover:bg-blue-500 text-white'
                }`}
              >
                <Code2 size={12} />
                {showCodeEditor ? 'Hide Editor' : 'Open Editor'}
              </button>
            </div>
          )}

          {/* Bottom area — Code Editor (always mounted to preserve state) + Voice Status */}
          <div className="flex-1 min-h-0 relative">
            {/* Code Editor — always mounted, hidden via CSS when not active */}
            <div className={`absolute inset-0 ${showCodeEditor && codingQuestion ? '' : 'hidden'}`}>
              {codingQuestion && (
                <CodeEditor
                  sessionId={sessionId}
                  initialCode={codingQuestion.initialCode}
                  language={codingQuestion.language}
                  testCases={codingQuestion.testCases}
                  onLanguageChange={setCurrentLanguage}
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
              )}
            </div>

            {/* Voice Status Panel — shown when editor is hidden */}
            {(!showCodeEditor || !codingQuestion) && (
              <div className="flex flex-col items-center justify-center h-full gap-8 px-8">
                <div className="relative">
                  <div className={`w-36 h-36 rounded-full flex items-center justify-center transition-all duration-300 ${statusConfig.bgColor} ring-4 ${statusConfig.ringColor} ${isRecording || isProcessing ? 'animate-pulse' : ''}`}>
                    {statusConfig.icon}
                  </div>
                  {isRecording && (
                    <span className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-400 rounded-full border-2 border-slate-900 animate-ping" />
                  )}
                </div>

                <div className="text-center space-y-1">
                  <p className="text-base font-semibold text-slate-200">{statusConfig.label}</p>
                  <p className="text-sm text-slate-500">{statusConfig.sublabel}</p>
                </div>

                {!isActive && !error && (
                  <p className="text-sm text-blue-400 animate-pulse">Initializing — please allow microphone access</p>
                )}

                {(error || vad.errored) && (
                  <div className="w-full max-w-sm bg-red-950/60 border border-red-800 rounded-xl px-5 py-4 space-y-3">
                    <p className="text-sm font-semibold text-red-400">Error</p>
                    <p className="text-sm text-red-300">{error || String(vad.errored)}</p>
                    <button
                      onClick={initializeInterview}
                      className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      Retry
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
