'use client';

import { useState } from 'react';
import CVUpload from '@/components/cv/CVUpload';
import CVAnalysisDisplay from '@/components/cv/CVAnalysisDisplay';

// Mock CV analysis data for demo
const mockAnalysis = {
  candidateName: "John Doe",
  email: "john.doe@example.com",
  phone: "+1-555-123-4567",
  skills: ["Python", "JavaScript", "React", "Node.js", "AWS", "Docker", "Kubernetes", "MongoDB"],
  experience: [
    {
      duration: "2020-Present",
      context: "Senior Software Engineer at Tech Corp - Led team of 5 engineers, built microservices using Python and AWS"
    },
    {
      duration: "2018-2020",
      context: "Software Engineer at StartupCo - Developed React applications and implemented CI/CD pipelines"
    }
  ],
  education: [
    {
      degree: "B.Tech",
      context: "B.Tech Computer Science, MIT (2018)"
    }
  ],
  totalYearsExperience: 5.5,
  technologies: ["Python", "JavaScript", "React", "AWS"],
  summary: "Experienced professional with 5.5 years in Python, JavaScript, React"
};

export default function CVDemoPage() {
  const [cvAnalysis, setCvAnalysis] = useState<any>(null);
  const [showMockData, setShowMockData] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">CV Upload & Analysis Demo</h1>
          <p className="text-gray-600">Test the CV upload and analysis display components</p>
        </div>

        {/* Controls */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <button
            onClick={() => setShowMockData(!showMockData)}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            {showMockData ? 'Hide' : 'Show'} Mock CV Analysis
          </button>
        </div>

        {/* CV Upload */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Upload CV</h2>
          <CVUpload
            sessionId="demo-session-123"
            onUploadSuccess={(analysis) => {
              setCvAnalysis(analysis);
              alert('CV uploaded successfully!');
            }}
            onUploadError={(error) => {
              alert(`Upload error: ${error}`);
            }}
          />
        </div>

        {/* CV Analysis Display */}
        {(cvAnalysis || showMockData) && (
          <div>
            <h2 className="text-xl font-semibold mb-4">CV Analysis</h2>
            <CVAnalysisDisplay
              analysis={cvAnalysis || mockAnalysis}
              onUpdate={(updated) => {
                setCvAnalysis(updated);
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}