'use client';
import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { TimedNotice } from '@/components/ui/TimedNotice';

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null),
    [ready, setReady] = useState(!supabase),
    [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [mode, setMode] = useState<'signin' | 'signup'>('signin'),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);
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
  if (session) return <>{children}</>;
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
      setMessage('Check your email to confirm your account, then sign in.');
  }
  return (
    <div className="auth-screen">
      <form className="auth-card" onSubmit={submit}>
        <div className="brand-icon">♧</div>
        <p className="eyebrow">YUREEH FARM · MANAGEMENT</p>
        <h1>{mode === 'signin' ? 'Welcome back' : 'Create farm account'}</h1>
        <p className="sub">Sign in to access your private farm records.</p>
        <label className="field">
          Email
          <input
            autoComplete="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="field">
          Password
          <input
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            type="password"
            minLength={6}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {message && <TimedNotice message={message} onDismiss={() => setMessage('')} />}
        <button className="btn full" disabled={busy}>
          {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
        </button>
        <button
          type="button"
          className="auth-switch"
          onClick={() => {
            setMode(mode === 'signin' ? 'signup' : 'signin');
            setMessage('');
          }}
        >
          {mode === 'signin' ? 'New here? Create account' : 'Already registered? Sign in'}
        </button>
      </form>
    </div>
  );
}
