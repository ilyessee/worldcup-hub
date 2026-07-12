"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { API_URL, getToken, setToken } from "@/lib/api";

function Landing() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [devMode, setDevMode] = useState(false);
  const [error, setError] = useState(null);
  const reason = searchParams.get("reason");

  useEffect(() => {
    // Already logged in? Straight to the dashboard.
    if (getToken()) {
      router.replace("/dashboard");
      return;
    }
    // Detect whether the backend allows the dev login shortcut
    fetch(`${API_URL}/auth/dev-login?email=probe@dev.local`)
      .then((r) => setDevMode(r.ok))
      .catch(() => setDevMode(false));
  }, [router]);

  async function devLogin() {
    try {
      const r = await fetch(`${API_URL}/auth/dev-login?email=demo@worldcuphub.dev&name=Demo User`);
      const body = await r.json();
      if (!r.ok) throw new Error(body.error || "Dev login failed");
      setToken(body.token);
      router.push("/dashboard");
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <main>
    <div className="hero">
      <h1>⚽ WorldCup Hub <span className="accent">2026</span></h1>
      <p>
        Predictions, favorite teams and live scores for the 2026 World Cup —
        powered by our ML prediction API.
      </p>
      {reason === "session-expired" && (
        <p className="error">Your session expired, please log in again.</p>
      )}
      <div className="row" style={{ justifyContent: "center" }}>
        <a className="btn" href={`${API_URL}/auth/google`}>
          Sign in with Google
        </a>
        {devMode && (
          <button className="btn secondary" onClick={devLogin}>
            Dev login (no Google)
          </button>
        )}
      </div>
      {error && <p className="error">{error}</p>}
    </div>
    </main>
  );
}

export default function Home() {
  return (
    <Suspense>
      <Landing />
    </Suspense>
  );
}
