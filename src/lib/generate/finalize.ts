import { z } from "zod";
import { GuideBaseSchema, GuideSchema, type Evidence, type Guide, type Probe } from "@/lib/guide-schema";
import { COMPOSIO_CALLBACK } from "@/lib/probes";
import { slugify } from "@/lib/slug";
import { cleanTextDeep } from "@/lib/text";

export const SubmissionSchema = GuideBaseSchema.omit({ schemaVersion: true, slug: true, probes: true, meta: true }).extend({
  researchNotes: z.string(),
});

export type Submission = z.infer<typeof SubmissionSchema>;

export function normalizeUrl(raw: string): string {
  try {
    const u = new URL(raw);
    u.hash = "";
    const path = u.pathname.replace(/\/+$/, "");
    return `${u.protocol}//${u.hostname.replace(/^www\./, "")}${path}${u.search}`.toLowerCase();
  } catch {
    return raw.trim().toLowerCase();
  }
}

type FinalizeInput = {
  submission: unknown;
  probes: Probe[];
  fetchedUrls: Set<string>;
  today: string;
};

export type FinalizeStats = { sourcesKept: number; sourcesDropped: number; claimsDowngraded: number };

type FinalizeResult = { ok: true; guide: Guide; checks: string[]; stats: FinalizeStats } | { ok: false; issues: string[] };

const NUMBER_WORD = /\d|\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|a few|a couple)\b/i;

function durationEvidence(ev: Evidence, hasRange: boolean, label: string): { evidence: Evidence; downgraded: boolean } {
  if (ev.status === "uncertain") return { evidence: ev, downgraded: false };
  if (ev.status === "tested") {
    const reason = `Probes cannot measure how long ${label} takes, so this is an estimate.${ev.note ? ` Agent note: ${ev.note}` : ""}`;
    return { evidence: { status: "uncertain", reason, sourceIds: ev.sourceIds }, downgraded: true };
  }
  if (!hasRange) return { evidence: ev, downgraded: false };
  if (ev.quote && NUMBER_WORD.test(ev.quote)) return { evidence: ev, downgraded: false };
  return {
    evidence: {
      status: "uncertain",
      reason: `Marked documented, but no quoted passage from an opened source states how long ${label} takes, so the range is an estimate.${ev.note ? ` Agent note: ${ev.note}` : ""}`,
      sourceIds: ev.sourceIds,
    },
    downgraded: true,
  };
}

