'use client';

import Link from 'next/link';
import { FileText, BarChart3, Code, Home } from 'lucide-react';

const demos = [
  {
    title: 'CV Upload & Analysis',
    description: 'Test drag-and-drop CV upload and analysis display',
    href: '/demo/cv',
    icon: FileText,
    color: 'bg-blue-500'
  },
  {
    title: 'Performance Dashboard',
    description: 'View performance reports with radar charts and metrics',
    href: '/demo/performance',
    icon: BarChart3,
    color: 'bg-green-500'
  },
  {
    title: 'Code Editor',
    description: 'Monaco editor with test runner and execution',
    href: '/demo/code-editor',
    icon: Code,
    color: 'bg-purple-500'
  }
];

export default function DemoIndexPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">intervyu Component Demos</h1>
              <p className="mt-2 text-sm text-gray-600">
                Test and explore all Phase 4 frontend components
              </p>
            </div>
            <Link
              href="/"
              className="flex items-center space-x-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              <Home className="w-4 h-4" />
              <span>Back to Home</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {demos.map((demo) => {
            const Icon = demo.icon;
            return (
              <Link
                key={demo.href}
                href={demo.href}
                className="group bg-white rounded-lg shadow-md hover:shadow-xl transition-all duration-200 overflow-hidden"
              >
                <div className={`${demo.color} p-6 text-white`}>
                  <Icon className="w-12 h-12 mb-4" />
                  <h2 className="text-2xl font-bold">{demo.title}</h2>
                </div>
                <div className="p-6">
                  <p className="text-gray-600">{demo.description}</p>
                  <div className="mt-4 flex items-center text-blue-600 font-medium group-hover:translate-x-2 transition-transform">
                    <span>View Demo</span>
                    <span className="ml-2">→</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Info Section */}
        <div className="mt-12 bg-white rounded-lg shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">About These Demos</h2>
          <div className="prose text-gray-600">
            <p className="mb-4">
              These demo pages showcase the Phase 4 frontend components built for the intervyu platform:
            </p>
            <ul className="list-disc list-inside space-y-2">
              <li><strong>CV Upload & Analysis:</strong> Drag-and-drop interface with real-time parsing and editable results</li>
              <li><strong>Performance Dashboard:</strong> Comprehensive visualization with radar charts, scores, and PDF export</li>
              <li><strong>Code Editor:</strong> Monaco editor (VS Code) with test runner and execution results</li>
            </ul>
            <p className="mt-4 text-sm text-gray-500">
              Note: These demos use mock data. In production, they connect to the backend API endpoints.
            </p>
          </div>
        </div>

        {/* Tech Stack */}
        <div className="mt-8 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg p-8 text-white">
          <h3 className="text-xl font-bold mb-4">Technology Stack</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="font-semibold">Editor</p>
              <p className="text-blue-100">Monaco Editor</p>
            </div>
            <div>
              <p className="font-semibold">Charts</p>
              <p className="text-blue-100">Recharts</p>
            </div>
            <div>
              <p className="font-semibold">File Upload</p>
              <p className="text-blue-100">React Dropzone</p>
            </div>
            <div>
              <p className="font-semibold">PDF Export</p>
              <p className="text-blue-100">jsPDF</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}