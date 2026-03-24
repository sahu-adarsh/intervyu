'use client';

import { useState, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { Play, RotateCcw, Save, Loader2, CheckCircle, XCircle, ChevronDown } from 'lucide-react';

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
  const [isLanguageDropdownOpen, setIsLanguageDropdownOpen] = useState(false);
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
    if (confirm(`Switch to ${newLanguage}? This will reset your code.`)) {
      setCurrentLanguage(newLanguage);
      setCode(getDefaultCode(newLanguage));
      setTestResults(null);
      onLanguageChange?.(newLanguage);
    }
  };

  const handleEditorDidMount = (editor: any) => {
    editorRef.current = editor;
  };

  const runCode = async () => {
    if (!code.trim()) {
      alert('Please write some code first!');
      return;
    }

    setIsRunning(true);
    setTestResults(null);

    try {
      // Call backend API to execute code
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/code/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
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
      onCodeSubmit?.(code, result, currentLanguage);
    } catch (error) {
      setTestResults({
        success: false,
        testResults: [],
        allTestsPassed: false,
        executionTime: 0,
        error: error instanceof Error ? error.message : 'Execution failed'
      });
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
      <div className="bg-gray-800 px-4 py-3 flex items-center justify-between border-b border-gray-700">
        <div className="flex items-center space-x-2">
          <div className="flex space-x-1">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
          </div>
          <span className="text-gray-300 text-sm ml-4">
            solution.{currentLanguage === 'python' ? 'py' : 'js'}
          </span>
        </div>

        <div className="flex items-center space-x-2">
          {/* Language Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsLanguageDropdownOpen(!isLanguageDropdownOpen)}
              className="px-3 py-1.5 bg-gray-700 text-gray-200 rounded hover:bg-gray-600 transition-colors flex items-center space-x-1.5 text-sm"
            >
              <span>{currentLanguage === 'python' ? 'Python' : 'JavaScript'}</span>
              <ChevronDown className="w-4 h-4" />
            </button>

            {isLanguageDropdownOpen && (
              <div className="absolute top-full mt-1 bg-gray-700 rounded shadow-lg overflow-hidden z-10 min-w-full">
                <button
                  onClick={() => {
                    setIsLanguageDropdownOpen(false);
                    if (currentLanguage !== 'python') {
                      handleLanguageChange('python');
                    }
                  }}
                  className={`w-full px-3 py-2 text-sm text-left transition-colors ${
                    currentLanguage === 'python'
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  Python
                </button>
                <button
                  onClick={() => {
                    setIsLanguageDropdownOpen(false);
                    if (currentLanguage !== 'javascript') {
                      handleLanguageChange('javascript');
                    }
                  }}
                  className={`w-full px-3 py-2 text-sm text-left transition-colors ${
                    currentLanguage === 'javascript'
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  JavaScript
                </button>
              </div>
            )}
          </div>
          <button
            onClick={resetCode}
            className="px-3 py-1.5 bg-gray-700 text-gray-200 rounded hover:bg-gray-600 transition-colors flex items-center space-x-1.5 text-sm"
            title="Reset code"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Reset</span>
          </button>

          <button
            onClick={saveCode}
            className="px-3 py-1.5 bg-gray-700 text-gray-200 rounded hover:bg-gray-600 transition-colors flex items-center space-x-1.5 text-sm"
            title="Save code"
          >
            <Save className="w-4 h-4" />
            <span>Save</span>
          </button>

          <button
            onClick={runCode}
            disabled={isRunning}
            className={`px-4 py-1.5 rounded flex items-center space-x-1.5 text-sm transition-colors ${
              isRunning
                ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                : 'bg-green-600 text-white hover:bg-green-700'
            }`}
          >
            {isRunning ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Running...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                <span>Run Tests</span>
              </>
            )}
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
        <div className="border-t border-gray-200 bg-gray-50 p-4 max-h-64 overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Test Results</h3>
            <div className="flex items-center space-x-2">
              {testResults.allTestsPassed ? (
                <span className="flex items-center space-x-1 text-green-600 font-medium">
                  <CheckCircle className="w-5 h-5" />
                  <span>All Tests Passed!</span>
                </span>
              ) : (
                <span className="flex items-center space-x-1 text-red-600 font-medium">
                  <XCircle className="w-5 h-5" />
                  <span>Some Tests Failed</span>
                </span>
              )}
              <span className="text-sm text-gray-500">
                ({testResults.executionTime.toFixed(3)}s)
              </span>
            </div>
          </div>

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

                  <div className="space-y-1 text-sm">
                    <div className="flex">
                      <span className="text-gray-600 w-20">Input:</span>
                      <code className="text-gray-900 font-mono">{result.input}</code>
                    </div>
                    <div className="flex">
                      <span className="text-gray-600 w-20">Expected:</span>
                      <code className="text-gray-900 font-mono">{result.expected}</code>
                    </div>
                    <div className="flex">
                      <span className="text-gray-600 w-20">Actual:</span>
                      <code className={`font-mono ${result.passed ? 'text-green-700' : 'text-red-700'}`}>
                        {result.actual}
                      </code>
                    </div>
                    {result.error && (
                      <div className="flex">
                        <span className="text-gray-600 w-20">Error:</span>
                        <code className="text-red-700 font-mono">{result.error}</code>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}