'use client';

import { useState, useRef, useEffect } from 'react';
import { flushSync } from 'react-dom';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
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
  const currentAudioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000';
    wsRef.current = new WebSocket(`${wsUrl}/ws/interview/${sessionId}`);

    wsRef.current.onopen = () => {
      console.log('WebSocket connected');
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
          setMessages(prev => [...prev, { role: 'user', content: data.text, timestamp: new Date() }]);
          setCurrentTranscript('');
          setCurrentResponse('');
          setError('');
          setIsProcessing(true);
        } else if (data.type === 'llm_chunk') {
          flushSync(() => {
            setCurrentResponse(prev => prev + data.text);
            setIsProcessing(true);
          });
        } else if (data.type === 'assistant_complete') {
          setMessages(prev => [...prev, { role: 'assistant', content: data.text, timestamp: new Date() }]);
          setCurrentResponse('');
          setIsProcessing(false);
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
      if (streamRef.current) streamRef.current.getTracks().forEach(track => track.stop());
      if (audioContextRef.current) audioContextRef.current.close();
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

  const initializeInterview = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: false  // Disabled: browser DSP distorts speech in ways Whisper misreads
        }
      });
      streamRef.current = stream;

      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      analyserRef.current = analyser;

      const mimeType = MediaRecorder.isTypeSupported('audio/wav') ? 'audio/wav' : 'audio/webm';
      const mediaRecorder = new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 64000 });
      mediaRecorderRef.current = mediaRecorder;

      let audioChunks: Blob[] = [];
      let isSpeaking = false;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data);
          if (wsRef.current?.readyState === WebSocket.OPEN && isSpeaking) {
            const chunk = new Blob([event.data], { type: mimeType });
            wsRef.current.send(chunk);
          }
        }
      };

      mediaRecorder.onstop = () => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'speech_end' }));
        }
        audioChunks = [];
        setIsRecording(false);
      };

      const checkSilence = () => {
        if (!analyserRef.current) return;
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;

        const SPEECH_THRESHOLD = 22;
        const SILENCE_DURATION = 1200;

        if (average > SPEECH_THRESHOLD) {
          if (!isSpeaking) {
            isSpeaking = true;
            setIsRecording(true);
            stopAudioPlayback();
            if (wsRef.current?.readyState === WebSocket.OPEN) {
              wsRef.current.send(JSON.stringify({ type: 'speech_start' }));
            }
            mediaRecorder.start(500);
          }
          if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
          silenceTimeoutRef.current = setTimeout(() => {
            if (mediaRecorder.state === 'recording') {
              mediaRecorder.stop();
              isSpeaking = false;
            }
          }, SILENCE_DURATION);
        }
      };

      const intervalId = setInterval(checkSilence, 100);
      (mediaRecorder as any).intervalId = intervalId;

      setIsActive(true);
      setError('');

      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'interview_ready' }));
      }
    } catch (err) {
      setError('Microphone access denied. Please allow microphone access to start the interview.');
      console.error('Microphone initialization error:', err);
    }
  };

  const stopAudioPlayback = () => {
    if (currentAudioSourceRef.current) {
      try {
        currentAudioSourceRef.current.stop();
        currentAudioSourceRef.current.disconnect();
      } catch (err) {
        console.log('Error stopping audio source:', err);
      }
      currentAudioSourceRef.current = null;
    }
    audioQueueRef.current = [];
    isPlayingRef.current = false;
  };

  const playNextAudioChunk = async () => {
    if (audioQueueRef.current.length === 0) {
      isPlayingRef.current = false;
      currentAudioSourceRef.current = null;
      return;
    }

    isPlayingRef.current = true;
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
      } catch (err) {
        console.error('Failed to end interview:', err);
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
      <header className="flex-shrink-0 bg-slate-900 border-b border-slate-800 px-6 py-3">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <div>
              <h1 className="text-sm font-semibold text-slate-100 tracking-wide">intervyu.io</h1>
              <p className="text-xs text-slate-400">{candidateName} · {interviewType}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="font-mono text-sm text-slate-300 bg-slate-800 px-3 py-1 rounded-md">
              {formatTime(timeElapsed)}
            </span>
            <button
              onClick={handleEndInterview}
              className="px-4 py-1.5 text-sm bg-red-600 hover:bg-red-500 text-white rounded-md transition-colors font-medium"
            >
              End Session
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left — Transcript */}
        <div className="w-1/2 flex flex-col border-r border-slate-800">
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
        <div className="w-1/2 flex flex-col bg-slate-900 overflow-hidden">

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

                {error && (
                  <div className="w-full max-w-sm bg-red-950/60 border border-red-800 rounded-xl px-5 py-4 space-y-3">
                    <p className="text-sm font-semibold text-red-400">Error</p>
                    <p className="text-sm text-red-300">{error}</p>
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