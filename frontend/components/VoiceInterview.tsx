'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';

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
    // Connect to WebSocket
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000';
    wsRef.current = new WebSocket(`${wsUrl}/ws/interview/${sessionId}`);

    wsRef.current.onopen = () => {
      console.log('WebSocket connected');
      // Auto-start interview when WebSocket is connected
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
          console.log(`[${new Date().toLocaleTimeString()}] Transcript received:`, data.text);
          setMessages(prev => [...prev, { role: 'user', content: data.text, timestamp: new Date() }]);
          setCurrentTranscript('');
          setCurrentResponse('');
          setError('');
          setIsProcessing(true);
        } else if (data.type === 'llm_chunk') {
          setCurrentResponse(prev => prev + data.text);
          setIsProcessing(true);
        } else if (data.type === 'assistant_complete') {
          setMessages(prev => [...prev, { role: 'assistant', content: data.text, timestamp: new Date() }]);
          setCurrentResponse('');
          setIsProcessing(false);
        } else if (data.type === 'coding_question') {
          // Coding question detected - show code editor
          console.log('Coding question detected:', data);
          setShowCodeEditor(true);
          setCodingQuestion({
            question: data.question || data.text || '',
            language: data.language || 'python',
            testCases: data.testCases || [],
            initialCode: data.initialCode || ''
          });
        } else if (data.type === 'error') {
          setError(data.message);
          setIsProcessing(false);
        }
      }
    };

    return () => {
      wsRef.current?.close();
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      // Clean up media resources
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [sessionId]);

  useEffect(() => {
    if (isActive) {
      timerRef.current = setInterval(() => {
        setTimeElapsed(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isActive]);

  const initializeInterview = async () => {
    try {
      // Request microphone permissions and set up audio
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true
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
      const mediaRecorder = new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 16000 });
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

        // Don't pick up microphone while interviewer audio is playing —
        // avoids background noise / speaker bleed triggering recording
        if (isPlayingRef.current) {
          if (isSpeaking && mediaRecorder.state === 'recording') {
            mediaRecorder.stop();
            isSpeaking = false;
          }
          if (silenceTimeoutRef.current) {
            clearTimeout(silenceTimeoutRef.current);
            silenceTimeoutRef.current = null;
          }
          return;
        }

        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;

        const SPEECH_THRESHOLD = 22;   // filters ambient noise
        const SILENCE_DURATION = 800;  // fast cut-off to reduce transcript lag

        if (average > SPEECH_THRESHOLD) {
          if (!isSpeaking) {
            isSpeaking = true;
            setIsRecording(true);

            // Stop any currently playing audio when user starts speaking
            stopAudioPlayback();

            if (wsRef.current?.readyState === WebSocket.OPEN) {
              wsRef.current.send(JSON.stringify({ type: 'speech_start' }));
            }

            mediaRecorder.start(500);
          }

          if (silenceTimeoutRef.current) {
            clearTimeout(silenceTimeoutRef.current);
          }
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

      // Signal to backend that client is ready for the interview to start
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'interview_ready' }));
      }
    } catch (err) {
      setError('Microphone access denied. Please allow microphone access to start the interview.');
      console.error('Microphone initialization error:', err);
    }
  };

  const stopAudioPlayback = () => {
    // Stop currently playing audio
    if (currentAudioSourceRef.current) {
      try {
        currentAudioSourceRef.current.stop();
        currentAudioSourceRef.current.disconnect();
      } catch (err) {
        // Audio source may already be stopped
        console.log('Error stopping audio source:', err);
      }
      currentAudioSourceRef.current = null;
    }

    // Clear the audio queue
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

      if (context.state === 'suspended') {
        await context.resume();
      }

      const buffer = await context.decodeAudioData(audioBuffer);
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(context.destination);

      // Store reference to current audio source
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

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200 px-6 py-4">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Interview Session</h1>
            <p className="text-sm text-gray-600">
              {candidateName} • {interviewType}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-lg font-mono text-gray-700">
              {formatTime(timeElapsed)}
            </div>
            <button
              onClick={handleEndInterview}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              End Session
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Transcript Panel (Left) */}
        <div className="w-1/2 flex flex-col border-r border-gray-300 bg-white">
          <div className="p-4 bg-gray-100 border-b border-gray-300">
            <h2 className="text-lg font-semibold text-gray-800">Conversation Transcript</h2>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`p-3 rounded-lg ${
                  msg.role === 'user'
                    ? 'bg-blue-100 ml-8 text-gray-900'
                    : 'bg-gray-100 mr-8 text-gray-900'
                }`}
              >
                <div className="flex justify-between items-center mb-1">
                  <p className="font-semibold text-sm">
                    {msg.role === 'user' ? 'You' : 'Interviewer'}
                  </p>
                  <p className="text-xs text-gray-500">
                    {msg.timestamp.toLocaleTimeString()}
                  </p>
                </div>
                <p>{msg.content}</p>
              </div>
            ))}

            {currentTranscript && (
              <div className="p-3 rounded-lg bg-blue-50 ml-8 text-gray-900 border-2 border-blue-300 border-dashed">
                <p className="font-semibold text-sm mb-1 text-blue-600">You (transcribing...)</p>
                <p className="italic opacity-80">{currentTranscript}</p>
              </div>
            )}

            {currentResponse && (
              <div className="p-3 rounded-lg bg-gray-100 mr-8 text-gray-900">
                <p className="font-semibold text-sm mb-1">Interviewer</p>
                <p>{currentResponse}</p>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Right Panel - Voice Control or Code Editor */}
        <div className="w-1/2 flex flex-col bg-white">
          {showCodeEditor && codingQuestion ? (
            // Code Editor Panel
            <div className="flex flex-col h-full">
              <div className="p-4 bg-gray-800 border-b border-gray-700 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">Code Editor</h2>
                <button
                  onClick={() => setShowCodeEditor(false)}
                  className="px-3 py-1 text-sm bg-gray-700 text-gray-200 rounded hover:bg-gray-600 transition-colors"
                >
                  Hide Editor
                </button>
              </div>

              {/* Code Editor Component */}
              <div className="flex-1 min-h-0">
                <CodeEditor
                  sessionId={sessionId}
                  initialCode={codingQuestion.initialCode}
                  language={codingQuestion.language}
                  testCases={codingQuestion.testCases}
                  onCodeSubmit={(code, result, language) => {
                    console.log('Code submitted:', code, result, language);

                    // Send code submission to chatbot via WebSocket
                    if (wsRef.current?.readyState === WebSocket.OPEN) {
                      const submissionMessage = {
                        type: 'code_submission',
                        code,
                        language,
                        allTestsPassed: result.allTestsPassed,
                        testResults: result.testResults,
                        executionTime: result.executionTime,
                        error: result.error
                      };

                      wsRef.current.send(JSON.stringify(submissionMessage));
                      console.log('Code submission sent to chatbot:', submissionMessage);
                    }
                  }}
                />
              </div>
            </div>
          ) : (
            // Voice Control Panel
            <div className="flex flex-col items-center justify-center p-8 bg-gradient-to-br from-blue-50 to-indigo-50 h-full">
              <h1 className="text-3xl font-bold mb-8 text-gray-900">Voice Interview</h1>

              {/* Status Indicator */}
              <div className={`w-48 h-48 rounded-full flex items-center justify-center transition-all shadow-lg ${
                isRecording
                  ? 'bg-green-500 animate-pulse ring-4 ring-green-400'
                  : isProcessing
                  ? 'bg-blue-500 animate-pulse'
                  : 'bg-gray-400'
              }`}>
                <div className="text-center text-white">
                  <div className="text-6xl mb-2">
                    {isRecording ? '🎙️' : isProcessing ? '🤖' : '👤'}
                  </div>
                  <div className="text-sm font-semibold">
                    {isRecording ? 'You are speaking' : isProcessing ? 'Interviewer responding' : 'Ready to listen'}
                  </div>
                </div>
              </div>

              {isActive && (
                <div className="mt-6 text-center space-y-2">
                  <p className="text-lg font-medium text-gray-700">
                    {isRecording ? '🟢 Listening to your response...' : isProcessing ? '💭 Interviewer is thinking...' : '⚪ Speak when you\'re ready'}
                  </p>
                </div>
              )}

              {!isActive && !error && (
                <div className="mt-6 text-center space-y-2">
                  <p className="text-lg font-medium text-blue-600 animate-pulse">
                    🔄 Initializing interview...
                  </p>
                  <p className="text-sm text-gray-600">
                    Please allow microphone access when prompted
                  </p>
                </div>
              )}

              {error && (
                <div className="mt-8 w-full max-w-md p-4 bg-red-100 border border-red-400 rounded">
                  <p className="font-semibold text-red-700">Error:</p>
                  <p className="text-red-600">{error}</p>
                  <button
                    onClick={initializeInterview}
                    className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors w-full"
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
  );
}
