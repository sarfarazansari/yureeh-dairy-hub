'use client';

import { useParams } from 'next/navigation';
import BuffaloDetailPage from '@/features/buffaloes/BuffaloDetailPage';

export default function BuffaloDetailRoute() {
  const { id } = useParams<{ id: string }>();
  return <BuffaloDetailPage id={id} />;
}
