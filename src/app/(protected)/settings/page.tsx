import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';

export default function SettingsPage() {
  return (
    <AppShell title="Settings" subtitle="Farm workspace">
      <div className="card">
        <h2 className="section-title">Account and data</h2>
        <p className="sub">
          Your records are protected by Supabase authentication and row-level security. Sign out
          using the account menu at the bottom of the sidebar.
        </p>
        <p className="sub">
          Database migrations are managed from the Supabase CLI in this project.
        </p>
        <Link className="btn secondary" href="/">
          Return to dashboard
        </Link>
      </div>
    </AppShell>
  );
}
