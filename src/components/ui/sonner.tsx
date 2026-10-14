"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";

function Toaster({ ...props }: ToasterProps) {
  return (
    <Sonner
      theme="light"
      position="top-right"
      richColors
      toastOptions={{
        classNames: {
          toast: "border border-[var(--line)] shadow-lg",
          title: "text-[var(--ink)]",
          description: "text-[var(--muted)]",
          success: "border-[#d7e9dc]",
          error: "border-[#f3d5d1]",
        },
      }}
      {...props}
    />
  );
}

export { Toaster };
