"use client";

/**
 * components/tasks/ActivityScheduleForm.tsx
 *
 * Handout 1 — "Weekly Activity Schedule"
 *
 * Desktop: grid with time slots (rows) × days (columns).
 * Mobile (< sm breakpoint): a time-block accordion — one section per day,
 * each time block rendered as a stacked card with native inputs.
 *
 * Data shape: ActivityLogFormData (types/tasks.ts) extended to a weekly grid.
 * The parent DynamicTaskForm controls persistence; this component is purely
 * presentational + data-collection.
 */

import React, { useCallback, useState } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Slider } from "@/components/ui/slider";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
export type Day = (typeof DAYS)[number];

// 6 AM … 11 PM in 1-hour slots = 18 slots
const START_HOUR = 6;
const END_HOUR = 23;
export const TIME_SLOTS: string[] = Array.from(
  { length: END_HOUR - START_HOUR + 1 },
  (_, i) => {
    const h = START_HOUR + i;
    const ampm = h < 12 ? "AM" : "PM";
    const display = h <= 12 ? h : h - 12;
    return `${display}:00 ${ampm}`;
  }
);

export interface TimeBlock {
  activity: string;
  moodRating: number; // 0-10
}

export type WeeklySchedule = Record<Day, Record<string, TimeBlock>>;

export function createEmptySchedule(): WeeklySchedule {
  const schedule: Partial<WeeklySchedule> = {};
  for (const day of DAYS) {
    const slots: Record<string, TimeBlock> = {};
    for (const slot of TIME_SLOTS) {
      slots[slot] = { activity: "", moodRating: 5 };
    }
    schedule[day] = slots;
  }
  return schedule as WeeklySchedule;
}

// ---------------------------------------------------------------------------
// Mood colour helper  (green 8-10, amber 4-7, red 0-3)
// ---------------------------------------------------------------------------
function moodColour(rating: number): string {
  if (rating >= 8) return "text-emerald-600 dark:text-emerald-400";
  if (rating >= 4) return "text-amber-600 dark:text-amber-400";
  return "text-rose-600 dark:text-rose-400";
}

function moodBg(rating: number): string {
  if (rating >= 8) return "bg-emerald-50 dark:bg-emerald-950/40";
  if (rating >= 4) return "bg-amber-50 dark:bg-amber-950/40";
  return "bg-rose-50 dark:bg-rose-950/40";
}

// ---------------------------------------------------------------------------
// TimeBlockCell  — used by the desktop grid
// ---------------------------------------------------------------------------
interface TimeBlockCellProps {
  block: TimeBlock;
  onChange: (block: TimeBlock) => void;
  disabled?: boolean;
}

