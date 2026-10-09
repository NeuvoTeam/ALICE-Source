"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { CLINICAL_AI_API_BASE } from "@/lib/clinical-ai-api";
import { CheckCircle2, Circle, Loader2, Sparkles, AlertCircle } from "lucide-react";

type PracticePackage = {
  homework: any[];
};

type SessionData = {
  id?: string;
  name?: string;
  practicePackage?: PracticePackage | null;
};

function getTaskLabel(item: any): string {
  if (typeof item === "string") return item;
  if (!item || typeof item !== "object") return String(item);
  return (
    item.task ||
    item.description ||
    item.title ||
    item.question ||
    item.prompt ||
    JSON.stringify(item)
  );
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
        });

        setError(null);
      } catch (err: any) {
        setError(err?.message || "Unable to load practice tasks");
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
        <div className="max-w-md w-full bg-white border border-red-200 rounded-3xl p-8 shadow-sm text-center">
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

  const homework = session?.practicePackage?.homework || [];
  const completedCount = Object.values(completed).filter(Boolean).length;
  const progressPercent = homework.length > 0 ? Math.round((completedCount / homework.length) * 100) : 0;

  return (
    <div className="min-h-screen bg-zinc-50/60 py-12 px-4 sm:px-6 flex justify-center">
      <div className="w-full max-w-2xl space-y-6">
        <div className="bg-white border rounded-[2rem] p-8 sm:p-10 shadow-sm space-y-6">
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
            <div className="text-center py-12 text-zinc-400 border-2 border-dashed border-zinc-100 rounded-2xl">
              No practice tasks currently assigned for this session.
            </div>
          ) : (
            <div className="space-y-3 pt-2">
              {homework.map((item: any, index: number) => {
                const label = getTaskLabel(item);
                const isDone = !!completed[index];

                return (
                  <button
                    key={index}
                    type="button"
                    onClick={() => toggleTask(index)}
                    className={`w-full flex items-start gap-4 p-4 rounded-2xl border text-left transition-all ${
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