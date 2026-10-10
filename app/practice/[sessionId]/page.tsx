"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { CLINICAL_AI_API_BASE } from "@/lib/clinical-ai-api";
import { CheckCircle2, Circle, Loader2, Sparkles, AlertCircle } from "lucide-react";
import { DynamicTaskForm, type TaskVariant } from "@/components/tasks/DynamicTaskForm";
import ReflectionCanvas from "@/components/canvas/ReflectionCanvas";

import type { PracticePackage } from "@/lib/practice-package";

/** The shared PracticePackage projected to the single homework member this route returns. */
type PracticeHomework = Pick<PracticePackage, "homework">;

/** The clinician's chosen activity, as projected by GET /client-homework/:id. */
type PracticeTask = {
  task_type: TaskVariant | "reflection_prompt";
  [field: string]: unknown;
};

const FORM_TASK_TYPES: readonly TaskVariant[] = [
  "activity_log",
  "thought_record",
  "two_choice_worksheet",
];

function readPracticeTask(value: unknown): PracticeTask | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const taskType = (value as { task_type?: unknown }).task_type;
  if (
    taskType === "reflection_prompt" ||
    (FORM_TASK_TYPES as readonly unknown[]).includes(taskType)
  ) {
    return value as PracticeTask;
  }
  return null;
}

type SessionData = {
  id?: string;
  name?: string;
  practicePackage?: PracticeHomework | null;
  practiceTask?: PracticeTask | null;
};

function getTaskLabel(item: unknown): string {
  if (typeof item === "string") return item;
  if (!item || typeof item !== "object") return String(item);
  const val =
    ("task" in item && item.task) ||
    ("description" in item && item.description) ||
    ("title" in item && item.title) ||
    ("question" in item && item.question) ||
    ("prompt" in item && item.prompt);
  return val ? String(val) : JSON.stringify(item);
}

