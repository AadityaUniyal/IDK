"use client";

import { useEffect, useState } from "react";
import { Save, Settings2, ShieldCheck, Cpu } from "lucide-react";

type Settings = { email: string; displayName: string; autonomyMode: string; defaultProvider: string };

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/settings").then((r) => r.json()).then((d) => setSettings(d.settings)).catch(() => setError("Unable to load settings"));
  }, []);

  async function save() {
    if (!settings) return;
    setSaved(false);
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
  }

  if (!settings) return <div className="p-8 font-mono text-sm text-muted">{error || "Loading control plane..."}</div>;

  return (
    <div className="relative min-h-screen overflow-hidden p-6 md:p-10">
      <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-accent/10 blur-3xl" />
      <div className="relative max-w-4xl">
        <div className="flex items-center gap-2 font-mono text-xs tracking-widest text-accent"><Settings2 className="h-4 w-4" /> CONTROL PLANE</div>
        <h1 className="mt-2 text-3xl font-semibold">Workspace settings</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">Tune how TRACE reasons, which provider it prefers, and how much autonomy it can exercise on your behalf.</p>
        <div className="mt-8 grid gap-5 md:grid-cols-2">
          <section className="glass rounded-2xl p-6">
            <div className="flex items-center gap-3"><ShieldCheck className="h-5 w-5 text-accent" /><div><h2 className="font-medium">Identity</h2><p className="text-xs text-muted">How the workspace addresses you.</p></div></div>
            <label className="mt-6 block text-xs font-mono text-muted">DISPLAY NAME<input value={settings.displayName} onChange={(e) => setSettings({ ...settings, displayName: e.target.value })} className="mt-2 w-full rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm outline-none focus:border-accent" /></label>
            <div className="mt-4 rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm text-muted">{settings.email}</div>
          </section>
          <section className="glass rounded-2xl p-6">
            <div className="flex items-center gap-3"><Cpu className="h-5 w-5 text-amber" /><div><h2 className="font-medium">Agent behavior</h2><p className="text-xs text-muted">Deterministic gates always override the model.</p></div></div>
            <label className="mt-6 block text-xs font-mono text-muted">AUTONOMY MODE<select value={settings.autonomyMode} onChange={(e) => setSettings({ ...settings, autonomyMode: e.target.value })} className="mt-2 w-full rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm outline-none focus:border-accent"><option value="observe">Observe - propose only</option><option value="assist">Assist - writes require approval</option><option value="controlled_autonomous">Controlled autonomous</option></select></label>
            <label className="mt-4 block text-xs font-mono text-muted">DEFAULT MODEL PROVIDER<select value={settings.defaultProvider} onChange={(e) => setSettings({ ...settings, defaultProvider: e.target.value })} className="mt-2 w-full rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm outline-none focus:border-accent"><option value="gemini">Gemini</option><option value="groq">Groq</option></select></label>
          </section>
        </div>
        {error && <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}
        <button onClick={save} className="mt-6 flex items-center gap-2 rounded-xl bg-accent px-5 py-3 font-medium text-background transition hover:brightness-110"><Save className="h-4 w-4" /> {saved ? "Saved" : "Save settings"}</button>
      </div>
    </div>
  );
}
