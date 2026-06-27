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

      // ✅ 1. Check if user is logged in
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push(`/client-login?redirect=/homework/${sessionId}`);
        return;
      }

      // ✅ 2. Fetch session from database
      const { data, error } = await supabase
        .from("sessions")
        .select("*")
        .eq("id", sessionId)
        .single();

      if (error || !data) {
        console.error("Session fetch error:", error);
        setSession(null);
      } else {
        setSession(data);
      }

      setLoading(false);
    };

    init();
  }, [sessionId, router]);

  // ✅ LOADING STATE
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Loading your homework...
      </div>
    );
  }

  // ✅ NOT FOUND
  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center text-red-500">
        Homework not found
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex justify-center">

      <div className="w-full max-w-2xl p-6 space-y-6">

        {/* HEADER */}
        <div className="text-center">
          <h1 className="text-2xl font-bold">
            Your Session Homework
          </h1>
          <p className="text-gray-500 text-sm">
            Please review and complete the tasks below
          </p>
        </div>

        {/* ✅ CASE SUMMARY */}
        {session.vignette && (
          <div className="bg-white p-5 rounded-xl shadow space-y-2">
            <h2 className="font-semibold text-lg">
              Case Summary
            </h2>
            <p className="text-sm text-gray-700 leading-relaxed">
              {session.vignette}
            </p>
          </div>
        )}

        {/* ✅ QUIZ */}
        {Array.isArray(session.quiz) && session.quiz.length > 0 && (
          <div className="bg-white p-5 rounded-xl shadow space-y-3">
            <h2 className="font-semibold text-lg">
              Reflection Questions
            </h2>

            {session.quiz.map((q: string, i: number) => (
              <div key={i} className="text-sm">
                <p className="font-medium">
                  {i + 1}. {q}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* ✅ HOMEWORK TASKS */}
        {Array.isArray(session.homework) && session.homework.length > 0 && (
          <div className="bg-white p-5 rounded-xl shadow space-y-3">
            <h2 className="font-semibold text-lg">
              Your Tasks
            </h2>

            <ul className="space-y-2">
              {session.homework.map((task: string, i: number) => (
                <li
                  key={i}
                  className="flex items-start gap-2 text-sm text-gray-700"
                >
                  <span className="mt-1 text-green-500">•</span>
                  {task}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* ✅ FOOTER */}
        <div className="text-center text-xs text-gray-400 pt-4">
          Provided by your clinician
        </div>

      </div>
    </div>
  );
}
