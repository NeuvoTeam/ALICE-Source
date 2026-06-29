"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

const API_BASE = "http://localhost:8787";

export default function HomeworkPage() {
  const { sessionId } = useParams();

  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    const load = async () => {
      if (!sessionId) return;

      try {
        // ✅ Always go through Cloudflare Worker
        const res = await fetch(`${API_BASE}/sessions/${sessionId}`);
        const data = await res.json();

        if (!res.ok || !data) {
          throw new Error("API failed");
        }

        setSession(data);

      } catch (err) {
        console.warn("Using fallback homework data");

        // ✅ Fallback (only if Worker fails)
        setSession({
          vignette:
            "Client experiencing anxiety around work stress and avoidance patterns.",
          quiz: [
            "What thoughts come up during stressful moments?",
            "How do you usually respond to these thoughts?",
          ],
          homework: [
            "Write down anxious thoughts each day",
            "Practice breathing exercises for 5 minutes daily",
          ],
        });
      }

      setLoading(false);
    };

    load();
  }, [sessionId]);

  // ✅ LOADING
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Loading your session...
      </div>
    );
  }

  // ✅ SAFETY
  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center text-red-500">
        Homework not found
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex justify-center">
      <div className="w-full max-w-2xl px-6 py-10 space-y-6">

        {/* HEADER */}
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            Your Homework
          </h1>
          <p className="text-sm text-gray-500">
            Review your session and complete the exercises below
          </p>
        </div>

        {/* CONTENT */}
        <div className="space-y-5">

          {/* SUMMARY */}
          {session.vignette && (
            <div className="bg-white border rounded-xl p-5 shadow-sm hover:shadow-md transition">
              <h2 className="text-sm font-semibold text-gray-700 mb-2">
                Case Summary
              </h2>
              <p className="text-sm text-gray-600 leading-relaxed">
                {session.vignette}
              </p>
            </div>
          )}

          {/* QUESTIONS */}
          {Array.isArray(session.quiz) && session.quiz.length > 0 && (
            <div className="bg-white border rounded-xl p-5 shadow-sm hover:shadow-md transition">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">
                Reflection Questions
              </h2>

              <ul className="space-y-3">
                {session.quiz.map((q: string, i: number) => (
                  <li key={i} className="text-sm text-gray-700">
                    <span className="font-medium text-gray-900">
                      {i + 1}.
                    </span>{" "}
                    {q}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* TASKS */}
          {Array.isArray(session.homework) && session.homework.length > 0 && (
            <div className="bg-white border rounded-xl p-5 shadow-sm hover:shadow-md transition">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">
                Your Tasks
              </h2>

              <ul className="space-y-2">
                {session.homework.map((task: string, i: number) => (
                  <li
                    key={i}
                    className="flex items-start gap-3 text-sm text-gray-700"
                  >
                    <span className="mt-1 text-green-500 text-xs">●</span>
                    {task}
                  </li>
                ))}
              </ul>
            </div>
          )}

        </div>

        {/* FOOTER */}
        <div className="pt-6 text-center text-xs text-gray-400">
          Provided by your clinician
        </div>

      </div>
    </div>
  );
}
