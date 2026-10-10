"use client";

/**
 * components/tasks/ThreeCsForm.tsx
 *
 * Handout 10 — "The 3 C's Practice Worksheet"
 *
 * Three sequential steps with Typeform-style progressive disclosure:
 *   Step 1 — Catch It   (notice the automatic thought)
 *   Step 2 — Check It   (examine the evidence)
 *   Step 3 — Correct It (craft a balanced thought)
 *
 * Each step is revealed only once the previous one has content, so the user
 * is never overwhelmed by a dense wall of fields.
 *
 * Data shape maps to ThoughtRecordFormData (types/tasks.ts).
 */

import React, { useMemo } from "react";
import { cn } from "@/lib/utils";
import { Check, Lock } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ThreeCsData {
  // Step 1 — Catch It
  situation: string;
  automaticThought: string;
  emotions: Array<{ label: string; intensity: number }>;
  // Step 2 — Check It
  evidenceFor: string;
  evidenceAgainst: string;
  // Step 3 — Correct It
  balancedThought: string;
  outcomeEmotionIntensity: number; // 0-100
}

export function createEmptyThreeCsData(): ThreeCsData {
  return {
    situation: "",
    automaticThought: "",
    emotions: [{ label: "", intensity: 50 }],
    evidenceFor: "",
    evidenceAgainst: "",
    balancedThought: "",
    outcomeEmotionIntensity: 50,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const COMMON_EMOTIONS = [
  "Anxious", "Sad", "Angry", "Hopeless", "Guilty",
  "Embarrassed", "Frustrated", "Lonely", "Ashamed", "Worried",
];

function intensityLabel(v: number): string {
  if (v >= 80) return "Very high";
  if (v >= 60) return "High";
  if (v >= 40) return "Moderate";
  if (v >= 20) return "Low";
  return "Very low";
}

function intensityColor(v: number): string {
  if (v >= 80) return "text-rose-600 dark:text-rose-400";
  if (v >= 60) return "text-amber-600 dark:text-amber-400";
  if (v >= 40) return "text-yellow-600 dark:text-yellow-400";
  return "text-emerald-600 dark:text-emerald-400";
}

// ---------------------------------------------------------------------------
// StepCard  — progressive-disclosure wrapper
// ---------------------------------------------------------------------------
interface StepCardProps {
  step: 1 | 2 | 3;
  label: string;
  icon: string;
  colour: string;
  isActive: boolean;
  isComplete: boolean;
  isLocked: boolean;
  children: React.ReactNode;
}

function StepCard({
  step,
  label,
  icon,
  colour,
  isActive,
  isComplete,
  isLocked,
  children,
}: StepCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border transition-all duration-300",
        isLocked
          ? "border-border/40 opacity-50"
          : isActive
          ? "border-primary/40 shadow-md shadow-primary/5"
          : "border-border"
      )}
    >
      {/* Header */}
      <div
        className={cn(
          "flex items-center gap-3 px-5 py-4 rounded-t-xl",
          colour
        )}
      >
        <div
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold",
            isComplete
              ? "bg-emerald-500 text-white"
              : isLocked
              ? "bg-muted text-muted-foreground"
              : "bg-primary text-primary-foreground"
          )}
        >
          {isComplete ? <Check className="h-4 w-4" /> : isLocked ? <Lock className="h-3.5 w-3.5" /> : step}
        </div>
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wider opacity-70">
            Step {step} of 3
          </p>
          <p className="text-base font-semibold leading-tight">
            {icon} {label}
          </p>
        </div>
      </div>

      {/* Body */}
      {!isLocked && (
        <div className="px-5 pb-5 pt-4 space-y-5">{children}</div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// EmotionRow
// ---------------------------------------------------------------------------
interface EmotionRowProps {
  emotion: { label: string; intensity: number };
  onChange: (e: { label: string; intensity: number }) => void;
  onRemove: () => void;
  canRemove: boolean;
  disabled?: boolean;
}

function EmotionRow({ emotion, onChange, onRemove, canRemove, disabled }: EmotionRowProps) {
  return (
    <div className="space-y-2 rounded-xl border border-border/60 bg-muted/30 p-3">
      {/* Emotion name */}
      <div className="flex items-center gap-2">
        <select
          value={COMMON_EMOTIONS.includes(emotion.label) ? emotion.label : "__custom__"}
          onChange={(e) =>
            onChange({
              ...emotion,
              label: e.target.value === "__custom__" ? "" : e.target.value,
            })
          }
          disabled={disabled}
          className={cn(
            "flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm",
            "focus:outline-none focus:ring-2 focus:ring-ring/40"
          )}
        >
          <option value="">— Select emotion —</option>
          {COMMON_EMOTIONS.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
          <option value="__custom__">Other…</option>
        </select>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            disabled={disabled}
            className="rounded-md p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
          >
            ×
          </button>
        )}
      </div>

      {/* Custom label */}
      {!COMMON_EMOTIONS.includes(emotion.label) && (
        <input
          type="text"
          value={emotion.label}
          onChange={(e) => onChange({ ...emotion, label: e.target.value })}
          placeholder="Describe the emotion…"
          disabled={disabled}
          className={cn(
            "w-full rounded-md border border-input bg-background px-3 py-2 text-sm",
            "focus:outline-none focus:ring-2 focus:ring-ring/40"
          )}
        />
      )}

      {/* Intensity slider */}
      <div className="flex items-center gap-3">
        <span className="text-xs text-muted-foreground whitespace-nowrap w-14">
          Intensity
        </span>
        <Slider
          min={0}
          max={100}
          step={5}
          value={[emotion.intensity]}
          onValueChange={([v]) => onChange({ ...emotion, intensity: v })}
          disabled={disabled}
          className="flex-1"
        />
        <span className={cn("text-xs font-semibold w-20 text-right", intensityColor(emotion.intensity))}>
          {emotion.intensity}% · {intensityLabel(emotion.intensity)}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ThreeCsForm  — exported component
// ---------------------------------------------------------------------------
interface ThreeCsFormProps {
  data: ThreeCsData;
  onChange: (data: ThreeCsData) => void;
  disabled?: boolean;
}

export function ThreeCsForm({ data, onChange, disabled }: ThreeCsFormProps) {
  const step1Complete = useMemo(
    () =>
      data.situation.trim().length > 0 &&
      data.automaticThought.trim().length > 0 &&
      data.emotions.some((e) => e.label.trim().length > 0),
    [data]
  );

  const step2Complete = useMemo(
    () =>
      step1Complete &&
      data.evidenceFor.trim().length > 0 &&
      data.evidenceAgainst.trim().length > 0,
    [step1Complete, data]
  );

  function updateEmotion(index: number, emotion: { label: string; intensity: number }) {
    const updated = [...data.emotions];
    updated[index] = emotion;
    onChange({ ...data, emotions: updated });
  }

  function addEmotion() {
    onChange({ ...data, emotions: [...data.emotions, { label: "", intensity: 50 }] });
  }

  function removeEmotion(index: number) {
    onChange({ ...data, emotions: data.emotions.filter((_, i) => i !== index) });
  }

  return (
    <div className="space-y-4">

      {/* ── Step 1: Catch It ───────────────────────────────── */}
      <StepCard
        step={1}
        label="Catch It"
        icon="🎯"
        colour="bg-violet-50/70 dark:bg-violet-950/30 text-violet-900 dark:text-violet-100"
        isActive={!step1Complete}
        isComplete={step1Complete}
        isLocked={false}
      >
        <div className="space-y-1.5">
          <label className="text-sm font-medium">
            Describe the situation
            <span className="text-destructive ml-0.5">*</span>
          </label>
          <p className="text-xs text-muted-foreground">
            Where were you? What were you doing? Who was there?
          </p>
          <Textarea
            value={data.situation}
            onChange={(e) => onChange({ ...data, situation: e.target.value })}
            placeholder="e.g. I was at a team meeting when my manager asked for feedback…"
            rows={3}
            disabled={disabled}
            className="resize-none"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">
            What was the automatic thought that crossed your mind?
            <span className="text-destructive ml-0.5">*</span>
          </label>
          <p className="text-xs text-muted-foreground">
            Write it exactly as it appeared — don't edit or censor it.
          </p>
          <Textarea
            value={data.automaticThought}
            onChange={(e) => onChange({ ...data, automaticThought: e.target.value })}
            placeholder={`e.g. "Everyone thinks I'm incompetent."`}
            rows={2}
            disabled={disabled}
            className="resize-none"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">
              Emotions &amp; intensity
              <span className="text-destructive ml-0.5">*</span>
            </label>
            <button
              type="button"
              onClick={addEmotion}
              disabled={disabled}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-medium text-primary",
                "border border-primary/40 hover:bg-primary/10 transition-colors"
              )}
            >
              + Add emotion
            </button>
          </div>
          {data.emotions.map((emotion, i) => (
            <EmotionRow
              key={i}
              emotion={emotion}
              onChange={(e) => updateEmotion(i, e)}
              onRemove={() => removeEmotion(i)}
              canRemove={data.emotions.length > 1}
              disabled={disabled}
            />
          ))}
        </div>
      </StepCard>

      {/* ── Step 2: Check It ───────────────────────────────── */}
      <StepCard
        step={2}
        label="Check It"
        icon="🔍"
        colour="bg-amber-50/70 dark:bg-amber-950/30 text-amber-900 dark:text-amber-100"
        isActive={step1Complete && !step2Complete}
        isComplete={step2Complete}
        isLocked={!step1Complete}
      >
        <div className="space-y-1.5">
          <label className="text-sm font-medium">
            Evidence that supports the thought
            <span className="text-destructive ml-0.5">*</span>
          </label>
          <p className="text-xs text-muted-foreground">
            Stick to observable facts — not interpretations.
          </p>
          <Textarea
            value={data.evidenceFor}
            onChange={(e) => onChange({ ...data, evidenceFor: e.target.value })}
            placeholder="e.g. My manager pointed out a mistake in my report."
            rows={3}
            disabled={disabled}
            className="resize-none"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">
            Evidence that doesn&apos;t support the thought
            <span className="text-destructive ml-0.5">*</span>
          </label>
          <p className="text-xs text-muted-foreground">
            What facts challenge or contradict the thought?
          </p>
          <Textarea
            value={data.evidenceAgainst}
            onChange={(e) => onChange({ ...data, evidenceAgainst: e.target.value })}
            placeholder="e.g. My manager praised my presentation last week."
            rows={3}
            disabled={disabled}
            className="resize-none"
          />
        </div>
      </StepCard>

      {/* ── Step 3: Correct It ─────────────────────────────── */}
      <StepCard
        step={3}
        label="Correct It"
        icon="✨"
        colour="bg-emerald-50/70 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-100"
        isActive={step2Complete}
        isComplete={false}
        isLocked={!step2Complete}
      >
        <div className="space-y-1.5">
          <label className="text-sm font-medium">
            Balanced, realistic thought
            <span className="text-destructive ml-0.5">*</span>
          </label>
          <p className="text-xs text-muted-foreground">
            Using both sets of evidence, write a more balanced perspective.
          </p>
          <Textarea
            value={data.balancedThought}
            onChange={(e) => onChange({ ...data, balancedThought: e.target.value })}
            placeholder={`e.g. "I made one mistake, but I've also received positive feedback. I'm still learning."`}
            rows={3}
            disabled={disabled}
            className="resize-none"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">
            How intense is the original emotion now?
          </label>
          <div className="flex items-center gap-3">
            <Slider
              min={0}
              max={100}
              step={5}
              value={[data.outcomeEmotionIntensity]}
              onValueChange={([v]) => onChange({ ...data, outcomeEmotionIntensity: v })}
              disabled={disabled}
              className="flex-1"
            />
            <span className={cn("text-sm font-bold w-24 text-right tabular-nums", intensityColor(data.outcomeEmotionIntensity))}>
              {data.outcomeEmotionIntensity}% · {intensityLabel(data.outcomeEmotionIntensity)}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            It&apos;s normal for this to remain above 0 — the goal is reduction, not elimination.
          </p>
        </div>
      </StepCard>
    </div>
  );
}
