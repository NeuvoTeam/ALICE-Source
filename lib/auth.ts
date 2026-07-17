const API_BASE =
  "https://clinical-ai-backend.neuvoteam.workers.dev";

export async function getCurrentUser() {
  if (typeof window === "undefined") {
    return null;
  }

  const token =
    localStorage.getItem("alice_token");

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
  localStorage.removeItem(
    "alice_token"
  );

  window.location.href = "/login";
}

export function isAuthenticated() {
  if (typeof window === "undefined") {
    return false;
  }

  return !!localStorage.getItem(
    "alice_token"
  );
}