import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border border-transparent px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--green)]", {
  variants: {
    variant: {
      default: "bg-[var(--green)] text-white",
      secondary: "bg-[#edf5ef] text-[var(--green)]",
      destructive: "bg-[#fff0ec] text-[#ad503d]",
      outline: "border-[var(--line)] text-[var(--ink)]",
      muted: "bg-[var(--paper)] text-[var(--muted)]",
    },
  },
  defaultVariants: { variant: "default" },
});

function Badge({ className, variant, ...props }: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
