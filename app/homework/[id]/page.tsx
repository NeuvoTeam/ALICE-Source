"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const API = "https://clinical-ai-backend.neuvoteam.workers.dev";

export default function HomeworkPage() {
  const { id } = useParams();
  const router = useRouter();

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // ✅ 1. Check login FIRST
  useEffect(() => {
    const checkAuth = async () => {
      const { data: userData } = await supabase.auth.getUser();

      if (!userData.user) {
        router.push(`/client-login?redirect=/homework/${id}`);
        return;
      }

      fetchHomework();
    };

    checkAuth();
  }, [id]);

  // ✅ 2. Fetch homework
  const fetchHomework = async () => {
    try {
      const res = await fetch(`${API}/client-homework/${id}`);
      const json = await res.json();

      console.log("API DATA:", json); // ✅ debug helper

      setData(json);
    } catch (err) {
      console.error("Failed to fetch homework:", err);
    } finally {
      setLoading(false);
    }
  };

  // ✅ 3. Loading state
  if (loading || !data) {
    return <div style={{ padding: 40 }}>Loading homework...</div>;
  }

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Your Session Work</h1>
      <p style={styles.subtitle}>{data.title || "Session"}</p>

      {/* ✅ Homework */}
      <div style={styles.card}>
        <h2>📝 Homework</h2>

        {Array.isArray(data.homework) ? (
          data.homework.map((h: string, i: number) => (
            <label key={i} style={styles.item}>
              <input type="checkbox" /> {h}
            </label>
          ))
        ) : (
          <p>No homework available</p>
        )}
      </div>

      {/* ✅ Reflection Questions */}
      <div style={styles.card}>
        <h2>💬 Reflection Questions</h2>

        {Array.isArray(data.quiz) ? (
          data.quiz.map((q: string, i: number) => (
            <p key={i} style={styles.item}>{q}</p>
          ))
        ) : (
          <p>No questions available</p>
        )}
      </div>

      {/* ✅ Scenario */}
      <div style={styles.card}>
        <h2>📖 Scenario</h2>
        <p>{data.vignette || "No scenario provided"}</p>
      </div>
    </div>
  );
}

// ✅ simple clean styling
const styles = {
  container: {
    maxWidth: 600,
    margin: "40px auto",
    padding: 20,
    fontFamily: "Arial",
  },
  title: {
    fontSize: 28,
    marginBottom: 5,
  },
  subtitle: {
    color: "#666",
    marginBottom: 20,
  },
  card: {
    background: "#f5f7f9",
    padding: 20,
    borderRadius: 10,
    marginBottom: 20,
  },
  item: {
    display: "block",
    marginBottom: 10,
  },
};
``