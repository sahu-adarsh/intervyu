'use client';

import { useState } from 'react';
import { Star, ArrowRight, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';

interface PostInterviewFeedbackProps {
  sessionId: string;
  onComplete: () => void;
}

export default function PostInterviewFeedback({ sessionId, onComplete }: PostInterviewFeedbackProps) {
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = rating > 0 && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await supabase.from('feedback').insert({
        user_id: session?.user.id ?? null,
        category: 'post_interview',
        message: JSON.stringify({ rating, comment: comment.trim(), session_id: sessionId }),
        page: `/interview/${sessionId}`,
      });
    } catch {
      // silent fail — always proceed to report
    } finally {
      onComplete();
    }
  };

  const displayed = hovered || rating;

  return (
    <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl">

        {/* Header */}
        <div className="text-center mb-7">
          <h2 className="text-xl font-bold text-white">How was your experience?</h2>
          <p className="text-sm text-slate-400 mt-1.5">Your feedback helps us keep improving</p>
        </div>

        {/* Stars */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              onClick={() => setRating(n)}
              onMouseEnter={() => setHovered(n)}
              onMouseLeave={() => setHovered(0)}
              className="p-1 transition-transform hover:scale-110 active:scale-95"
            >
              <Star
                size={32}
                className={`transition-colors ${
                  n <= displayed
                    ? 'fill-amber-400 text-amber-400'
                    : 'fill-transparent text-slate-700'
                }`}
              />
            </button>
          ))}
        </div>

        {/* Comment */}
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="What could we do better? (optional)"
          rows={3}
          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent resize-none transition-colors mb-5"
        />

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className={`w-full py-3 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
            canSubmit
              ? 'bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-500/20'
              : 'bg-slate-800 text-slate-500 cursor-not-allowed'
          }`}
        >
          {submitting ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <>
              Submit &amp; View Report
              <ArrowRight size={15} />
            </>
          )}
        </button>
        {!rating && (
          <p className="text-center text-xs text-slate-600 mt-3">Select a rating to continue</p>
        )}

      </div>
    </div>
  );
}
