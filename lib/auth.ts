const API_BASE =
  "https://clinical-ai-backend.neuvoteam.workers.dev";

const TOKEN_KEY = "alice_token";

/** Authorization header for the current session, or `extra` unchanged when signed out. */
export function authHeaders(
  extra: Record<string, string> = {}
): Record<string, string> {
  const token =
    typeof window === "undefined"
      ? null
      : localStorage.getItem(TOKEN_KEY);

  return token
    ? { ...extra, Authorization: `Bearer ${token}` }
    : extra;
}

/**
 * Every clinician-facing Worker call goes through here: it attaches the Supabase
 * access token and, on 401, clears it and routes to /login. The token is removed
 * *before* navigating so /login cannot bounce back into a 401 loop.
 *
 * Client-facing pages (`/homework`, `/practice`) deliberately do NOT use this —
 * they read the narrow public projection with no token at all.
 */
export async function apiFetch(
  url: string,
  init: RequestInit = {}
): Promise<Response> {
  const res = await fetch(url, {
    ...init,
    headers: authHeaders(
      (init.headers as Record<string, string> | undefined) || {}
    ),
  });

  if (res.status === 401 && typeof window !== "undefined") {
    localStorage.removeItem(TOKEN_KEY);
    window.location.href = "/login";
  }

  return res;
}

export async function getCurrentUser() {
  if (typeof window === "undefined") {
    return null;
  }

  const token =
    localStorage.getItem(TOKEN_KEY);

  if (!token) {
    return null;
  }

  try {
    const res = await fetch(
      `${API_BASE}/auth/me`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!res.ok) {
      return null;
    }

    return await res.json();
  } catch (err) {
    console.error(
      "Failed to get current user:",
      err
    );

    return null;
  }
}

export function logout() {
  localStorage.removeItem(TOKEN_KEY);

  window.location.href = "/login";
}

export function isAuthenticated() {
  if (typeof window === "undefined") {
    return false;
  }

  return !!localStorage.getItem(TOKEN_KEY);
}