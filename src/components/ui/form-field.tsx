import * as React from 'react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

type FormFieldProps = {
  id: string;
  label: React.ReactNode;
  description?: React.ReactNode;
  error?: React.ReactNode;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
};

/**
 * Shared label/help/error wrapper for a single form control.
 * Control props remain owned by the caller so compound controls can attach IDs
 * and ARIA attributes to their actual focusable trigger instead of a root node.
 */
function FormField({ id, label, description, error, required, className, children }: FormFieldProps) {
  const descriptionId = description ? `${id}-description` : undefined;
  const errorId = error ? `${id}-error` : undefined;

  return (
    <div className={cn('field min-w-0', className)}>
      <Label htmlFor={id}>
        {label}
        {required && <span aria-hidden="true" className="ml-1 text-red-600">*</span>}
      </Label>
      {children}
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
