/**
 * Centralized API client for the intervyu backend.
 * Automatically injects the Supabase access token as Authorization header.
 */

import { supabase } from './supabase/client';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Single source of truth for the latest access token.
// Updated immediately by onAuthStateChange (in-memory, no localStorage race).
let _latestToken: string | null = null;

supabase.auth.onAuthStateChange((_event, session) => {
  _latestToken = session?.access_token ?? null;
});

// Seed from storage on module load (covers hard-refresh when session is already stored)
supabase.auth.getSession().then(({ data }) => {
  if (data.session && !_latestToken) _latestToken = data.session.access_token;
});

async function authFetch(path: string, options: RequestInit = {}): Promise<Response> {
  let token = _latestToken;
  if (!token) {
    const { data } = await supabase.auth.getSession();
    token = data.session?.access_token ?? null;
    if (token) _latestToken = token;
  }

  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Only set Content-Type for JSON bodies (not FormData)
  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  return fetch(`${API_URL}${path}`, { ...options, headers });
}

// ─── Session endpoints ────────────────────────────────────────────────────────

export async function createSession(body: {
  interview_type: string;
  candidate_name: string;
}): Promise<{ session_id: string; interview_type: string; candidate_name: string; created_at: string; status: string }> {
  const res = await authFetch('/api/sessions', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Failed to create session: ${res.status}`);
  return res.json();
}

export async function getSession(sessionId: string) {
  const res = await authFetch(`/api/sessions/${sessionId}`);
  if (!res.ok) throw new Error(`Failed to get session: ${res.status}`);
  return res.json();
}

// ─── Interview endpoints ──────────────────────────────────────────────────────

export async function endInterview(sessionId: string) {
  const res = await authFetch(`/api/interviews/${sessionId}/end`, { method: 'POST' });
  if (!res.ok) throw new Error(`Failed to end interview: ${res.status}`);
  return res.json();
}

export async function getTranscript(sessionId: string) {
  const res = await authFetch(`/api/interviews/${sessionId}/transcript`);
  if (!res.ok) throw new Error(`Failed to get transcript: ${res.status}`);
  return res.json();
}

export async function uploadCV(sessionId: string, file: File) {
  const formData = new FormData();
  formData.append('file', file);
  const res = await authFetch(`/api/interviews/${sessionId}/upload-cv`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) throw new Error(`Failed to upload CV: ${res.status}`);
  return res.json();
}

export async function getCVAnalysis(sessionId: string) {
  const res = await authFetch(`/api/interviews/${sessionId}/cv-analysis`);
  if (!res.ok) throw new Error(`Failed to get CV analysis: ${res.status}`);
  return res.json();
}

export async function getPerformanceReport(sessionId: string) {
  const res = await authFetch(`/api/interviews/${sessionId}/performance-report`);
  if (!res.ok) throw new Error(`Failed to get performance report: ${res.status}`);
  return res.json();
}

// ─── Code endpoints ───────────────────────────────────────────────────────────

export async function executeCode(body: {
  sessionId: string;
  code: string;
  language: string;
  testCases: { input: string; expected: string }[];
  functionName?: string;
}) {
  const res = await authFetch('/api/code/execute', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Failed to execute code: ${res.status}`);
  return res.json();
}

// ─── Analytics endpoints ─────────────────────────────────────────────────────

export async function getAggregateAnalytics() {
  const res = await authFetch('/api/analytics/aggregate');
  if (!res.ok) throw new Error(`Failed to get analytics: ${res.status}`);
  return res.json();
}

export async function getUserHistory() {
  const res = await authFetch('/api/analytics/history');
  if (!res.ok) throw new Error(`Failed to get history: ${res.status}`);
  return res.json();
}

export async function getTrends(days = 30) {
  const res = await authFetch(`/api/analytics/trends?days=${days}`);
  if (!res.ok) throw new Error(`Failed to get trends: ${res.status}`);
  return res.json();
}

// ─── Auth endpoint ────────────────────────────────────────────────────────────

export async function getMe() {
  const res = await authFetch('/api/auth/me');
  if (!res.ok) throw new Error(`Auth check failed: ${res.status}`);
  return res.json();
}

// ─── WebSocket helper ─────────────────────────────────────────────────────────

/** Build the authenticated WebSocket URL (token passed as query param). */
export async function buildWsUrl(sessionId: string): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const wsBase = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000';
  const url = `${wsBase}/ws/interview/${sessionId}`;
  return token ? `${url}?token=${token}` : url;
}
