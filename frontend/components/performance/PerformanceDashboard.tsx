'use client';

import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { Trophy, TrendingUp, TrendingDown, Download, Calendar } from 'lucide-react';

interface PerformanceReport {
  sessionId: string;
  candidateName: string;
  interviewType: string;
  timestamp: string;
  duration: number;
  overallScore: number;
  scores: {
    technicalKnowledge: number;
    problemSolving: number;
    communication: number;
    codeQuality: number;
    culturalFit: number;
  };
  strengths: string[];
  improvements: string[];
  recommendation: string;
  detailedFeedback: string;
}

interface PerformanceDashboardProps {
  report: PerformanceReport;
  onExportPDF?: () => void;
}

const getRecommendationColor = (recommendation: string) => {
  switch (recommendation) {
    case 'STRONG_HIRE':
      return 'bg-green-500';
    case 'HIRE':
      return 'bg-green-400';
    case 'BORDERLINE':
      return 'bg-yellow-500';
    case 'NO_HIRE':
      return 'bg-orange-500';
    case 'STRONG_NO_HIRE':
      return 'bg-red-500';
    default:
      return 'bg-gray-500';
  }
};

const getRecommendationText = (recommendation: string) => {
  return recommendation.replace(/_/g, ' ');
};

export default function PerformanceDashboard({ report, onExportPDF }: PerformanceDashboardProps) {
  // Prepare data for radar chart
  const radarData = [
    {
      subject: 'Technical',
      score: report.scores.technicalKnowledge,
      fullMark: 10,
    },
    {
      subject: 'Problem Solving',
      score: report.scores.problemSolving,
      fullMark: 10,
    },
    {
      subject: 'Communication',
      score: report.scores.communication,
      fullMark: 10,
    },
    {
      subject: 'Code Quality',
      score: report.scores.codeQuality,
      fullMark: 10,
    },
    {
      subject: 'Cultural Fit',
      score: report.scores.culturalFit,
      fullMark: 10,
    },
  ];

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    return `${minutes} min`;
  };

  const formatDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b">
        <div>
          <h1 className="text-xl sm:text-3xl font-bold text-gray-900">Performance Report</h1>
          <p className="text-gray-600 mt-1 text-sm sm:text-base">{report.candidateName} • {report.interviewType}</p>
        </div>
        {onExportPDF && (
          <button
            onClick={onExportPDF}
            className="flex items-center space-x-2 px-3 sm:px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm flex-shrink-0"
          >
            <Download className="w-4 h-4" />
            <span>Export PDF</span>
          </button>
        )}
      </div>

      {/* Overall Score Card */}
      <div className="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg p-5 sm:p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-blue-100 text-sm font-medium">Overall Score</p>
            <p className="text-4xl sm:text-5xl font-bold mt-2">{report.overallScore.toFixed(1)}</p>
            <p className="text-blue-100 mt-1">out of 10</p>
          </div>
          <Trophy className="w-10 h-10 sm:w-16 sm:h-16 text-blue-200 flex-shrink-0" />
        </div>

        <div className="mt-4 pt-4 border-t border-blue-400">
          <div className="flex items-center justify-between text-sm">
            <span className="text-blue-100">Recommendation</span>
            <span className={`px-3 py-1 rounded-full text-white font-medium ${getRecommendationColor(report.recommendation)}`}>
              {getRecommendationText(report.recommendation)}
            </span>
          </div>
        </div>
      </div>

      {/* Metadata */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center space-x-2 text-gray-600 mb-1">
            <Calendar className="w-4 h-4" />
            <p className="text-sm font-medium">Interview Date</p>
          </div>
          <p className="text-gray-900 font-semibold">{formatDate(report.timestamp)}</p>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center space-x-2 text-gray-600 mb-1">
            <Calendar className="w-4 h-4" />
            <p className="text-sm font-medium">Duration</p>
          </div>
          <p className="text-gray-900 font-semibold">{formatDuration(report.duration)}</p>
        </div>
      </div>

      {/* Radar Chart */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance Breakdown</h3>
        <div className="bg-gray-50 rounded-lg p-6">
          <ResponsiveContainer width="100%" height={280}>
            <RadarChart data={radarData}>
              <PolarGrid strokeDasharray="3 3" />
              <PolarAngleAxis dataKey="subject" tick={{ fill: '#4B5563', fontSize: 12 }} />
              <PolarRadiusAxis angle={90} domain={[0, 10]} tick={{ fill: '#9CA3AF' }} />
              <Radar
                name="Score"
                dataKey="score"
                stroke="#3B82F6"
                fill="#3B82F6"
                fillOpacity={0.6}
              />
              <Tooltip />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Detailed Scores */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Detailed Scores</h3>
        <div className="space-y-3">
          {Object.entries(report.scores).map(([key, value]) => {
            const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
            const percentage = (value / 10) * 100;

            return (
              <div key={key}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-700">{label}</span>
                  <span className="text-sm font-bold text-gray-900">{value.toFixed(1)} / 10</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      value >= 8 ? 'bg-green-500' :
                      value >= 6 ? 'bg-blue-500' :
                      value >= 4 ? 'bg-yellow-500' :
                      'bg-red-500'
                    }`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Strengths & Improvements */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Strengths */}
        <div>
          <div className="flex items-center space-x-2 mb-4">
            <TrendingUp className="w-5 h-5 text-green-600" />
            <h3 className="text-lg font-semibold text-gray-900">Strengths</h3>
          </div>
          <ul className="space-y-2">
            {report.strengths.map((strength, index) => (
              <li key={index} className="flex items-start space-x-2">
                <span className="text-green-500 mt-1">✓</span>
                <span className="text-gray-700">{strength}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Areas for Improvement */}
        <div>
          <div className="flex items-center space-x-2 mb-4">
            <TrendingDown className="w-5 h-5 text-orange-600" />
            <h3 className="text-lg font-semibold text-gray-900">Areas for Improvement</h3>
          </div>
          <ul className="space-y-2">
            {report.improvements.map((improvement, index) => (
              <li key={index} className="flex items-start space-x-2">
                <span className="text-orange-500 mt-1">→</span>
                <span className="text-gray-700">{improvement}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Detailed Feedback */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Detailed Feedback</h3>
        <div className="bg-gray-50 rounded-lg p-4">
          <pre className="whitespace-pre-wrap text-sm text-gray-700 font-sans">
            {report.detailedFeedback}
          </pre>
        </div>
      </div>
    </div>
  );
}