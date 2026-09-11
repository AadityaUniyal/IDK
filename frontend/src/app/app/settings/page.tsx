"use client";

import { useEffect, useState } from "react";
import { Save, Settings2, ShieldCheck, Cpu, KeyRound, Check } from "lucide-react";

type Settings = { email: string; displayName: string; autonomyMode: string; defaultProvider: string };

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  // Password change state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passError, setPassError] = useState("");
  const [passSaved, setPassSaved] = useState(false);
  const [passLoading, setPassLoading] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => setSettings(d.settings))
      .catch(() => setError("Unable to load settings"));
  }, []);

  async function save() {
    if (!settings) return;
    setSaved(false);
    setError("");
    const response = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setError(body.error ?? "Unable to save settings");
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setPassLoading(true);
    setPassError("");
    setPassSaved(false);

    const res = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });

    const data = await res.json();
    setPassLoading(false);

    if (!res.ok) {
      setPassError(data.error ?? "Password update failed");
      return;
    }

    setPassSaved(true);
    setCurrentPassword("");
    setNewPassword("");
    setTimeout(() => setPassSaved(false), 3000);
  }

  if (!settings) return <div className="p-8 font-mono text-sm text-muted">{error || "Loading control plane..."}</div>;

  return (
    <div className="relative min-h-screen overflow-hidden p-6 md:p-10">
      <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-accent/10 blur-3xl" />
      <div className="relative max-w-4xl space-y-8">
        <div>
          <div className="flex items-center gap-2 font-mono text-xs tracking-widest text-accent">
            <Settings2 className="h-4 w-4" /> CONTROL PLANE
          </div>
          <h1 className="mt-2 text-3xl font-semibold">Workspace settings</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
            Tune how TRACE reasons, which provider it prefers, and how much autonomy it can exercise on your behalf.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          {/* Identity */}
          <section className="glass rounded-2xl p-6">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-accent" />
              <div>
                <h2 className="font-medium">Identity</h2>
                <p className="text-xs text-muted">How the workspace addresses you.</p>
              </div>
            </div>
            <label className="mt-6 block text-xs font-mono text-muted">
              DISPLAY NAME
              <input
                value={settings.displayName}
                onChange={(e) => setSettings({ ...settings, displayName: e.target.value })}
                className="mt-2 w-full rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm outline-none focus:border-accent"
              />
            </label>
            <div className="mt-4 rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm text-muted">
              {settings.email}
            </div>
          </section>

          {/* Behavior */}
          <section className="glass rounded-2xl p-6">
            <div className="flex items-center gap-3">
              <Cpu className="h-5 w-5 text-amber" />
              <div>
                <h2 className="font-medium">Agent behavior</h2>
                <p className="text-xs text-muted">Deterministic gates always override the model.</p>
              </div>
            </div>
            <label className="mt-6 block text-xs font-mono text-muted">
              AUTONOMY MODE
              <select
                value={settings.autonomyMode}
                onChange={(e) => setSettings({ ...settings, autonomyMode: e.target.value })}
                className="mt-2 w-full rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm outline-none focus:border-accent"
              >
                <option value="observe">Observe - propose only</option>
                <option value="assist">Assist - writes require approval</option>
                <option value="controlled_autonomous">Controlled autonomous</option>
              </select>
            </label>
            <label className="mt-4 block text-xs font-mono text-muted">
              DEFAULT MODEL PROVIDER
              <select
                value={settings.defaultProvider}
                onChange={(e) => setSettings({ ...settings, defaultProvider: e.target.value })}
                className="mt-2 w-full rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm outline-none focus:border-accent"
              >
                <option value="gemini">Gemini</option>
                <option value="groq">Groq</option>
              </select>
            </label>
          </section>
        </div>

        {error && <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}

        <button
          onClick={save}
          className="flex items-center gap-2 rounded-xl bg-accent px-5 py-3 font-medium text-background transition hover:brightness-110"
        >
          <Save className="h-4 w-4" /> {saved ? "Saved" : "Save settings"}
        </button>

        {/* Security & Password Form */}
        <section className="glass rounded-2xl p-6 max-w-xl">
          <div className="flex items-center gap-3">
            <KeyRound className="h-5 w-5 text-accent" />
            <div>
              <h2 className="font-medium">Security & Credentials</h2>
              <p className="text-xs text-muted">Update your workspace sign-in password.</p>
            </div>
          </div>

          <form onSubmit={changePassword} className="mt-6 space-y-4">
            <input
              type="password"
              required
              placeholder="Current password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm outline-none focus:border-accent"
            />
            <input
              type="password"
              required
              placeholder="New password (min 8 characters)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm outline-none focus:border-accent"
            />

            {passError && (
              <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-xs text-red-300">
                {passError}
              </p>
            )}

            {passSaved && (
              <p className="flex items-center gap-2 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-4 py-2 text-xs text-cyan-300">
                <Check className="h-4 w-4" /> Password updated successfully!
              </p>
            )}

            <button
              disabled={passLoading}
              className="rounded-xl border border-border bg-surface-2 px-5 py-2.5 font-medium text-xs text-slate-200 hover:border-accent transition disabled:opacity-50"
            >
              {passLoading ? "Updating..." : "Update password"}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