function TimeBlockCell({ block, onChange, disabled }: TimeBlockCellProps) {
  const isEmpty = !block.activity.trim();

  return (
    <div
      className={cn(
        "group rounded-lg border border-border/60 p-2 transition-all",
        isEmpty ? "bg-muted/30" : moodBg(block.moodRating),
        disabled && "pointer-events-none opacity-50"
      )}
    >
      <textarea
        value={block.activity}
        onChange={(e) => onChange({ ...block, activity: e.target.value })}
        placeholder="Activity…"
        rows={2}
        disabled={disabled}
        className={cn(
          "w-full resize-none rounded bg-transparent text-xs text-foreground placeholder:text-muted-foreground/60",
          "focus:outline-none focus:ring-0 border-none p-0"
        )}
      />
      {!isEmpty && (
        <div className="mt-1.5 space-y-0.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground">Mood</span>
            <span
              className={cn("text-xs font-semibold tabular-nums", moodColour(block.moodRating))}
            >
              {block.moodRating}
            </span>
          </div>
          <Slider
            min={0}
            max={10}
            step={1}
            value={[block.moodRating]}
            onValueChange={([v]) => onChange({ ...block, moodRating: v })}
            disabled={disabled}
            className="h-3"
          />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// MobileDayAccordion  — single collapsible day panel for narrow viewports
// ---------------------------------------------------------------------------
interface MobileDayAccordionProps {
  day: Day;
  dayData: Record<string, TimeBlock>;
  onChange: (slot: string, block: TimeBlock) => void;
  disabled?: boolean;
}

function MobileDayAccordion({ day, dayData, onChange, disabled }: MobileDayAccordionProps) {
  const [open, setOpen] = useState(false);
  const filledCount = Object.values(dayData).filter((b) => b.activity.trim()).length;

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "w-full flex items-center justify-between px-4 py-3 text-left",
          "bg-card hover:bg-muted/50 transition-colors"
        )}
      >
        <div className="flex items-center gap-3">
          <span className="font-semibold text-sm">{day}</span>
          {filledCount > 0 && (
            <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium text-primary">
              {filledCount} block{filledCount !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {open && (
        <div className="divide-y divide-border/60 bg-background">
          {TIME_SLOTS.map((slot) => (
            <div key={slot} className="px-4 py-3">
              <p className="mb-2 text-xs font-medium text-muted-foreground">{slot}</p>
              <div className="space-y-2">
                <input
                  type="text"
                  value={dayData[slot].activity}
                  onChange={(e) =>
                    onChange(slot, { ...dayData[slot], activity: e.target.value })
                  }
                  placeholder="What did you do?"
                  disabled={disabled}
                  className={cn(
                    "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm",
                    "placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring/40"
                  )}
                />
                {dayData[slot].activity.trim() && (
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      Mood rating
                    </span>
                    <Slider
                      min={0}
                      max={10}
                      step={1}
                      value={[dayData[slot].moodRating]}
                      onValueChange={([v]) =>
                        onChange(slot, { ...dayData[slot], moodRating: v })
                      }
                      disabled={disabled}
                      className="flex-1"
                    />
                    <span
                      className={cn(
                        "w-6 text-right text-sm font-bold tabular-nums",
                        moodColour(dayData[slot].moodRating)
                      )}
                    >
                      {dayData[slot].moodRating}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ActivityScheduleForm  — the exported component
// ---------------------------------------------------------------------------
interface ActivityScheduleFormProps {
  schedule: WeeklySchedule;
  onChange: (schedule: WeeklySchedule) => void;
  disabled?: boolean;
}

export function ActivityScheduleForm({
  schedule,
  onChange,
  disabled,
}: ActivityScheduleFormProps) {
  const handleCellChange = useCallback(
    (day: Day, slot: string, block: TimeBlock) => {
      onChange({
        ...schedule,
        [day]: { ...schedule[day], [slot]: block },
      });
    },
    [schedule, onChange]
  );

  return (
    <div className="space-y-4">
      {/* ── Desktop grid ─────────────────────────────────────── */}
      <div className="hidden sm:block overflow-x-auto rounded-xl border border-border">
        <table className="min-w-full table-fixed">
          <thead>
            <tr className="bg-muted/50">
              <th className="w-24 py-3 px-3 text-left text-xs font-semibold text-muted-foreground">
                Time
              </th>
              {DAYS.map((day) => (
                <th
                  key={day}
                  className="py-3 px-2 text-center text-xs font-semibold text-foreground"
                >
                  {day}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {TIME_SLOTS.map((slot) => (
              <tr key={slot} className="hover:bg-muted/20 transition-colors">
                <td className="py-2 px-3 text-xs text-muted-foreground whitespace-nowrap align-top pt-3">
                  {slot}
                </td>
                {DAYS.map((day) => (
                  <td key={day} className="py-1.5 px-1.5 align-top min-w-[110px]">
                    <TimeBlockCell
                      block={schedule[day][slot]}
                      onChange={(b) => handleCellChange(day, slot, b)}
                      disabled={disabled}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Mobile accordion ─────────────────────────────────── */}
      <div className="sm:hidden space-y-2">
        {DAYS.map((day) => (
          <MobileDayAccordion
            key={day}
            day={day}
            dayData={schedule[day]}
            onChange={(slot, block) => handleCellChange(day, slot, block)}
            disabled={disabled}
          />
        ))}
      </div>
    </div>
  );
}
