"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/* =========================
   ✅ SAFE REDIRECT
========================= */
// Only same-site relative paths are allowed. Rejects absolute URLs
// ("https://evil.com"), protocol-relative URLs ("//evil.com") and the backslash
// variant ("/\evil.com"), all of which would navigate off the app origin.
function resolveRedirect(target: string | null): string {
  if (!target) return "/";
  if (!target.startsWith("/")) return "/";
  if (target.startsWith("//")) return "/";
  if (target.includes("\\")) return "/";
  return target;
}

function ClientLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const redirect = resolveRedirect(searchParams.get("redirect"));

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    setLoading(true);
    setError("");

    if (!email || !password) {
      setError("Please enter email and password");
      setLoading(false);
      return;
    }

    router.push(redirect);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm bg-white p-6 rounded-xl shadow space-y-4">
        <h1 className="text-xl font-semibold text-center">
          Client Login
        </h1>

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border rounded px-3 py-2"
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border rounded px-3 py-2"
        />

        {error && (
          <div className="text-sm text-red-500 text-center">
            {error}
          </div>
        )}

        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full bg-black text-white py-2 rounded"
        >
          {loading ? "Logging in..." : "Login"}
        </button>
      </div>
    </div>
  );
}

export default function ClientLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="w-full max-w-sm bg-white p-6 rounded-xl shadow text-center text-sm text-gray-500">
            Loading...
          </div>
        </div>
      }
    >
      <ClientLoginForm />
    </Suspense>
  );
}