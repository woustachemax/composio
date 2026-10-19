import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { GuideSchema, type Evidence, type Guide } from "../src/lib/guide-schema";
import { allClaims } from "../src/lib/guide-view";

const dir = join(process.cwd(), "src/content/guides");
const out = join(process.cwd(), "src/content/quote-check.json");

function stripMarkdown(text: string) {
  return text.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/\*\*|__/g, "").replace(/(^|\s)_([^_]+)_/g, "$1$2");
}

function normalize(text: string) {
  return stripMarkdown(text)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;|&rsquo;|&lsquo;|’|‘/g, "'")
    .replace(/&ldquo;|&rdquo;|“|”/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/`/g, "")
    .replace(/\s+/g, " ")
    .replace(/\s+([.,;:)!?])/g, "$1")
    .replace(/\(\s+/g, "(")
    .replace(/\s*'\s*/g, "'")
    .toLowerCase()
    .trim();
}

function withEnglish(url: string) {
  const u = new URL(url);
  if (/(^|\.)google\.com$/.test(u.hostname) && !u.searchParams.has("hl")) u.searchParams.set("hl", "en");
  return u.toString();
}

const pageCache = new Map<string, Promise<string | null>>();
function getPage(url: string) {
  if (!pageCache.has(url))
    pageCache.set(
      url,
      fetch(withEnglish(url), {
        headers: { "user-agent": "Mozilla/5.0 (oauth-setup-guides quote checker)", accept: "text/html,text/plain", "accept-language": "en-US,en;q=0.9" },
        signal: AbortSignal.timeout(20000),
      })
        .then(async (r) => (r.ok ? normalize(await r.text()) : null))
        .catch(() => null),
    );
  return pageCache.get(url)!;
}

type Row = { guide: string; claim: string; quote: string; sources: string[]; result: "found" | "not-found" | "unreachable" };

async function main() {
  const rows: Row[] = [];
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
    const guide: Guide = GuideSchema.parse(JSON.parse(readFileSync(join(dir, file), "utf8")));
    for (const c of allClaims(guide)) {
      const ev: Evidence = c.evidence;
      if (ev.status !== "documented" || !ev.quote) continue;
      const urls = ev.sourceIds.map((id) => guide.sources.find((s) => s.id === id)!.url);
      const needle = normalize(ev.quote).replace(/\.\.\.|…/g, "").replace(/[.,;:]+$/, "");
      const pages = await Promise.all(urls.map(getPage));
      let result: Row["result"] = pages.every((p) => p === null) ? "unreachable" : "not-found";
      if (pages.some((p) => p && needle.split(/\s*\.\.\.\s*/).every((part) => p.includes(part.trim())))) result = "found";
      rows.push({ guide: guide.slug, claim: `${c.section}: ${c.label}`, quote: ev.quote, sources: urls, result });
    }
  }
  const links: { guide: string; url: string; status: number | null }[] = [];
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
    const guide: Guide = GuideSchema.parse(JSON.parse(readFileSync(join(dir, file), "utf8")));
    const statuses = await Promise.all(
      guide.sources.map((s) =>
        fetch(withEnglish(s.url), { headers: { "user-agent": "Mozilla/5.0 (oauth-setup-guides link checker)" }, signal: AbortSignal.timeout(20000) })
          .then((r) => r.status)
          .catch(() => null),
      ),
    );
    guide.sources.forEach((s, i) => links.push({ guide: guide.slug, url: s.url, status: statuses[i] }));
  }
  const broken = links.filter((l) => l.status === null || l.status >= 400);
  for (const b of broken) console.log(`link ${b.status ?? "error"} ${b.guide} ${b.url}`);
  const summary = { found: 0, "not-found": 0, unreachable: 0 } as Record<Row["result"], number>;
  for (const r of rows) summary[r.result]++;
  writeFileSync(out, JSON.stringify({ ranAt: new Date().toISOString().slice(0, 10), summary, rows, links: { checked: links.length, broken } }, null, 2) + "\n");
  for (const r of rows) if (r.result !== "found") console.log(`${r.result.padEnd(11)} ${r.guide} | ${r.claim}\n            “${r.quote}”\n            ${r.sources.join(" ")}`);
  console.log(summary);
}

main();
