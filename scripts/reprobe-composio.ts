import { existsSync } from "node:fs";
import { GuideSchema, type Guide, type Probe } from "../src/lib/guide-schema";
import { listLibraryGuides } from "../src/lib/library";
import { composioProbeEnabled, probeComposioToolkit } from "../src/lib/probes";
import { listGeneratedGuides, saveGeneratedGuide, storageMode } from "../src/lib/store";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const dryRun = process.argv.includes("--dry-run");

function candidateSlugs(guide: Guide) {
  const slugs: string[] = [];
  const existing = guide.probes.find((p) => p.kind === "composio-toolkit");
  const fromProbe = existing?.request.match(/\/toolkits\/([a-z0-9_-]+)/i)?.[1];
  if (fromProbe) slugs.push(fromProbe);
  for (const s of guide.sources) {
    const m = s.url.match(/docs\.composio\.dev\/toolkits\/([a-z0-9_-]+)\/?$/i)?.[1];
    if (m && m !== "managed-auth") slugs.push(m);
  }
  slugs.push(guide.slug, guide.app.name.toLowerCase().replace(/[^a-z0-9]+/g, ""));
  return [...new Set(slugs.map((s) => s.toLowerCase()))];
}

async function liveProbe(guide: Guide, id: string) {
  let last: Probe | null = null;
  for (const slug of candidateSlugs(guide)) {
    const { probe } = await probeComposioToolkit(id, slug);
    if (probe.outcome !== "inconclusive") return probe;
    last = probe;
  }
  return last;
}

function nextProbeId(guide: Guide) {
  const ids = new Set(guide.probes.map((p) => p.id));
  for (let n = 1; ; n++) if (!ids.has(`probe-composio-recheck-${n}`)) return `probe-composio-recheck-${n}`;
}

function applyProbe(guide: Guide, probe: Probe): Guide {
  const managed = probe.outcome === "confirmed" ? "yes" : "no";
  const prior = guide.composio.evidence;
  const priorNote = prior.status === "tested" ? null : prior.status === "uncertain" ? prior.reason : prior.note;
  const hadProbe = guide.probes.some((p) => p.id === probe.id);
  return GuideSchema.parse({
    ...guide,
    composio: {
      ...guide.composio,
      managedAuthAvailable: managed,
      evidence: {
        status: "tested",
        probeIds: [probe.id],
        sourceIds: prior.sourceIds,
        note: [probe.observed, priorNote].filter(Boolean).join(" "),
      },
    },
    probes: hadProbe ? guide.probes.map((p) => (p.id === probe.id ? probe : p)) : [...guide.probes, probe],
  });
}

async function main() {
  if (!composioProbeEnabled()) {
    console.error("COMPOSIO_API_KEY is not set. Nothing was checked.");
    process.exit(1);
  }
  console.log(`Storage: ${storageMode()}${dryRun ? " (dry run, nothing is saved)" : ""}`);
  let failures = 0;

  for (const guide of await listGeneratedGuides()) {
    const id = guide.probes.find((p) => p.kind === "composio-toolkit")?.id ?? nextProbeId(guide);
    const probe = await liveProbe(guide, id);
    const before = guide.composio.managedAuthAvailable;
    if (!probe || probe.outcome === "inconclusive") {
      failures++;
      console.log(`generated ${guide.slug.padEnd(14)} ${before.padEnd(8)} unchanged   ${probe?.observed ?? "no slug to try"}`);
      continue;
    }
    const updated = applyProbe(guide, probe);
    const after = updated.composio.managedAuthAvailable;
    if (!dryRun) await saveGeneratedGuide(updated);
    console.log(`generated ${guide.slug.padEnd(14)} ${before.padEnd(8)} -> ${after.padEnd(8)}${before === after ? "" : " CHANGED"}  ${probe.observed}`);
  }

  for (const guide of listLibraryGuides()) {
    const probe = await liveProbe(guide, "probe-composio-library-check");
    const live = !probe || probe.outcome === "inconclusive" ? "inconclusive" : probe.outcome === "confirmed" ? "yes" : "no";
    const drift = live !== "inconclusive" && live !== guide.composio.managedAuthAvailable;
    if (drift || live === "inconclusive") failures++;
    console.log(`library   ${guide.slug.padEnd(14)} ${guide.composio.managedAuthAvailable.padEnd(8)} live ${live.padEnd(12)}${drift ? " DRIFT, update the JSON by hand" : ""}`);
  }

  process.exit(failures > 0 ? 1 : 0);
}

main();
