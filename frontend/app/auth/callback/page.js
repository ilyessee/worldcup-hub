"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { setToken } from "@/lib/api";

function Callback() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams.get("token");
    if (token) {
      setToken(token);
      router.replace("/dashboard");
    } else {
      router.replace("/?reason=login-failed");
    }
  }, [router, searchParams]);

  return <p className="muted">Signing you in…</p>;
}

export default function AuthCallback() {
  return (
    <Suspense>
      <Callback />
    </Suspense>
  );
}
