import { AuthGate } from '../auth-gate';
import { FarmRoleRouteGuard } from '@/components/layout/FarmRoleRouteGuard';

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate>
      <FarmRoleRouteGuard>{children}</FarmRoleRouteGuard>
    </AuthGate>
  );
}
