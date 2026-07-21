"use client";

import { useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async () => {
    try {
      const res = await fetch(
        "https://clinical-ai-backend.neuvoteam.workers.dev/auth/login",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email,
            password,
          }),
        }
      );

      const data = await res.json();

      if (data.access_token) {
        localStorage.setItem(
          "alice_token",
          data.access_token
        );

        window.location.href =
          "/dashboard";

        return;
      }

      alert(
        data.error || "Login failed"
      );
    } catch (err) {
      console.error(err);
      alert("Login failed");
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        background:
          "linear-gradient(to bottom, #f8fafc, #eef6ff)",
      }}
    >
      <div
        style={{
          width: 480,
          background: "#fff",
          padding: 48,
          borderRadius: 24,
          boxShadow:
            "0 12px 30px rgba(15,23,42,0.08)",
        }}
      >
        <h1
          style={{
            margin: 0,
            textAlign: "center",
            fontSize: 42,
            fontWeight: 800,
            color: "#0f172a",
          }}
        >
          ALICE
        </h1>

        <p
          style={{
            textAlign: "center",
            color: "#64748b",
            fontSize: 14,
            marginTop: 8,
            marginBottom: 24,
          }}
        >
          Supporting mental health professionals with AI-assisted clinical tools
        </p>

        <input
          placeholder="Email"
          value={email}
          onChange={(e) =>
            setEmail(e.target.value)
          }
          style={{
            width: "100%",
            padding: 12,
            marginBottom: 12,
            border: "1px solid #d1d5db",
            borderRadius: 10,
            boxSizing: "border-box",
          }}
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) =>
            setPassword(e.target.value)
          }
          style={{
            width: "100%",
            padding: 12,
            marginBottom: 16,
            border: "1px solid #d1d5db",
            borderRadius: 10,
            boxSizing: "border-box",
          }}
        />

        <button
          onClick={handleLogin}
          style={{
            width: "100%",
            padding: 12,
            border: "none",
            borderRadius: 10,
            background: "#06b6d4",
            color: "#fff",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Login
        </button>

        <div
  style={{
    textAlign: "center",
    marginTop: 16,
  }}
>
  <a
    href="/forgot-password"
    style={{
      color: "#06b6d4",
      textDecoration: "none",
      fontSize: 14,
    }}
  >
    Forgot Password?
  </a>
</div>

<div
  style={{
    textAlign: "center",
    marginTop: 8,
  }}
>
  <a
    href="/signup"
    style={{
      color: "#06b6d4",
      textDecoration: "none",
      fontSize: 14,
    }}
  >
    Create Account
  </a>
</div>
      </div>
    </div>
  );
}