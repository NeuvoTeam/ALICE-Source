"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { CLINICAL_AI_API_BASE } from "@/lib/clinical-ai-api";

type HomeworkSession = {
  id?: string;
  name?: string;
  vignette?: string;
  quiz?: string[];
  homework?: string[];
};

export default function HomeworkPage() {
  const params = useParams();

  const sessionId =
    typeof params?.sessionId === "string"
      ? params.sessionId
      : Array.isArray(params?.sessionId)
      ? params.sessionId[0]
      : null;

  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<HomeworkSession | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!sessionId) {
        setError("Missing session ID");
        setLoading(false);
        return;
      }

      try {
        const url = `${CLINICAL_AI_API_BASE}/sessions/${sessionId}`;

        console.log("📚 HOMEWORK FETCH:", url);

        const res = await fetch(url, {
          method: "GET",
          cache: "no-store",
        });

        const data = await res.json().catch(() => null);

        console.log("📚 HOMEWORK STATUS:", res.status);
        console.log("📚 HOMEWORK RESPONSE:", data);

        if (!res.ok) {
          throw new Error(
            `Failed to load session (${res.status})`
          );
        }

        if (!data) {
          throw new Error("Empty session response");
        }

        setSession({
          id: data.id,
          name: data.name,
          vignette: data.vignette ?? "",
          quiz: Array.isArray(data.quiz)
            ? data.quiz
            : [],
          homework: Array.isArray(data.homework)
            ? data.homework
            : [],
        });

        setError(null);
      } catch (err: any) {
        console.error("❌ HOMEWORK LOAD FAILED", err);

        setSession(null);
        setError(
          err?.message ||
            "Unable to load homework session"
        );
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [sessionId]);

  /* =========================
     LOADING
  ========================= */
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Loading your session...
      </div>
    );
  }

  /* =========================
     ERROR
  ========================= */
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center max-w-md">
          <h2 className="text-red-700 font-semibold">
            Unable to Load Homework
          </h2>

          <p className="text-sm text-red-600 mt-2">
            {error}
          </p>

          <p className="text-xs text-gray-500 mt-4">
            Session ID: {sessionId}
          </p>
        </div>
      </div>
    );
  }

  /* =========================
     SAFETY
  ========================= */
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
          {!!session.vignette && (
            <div className="bg-white border rounded-xl p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-700 mb-2">
                Case Summary
              </h2>

              <p className="text-sm text-gray-600 leading-relaxed">
                {session.vignette}
              </p>
            </div>
          )}

          {/* QUESTIONS */}
          {session.quiz &&
            session.quiz.length > 0 && (
              <div className="bg-white border rounded-xl p-5 shadow-sm">
                <h2 className="text-sm font-semibold text-gray-700 mb-3">
                  Reflection Questions
                </h2>

                <ul className="space-y-3">
                  {session.quiz.map((question, index) => (
                    <li
                      key={index}
                      className="text-sm text-gray-700"
                    >
                      <span className="font-medium text-gray-900">
                        {index + 1}.
                      </span>{" "}
                      {question}
                    </li>
                  ))}
                </ul>
              </div>
            )}

          {/* TASKS */}
          {session.homework &&
            session.homework.length > 0 && (
              <div className="bg-white border rounded-xl p-5 shadow-sm">
                <h2 className="text-sm font-semibold text-gray-700 mb-3">
                  Your Tasks
                </h2>

                <ul className="space-y-2">
                  {session.homework.map((task, index) => (
                    <li
                      key={index}
                      className="flex items-start gap-3 text-sm text-gray-700"
                    >
                      <span className="mt-1 text-green-500 text-xs">
                        ●
                      </span>

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