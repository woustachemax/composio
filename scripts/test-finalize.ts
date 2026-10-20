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

const noTimeEvidence = finalizeSubmission({
  submission: { ...submission, summary: { ...submission.summary, time: { ...submission.summary.time, handsOnEvidence: undefined } } },
  probes,
  fetchedUrls: allFetched,
  today: "2026-10-19",
});
assert.equal(noTimeEvidence.ok, false);
if (!noTimeEvidence.ok) assert.ok(noTimeEvidence.issues.some((i) => i.startsWith("summary.time.handsOnEvidence")));

const claimedWait = finalizeSubmission({
  submission: {
    ...submission,
    summary: {
      ...submission.summary,
      time: {
        ...submission.summary.time,
        approvalWait: { min: 2, max: 4, unit: "weeks" as const },
        approvalWaitEvidence: { status: "documented" as const, sourceIds: ["gh-create"], quote: "Review is required before launch." },
        handsOnEvidence: { status: "tested" as const, probeIds: [probes[0].id], sourceIds: [] },
      },
    },
  },
  probes,
  fetchedUrls: allFetched,
  today: "2026-10-19",
});
assert.equal(claimedWait.ok, true);
if (claimedWait.ok) {
  assert.equal(claimedWait.guide.summary.time.approvalWaitEvidence?.status, "uncertain");
  assert.equal(claimedWait.guide.summary.time.handsOnEvidence?.status, "uncertain");
  assert.equal(claimedWait.guide.summary.time.evidence.status, "uncertain");
  assert.equal(claimedWait.stats.claimsDowngraded >= 2, true);
}

const quotedWait = finalizeSubmission({
  submission: {
    ...submission,
    summary: {
      ...submission.summary,
      time: {
        ...submission.summary.time,
        approvalWait: { min: 2, max: 4, unit: "weeks" as const },
        approvalWaitEvidence: { status: "documented" as const, sourceIds: ["gh-create"], quote: "Reviews take 2 to 4 weeks." },
      },
    },
  },
  probes,
  fetchedUrls: allFetched,
  today: "2026-10-19",
});
assert.equal(quotedWait.ok, true);
if (quotedWait.ok) assert.equal(quotedWait.guide.summary.time.approvalWaitEvidence?.status, "documented");

const statedWait = (sourceIds: string[], quote: string) =>
  finalizeSubmission({
    submission: {
      ...submission,
      summary: {
        ...submission.summary,
        time: {
          ...submission.summary.time,
          approvalWait: { min: 6, max: 12, unit: "weeks" as const },
          approvalWaitEvidence: { status: "uncertain" as const, reason: "Upper bound inferred.", sourceIds: [] },
          approvalWaitStated: { value: "About 6 weeks", attribution: "GitHub's estimate", sourceIds, quote },
        },
      },
    },
    probes,
    fetchedUrls: partial,
    today: "2026-10-19",
  });
const keptStated = statedWait(["gh-create"], "Reviews take about 6 weeks.");
assert.equal(keptStated.ok, true);
if (keptStated.ok) assert.equal(keptStated.guide.summary.time.approvalWaitStated?.value, "About 6 weeks");
const unopenedStated = statedWait(["gh-scopes"], "Reviews take about 6 weeks.");
assert.equal(unopenedStated.ok, true);
if (unopenedStated.ok) assert.equal(unopenedStated.guide.summary.time.approvalWaitStated, undefined);
const vagueStated = statedWait(["gh-create"], "Reviews take a while.");
assert.equal(vagueStated.ok, true);
if (vagueStated.ok) assert.equal(vagueStated.guide.summary.time.approvalWaitStated, undefined);

const composioProbe = {
  id: "probe-composio-9",
  kind: "composio-toolkit" as const,
  description: "Whether Composio offers a managed OAuth app for GitHub",
  request: "GET https://backend.composio.dev/api/v3.1/toolkits/github with a Composio API key",
  observed: "HTTP 200. composio_managed_auth_schemes=[]. Composio has no managed OAuth app for GitHub, so developers bring their own.",
  outcome: "refuted" as const,
  ranAt: "2026-10-19",
};
const probed = finalizeSubmission({ submission, probes: [...probes, composioProbe], fetchedUrls: allFetched, today: "2026-10-19" });
assert.equal(probed.ok, true);
if (probed.ok) {
  assert.equal(probed.guide.composio.managedAuthAvailable, "no");
  assert.equal(probed.guide.composio.evidence.status, "tested");
  assert.ok(probed.checks.some((c) => c.includes("live toolkit check")));
}

console.log("finalize tests passed");
