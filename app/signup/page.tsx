"use client";

import { useState } from "react";

export default function SignupPage() {
  const [firstName, setFirstName] =
    useState("");

  const [lastName, setLastName] =
    useState("");

  const [email, setEmail] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [
    confirmPassword,
    setConfirmPassword,
  ] = useState("");

  const handleSignup = async () => {
    if (!firstName.trim()) {
      alert("First name is required");
      return;
    }

    if (!lastName.trim()) {
      alert("Last name is required");
      return;
    }

    if (!email.trim()) {
      alert("Email is required");
      return;
    }

    const emailRegex =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {
      alert("Please enter a valid email");
      return;
    }

    if (!password.trim()) {
      alert("Password is required");
      return;
    }

    if (password !== confirmPassword) {
      alert("Passwords do not match");
      return;
    }

    try {
      const res = await fetch(
        "https://clinical-ai-backend.neuvoteam.workers.dev/auth/signup",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            first_name: firstName,
            last_name: lastName,
            email,
            password,
          }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        console.error(
          "Signup Error:",
          data
        );
      
        if (
          data?.error_code ===
          "over_email_send_rate_limit"
        ) {
          alert(
            "Limit reached."
          );
          return;
        }
      
        alert(
          data?.msg ||
          data?.error ||
          "Signup failed"
        );
      
        return;
      }

      alert(
        data.message ||
          "Verification email sent"
      );

      setFirstName("");
      setLastName("");
      setEmail("");
      setPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      console.error(
        "Signup Exception:",
        err
      );
    
      alert(
        JSON.stringify(err, null, 2)
      );
    }
  };

  const isFormValid =
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      email
    ) &&
    password.length >= 8 &&
    password === confirmPassword;

  const inputStyle = {
    width: "100%",
    padding: 12,
    marginBottom: 12,
    border: "1px solid #d1d5db",
    borderRadius: 10,
    boxSizing:
      "border-box" as const,
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
          Create your account
        </p>

        <input
          placeholder="First Name"
          value={firstName}
          onChange={(e) =>
            setFirstName(e.target.value)
          }
          style={inputStyle}
        />

        <input
          placeholder="Last Name"
          value={lastName}
          onChange={(e) =>
            setLastName(e.target.value)
          }
          style={inputStyle}
        />

        <input
          placeholder="Email"
          value={email}
          onChange={(e) =>
            setEmail(e.target.value)
          }
          style={inputStyle}
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) =>
            setPassword(e.target.value)
          }
          style={inputStyle}
        />

        <input
          type="password"
          placeholder="Confirm Password"
          value={confirmPassword}
          onChange={(e) =>
            setConfirmPassword(
              e.target.value
            )
          }
          style={{
            ...inputStyle,
            marginBottom: 16,
          }}
        />

        <button
          onClick={handleSignup}
          disabled={!isFormValid}
          style={{
            width: "100%",
            padding: 12,
            border: "none",
            borderRadius: 10,
            background:
              isFormValid
                ? "#06b6d4"
                : "#cbd5e1",
            color: "#fff",
            fontWeight: 600,
            cursor:
              isFormValid
                ? "pointer"
                : "not-allowed",
          }}
        >
          Create Account
        </button>

        <div
          style={{
            textAlign: "center",
            marginTop: 16,
          }}
        >
          <button
            onClick={() => {
              window.location.href =
                "/login";
            }}
            style={{
              background: "none",
              border: "none",
              color: "#06b6d4",
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            Already have an account?
            Login
          </button>
        </div>
      </div>
    </div>
  );
}