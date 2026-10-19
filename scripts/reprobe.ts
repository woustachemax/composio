import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { GuideSchema, type Probe } from "../src/lib/guide-schema";
import { probeAuthorize, probeConsole, probeDiscovery } from "../src/lib/probes";

const dir = join(process.cwd(), "src/content/guides");
const out = join(process.cwd(), "src/content/reprobe-report.json");

type Row = {
  guide: string;
  probeId: string;
  kind: Probe["kind"];
  recorded: Probe["outcome"];
  rerun: Probe["outcome"] | "skipped";
  observed: string;
};

function firstUrl(request: string) {
  const m = request.match(/https?:\/\/[^\s,)]+/);
  return m ? m[0].replace(/[.…]+$/, "") : null;
}

async function main() {
  const rows: Row[] = [];
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
    const guide = GuideSchema.parse(JSON.parse(readFileSync(join(dir, file), "utf8")));
    for (const p of guide.probes) {
      const url = firstUrl(p.request);
      const base = { guide: guide.slug, probeId: p.id, kind: p.kind, recorded: p.outcome };
      if (!url || url.includes("{") || p.kind === "token-endpoint" || p.kind === "other") {
        rows.push({ ...base, rerun: "skipped", observed: p.kind === "token-endpoint" ? "Token probes use POST and are re-run by hand only." : "Templated or non-standard request; not re-run automatically." });
        continue;
      }
      let result;
      if (p.kind === "oidc-discovery") result = await probeDiscovery(p.id, url.replace(/\/\.well-known\/.*$/, ""));
      else if (p.kind === "authorize-endpoint") result = await probeAuthorize(p.id, url.split("?")[0]);
      else result = await probeConsole(p.id, url);
      rows.push({ ...base, rerun: result.probe.outcome, observed: result.probe.observed });
    }
  }
  const drift = rows.filter((r) => r.rerun !== "skipped" && r.rerun !== r.recorded);
  writeFileSync(out, JSON.stringify({ ranAt: new Date().toISOString().slice(0, 10), total: rows.length, drift: drift.length, rows }, null, 2) + "\n");
  for (const r of rows) console.log(`${r.guide.padEnd(8)} ${r.probeId.padEnd(30)} recorded=${r.recorded.padEnd(12)} rerun=${r.rerun}${r.rerun !== "skipped" && r.rerun !== r.recorded ? "  DRIFT" : ""}`);
}

main();
