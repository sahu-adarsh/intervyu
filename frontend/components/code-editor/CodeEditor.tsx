'use client';

import { useState, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { Play, RotateCcw, Save, Loader2, CheckCircle, XCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { authFetch } from '@/lib/api';

interface TestCase {
  input: string;
  expected: string;
  passed?: boolean;
  actual?: string;
  error?: string;
}

interface TestResult {
  success: boolean;
  testResults: Array<{
    testCase: number;
    passed: boolean;
    input: string;
    expected: string;
    actual: string;
    error?: string;
  }>;
  allTestsPassed: boolean;
  executionTime: number;
  output?: string;
  error?: string;
}

interface CodeEditorProps {
  sessionId: string;
  initialCode?: string;
  language?: string;
  testCases?: TestCase[];
  onCodeSubmit?: (code: string, result: TestResult, language: string) => void;
  onLanguageChange?: (language: string) => void;
}

export default function CodeEditor({
  sessionId,
  initialCode = '# Write your code here\ndef solution(arr):\n    # Your implementation\n    return arr\n',
  language = 'python',
  testCases = [],
  onCodeSubmit,
  onLanguageChange
}: CodeEditorProps) {
  const [code, setCode] = useState(initialCode);
  const [currentLanguage, setCurrentLanguage] = useState(language);
  const [isRunning, setIsRunning] = useState(false);
  const [testResults, setTestResults] = useState<TestResult | null>(null);
  const [testResultsExpanded, setTestResultsExpanded] = useState(true);
  const [isLanguageDropdownOpen, setIsLanguageDropdownOpen] = useState(false);
  const [testResultsHeight, setTestResultsHeight] = useState(220);
  const editorRef = useRef<any>(null);

  // Update code template when language changes
  const getDefaultCode = (lang: string) => {
    if (lang === 'python') {
      return '# Write your code here\ndef solution(arr):\n    # Your implementation\n    return arr\n';
    } else {
      return '// Write your code here\nfunction solution(arr) {\n  // Your implementation\n  return arr;\n}\n';
    }
  };

  const handleLanguageChange = (newLanguage: string) => {
    setCurrentLanguage(newLanguage);
    setCode(getDefaultCode(newLanguage));
    setTestResults(null);
    onLanguageChange?.(newLanguage);
  };

  const handleEditorDidMount = (editor: any) => {
    editorRef.current = editor;
  };

  const runCode = async () => {
    if (!code.trim()) return;

    setIsRunning(true);
    setTestResults(null);

    try {
      // Call backend API to execute code
      const response = await authFetch('/api/code/execute', {
        method: 'POST',
        body: JSON.stringify({
          sessionId,
          code,
          language: currentLanguage,
          testCases: testCases.map(tc => ({
            input: tc.input,
            expected: tc.expected
          })),
          functionName: 'solution'
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to execute code');
      }

      const result: TestResult = await response.json();
      setTestResults(result);
      setTestResultsExpanded(true);
      onCodeSubmit?.(code, result, currentLanguage);
    } catch (error) {
      const errorResult: TestResult = {
        success: false,
        testResults: [],
        allTestsPassed: false,
        executionTime: 0,
        error: error instanceof Error ? error.message : 'Execution failed'
      };
      setTestResults(errorResult);
      setTestResultsExpanded(true);
      onCodeSubmit?.(code, errorResult, currentLanguage);
    } finally {
      setIsRunning(false);
    }
  };

  const resetCode = () => {
    setCode(initialCode);
    setTestResults(null);
  };

  const saveCode = () => {
    // In production, save to backend
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `solution.${language === 'python' ? 'py' : 'js'}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-full flex flex-col bg-white rounded-lg shadow-lg overflow-hidden">
      {/* Toolbar */}
      <div className="bg-gray-800 px-3 sm:px-4 py-2.5 flex items-center justify-between border-b border-gray-700 gap-2">
        <div className="flex items-center space-x-2 min-w-0">
          <div className="flex space-x-1 flex-shrink-0">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div>
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500"></div>
            <div className="w-2.5 h-2.5 rounded-full bg-green-500"></div>
          </div>
          <span className="text-gray-300 text-xs sm:text-sm truncate">
            solution.{currentLanguage === 'python' ? 'py' : 'js'}
          </span>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Language Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsLanguageDropdownOpen(!isLanguageDropdownOpen)}
              className="px-2 sm:px-3 py-1.5 bg-gray-700 text-gray-200 rounded hover:bg-gray-600 transition-colors flex items-center gap-1 text-xs sm:text-sm"
            >
              <span>{currentLanguage === 'python' ? 'Python' : 'JavaScript'}</span>
              <ChevronDown className="w-3 h-3 sm:w-4 sm:h-4" />
            </button>

            {isLanguageDropdownOpen && (
              <div className="absolute top-full right-0 mt-1 bg-gray-700 rounded shadow-lg overflow-hidden z-10 min-w-[100px]">
                <button
                  onClick={() => { setIsLanguageDropdownOpen(false); if (currentLanguage !== 'python') handleLanguageChange('python'); }}
                  className={`w-full px-3 py-2 text-sm text-left transition-colors ${currentLanguage === 'python' ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-600'}`}
                >Python</button>
                <button
                  onClick={() => { setIsLanguageDropdownOpen(false); if (currentLanguage !== 'javascript') handleLanguageChange('javascript'); }}
                  className={`w-full px-3 py-2 text-sm text-left transition-colors ${currentLanguage === 'javascript' ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-600'}`}
                >JavaScript</button>
              </div>
            )}
          </div>

          <button onClick={resetCode} className="p-1.5 bg-gray-700 text-gray-200 rounded hover:bg-gray-600 transition-colors" title="Reset code">
            <RotateCcw className="w-4 h-4" />
          </button>

          <button onClick={saveCode} className="p-1.5 bg-gray-700 text-gray-200 rounded hover:bg-gray-600 transition-colors" title="Save code">
            <Save className="w-4 h-4" />
          </button>

          <button
            onClick={runCode}
            disabled={isRunning || !code.trim()}
            className={`px-2.5 sm:px-3 py-1.5 rounded flex items-center gap-1.5 text-xs sm:text-sm transition-colors ${
              isRunning || !code.trim() ? 'bg-gray-600 text-gray-400 cursor-not-allowed' : 'bg-green-600 text-white hover:bg-green-700'
            }`}
          >
            {isRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            <span className="hidden sm:inline">{isRunning ? 'Running...' : 'Run Tests'}</span>
            <span className="sm:hidden">{isRunning ? '...' : 'Run'}</span>
          </button>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 min-h-0">
        <Editor
          key={currentLanguage}
          height="100%"
          language={currentLanguage}
          value={code}
          onChange={(value) => setCode(value || '')}
          onMount={handleEditorDidMount}
          theme="vs-dark"
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            lineNumbers: 'on',
            rulers: [80],
            wordWrap: 'on',
            automaticLayout: true,
            scrollBeyondLastLine: false,
            padding: { top: 16, bottom: 16 }
          }}
        />
      </div>

      {/* Test Results */}
      {testResults && (
        <div className="border-t border-gray-200 bg-gray-50 flex flex-col" style={{ height: testResultsExpanded ? testResultsHeight : 'auto' }}>
          {/* Drag handle */}
          {testResultsExpanded && (
            <div
              className="h-1.5 w-full bg-gray-200 hover:bg-blue-400 cursor-row-resize transition-colors flex-shrink-0"
              onMouseDown={(e) => {
                e.preventDefault();
                const startY = e.clientY;
                const startH = testResultsHeight;
                const onMove = (me: MouseEvent) => setTestResultsHeight(Math.max(80, Math.min(560, startH - (me.clientY - startY))));
                const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
                window.addEventListener('mousemove', onMove);
                window.addEventListener('mouseup', onUp);
              }}
            />
          )}
          <button
            onClick={() => setTestResultsExpanded(!testResultsExpanded)}
            className="w-full px-3 sm:px-4 py-2.5 flex items-center justify-between hover:bg-gray-100 transition-colors flex-shrink-0"
          >
            <h3 className="text-base sm:text-lg font-semibold text-gray-900">Test Results</h3>
            <div className="flex items-center gap-2">
              {testResults.allTestsPassed ? (
                <span className="flex items-center gap-1 text-green-600 font-medium text-sm">
                  <CheckCircle className="w-4 h-4" />
                  <span>All Passed!</span>
                </span>
              ) : (
                <span className="flex items-center gap-1 text-red-600 font-medium text-sm">
                  <XCircle className="w-4 h-4" />
                  <span>Some Failed</span>
                </span>
              )}
              <span className="text-xs text-gray-500">({testResults.executionTime.toFixed(3)}s)</span>
              {testResultsExpanded ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
            </div>
          </button>

          {testResultsExpanded && <div className="px-3 sm:px-4 pb-3 sm:pb-4 flex-1 overflow-y-auto min-h-0">
          {testResults.error ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-red-800 text-sm font-mono">{testResults.error}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {testResults.testResults.map((result, index) => (
                <div
                  key={index}
                  className={`rounded-lg p-3 ${
                    result.passed ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-gray-900">Test Case {result.testCase}</span>
                    {result.passed ? (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-600" />
                    )}
                  </div>

                  <div className="space-y-1 text-xs sm:text-sm">
                    <div className="flex flex-col sm:flex-row sm:gap-2">
                      <span className="text-gray-500 font-medium sm:w-16 sm:flex-shrink-0">Input:</span>
                      <code className="text-gray-900 font-mono break-all">{result.input}</code>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:gap-2">
                      <span className="text-gray-500 font-medium sm:w-16 sm:flex-shrink-0">Expected:</span>
                      <code className="text-gray-900 font-mono break-all">{result.expected}</code>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:gap-2">
                      <span className="text-gray-500 font-medium sm:w-16 sm:flex-shrink-0">Actual:</span>
                      <code className={`font-mono break-all ${result.passed ? 'text-green-700' : 'text-red-700'}`}>
                        {result.actual}
                      </code>
                    </div>
                    {result.error && (
                      <div className="flex flex-col sm:flex-row sm:gap-2">
                        <span className="text-gray-500 font-medium sm:w-16 sm:flex-shrink-0">Error:</span>
                        <code className="text-red-700 font-mono break-all">{result.error}</code>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          </div>}
        </div>
      )}
    </div>
  );
}