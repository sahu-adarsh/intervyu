'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

/** Silently redirects authenticated users to /dashboard. Renders nothing. */
export default function AuthRedirect() {
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace('/dashboard');
    });
  }, [router]);

  return null;
}
