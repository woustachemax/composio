import type { Probe } from "@/lib/guide-schema";

export type GenerationEvent =
  | { type: "started"; app: string; model: string }
  | { type: "note"; text: string }
  | { type: "search"; query: string; repeat?: boolean }
  | { type: "fetch"; url: string; repeat?: boolean }
  | { type: "fetched"; url: string; ok: boolean; title?: string }
  | { type: "probe"; probe: Probe }
  | { type: "thinking"; phase: "research" | "planning"; update: string | null; seconds: number }
  | { type: "writing"; chars: number; section: string | null; sectionsStarted: number; sectionsTotal: number }
  | { type: "submit"; attempt: number }
  | { type: "invalid"; issues: string[] }
  | { type: "check"; message: string }
  | { type: "checked"; sourcesKept: number; sourcesDropped: number; claimsDowngraded: number }
  | { type: "done"; slug: string; source: "library" | "cache" | "generated" }
  | { type: "unsupported"; reason: string; message: string; suggestions: string[] }
  | { type: "error"; message: string; code?: "rate_limited" | "invalid_input" | "timeout"; retryAfter?: number };