function formatIssues(error: z.ZodError): string[] {
  return error.issues.slice(0, 25).map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`);
}

export function finalizeSubmission({ submission, probes, fetchedUrls, today }: FinalizeInput): FinalizeResult {
  const parsed = SubmissionSchema.safeParse(submission);
  if (!parsed.success) return { ok: false, issues: formatIssues(parsed.error) };
  const s = cleanTextDeep(parsed.data);
  const checks: string[] = [];
  const missingTime = [
    !s.summary.time.handsOnEvidence && "summary.time.handsOnEvidence: required. Give the hands-on range its own evidence.",
    !s.summary.time.approvalWaitEvidence && "summary.time.approvalWaitEvidence: required. Give the approval wait its own evidence, including when approvalWait is null.",
  ].filter((x): x is string => Boolean(x));
  if (missingTime.length > 0) return { ok: false, issues: missingTime };

  const unopened = new Map<string, string>();
  const sources = s.sources.filter((src) => {
    if (fetchedUrls.has(normalizeUrl(src.url))) return true;
    unopened.set(src.id, src.url);
    return false;
  });
  if (unopened.size > 0)
    checks.push(`Removed ${unopened.size} cited source${unopened.size === 1 ? "" : "s"} the agent never opened: ${[...unopened.values()].join(", ")}`);

  const probeById = new Map(probes.map((p) => [p.id, p]));
  let downgradedDocumented = 0;
  let downgradedTested = 0;

  const fix = (ev: Evidence): Evidence => {
    const keptSources = ev.sourceIds.filter((id) => !unopened.has(id));
    const droppedUrls = ev.sourceIds.filter((id) => unopened.has(id)).map((id) => unopened.get(id));
    if (ev.status === "tested") {
      const decisive = ev.probeIds.filter((id) => {
        const p = probeById.get(id);
        return p && p.outcome !== "inconclusive";
      });
      if (decisive.length > 0) return { ...ev, probeIds: decisive, sourceIds: keptSources };
      downgradedTested++;
      if (keptSources.length > 0)
        return { status: "documented", sourceIds: keptSources, note: "Marked tested by the agent, but no probe gave a decisive result, so this rests on the sources only." };
      return { status: "uncertain", reason: "Marked tested by the agent, but no probe gave a decisive result and no opened source supports it.", sourceIds: [] };
    }
    if (ev.status === "documented") {
      if (keptSources.length > 0) return { ...ev, sourceIds: keptSources };
      downgradedDocumented++;
      return {
        status: "uncertain",
        reason: `The agent cited ${droppedUrls.join(", ") || "a source"} but never opened it, so the claim is unverified.${ev.note ? ` Agent note: ${ev.note}` : ""}`,
        sourceIds: [],
      };
    }
    return { ...ev, sourceIds: keptSources };
  };

  const handsOn = durationEvidence(fix(s.summary.time.handsOnEvidence!), true, "the hands-on work");
  const approvalWait = durationEvidence(fix(s.summary.time.approvalWaitEvidence!), s.summary.time.approvalWait !== null, "provider approval");
  const timeDowngrades = [handsOn, approvalWait].filter((x) => x.downgraded).length;
  if (timeDowngrades > 0)
    checks.push(`Marked ${timeDowngrades === 1 ? "a time estimate" : "both time estimates"} uncertain because no opened source quotes the duration.`);
  let approvalWaitStated = s.summary.time.approvalWaitStated;
  if (approvalWaitStated) {
    const opened = approvalWaitStated.sourceIds.filter((id) => !unopened.has(id) && sources.some((src) => src.id === id));
    if (opened.length === 0 || !NUMBER_WORD.test(approvalWaitStated.quote)) {
      checks.push(`Dropped the stated approval wait "${approvalWaitStated.value}" because no opened source quotes that figure.`);
      approvalWaitStated = undefined;
    } else {
      approvalWaitStated = { ...approvalWaitStated, sourceIds: opened };
    }
  }
  let timeEvidence = fix(s.summary.time.evidence);
  const weakest = [handsOn.evidence, approvalWait.evidence].find((e) => e.status === "uncertain");
  if (weakest && timeEvidence.status !== "uncertain") timeEvidence = weakest;

  let composio = { ...s.composio, callbackUrl: COMPOSIO_CALLBACK, evidence: fix(s.composio.evidence) };
  const composioProbe = [...probes].reverse().find((p) => p.kind === "composio-toolkit" && p.outcome !== "inconclusive");
  if (composioProbe) {
    const managed = composioProbe.outcome === "confirmed" ? "yes" : "no";
    if (composio.managedAuthAvailable !== managed)
      checks.push(`Set Composio managed auth to "${managed}" from the live toolkit check; the agent said "${composio.managedAuthAvailable}".`);
    const agentNote = composio.evidence.status === "uncertain" ? composio.evidence.reason : composio.evidence.note;
    composio = {
      ...composio,
      managedAuthAvailable: managed,
      evidence: {
        status: "tested",
        probeIds: [composioProbe.id],
        sourceIds: composio.evidence.sourceIds,
        note: [composioProbe.observed, agentNote].filter(Boolean).join(" "),
      },
    };
  }

  const guide = {
    schemaVersion: 1 as const,
    slug: slugify(s.app.name) || "app",
    app: s.app,
    meta: { lastVerified: today, origin: "agent-generated" as const, researchNotes: s.researchNotes },
    summary: {
      verdict: s.summary.verdict,
      difficulty: { ...s.summary.difficulty, evidence: fix(s.summary.difficulty.evidence) },
      time: { ...s.summary.time, evidence: timeEvidence, handsOnEvidence: handsOn.evidence, approvalWaitEvidence: approvalWait.evidence, approvalWaitStated },
    },
    composio,
    appTypeChoice: s.appTypeChoice ? { ...s.appTypeChoice, evidence: fix(s.appTypeChoice.evidence) } : undefined,
    requirements: s.requirements.map((r) => ({ ...r, evidence: fix(r.evidence) })),
    steps: s.steps.map((st) => ({ ...st, evidence: fix(st.evidence) })),
    blockers: s.blockers.map((b) => ({ ...b, evidence: fix(b.evidence) })),
    facts: s.facts.map((f) => ({ ...f, evidence: fix(f.evidence) })),
    openQuestions: s.openQuestions,
    sources,
    probes,
  };

  if (downgradedDocumented > 0) checks.push(`Downgraded ${downgradedDocumented} documented claim${downgradedDocumented === 1 ? "" : "s"} to uncertain because their only sources were never opened.`);
  if (downgradedTested > 0) checks.push(`Downgraded ${downgradedTested} tested claim${downgradedTested === 1 ? "" : "s"} because no probe gave a decisive result.`);
  if (sources.length === 0) return { ok: false, issues: ["sources: none of the cited sources were opened with web_fetch. Fetch the official docs you rely on and cite those exact URLs."] };

  const final = GuideSchema.safeParse(guide);
  if (!final.success) return { ok: false, issues: formatIssues(final.error) };
  if (checks.length > 0)
    final.data.meta.researchNotes = `${final.data.meta.researchNotes} Automatic checks: ${checks.join(" ")}`;
  return {
    ok: true,
    guide: final.data,
    checks,
    stats: { sourcesKept: sources.length, sourcesDropped: unopened.size, claimsDowngraded: downgradedDocumented + downgradedTested + timeDowngrades },
  };
}
