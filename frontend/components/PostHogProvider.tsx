'use client';

import { PHProvider, usePostHog } from 'posthog-js/react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, Suspense } from 'react';
import { useSupabaseSession } from '@/lib/supabase/auth';
import { initPostHog, posthog } from '@/lib/posthog';

initPostHog();

function PostHogPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const ph = usePostHog();

  useEffect(() => {
    ph?.capture('$pageview', { $current_url: window.location.href });
  }, [pathname, searchParams, ph]);

  return null;
}

function PostHogIdentify() {
  const { user } = useSupabaseSession();
  const ph = usePostHog();

  useEffect(() => {
    if (user) {
      ph?.identify(user.id, {
        email: user.email,
        name: user.user_metadata?.full_name || user.user_metadata?.name,
      });
    } else {
      ph?.reset();
    }
  }, [user, ph]);

  return null;
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  return (
    <PHProvider client={posthog}>
      <Suspense fallback={null}>
        <PostHogPageView />
      </Suspense>
      <PostHogIdentify />
      {children}
    </PHProvider>
  );
}
