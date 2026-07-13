// PURPOSE: Frontend helper for talking to the gateway with the JWT.
//
// WHAT THIS FILE DOES:
//   1. getToken / setToken / clearToken -> store the JWT in localStorage
//   2. apiFetch() -> attach "Authorization: Bearer <jwt>" to every request,
//      and on a 401 (expired token) clear it and redirect to the login page
export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

export function setToken(token) {
  localStorage.setItem("token", token);
}

export function clearToken() {
  localStorage.removeItem("token");
}

// Authenticated fetch: attaches the JWT, and redirects to the login
// page whenever the backend answers 401 (expired/invalid token).
export async function apiFetch(path, options = {}) {
  const token = getToken();
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  if (response.status === 401) {
    clearToken();
    window.location.href = "/?reason=session-expired";
    throw new Error("Session expired");
  }

  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "Request failed");
  return body;
}
