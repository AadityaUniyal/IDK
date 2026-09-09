"use client";

import { useEffect, useState } from "react";
import { Search, Compass, Database, Wrench, PlusCircle, Shield, X } from "lucide-react";
import Link from "next/link";

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  if (!open) return null;

  const actions = [
    { title: "Create New Mission", href: "/app/new", icon: PlusCircle, category: "Actions" },
    { title: "Mission Control Center", href: "/app", icon: Compass, category: "Navigation" },
    { title: "Data Sources Inventory", href: "/app/data", icon: Database, category: "Data" },
    { title: "Tool Registry & Capabilities", href: "/app/tools", icon: Wrench, category: "Tools" },
    { title: "Approval Gate Center", href: "/app/approvals", icon: Shield, category: "Security" },
    { title: "Hero Presentation Demo", href: "/hero-demo", icon: Compass, category: "Demos" },
    { title: "Hold To Confirm Demo", href: "/hold-to-confirm-demo", icon: Shield, category: "Demos" },
  ];

  const filtered = actions.filter((a) =>
    a.title.toLowerCase().includes(query.toLowerCase()) || a.category.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/80 p-4 pt-20 backdrop-blur-md">
      <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl">
        <div className="flex items-center border-b border-slate-800 px-4 py-3">
          <Search className="h-5 w-5 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command or search TRACE..."
            className="flex-1 bg-transparent px-3 text-sm text-slate-100 placeholder-slate-500 outline-none"
            autoFocus
          />
          <button onClick={() => setOpen(false)} className="text-slate-500 hover:text-slate-300">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-80 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <p className="p-4 text-center text-xs text-slate-500">No commands matched "{query}".</p>
          ) : (
            filtered.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-between rounded-xl px-3 py-2.5 hover:bg-slate-800/60 transition"
                >
                  <div className="flex items-center gap-3">
                    <Icon className="h-4 w-4 text-cyan-400" />
                    <span className="text-sm font-medium text-slate-200">{item.title}</span>
                  </div>
                  <span className="font-mono text-[10px] uppercase text-slate-500">{item.category}</span>
                </Link>
              );
            })
          )}
        </div>

        <div className="flex items-center justify-between border-t border-slate-800 bg-slate-950/50 px-4 py-2 text-[11px] text-slate-500">
          <span>Navigate with mouse or arrow keys</span>
          <kbd className="rounded border border-slate-800 bg-slate-900 px-1.5 py-0.5 text-[10px]">ESC to close</kbd>
        </div>
      </div>
    </div>
  );
}
