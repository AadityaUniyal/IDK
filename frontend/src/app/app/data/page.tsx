"use client";

import { useEffect, useRef, useState } from "react";
import DocumentPreviewModal, { DataSource } from "@/components/ui/document-preview-modal";
import Ambient3DBackground from "@/components/ui/ambient-3d-background";
import { Eye, Trash2, FileText, UploadCloud } from "lucide-react";

type Source = { id: string; name: string; type: string; size: number; created_at: string; content?: string };

export default function DataPage() {
  const [sources, setSources] = useState<Source[] | null>(null);
  const [previewSource, setPreviewSource] = useState<DataSource | null>(null);
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
    const res = await fetch(`/api/data-sources/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Failed to delete data source");
      return;
    }
    load();
  }

  async function openPreview(s: Source) {
    if (s.content) {
      setPreviewSource(s as DataSource);
      return;
    }
    const res = await fetch(`/api/data-sources/${s.id}`);
    if (res.ok) {
      const d = await res.json();
      setPreviewSource(d.source as DataSource);
    } else {
      setPreviewSource({ id: s.id, name: s.name, type: s.type, content: "Unable to load document content." });
    }
  }

  return (
    <div className="relative min-h-screen p-8 text-slate-100 bg-slate-950">
      <Ambient3DBackground />
      <DocumentPreviewModal source={previewSource} onClose={() => setPreviewSource(null)} />

      <div className="relative z-10 max-w-4xl">
        <h1 className="text-2xl font-bold tracking-tight text-slate-100">Data Sources Inventory</h1>
        <p className="mt-1 text-sm text-slate-400">
          Upload text, Markdown, JSON, and CSV files to serve as searchable ground-truth context for autonomous AI investigations.
        </p>

        <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-md">
          <form onSubmit={upload} className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-mono text-xs text-cyan-400">
                <UploadCloud className="h-4 w-4" /> UPLOAD CONTEXT FILE
              </div>
              <button type="button" onClick={() => fileRef.current?.click()} className="text-xs text-cyan-400 hover:underline">
                or pick a file (.txt .md .json .csv .log)
              </button>
              <input
                ref={fileRef} type="file" hidden accept=".txt,.md,.markdown,.json,.csv,.log,.tsv"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f); e.target.value = ""; }}
              />
            </div>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Source name, e.g. sales_q3.csv"
              className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:border-cyan-500/50 focus:outline-none"
            />
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={5}
              placeholder="Paste text/CSV/JSON content here..."
              className="w-full resize-y rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 font-mono text-xs text-slate-200 placeholder-slate-500 focus:border-cyan-500/50 focus:outline-none"
            />
            {error && <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-xs text-red-300">{error}</p>}
            <button
              disabled={busy || !name || !content}
              className="rounded-xl bg-cyan-500 px-5 py-2.5 text-sm font-semibold text-slate-950 hover:bg-cyan-400 disabled:opacity-50 transition"
            >
              {busy ? "Uploading..." : "Add Data Source"}
            </button>
          </form>
        </div>

        <div className="mt-8">
          <h2 className="font-mono text-xs tracking-widest text-slate-400">
            {sources ? `${sources.length} DATA SOURCE(S) READY` : "LOADING..."}
          </h2>
          <div className="mt-3 space-y-2">
            {(sources ?? []).map((s) => (
              <div key={s.id} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3.5 backdrop-blur-md">
                <div className="flex items-center gap-3">
                  <FileText className="h-4 w-4 text-cyan-400" />
                  <div>
                    <span className="font-medium text-slate-100">{s.name}</span>
                    <span className="ml-3 font-mono text-xs text-slate-400">{s.type} · {s.size.toLocaleString()} chars</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openPreview(s)}
                    className="flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-950 px-3 py-1.5 font-mono text-xs text-cyan-400 hover:border-cyan-500/50"
                  >
                    <Eye className="h-3.5 w-3.5" /> Preview
                  </button>
                  <button
                    onClick={() => remove(s.id)}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-red-950/40 hover:text-red-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
