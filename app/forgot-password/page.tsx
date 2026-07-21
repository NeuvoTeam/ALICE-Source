"use client";

import { useState } from "react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);

  const handleReset = async () => {
    try {
      setSending(true);

      alert(
        "Reset password functionality will be connected next."
      );
    } finally {
      setSending(false);
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
          width: 520,
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
          Enter your email address and we'll send you a password reset link.
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
            marginBottom: 16,
            border: "1px solid #d1d5db",
            borderRadius: 10,
            boxSizing: "border-box",
          }}
        />

<button
  onClick={handleReset}
  disabled={sending}
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
  {sending
    ? "Sending..."
    : "Send Reset Link"}
</button>

<div
  style={{
    textAlign: "center",
    marginTop: 16,
  }}
>
  <button
    onClick={() => {
      window.location.href = "/login";
    }}
    style={{
      background: "none",
      border: "none",
      color: "#06b6d4",
      cursor: "pointer",
      fontSize: 14,
    }}
  >
    Back to Login
  </button>
</div>
      </div>
    </div>
  );
}