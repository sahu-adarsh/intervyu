'use client';

import { useState } from 'react';
import PerformanceDashboard from '@/components/performance/PerformanceDashboard';
import InterviewHistory from '@/components/performance/InterviewHistory';
import { exportToPDF } from '@/components/common/PDFExport';

// Mock performance report
const mockReport = {
  sessionId: "session-123",
  candidateName: "John Doe",
  interviewType: "Google India SDE",
  timestamp: new Date().toISOString(),
  duration: 1800,
  overallScore: 7.8,
  scores: {
    technicalKnowledge: 8.5,
    problemSolving: 7.5,
    communication: 8.0,
    codeQuality: 7.2,
    culturalFit: 7.8
  },
  strengths: [
    "Strong technical knowledge and understanding of concepts",
    "Excellent problem-solving approach and logical thinking",
    "Clear and effective communication skills"
  ],
  improvements: [
    "Consider edge cases more thoroughly",
    "Optimize time complexity in solutions",
    "Practice more system design problems"
  ],
  recommendation: "HIRE",
  detailedFeedback: `Interview Type: Google India SDE

Performance Summary:
The candidate demonstrated excellent technical knowledge, strong problem-solving abilities, and good communication skills.

Key Strengths:
1. Strong technical knowledge and understanding of concepts
2. Excellent problem-solving approach and logical thinking
3. Clear and effective communication skills

Areas for Improvement:
1. Consider edge cases more thoroughly
2. Optimize time complexity in solutions
3. Practice more system design problems

Next Steps:
Continue practicing interview questions, focus on the improvement areas mentioned above, and maintain your strengths.`
};

// Mock interview history
const mockSessions = [
  {
    sessionId: "session-123",
    interviewType: "Google India SDE",
    candidateName: "John Doe",
    createdAt: new Date().toISOString(),
    status: "completed" as const,
    overallScore: 7.8,
    duration: 1800,
    recommendation: "HIRE"
  },
  {
    sessionId: "session-122",
    interviewType: "AWS Solutions Architect",
    candidateName: "John Doe",
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    status: "completed" as const,
    overallScore: 8.2,
    duration: 2100,
    recommendation: "STRONG_HIRE"
  },
  {
    sessionId: "session-121",
    interviewType: "Microsoft SDE",
    candidateName: "John Doe",
    createdAt: new Date(Date.now() - 172800000).toISOString(),
    status: "completed" as const,
    overallScore: 6.5,
    duration: 1600,
    recommendation: "BORDERLINE"
  }
];

export default function PerformanceDemoPage() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'history'>('dashboard');

  const handleExportPDF = async () => {
    try {
      await exportToPDF('performance-dashboard', {
        filename: 'performance-report.pdf',
        quality: 0.95,
        format: 'a4'
      });
      alert('PDF exported successfully!');
    } catch (error) {
      alert('Error exporting PDF: ' + (error as Error).message);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-xl sm:text-3xl font-bold text-gray-900 mb-2">Performance Dashboard Demo</h1>
          <p className="text-gray-600">Test the performance visualization and history components</p>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="flex border-b">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`px-4 sm:px-6 py-3 text-sm sm:text-base font-medium transition-colors ${
                activeTab === 'dashboard'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <span className="hidden sm:inline">Performance Dashboard</span>
              <span className="sm:hidden">Dashboard</span>
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-4 sm:px-6 py-3 text-sm sm:text-base font-medium transition-colors ${
                activeTab === 'history'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              History
            </button>
          </div>
        </div>

        {/* Content */}
        {activeTab === 'dashboard' ? (
          <div id="performance-dashboard">
            <PerformanceDashboard
              report={mockReport}
              onExportPDF={handleExportPDF}
            />
          </div>
        ) : (
          <InterviewHistory
            sessions={mockSessions}
            onSessionClick={(sessionId) => {
              alert(`Clicked session: ${sessionId}`);
            }}
          />
        )}
      </div>
    </div>
  );
}