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

      console.log(
        "Signup response:",
        data
      );

      if (!res.ok) {
        alert(
          data.error ||
            JSON.stringify(data) ||
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
        "Signup error:",
        err
      );

      alert(
        err?.message ||
          "Signup failed"
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

  return (
    <div style={{ padding: 40 }}>
      <h1>ALICE Signup</h1>

      <input
        placeholder="First Name *"
        value={firstName}
        onChange={(e) =>
          setFirstName(
            e.target.value
          )
        }
      />

      <br />
      <br />

      <input
        placeholder="Last Name *"
        value={lastName}
        onChange={(e) =>
          setLastName(
            e.target.value
          )
        }
      />

      <br />
      <br />

      <input
        placeholder="Email *"
        value={email}
        onChange={(e) =>
          setEmail(
            e.target.value
          )
        }
      />

      <br />
      <br />

      <input
        type="password"
        placeholder="Password *"
        value={password}
        onChange={(e) =>
          setPassword(
            e.target.value
          )
        }
      />

      <br />
      <br />

      <input
        type="password"
        placeholder="Confirm Password *"
        value={confirmPassword}
        onChange={(e) =>
          setConfirmPassword(
            e.target.value
          )
        }
      />

      <br />
      <br />

      <button
        onClick={handleSignup}
        disabled={!isFormValid}
        style={{
          padding: "10px 16px",
          borderRadius: 10,
          border: "none",
          background:
            isFormValid
              ? "#06b6d4"
              : "#cbd5e1",
          color: "#fff",
          cursor: isFormValid
            ? "pointer"
            : "not-allowed",
        }}
      >
        Create Account
      </button>
    </div>
  );
}