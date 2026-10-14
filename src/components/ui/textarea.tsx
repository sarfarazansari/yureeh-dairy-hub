import * as React from "react";
import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex min-h-24 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm text-[#23392e] shadow-xs outline-none transition-colors placeholder:text-[var(--muted)] focus-visible:border-[var(--green)] focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--green)_20%,transparent)] disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-red-500",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
