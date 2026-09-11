// AI Guard & Prompt Injection Defense Engine

export interface GuardResult {
  safe: boolean;
  sanitized: string;
  reason?: string;
}

const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous\s+)?instructions/i,
  /disregard\s+(all\s+)?prior\s+prompts/i,
  /system\s+prompt\s*:/i,
  /\bDAN\s+mode\b/i,
  /bypass\s+safety\s+filter/i,
  /override\s+autonomy\s+policy/i,
  /forget\s+your\s+rules/i,
  /you\s+are\n+now\s+free\s+from/i,
];

export function sanitizePromptInput(input: string): GuardResult {
  const trimmed = String(input ?? "").trim();
  if (!trimmed) return { safe: true, sanitized: "" };

  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        safe: false,
        sanitized: trimmed.replace(pattern, "[PROMPT_INJECTION_NEUTRALIZED]"),
        reason: `Detected adversarial prompt pattern: ${pattern.source}`,
      };
    }
  }

  return { safe: true, sanitized: trimmed };
}
