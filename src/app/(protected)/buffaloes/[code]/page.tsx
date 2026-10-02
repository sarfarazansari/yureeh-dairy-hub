'use client';

import { useParams } from 'next/navigation';
import BuffaloDetailPage from '@/features/buffaloes/BuffaloDetailPage';

export default function BuffaloDetailRoute() {
  const { code } = useParams<{ code: string }>();
  return <BuffaloDetailPage code={code} />;
}
