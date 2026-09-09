"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Logo from "@/components/Logo";

const nav = [
  { href: "/app", label: "Missions" },
  { href: "/app/new", label: "New mission" },
  { href: "/app/data", label: "Data sources" },
  { href: "/app/tools", label: "Tools" },
  { href: "/app/approvals", label: "Approvals" },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<{ display_name: string; email: string } | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (!d.user) router.replace("/login");
        else { setUser(d.user); setChecked(true); }
      })
      .catch(() => router.replace("/login"));
  }, [router]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  if (!checked) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex items-center gap-3 font-mono text-sm text-muted">
          <span className="h-2 w-2 rounded-full bg-accent animate-trace-pulse" /> Connecting to TRACE…
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-surface/60">
        <div className="px-5 py-5 border-b border-border">
          <Link href="/app"><Logo /></Link>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {nav.map((item) => {
            const active = item.href === "/app" ? pathname === "/app" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block rounded-lg px-3 py-2 text-sm transition ${active ? "bg-accent/10 text-accent border border-accent/30" : "text-muted hover:text-foreground hover:bg-surface-2"}`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-border p-4 text-sm">
          <div className="truncate font-medium">{user?.display_name || user?.email}</div>
          <button onClick={logout} className="mt-2 text-xs text-muted hover:text-foreground transition">Sign out</button>
        </div>
      </aside>
      <main className="flex-1 overflow-x-hidden">{children}</main>
    </div>
  );
}
