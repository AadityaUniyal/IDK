"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Logo from "@/components/Logo";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error ?? "Sign-in failed"); return; }
    router.push("/app");
  }

  return (
    <main className="trace-grid-bg flex min-h-screen items-center justify-center px-6">
      <div className="glass w-full max-w-md rounded-2xl p-8">
        <div className="mb-6 flex justify-center"><Logo size={32} /></div>
        <h1 className="text-center text-xl font-semibold">Welcome back</h1>
        <p className="mt-1 text-center text-sm text-muted">Sign in to your mission control</p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <input
            type="email" required placeholder="Email" value={email} autoComplete="email"
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface-2 px-4 py-3 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          />
          <input
            type="password" required placeholder="Password" value={password} autoComplete="current-password"
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface-2 px-4 py-3 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          />
          {error && <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-300">{error}</p>}
          <button disabled={loading} className="w-full rounded-lg bg-accent px-4 py-3 font-medium text-background hover:brightness-110 disabled:opacity-60 transition">
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-muted">
          New to TRACE? <Link href="/signup" className="text-accent hover:underline">Create an account</Link>
        </p>
      </div>
    </main>
  );
}
