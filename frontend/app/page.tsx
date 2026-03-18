'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type InterviewType = {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: string;
};

const interviewTypes: InterviewType[] = [
  {
    id: 'google-sde',
    title: 'Google SDE',
    description: 'Technical interview preparation for Software Development Engineer role at Google',
    icon: '💻',
    category: 'Technical'
  },
  {
    id: 'amazon-sde',
    title: 'Amazon SDE',
    description: 'Software Development Engineer interview with Amazon leadership principles',
    icon: '📦',
    category: 'Technical'
  },
  {
    id: 'microsoft-sde',
    title: 'Microsoft SDE',
    description: 'Technical interview for Software Engineer position at Microsoft',
    icon: '⊞',
    category: 'Technical'
  },
  {
    id: 'aws-sa',
    title: 'AWS Solutions Architect',
    description: 'Cloud architecture and AWS services focused interview',
    icon: '☁️',
    category: 'Solutions Architect'
  },
  {
    id: 'azure-sa',
    title: 'Azure Solutions Architect',
    description: 'Microsoft Azure cloud architecture interview preparation',
    icon: '🌐',
    category: 'Solutions Architect'
  },
  {
    id: 'gcp-sa',
    title: 'GCP Solutions Architect',
    description: 'Google Cloud Platform architecture interview',
    icon: '🔷',
    category: 'Solutions Architect'
  },
  {
    id: 'behavioral',
    title: 'Behavioral Interview',
    description: 'CV grilling and behavioral questions based on your experience',
    icon: '🗣️',
    category: 'Behavioral'
  },
  {
    id: 'coding-round',
    title: 'Coding Round',
    description: 'Live coding practice with algorithmic problems',
    icon: '⌨️',
    category: 'Coding'
  }
];

export default function Home() {
  const router = useRouter();
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [candidateName, setCandidateName] = useState('');

  const handleStartInterview = () => {
    if (!selectedType || !candidateName.trim()) {
      alert('Please select an interview type and enter your name');
      return;
    }

    // Navigate to interview session page
    router.push(`/interview/new?type=${selectedType}&name=${encodeURIComponent(candidateName)}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-3xl font-bold text-gray-900">Intervyu</h1>
          <p className="mt-2 text-sm text-gray-600">
            AI-Powered Interview Preparation with Real-time Voice Communication
          </p>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-black">
        {/* Candidate Info */}
        <div className="mb-8 bg-white rounded-lg shadow-md p-6">
          <label htmlFor="candidateName" className="block text-sm font-medium text-gray-700 mb-2">
            Your Name
          </label>
          <input
            type="text"
            id="candidateName"
            value={candidateName}
            onChange={(e) => setCandidateName(e.target.value)}
            placeholder="Enter your name"
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Interview Type Selection */}
        <div className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-6">
            Select Interview Type
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {interviewTypes.map((type) => (
              <button
                key={type.id}
                onClick={() => setSelectedType(type.id)}
                className={`p-6 rounded-lg border-2 transition-all duration-200 text-left ${
                  selectedType === type.id
                    ? 'border-blue-500 bg-blue-50 shadow-lg transform scale-105'
                    : 'border-gray-200 bg-white hover:border-blue-300 hover:shadow-md'
                }`}
              >
                <div className="text-4xl mb-3">{type.icon}</div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {type.title}
                </h3>
                <p className="text-sm text-gray-600 mb-3">{type.description}</p>
                <span className="inline-block px-3 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded-full">
                  {type.category}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Start Interview Button */}
        <div className="flex justify-center">
          <button
            onClick={handleStartInterview}
            disabled={!selectedType || !candidateName.trim()}
            className={`px-8 py-4 text-lg font-semibold rounded-lg transition-all duration-200 ${
              selectedType && candidateName.trim()
                ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg hover:shadow-xl transform hover:scale-105'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            Start Interview
          </button>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-16 py-8 bg-white border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-gray-600 text-sm">
          <p>Built with AWS Bedrock Agents | Real-time Voice AI Interview Practice</p>
        </div>
      </footer>
    </div>
  );
}
