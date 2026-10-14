import * as React from "react";
import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      data-slot="input"
      type={type}
      className={cn(
        "flex h-10 w-full min-w-0 rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm text-[#23392e] shadow-xs outline-none transition-colors placeholder:text-[var(--muted)] focus-visible:border-[var(--green)] focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--green)_20%,transparent)] disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-red-500 aria-invalid:ring-2 aria-invalid:ring-red-200",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
