"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Activity, Database, LayoutDashboard, LogOut, Menu, Plus, ShieldCheck, Sparkles, Wrench, Settings, X } from "lucide-react";
import Logo from "@/components/ui/logo";

const nav = [
  { href: "/app", label: "Mission center", icon: LayoutDashboard },
  { href: "/app/new", label: "New mission", icon: Plus },
  { href: "/app/data", label: "Data sources", icon: Database },
  { href: "/app/tools", label: "Tool registry", icon: Wrench },
  { href: "/app/approvals", label: "Approvals", icon: ShieldCheck },
  { href: "/app/settings", label: "Settings", icon: Settings },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<{ display_name: string; email: string; onboarded?: boolean } | null>(null);
  const [checked, setChecked] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((response) => response.json())
      .then((data) => {
        if (!data.user) router.replace("/login");
        else {
          if (data.user.onboarded === false && pathname !== "/app/onboarding") {
            router.replace("/app/onboarding");
            return;
          }
          setUser(data.user);
          setChecked(true);
        }
      })
      .catch(() => router.replace("/login"));
  }, [router]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  if (!checked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex items-center gap-3 font-mono text-sm text-muted">
          <span className="h-2 w-2 animate-trace-pulse rounded-full bg-accent" /> Connecting to TRACE...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-border bg-surface/90 px-4 py-3 backdrop-blur-xl lg:hidden">
        <Link href="/app" aria-label="TRACE mission center"><Logo /></Link>
        <button
          type="button"
          aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((open) => !open)}
          className="rounded-lg border border-border p-2 text-muted transition hover:border-accent/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>
      {mobileOpen && (
        <div className="fixed inset-0 z-30 bg-background/70 backdrop-blur-sm lg:hidden" onClick={() => setMobileOpen(false)} aria-hidden="true" />
      )}
      <aside className={`fixed inset-y-0 left-0 z-30 flex w-[min(21rem,88vw)] flex-col border-r border-border bg-surface/95 backdrop-blur-xl transition-transform duration-200 lg:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full"} lg:w-72`}>
        <div className="border-b border-border px-6 py-6">
          <Link href="/app"><Logo /></Link>
          <div className="mt-5 flex items-center gap-2 rounded-lg border border-accent/20 bg-accent/5 px-3 py-2 font-mono text-[10px] tracking-[0.18em] text-accent">
            <Activity className="h-3.5 w-3.5" /> RUNTIME ONLINE
          </div>
        </div>
        <nav className="flex-1 space-y-1 p-4">
          <div className="mb-3 px-3 font-mono text-[10px] tracking-[0.2em] text-muted">WORKSPACE</div>
          {nav.map((item) => {
            const active = item.href === "/app" ? pathname === "/app" : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${active ? "border border-accent/30 bg-accent/10 text-accent" : "text-muted hover:bg-surface-2 hover:text-foreground"}`}>
                <Icon className="h-4 w-4" /> {item.label}
              </Link>
            );
          })}
          <div className="mt-8 rounded-2xl border border-amber/20 bg-amber/5 p-4">
            <div className="flex items-center gap-2 font-mono text-[10px] tracking-widest text-amber"><Sparkles className="h-3.5 w-3.5" /> AGENT MODE</div>
            <p className="mt-2 text-xs leading-relaxed text-muted">Reads run automatically. High-impact actions pause for your authorization.</p>
          </div>
        </nav>
        <div className="border-t border-border p-4">
          <div className="truncate text-sm font-medium">{user?.display_name || user?.email}</div>
          <div className="mt-1 truncate font-mono text-[10px] text-muted">{user?.email}</div>
          <button onClick={logout} className="mt-4 flex items-center gap-2 text-xs text-muted transition hover:text-foreground"><LogOut className="h-3.5 w-3.5" /> Sign out</button>
        </div>
      </aside>
      <main className="min-h-screen lg:pl-72">{children}</main>
    </div>
  );
}
