'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useUpdateBuffaloProfile } from '../hooks/use-buffaloes';
import type { BuffaloDetail } from '../types';

export function BuffaloProfileForm({ buffalo, onCancel }: { buffalo: BuffaloDetail; onCancel: () => void }) {
  const mutation = useUpdateBuffaloProfile();
  const [code, setCode] = useState(buffalo.buffalo_code);
  const [name, setName] = useState(buffalo.name ?? '');
  const [breed, setBreed] = useState(buffalo.breed ?? '');
  const [color, setColor] = useState(buffalo.color ?? '');
  const [identificationMark, setIdentificationMark] = useState(buffalo.identification_mark ?? '');
  const [ageMonths, setAgeMonths] = useState(buffalo.age_at_purchase_months == null ? '' : String(buffalo.age_at_purchase_months));
  const [notes, setNotes] = useState(buffalo.notes ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (!code.trim()) nextErrors.code = 'Buffalo code is required.';
    if (!breed.trim()) nextErrors.breed = 'Breed is required.';
    const age = ageMonths.trim() ? Number(ageMonths) : null;
    if (age !== null && (!Number.isInteger(age) || age < 0)) nextErrors.ageMonths = 'Age must be a non-negative whole number.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    try {
      await mutation.mutateAsync({
        buffaloId: buffalo.id,
        profile: {
          buffalo_code: code.trim().toUpperCase(),
          name: name.trim(),
          breed: breed.trim(),
          color: color.trim(),
          identification_mark: identificationMark.trim(),
          age_at_purchase_months: age,
          notes: notes.trim(),
        },
      });
      onCancel();
    } catch {
      // Keep the form open so the error can be corrected.
    }
  }

  return (
    <form className="card mb-4 space-y-4" onSubmit={handleSave} noValidate>
      <h2 className="section-title">Edit buffalo profile</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Buffalo code" error={errors.code}><Input id="buffalo-profile-code" value={code} onChange={(event) => setCode(event.target.value)} aria-invalid={Boolean(errors.code)} /></Field>
        <Field label="Name"><Input id="buffalo-profile-name" value={name} onChange={(event) => setName(event.target.value)} /></Field>
        <Field label="Breed" error={errors.breed}><Input id="buffalo-profile-breed" value={breed} onChange={(event) => setBreed(event.target.value)} aria-invalid={Boolean(errors.breed)} /></Field>
        <Field label="Color"><Input id="buffalo-profile-color" value={color} onChange={(event) => setColor(event.target.value)} /></Field>
        <Field label="Identification mark"><Input id="buffalo-profile-mark" value={identificationMark} onChange={(event) => setIdentificationMark(event.target.value)} /></Field>
        <Field label="Age at purchase · months" error={errors.ageMonths}><Input id="buffalo-profile-age" type="number" min="0" step="1" value={ageMonths} onChange={(event) => setAgeMonths(event.target.value)} aria-invalid={Boolean(errors.ageMonths)} /></Field>
      </div>
      <Field label="Notes"><Textarea id="buffalo-profile-notes" rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} /></Field>
      {mutation.isError && <p role="alert" className="auth-message">{mutation.error.message}</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Saving…' : 'Save changes'}</Button>
        <Button type="button" variant="outline" disabled={mutation.isPending} onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return <div className="field"><Label>{label}</Label>{children}{error && <p className="field-error" role="alert">{error}</p>}</div>;
}
