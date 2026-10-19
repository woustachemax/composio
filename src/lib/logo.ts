import { cacheLife } from "next/cache";

const LOGO_BASE = "https://logos.composio.dev/api/";

const aliases: Record<string, string> = {
  x: "twitter",
  "x-twitter": "twitter",
  "google-oauth": "gmail",
};

export function logoCandidates(app: { slug: string; name: string; website?: string }): string[] {
  const out: string[] = [];
  const push = (s: string | undefined) => {
    if (!s) return;
    const clean = s.toLowerCase().replace(/[^a-z0-9-]/g, "");
    if (!clean) return;
    const v = aliases[clean] ?? clean;
    if (!out.includes(v)) out.push(v);
  };
  push(app.slug);
  push(app.name.split(/[\s(]/)[0]);
  push(app.name.replace(/\(.*\)/, "").replace(/\s+/g, ""));
  if (app.website) {
    try {
      const host = new URL(app.website).hostname.replace(/^www\./, "");
      push(host.split(".").slice(-2, -1)[0]);
    } catch {}
  }
  return out.slice(0, 4);
}

export async function resolveLogo(candidates: string[]): Promise<string | null> {
  "use cache";
  for (const slug of candidates) {
    const url = `${LOGO_BASE}${encodeURIComponent(slug)}`;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
      if (res.ok && res.headers.get("x-logo-fallback") !== "true") {
        cacheLife("weeks");
        return url;
      }
    } catch {
      cacheLife("minutes");
      return null;
    }
  }
  cacheLife("weeks");
  return null;
}

export async function logoFor(app: { slug: string; name: string; website?: string }) {
  return resolveLogo(logoCandidates(app));
}
