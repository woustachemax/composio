import type { Probe } from "@/lib/guide-schema";

export type GenerationEvent =
  | { type: "started"; app: string; model: string }
  | { type: "note"; text: string }
  | { type: "search"; query: string }
  | { type: "fetch"; url: string }
  | { type: "fetched"; url: string; ok: boolean; title?: string }
  | { type: "probe"; probe: Probe }
  | { type: "submit"; attempt: number }
  | { type: "invalid"; issues: string[] }
  | { type: "check"; message: string }
  | { type: "done"; slug: string; source: "library" | "cache" | "generated" }
  | { type: "unsupported"; reason: string; message: string; suggestions: string[] }
  | { type: "error"; message: string; code?: "rate_limited" | "invalid_input"; retryAfter?: number };
