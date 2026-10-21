'use client';

import { useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { FarmRoleProvider, type FarmRole } from '@/lib/farm-access';
import { TimedNotice } from '@/components/ui/TimedNotice';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(!supabase);
  const [role, setRole] = useState<FarmRole | null>(null);
  const [roleLoading, setRoleLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const activeUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!supabase) return;
    let mounted = true;
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;
      if (error) setMessage(error.message);
      activeUserIdRef.current = data.session?.user.id ?? null;
      setSession(data.session);
      setReady(true);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      const nextUserId = nextSession?.user.id ?? null;
      if (nextUserId !== activeUserIdRef.current) {
        activeUserIdRef.current = nextUserId;
        setRole(null);
        setRoleLoading(Boolean(nextSession));
      }
      setSession(nextSession);
    });
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!supabase || !session) {
      setRole(null);
      setRoleLoading(false);
      return;
    }
    let mounted = true;
    setRoleLoading(true);
    void (async () => {
      // A pending invitation is claimed only when the signed-in, verified auth
      // email matches the invitation created by the farm owner.
      const claim = await supabase!.rpc('claim_farm_viewer_invite');
      if (claim.error && mounted) {
        setMessage('Unable to verify farm access. Please contact the farm administrator.');
      }
      const result = await supabase!.rpc('current_farm_role');
      if (!mounted) return;
      const value = result.error ? null : result.data;
      setRole(value === 'super_admin' || value === 'viewer' ? value : null);
      if (result.error) {
        setMessage('Farm access could not be verified. Apply the latest database migrations or contact the administrator.');
      } else if (value !== 'super_admin' && value !== 'viewer') {
        setMessage('This account has no farm access. Ask the Super Admin to invite this email address.');
      } else {
        setMessage('');
      }
      setRoleLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [session?.user.id]);

  if (!ready) return <div className="auth-screen">Loading your farm workspace…</div>;
  if (!supabase)
    return (
      <div className="auth-screen">
        <section className="auth-card">
          <h1>Supabase setup needed</h1>
          <p>
            Add your project URL and publishable key to <code>.env.local</code>, then restart
            Next.js.
          </p>
        </section>
      </div>
    );

  if (session && roleLoading)
    return <div className="auth-screen">Verifying farm permissions…</div>;

  if (session && role) {
    return <FarmRoleProvider role={role}>{children}</FarmRoleProvider>;
  }

  if (session && !role) {
    return (
      <div className="auth-screen">
        <section className="auth-card">
          <p className="eyebrow">YUREEH FARM · ACCESS CONTROL</p>
          <h1>Farm access required</h1>
          <p className="sub">
            Your account is authenticated, but it is not assigned to this farm. Ask the farm
            Super Admin to invite the email address you used to sign in.
          </p>
          {message && <TimedNotice message={message} onDismiss={() => setMessage('')} />}
          <Button
            type="button"
            className="w-full"
            onClick={() => void supabase.auth.signOut()}
          >
            Sign out
          </Button>
        </section>
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage('');
    const result =
      mode === 'signin'
        ? await supabase!.auth.signInWithPassword({ email, password })
        : await supabase!.auth.signUp({ email, password });
    setBusy(false);
    if (result.error) setMessage(result.error.message);
    else if (mode === 'signup' && !result.data.session)
      setMessage('Check your email to confirm your account. Farm access is granted only if the Super Admin invited this email.');
    else if (mode === 'signup')
      setMessage('Account created. Farm access will be available only if this email has a valid invitation.');
  }

  return (
    <div className="auth-screen">
      <form className="auth-card" onSubmit={submit}>
        <div className="brand-icon">♧</div>
        <p className="eyebrow">YUREEH FARM · MANAGEMENT</p>
        <h1>{mode === 'signin' ? 'Welcome back' : 'Create account'}</h1>
        <p className="sub">Sign in with an authorized farm account.</p>
        <label className="field">
          Email
          <Input
            autoComplete="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="field">
          Password
          <Input
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            type="password"
            minLength={6}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {message && <TimedNotice message={message} onDismiss={() => setMessage('')} />}
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="auth-switch"
          onClick={() => {
            setMode(mode === 'signin' ? 'signup' : 'signin');
            setMessage('');
          }}
        >
          {mode === 'signin' ? 'New here? Create account' : 'Already registered? Sign in'}
        </Button>
      </form>
    </div>
  );
}
