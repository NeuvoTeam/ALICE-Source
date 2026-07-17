"use client";

import { useState } from "react";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSignup = async () => {
    try {
      const res = await fetch(
        "https://clinical-ai-backend.neuvoteam.workers.dev/auth/signup",
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

      console.log(data);

      alert(
        data.message ||
          data.error ||
          "Signup complete"
      );
    } catch (err) {
      console.error(err);
      alert("Signup failed");
    }
  };

  return (
    <div style={{ padding: 40 }}>
      <h1>ALICE Signup</h1>

      <input
        placeholder="Email"
        value={email}
        onChange={(e) =>
          setEmail(e.target.value)
        }
      />

      <br />
      <br />

      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) =>
          setPassword(e.target.value)
        }
      />

      <br />
      <br />

      <button onClick={handleSignup}>
        Create Account
      </button>
    </div>
  );
}
