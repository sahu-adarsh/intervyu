'use client';

import posthog from 'posthog-js';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, Suspense } from 'react';
import { useSupabaseSession } from '@/lib/supabase/auth';

function PostHogPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  useEffect(() => {
    try {
      posthog.capture('$pageview', { $current_url: window.location.href });
    } catch {}
  }, [pathname, searchParams]);
  return null;
}

function PostHogIdentify() {
  const { user } = useSupabaseSession();
  useEffect(() => {
    try {
      if (user) {
        posthog.identify(user.id, {
          email: user.email,
          name: user.user_metadata?.full_name || user.user_metadata?.name,
        });
      } else {
        posthog.reset();
      }
    } catch {}
  }, [user]);
  return null;
}

export function PostHogInit() {
  useEffect(() => {
    try {
      posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
        api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
        ui_host: 'https://us.posthog.com',
        capture_pageview: false,
        capture_pageleave: true,
      });
    } catch {}
  }, []);

  return (
    <Suspense fallback={null}>
      <PostHogPageView />
      <PostHogIdentify />
    </Suspense>
  );
}
