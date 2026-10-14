import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--green)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-[var(--green)] text-white hover:opacity-90",
        destructive: "bg-red-600 text-white hover:bg-red-700",
        outline: "border border-[var(--line)] bg-white text-[var(--ink)] hover:bg-[var(--paper)]",
        secondary: "bg-[#edf5ef] text-[var(--green)] hover:bg-[#e2eee5]",
        ghost: "text-[var(--ink)] hover:bg-[#edf5ef]",
        link: "text-[var(--green)] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-11 rounded-lg px-6",
        icon: "size-9",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

function Button({ className, variant, size, type = "button", ...props }: ButtonProps) {
  return <button data-slot="button" type={type} className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

export { Button, buttonVariants };
