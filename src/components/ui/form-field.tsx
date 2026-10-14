import * as React from 'react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export type FormFieldControlProps = {
  id: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
};

type FormFieldProps = {
  id: string;
  label: React.ReactNode;
  description?: React.ReactNode;
  error?: React.ReactNode;
  required?: boolean;
  className?: string;
  children: (controlProps: FormFieldControlProps) => React.ReactNode;
};

/**
 * Shared label/help/error wrapper for one control. A render prop ensures ARIA
 * attributes can be attached to the actual focusable element (e.g. SelectTrigger).
 */
function FormField({ id, label, description, error, required, className, children }: FormFieldProps) {
  const descriptionId = description ? `${id}-description` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [descriptionId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cn('field min-w-0', className)}>
      <Label htmlFor={id}>
        {label}
        {required && <span aria-hidden="true" className="ml-1 text-red-600">*</span>}
      </Label>
      {children({
        id,
        'aria-describedby': describedBy,
        'aria-invalid': error ? true : undefined,
      })}
      {description && (
        <p id={descriptionId} className="text-xs leading-5 text-[var(--muted)]">
          {description}
        </p>
      )}
      {error && (
        <p id={errorId} className="field-error text-xs" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export { FormField };
