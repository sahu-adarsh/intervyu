'use client';

import { useState } from 'react';
import { User, Mail, Phone, Briefcase, GraduationCap, Code, Edit2, Check, X } from 'lucide-react';

interface CVAnalysis {
  candidateName: string;
  email: string;
  phone: string;
  skills: string[];
  experience: Array<{
    duration: string;
    context: string;
  }>;
  education: Array<{
    degree: string;
    context: string;
  }>;
  totalYearsExperience: number;
  technologies: string[];
  summary: string;
}

interface CVAnalysisDisplayProps {
  analysis: CVAnalysis;
  onUpdate?: (updatedAnalysis: CVAnalysis) => void;
}

export default function CVAnalysisDisplay({ analysis, onUpdate }: CVAnalysisDisplayProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedAnalysis, setEditedAnalysis] = useState<CVAnalysis>(analysis);

  const handleSave = () => {
    onUpdate?.(editedAnalysis);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedAnalysis(analysis);
    setIsEditing(false);
  };

  const updateSkills = (skills: string) => {
    setEditedAnalysis({
      ...editedAnalysis,
      skills: skills.split(',').map(s => s.trim()).filter(Boolean)
    });
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b">
        <h2 className="text-2xl font-bold text-gray-900">CV Analysis</h2>
        {!isEditing ? (
          <button
            onClick={() => setIsEditing(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            <Edit2 className="w-4 h-4" />
            <span>Edit</span>
          </button>
        ) : (
          <div className="flex space-x-2">
            <button
              onClick={handleSave}
              className="flex items-center space-x-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
            >
              <Check className="w-4 h-4" />
              <span>Save</span>
            </button>
            <button
              onClick={handleCancel}
              className="flex items-center space-x-2 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
            >
              <X className="w-4 h-4" />
              <span>Cancel</span>
            </button>
          </div>
        )}
      </div>

      {/* Summary */}
      <div className="bg-blue-50 rounded-lg p-4">
        <p className="text-gray-700 italic">"{editedAnalysis.summary}"</p>
      </div>

      {/* Personal Info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="flex items-center space-x-3">
          <User className="w-5 h-5 text-gray-500" />
          <div>
            <p className="text-xs text-gray-500">Name</p>
            {isEditing ? (
              <input
                type="text"
                value={editedAnalysis.candidateName}
                onChange={(e) => setEditedAnalysis({...editedAnalysis, candidateName: e.target.value})}
                className="w-full px-2 py-1 border rounded text-sm"
              />
            ) : (
              <p className="font-medium text-gray-900">{editedAnalysis.candidateName}</p>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <Mail className="w-5 h-5 text-gray-500" />
          <div>
            <p className="text-xs text-gray-500">Email</p>
            {isEditing ? (
              <input
                type="email"
                value={editedAnalysis.email}
                onChange={(e) => setEditedAnalysis({...editedAnalysis, email: e.target.value})}
                className="w-full px-2 py-1 border rounded text-sm"
              />
            ) : (
              <p className="font-medium text-gray-900">{editedAnalysis.email}</p>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <Phone className="w-5 h-5 text-gray-500" />
          <div>
            <p className="text-xs text-gray-500">Phone</p>
            {isEditing ? (
              <input
                type="tel"
                value={editedAnalysis.phone}
                onChange={(e) => setEditedAnalysis({...editedAnalysis, phone: e.target.value})}
                className="w-full px-2 py-1 border rounded text-sm"
              />
            ) : (
              <p className="font-medium text-gray-900">{editedAnalysis.phone}</p>
            )}
          </div>
        </div>
      </div>

      {/* Experience */}
      <div>
        <div className="flex items-center space-x-2 mb-3">
          <Briefcase className="w-5 h-5 text-gray-700" />
          <h3 className="text-lg font-semibold text-gray-900">
            Experience ({editedAnalysis.totalYearsExperience} years)
          </h3>
        </div>
        <div className="space-y-2">
          {(editedAnalysis.experience ?? []).map((exp, index) => (
            <div key={index} className="bg-gray-50 rounded-lg p-3">
              <p className="text-sm font-medium text-gray-900">{exp.duration}</p>
              <p className="text-sm text-gray-600 mt-1">{exp.context}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Education */}
      <div>
        <div className="flex items-center space-x-2 mb-3">
          <GraduationCap className="w-5 h-5 text-gray-700" />
          <h3 className="text-lg font-semibold text-gray-900">Education</h3>
        </div>
        <div className="space-y-2">
          {(editedAnalysis.education ?? []).map((edu, index) => (
            <div key={index} className="bg-gray-50 rounded-lg p-3">
              <p className="text-sm font-medium text-gray-900">{edu.degree}</p>
              <p className="text-sm text-gray-600 mt-1">{edu.context}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Skills */}
      <div>
        <div className="flex items-center space-x-2 mb-3">
          <Code className="w-5 h-5 text-gray-700" />
          <h3 className="text-lg font-semibold text-gray-900">Skills & Technologies</h3>
        </div>
        {isEditing ? (
          <textarea
            value={editedAnalysis.skills.join(', ')}
            onChange={(e) => updateSkills(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg"
            rows={3}
            placeholder="Enter skills separated by commas"
          />
        ) : (
          <div className="flex flex-wrap gap-2">
            {(editedAnalysis.skills ?? []).map((skill, index) => (
              <span
                key={index}
                className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium"
              >
                {skill}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}