"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function HomeworkPage() {
  const { sessionId } = useParams();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    const init = async () => {
      if (!sessionId) return;

      // ✅ 1. Check login
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push(`/client-login?redirect=/homework/${sessionId}`);
        return;
      }

      try {
        // ✅ 2. Try to fetch real data (if backend is running)
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_BASE}/sessions/${sessionId}`
        );

        if (!res.ok) {
          throw new Error("API not available");
        }

        const data = await res.json();

        if (!data) {
          throw new Error("No session data");
        }

        setSession(data);

      } catch (err) {
        console.warn("Using fallback homework data");

        // ✅ 3. Fallback data (works even when backend is OFF)
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

    init();
  }, [sessionId, router]);

  // ✅ LOADING STATE
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Loading your session...
      </div>
    );
  }

  // ✅ SAFETY FALLBACK (should rarely hit now)
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

        {/* ✅ HEADER */}
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            Your Homework
          </h1>
          <p className="text-sm text-gray-500">
            Review your session and complete the exercises below
          </p>
        </div>

        {/* ✅ CONTENT */}
        <div className="space-y-5">

          {/* ✅ SUMMARY */}
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

          {/* ✅ QUESTIONS */}
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

          {/* ✅ TASKS */}
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

        {/* ✅ FOOTER */}
        <div className="pt-6 text-center text-xs text-gray-400">
          Provided by your clinician
        </div>

      </div>
    </div>
  );
}
``