export default function PracticePage() {
  const params = useParams();

  const sessionId =
    typeof params?.sessionId === "string"
      ? params.sessionId
      : Array.isArray(params?.sessionId)
      ? params.sessionId[0]
      : null;

  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<SessionData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState<Record<number, boolean>>({});

  useEffect(() => {
    const load = async () => {
      if (!sessionId) {
        setError("Missing session ID");
        setLoading(false);
        return;
      }

      try {
        // Signed, expiring link (…?exp=…&sig=…): a bare UUID opens nothing now.
        const searchParams = new URLSearchParams(window.location.search);
        const link = new URLSearchParams();

        if (searchParams.get("exp")) link.set("exp", searchParams.get("exp") as string);
        if (searchParams.get("sig")) link.set("sig", searchParams.get("sig") as string);

        const query = link.toString();

        const res = await fetch(
          `${CLINICAL_AI_API_BASE}/client-homework/${sessionId}${
            query ? `?${query}` : ""
          }`,
          {
            method: "GET",
            cache: "no-store",
          }
        );

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data?.error || "Failed to load session");
        }

        const homeworkList =
          Array.isArray(data.practiceHomework) && data.practiceHomework.length > 0
            ? data.practiceHomework
            : Array.isArray(data.homework) && data.homework.length > 0
            ? data.homework
            : [];

        setSession({
          id: data.sessionId,
          name: data.title,
          practicePackage: {
            homework: homeworkList,
          },
          practiceTask: readPracticeTask(data.practiceTask),
        });

        setError(null);
      } catch (err) {
        setError((err instanceof Error ? err.message : null) || "Unable to load practice tasks");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [sessionId]);

  const toggleTask = (index: number) => {
    setCompleted((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50/50 flex flex-col items-center justify-center p-6 text-zinc-500">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
        <span className="text-sm font-medium">Loading practice tasks…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-zinc-50/50 flex flex-col items-center justify-center p-6 text-zinc-800">
        <div className="max-w-md w-full bg-white border border-red-200 rounded-xl p-8 shadow-sm text-center">
          <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 mx-auto flex items-center justify-center mb-4">
            <AlertCircle className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-bold text-zinc-900 mb-2">Unable to Open Practice Link</h2>
          <p className="text-sm text-zinc-600 mb-6">{error}</p>
          <div className="text-xs text-zinc-400">
            Please ask your clinician for a renewed link if your current session has expired.
          </div>
        </div>
      </div>
    );
  }

  // The clinician's chosen activity. The type is fixed by the clinician — this
  // page renders no picker and nothing here can change it. Nothing is saved:
  // the form runs with persist={false}, and the canvas is mounted without a
  // ref, so its upload handle is unreachable.
  const practiceTask = session?.practiceTask ?? null;

  if (practiceTask) {
    const reflectionPrompt =
      practiceTask.task_type === "reflection_prompt" &&
      typeof practiceTask.prompt === "string"
        ? practiceTask.prompt
        : null;

    return (
      <div className="min-h-screen bg-zinc-50/60 py-12 px-4 sm:px-6 flex justify-center">
        <div className="w-full max-w-4xl space-y-6">
          <div className="bg-white border rounded-4xl p-4 sm:p-8 shadow-sm space-y-6">
            <div className="text-center space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider mb-2">
                <Sparkles className="h-3.5 w-3.5" /> ALICE Practice
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 tracking-tight">
                Client Practice Task
              </h1>
              {session?.name && (
                <p className="text-sm font-bold text-zinc-500 uppercase tracking-wider">
                  {session.name}
                </p>
              )}
              <p className="text-sm text-zinc-500 max-w-md mx-auto pt-1">
                Please complete the activity your clinician has prepared before your next session.
              </p>
            </div>

            {practiceTask.task_type === "reflection_prompt" ? (
              <div className="space-y-4">
                {reflectionPrompt && (
                  <p className="text-sm sm:text-base font-medium text-zinc-800 leading-relaxed">
                    {reflectionPrompt}
                  </p>
                )}
                <ReflectionCanvas />
              </div>
            ) : (
              <DynamicTaskForm
                taskType={practiceTask.task_type}
                initialData={practiceTask}
                persist={false}
              />
            )}

            <div className="pt-6 border-t border-zinc-100 flex items-center justify-between text-xs text-zinc-400">
              <span>Powered by Neuvo ALICE</span>
              <span>Confidential &amp; Secure</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const homework = session?.practicePackage?.homework || [];
  const completedCount = Object.values(completed).filter(Boolean).length;
  const progressPercent = homework.length > 0 ? Math.round((completedCount / homework.length) * 100) : 0;

  return (
    <div className="min-h-screen bg-zinc-50/60 py-12 px-4 sm:px-6 flex justify-center">
      <div className="w-full max-w-2xl space-y-6">
        <div className="bg-white border rounded-4xl p-8 sm:p-10 shadow-sm space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider mb-2">
              <Sparkles className="h-3.5 w-3.5" /> ALICE Practice
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 tracking-tight">
              Client Practice Tasks
            </h1>
            {session?.name && (
              <p className="text-sm font-bold text-zinc-500 uppercase tracking-wider">
                {session.name}
              </p>
            )}
            <p className="text-sm text-zinc-500 max-w-md mx-auto pt-1">
              Please review and complete the following activities before your next session. Tap any item to check it off.
            </p>
          </div>

          {homework.length > 0 && (
            <div className="space-y-2 pt-2">
              <div className="flex justify-between items-center text-xs font-bold text-zinc-500">
                <span>Progress</span>
                <span>
                  {completedCount} of {homework.length} completed ({progressPercent}%)
                </span>
              </div>
              <div className="w-full h-2 bg-zinc-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300 rounded-full"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}

          {homework.length === 0 ? (
            <div className="text-center py-12 text-zinc-400 border-2 border-dashed border-zinc-100 rounded-xl">
              No practice tasks currently assigned for this session.
            </div>
          ) : (
            <div className="space-y-3 pt-2">
              {homework.map((item, index: number) => {
                const label = getTaskLabel(item);
                const isDone = !!completed[index];

                return (
                  <button
                    key={index}
                    type="button"
                    onClick={() => toggleTask(index)}
                    className={`w-full flex items-start gap-4 p-4 rounded-xl border text-left transition-all ${
                      isDone
                        ? "bg-zinc-50/80 border-zinc-200 text-zinc-400"
                        : "bg-white border-zinc-200 hover:border-primary/40 hover:bg-zinc-50/40 text-zinc-800 shadow-sm"
                    }`}
                  >
                    <span className="mt-0.5 shrink-0 transition-transform active:scale-90">
                      {isDone ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                      ) : (
                        <Circle className="h-5 w-5 text-zinc-300 hover:text-primary" />
                      )}
                    </span>
                    <span
                      className={`text-sm sm:text-base leading-relaxed ${
                        isDone ? "line-through text-zinc-400" : "font-medium text-zinc-800"
                      }`}
                    >
                      {label}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          <div className="pt-6 border-t border-zinc-100 flex items-center justify-between text-xs text-zinc-400">
            <span>Powered by Neuvo ALICE</span>
            <span>Confidential &amp; Secure</span>
          </div>
        </div>
      </div>
    </div>
  );
}