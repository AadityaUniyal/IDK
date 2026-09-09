export default function Logo({ size = 28 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2 select-none">
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <rect x="1.5" y="1.5" width="29" height="29" rx="7" stroke="var(--accent)" strokeWidth="2" />
        <circle cx="16" cy="9" r="2.6" fill="var(--accent)" />
        <path d="M16 12v8" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" />
        <path d="M16 20l-6 6M16 20l6 6" stroke="var(--amber)" strokeWidth="2" strokeLinecap="round" />
        <circle cx="7" cy="26" r="2" fill="var(--amber)" />
        <circle cx="25" cy="26" r="2" fill="var(--amber)" />
      </svg>
      <span className="font-semibold tracking-[0.22em] text-foreground">TRACE</span>
    </span>
  );
}
