'use client';

import CodeEditor from '@/components/code-editor/CodeEditor';

const sampleTestCases = [
  {
    input: '[3, 1, 2]',
    expected: '[1, 2, 3]'
  },
  {
    input: '[5, 2, 8, 1]',
    expected: '[1, 2, 5, 8]'
  },
  {
    input: '[]',
    expected: '[]'
  }
];

const initialCode = `// Problem: Sort an array
// Write a function that takes an array and returns it sorted

function solution(arr) {
  // Your implementation here
  return arr.sort((a, b) => a - b);
}
`;

export default function CodeEditorDemoPage() {
  return (
    <div className="min-h-screen bg-gray-900 py-8">
      <div className="max-w-7xl mx-auto px-4">
        <div className="mb-8 text-white">
          <h1 className="text-3xl font-bold mb-2">Code Editor Demo</h1>
          <p className="text-gray-400">Test the Monaco code editor with test runner</p>
        </div>

        {/* Instructions */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6 text-white">
          <h2 className="text-xl font-semibold mb-4">Instructions</h2>
          <ol className="list-decimal list-inside space-y-2 text-gray-300">
            <li>Write or modify the code in the editor</li>
            <li>Click "Run Tests" to execute your code</li>
            <li>See test results below the editor</li>
            <li>Use "Reset" to restore initial code</li>
            <li>Use "Save" to download your code</li>
          </ol>
        </div>

        {/* Editor Container */}
        <div className="h-[600px]">
          <CodeEditor
            sessionId="demo-session"
            initialCode={initialCode}
            language="javascript"
            testCases={sampleTestCases}
            onCodeSubmit={() => {}}
          />
        </div>

        {/* Test Cases Info */}
        <div className="mt-6 bg-gray-800 rounded-lg p-6 text-white">
          <h2 className="text-xl font-semibold mb-4">Test Cases</h2>
          <div className="space-y-3">
            {sampleTestCases.map((tc, index) => (
              <div key={index} className="bg-gray-700 rounded p-3">
                <p className="text-sm text-gray-400">Test Case {index + 1}</p>
                <div className="mt-2 space-y-1 text-sm">
                  <div className="flex">
                    <span className="text-gray-400 w-24">Input:</span>
                    <code className="text-green-400">{tc.input}</code>
                  </div>
                  <div className="flex">
                    <span className="text-gray-400 w-24">Expected:</span>
                    <code className="text-blue-400">{tc.expected}</code>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}