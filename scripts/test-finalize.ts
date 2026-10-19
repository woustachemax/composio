import assert from "node:assert/strict";
import github from "../src/content/guides/github.json";
import { finalizeSubmission, normalizeUrl } from "../src/lib/generate/finalize";
import { GuideSchema } from "../src/lib/guide-schema";
import { FORBIDDEN_PUNCTUATION } from "../src/lib/text";

const guide = GuideSchema.parse(github);
const { schemaVersion, slug, meta, probes, ...rest } = guide;
void schemaVersion;
void slug;
const submission = { ...rest, researchNotes: meta.researchNotes ?? "" };

const allFetched = new Set(guide.sources.map((s) => normalizeUrl(s.url)));
const full = finalizeSubmission({ submission, probes, fetchedUrls: allFetched, today: "2026-10-19" });
assert.equal(full.ok, true);
if (full.ok) {
  assert.equal(full.guide.meta.origin, "agent-generated");
  assert.equal(full.guide.slug, "github");
  assert.equal(full.checks.length, 0);
}

const partial = new Set([...allFetched].filter((u) => !u.includes("scopes-for-oauth-apps")));
const downgraded = finalizeSubmission({ submission, probes, fetchedUrls: partial, today: "2026-10-19" });
assert.equal(downgraded.ok, true);
if (downgraded.ok) {
  const pick = downgraded.guide.steps.find((s) => s.id === "pick-scopes");
  assert.equal(pick?.evidence.status, "uncertain");
  const coarse = downgraded.guide.requirements.find((r) => r.id === "coarse-scopes");
  assert.equal(coarse?.evidence.status, "documented");
  assert.ok(!downgraded.guide.sources.some((s) => s.id === "gh-scopes"));
  console.log("checks:", downgraded.checks);
}

const inconclusiveProbes = probes.map((p) => ({ ...p, outcome: "inconclusive" as const }));
const noTested = finalizeSubmission({ submission, probes: inconclusiveProbes, fetchedUrls: allFetched, today: "2026-10-19" });
assert.equal(noTested.ok, true);
if (noTested.ok) {
  assert.ok(![...noTested.guide.facts, ...noTested.guide.steps].some((x) => x.evidence.status === "tested"));
  const discovery = noTested.guide.facts.find((f) => f.id === "discovery");
  assert.equal(discovery?.evidence.status, "uncertain");
  console.log("checks:", noTested.checks);
}

const nothingFetched = finalizeSubmission({ submission, probes, fetchedUrls: new Set(), today: "2026-10-19" });
assert.equal(nothingFetched.ok, false);

const broken = finalizeSubmission({ submission: { ...submission, summary: { ...submission.summary, difficulty: { level: "trivial" } } }, probes, fetchedUrls: allFetched, today: "2026-10-19" });
assert.equal(broken.ok, false);
if (!broken.ok) console.log("issues:", broken.issues.slice(0, 3));

const dashed = finalizeSubmission({
  submission: {
    ...submission,
    summary: { ...submission.summary, verdict: "Easy to set up \u2014 no review needed. Review takes 6\u201312 weeks. Open Settings \u2192 Developer settings." },
  },
  probes,
  fetchedUrls: allFetched,
  today: "2026-10-19",
});
assert.equal(dashed.ok, true);
if (dashed.ok) {
  assert.equal(dashed.guide.summary.verdict, "Easy to set up, no review needed. Review takes 6 to 12 weeks. Open Settings, then Developer settings.");
  assert.ok(!FORBIDDEN_PUNCTUATION.test(JSON.stringify(dashed.guide.summary)));
}

console.log("finalize tests passed");
