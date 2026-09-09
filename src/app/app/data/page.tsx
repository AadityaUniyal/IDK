"use client";

import { useEffect, useRef, useState } from "react";

type Source = { id: string; name: string; type: string; size: number; created_at: string };

export default function DataPage() {
  const [sources, setSources] = useState<Source[] | null>(null);
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    const d = await fetch("/api/data-sources").then((r) => r.json());
    setSources(d.sources ?? []);
  }
  useEffect(() => { load(); }, []);

  async function upload(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/data-sources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, content }),
    });
    const d = await res.json();
    setBusy(false);
    if (!res.ok) { setError(d.error); return; }
    setName(""); setContent("");
    load();
  }

  async function uploadFile(file: File) {
    setBusy(true);
    setError("");
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result);
        resolve(result.includes(",") ? result.split(",")[1] : result);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    const res = await fetch("/api/data-sources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: file.name, base64 }),
    });
    const d = await res.json();
    setBusy(false);
    if (!res.ok) { setError(d.error); return; }
    load();
  }

  async function remove(id: string) {
    await fetch(`/api/data-sources?id=${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="text-2xl font-semibold">Data sources</h1>
      <p className="mt-1 text-sm text-muted">Text, Markdown, JSON and CSV become searchable context for the agent. PDFs should be extracted to text first.</p>

      <div className="glass mt-6 rounded-2xl p-6">
        <form onSubmit={upload} className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="font-mono text-xs text-muted">UPLOAD</div>
            <button type="button" onClick={() => fileRef.current?.click()} className="text-xs text-accent hover:underline">
              or pick a file (.txt .md .json .csv .log)
            </button>
            <input
              ref={fileRef} type="file" hidden accept=".txt,.md,.markdown,.json,.csv,.log,.tsv"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f); e.target.value = ""; }}
            />
          </div>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Source name, e.g. sales.csv"
            className="w-full rounded-lg border border-border bg-surface-2 px-4 py-2.5 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-accent" />
          <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={6} placeholder="Paste content here…"
            className="w-full resize-y rounded-lg border border-border bg-surface-2 px-4 py-2.5 font-mono text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-accent" />
          {error && <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-300">{error}</p>}
          <button disabled={busy || !name || !content} className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background hover:brightness-110 disabled:opacity-50 transition">
            {busy ? "Uploading…" : "Add source"}
          </button>
        </form>
      </div>

      <div className="mt-8">
        <h2 className="font-mono text-xs tracking-widest text-muted">
          {sources ? `${sources.length} SOURCE(S) READY` : "LOADING…"}
        </h2>
        <div className="mt-3 space-y-2">
          {(sources ?? []).map((s) => (
            <div key={s.id} className="glass flex items-center justify-between rounded-xl px-4 py-3">
              <div>
                <span className="font-medium">{s.name}</span>
                <span className="ml-3 font-mono text-xs text-muted">{s.type} · {s.size.toLocaleString()} chars</span>
              </div>
              <button onClick={() => remove(s.id)} className="text-xs text-muted hover:text-red-300 transition">Delete</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
