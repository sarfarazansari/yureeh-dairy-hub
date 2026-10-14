"use client";

import * as React from "react";
import { DayPicker } from "react-day-picker";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col sm:flex-row gap-4",
        month: "space-y-4",
        month_caption: "relative flex items-center justify-center pt-1",
        caption_label: "text-sm font-medium",
        nav: "flex items-center gap-1",
        button_previous: "absolute left-1 inline-flex size-7 items-center justify-center rounded-md border border-[var(--line)] bg-white hover:bg-[#edf5ef]",
        button_next: "absolute right-1 inline-flex size-7 items-center justify-center rounded-md border border-[var(--line)] bg-white hover:bg-[#edf5ef]",
        month_grid: "w-full border-collapse space-y-1",
        weekdays: "flex",
        weekday: "w-9 rounded-md text-[0.8rem] font-normal text-[var(--muted)]",
        week: "mt-2 flex w-full",
        day: "relative size-9 p-0 text-center text-sm",
        day_button: "inline-flex size-9 items-center justify-center rounded-md p-0 font-normal hover:bg-[#edf5ef] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--green)]",
        selected: "[&>button]:bg-[var(--green)] [&>button]:text-white [&>button]:hover:bg-[var(--green)]",
        today: "[&>button]:border [&>button]:border-[var(--green)]",
        outside: "text-[var(--muted)] opacity-50",
        disabled: "text-[var(--muted)] opacity-30",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, ...chevronProps }) =>
          orientation === "left" ? <ChevronLeft className="size-4" {...chevronProps} /> : <ChevronRight className="size-4" {...chevronProps} />,
      }}
      {...props}
    />
  );
}

export { Calendar };
