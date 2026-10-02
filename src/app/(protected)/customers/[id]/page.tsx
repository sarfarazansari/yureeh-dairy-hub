'use client';

import { useParams } from 'next/navigation';
import CustomerDetailPage from '@/features/customers/CustomerDetailPage';

export default function CustomerDetailRoute() {
  const { id } = useParams<{ id: string }>();
  return <CustomerDetailPage id={id} />;
}
