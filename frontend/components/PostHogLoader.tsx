'use client';

import dynamic from 'next/dynamic';

const PostHogInit = dynamic(
  () => import('@/components/PostHogInit').then((m) => ({ default: m.PostHogInit })),
  { ssr: false }
);

export function PostHogLoader() {
  return <PostHogInit />;
}
