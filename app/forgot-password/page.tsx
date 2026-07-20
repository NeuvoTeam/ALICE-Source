"use client";

import { useState } from "react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");

  return (
    <div style={{ padding: 40 }}>
      <h1>ALICE</h1>

      <h2>Reset Password</h2>

      <input
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      <br />
      <br />

      <button>
        Send Reset Link
      </button>

      <br />
      <br />

      /login
    </div>
  );
}