'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useFarmRole } from '@/lib/farm-access';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

type MembershipRow = {
  id: string;
  invited_email: string | null;
  member_user_id: string | null;
  role: 'super_admin' | 'viewer';
  status: 'invited' | 'active' | 'revoked';
  created_at: string;
};

export function ViewerAccessManager() {
  const role = useFarmRole();
  const [email, setEmail] = useState('');
  const [rows, setRows] = useState<MembershipRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!supabase || role !== 'super_admin') {
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from('farm_memberships')
      .select('id, invited_email, member_user_id, role, status, created_at')
      .eq('role', 'viewer')
      .order('created_at', { ascending: false });
    if (error) {
      toast.error('Unable to load viewer access. Apply the latest RBAC migration and try again.');
      setRows([]);
    } else {
      setRows((data ?? []) as MembershipRow[]);
    }
    setLoading(false);
  }, [role]);

  useEffect(() => {
    void load();
  }, [load]);

  async function invite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (!supabase || !normalizedEmail) return;
    setSaving(true);
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      toast.error('Your session could not be verified. Sign in again.');
      setSaving(false);
      return;
    }
    const { error } = await supabase.from('farm_memberships').insert({
      owner_user_id: authData.user.id,
      member_user_id: null,
      invited_email: normalizedEmail,
      role: 'viewer',
      status: 'invited',
    });
    setSaving(false);
    if (error) {
      toast.error(
        error.code === '23505'
          ? 'This email already has a pending invitation or active farm access.'
          : error.message || 'Unable to create the invitation.',
      );
      return;
    }
    setEmail('');
    toast.success('Viewer invitation created. The person must sign in using this email address.');
    await load();
  }

  async function revoke(row: MembershipRow) {
    if (!supabase) return;
    const { error } = await supabase
      .from('farm_memberships')
      .update({ status: 'revoked' })
      .eq('id', row.id)
      .eq('role', 'viewer');
    if (error) {
      toast.error(error.message || 'Unable to revoke viewer access.');
      return;
    }
    toast.success('Viewer access revoked.');
    await load();
  }

  if (role !== 'super_admin') {
    return <p className="sub">Only the farm Super Admin can manage viewer access.</p>;
  }

  return (
    <section className="card">
      <h2 className="section-title">Read-only access</h2>
      <p className="sub">
        Invite someone to view farm operations and reports without changing records. The invitation
        is tied to the exact email address entered here.
      </p>
      <form className="row" onSubmit={invite} style={{ alignItems: 'end', gap: 12 }}>
        <label className="field" style={{ flex: 1, minWidth: 220 }}>
          Viewer email
          <Input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="viewer@example.com"
          />
        </label>
        <Button type="submit" disabled={saving}>
          {saving ? 'Creating…' : 'Invite viewer'}
        </Button>
      </form>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Email / account</th>
              <th>Status</th>
              <th>Role</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4}>Loading access…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={4}>No viewer invitations or memberships yet.</td></tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.invited_email ?? (row.member_user_id ? 'Accepted account' : '—')}</td>
                  <td>{row.status === 'active' ? 'Active' : row.status === 'invited' ? 'Invitation pending' : 'Revoked'}</td>
                  <td>Viewer · read-only</td>
                  <td>
                    {row.status !== 'revoked' ? (
                      <Button type="button" size="sm" variant="outline" onClick={() => void revoke(row)}>
                        Revoke
                      </Button>
                    ) : '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
