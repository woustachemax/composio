import type { Duration, Evidence, Guide, Requirement, Step } from "./guide-schema";
import { toMinutes } from "./timeline";

const unitShort: Record<Duration["unit"], [string, string]> = {
  minutes: ["min", "min"],
  hours: ["hour", "hours"],
  days: ["day", "days"],
  weeks: ["week", "weeks"],
};

export function shortName(guide: Guide) {
  return guide.app.name.replace(/\s*\(.*?\)\s*/g, " ").trim();
}

export function formatDuration(d: Duration): string {
  const [one, many] = unitShort[d.unit];
  if (d.min === d.max) return `${d.min} ${d.min === 1 ? one : many}`;
  return `${d.min} to ${d.max} ${many}`;
}

const impactRank: Record<Requirement["impact"], number> = { blocker: 0, friction: 1, info: 2 };
const appliesRank: Record<Requirement["applies"], number> = {
  required: 0,
  conditional: 1,
  "not-required": 2,
};

export function sortRequirements(reqs: Requirement[]): Requirement[] {
  return [...reqs].sort(
    (a, b) =>
      impactRank[a.impact] - impactRank[b.impact] || appliesRank[a.applies] - appliesRank[b.applies],
  );
}

export function headlineRequirements(guide: Guide) {
  const applicable = sortRequirements(guide.requirements.filter((r) => r.applies !== "not-required"));
  const notRequired = guide.requirements.filter((r) => r.applies === "not-required");
  return { applicable, notRequired };
}

export function stepsByOwner(guide: Guide) {
  const agent = guide.steps.filter((s) => s.owner === "agent");
  const you = guide.steps.filter((s) => s.owner === "you");
  const assisted = you.filter((s) => s.agentAssist);
  return { agent, you, assisted };
}

export const phaseLabels: Record<Step["phase"], string> = {
  decide: "Decide",
  register: "Register the app",
  configure: "Configure",
  verify: "Verify",
  launch: "Launch",
};

export function stepsByPhase(guide: Guide) {
  const order: Step["phase"][] = ["decide", "register", "configure", "verify", "launch"];
  return order
    .map((phase) => ({ phase, steps: guide.steps.filter((s) => s.phase === phase) }))
    .filter((g) => g.steps.length > 0);
}

export type ClaimRef = { section: string; label: string; evidence: Evidence };

export function allClaims(guide: Guide): ClaimRef[] {
  const claims: ClaimRef[] = [
    { section: "Summary", label: "Difficulty", evidence: guide.summary.difficulty.evidence },
    { section: "Summary", label: "Time estimate", evidence: guide.summary.time.evidence },
    { section: "Composio", label: "Composio setup", evidence: guide.composio.evidence },
  ];
  if (guide.appTypeChoice)
    claims.push({ section: "App type", label: guide.appTypeChoice.question, evidence: guide.appTypeChoice.evidence });
  for (const r of guide.requirements) claims.push({ section: "Requirement", label: r.title, evidence: r.evidence });
  for (const s of guide.steps) claims.push({ section: "Step", label: s.title, evidence: s.evidence });
  for (const b of guide.blockers) claims.push({ section: "Blocker", label: b.symptom, evidence: b.evidence });
  for (const f of guide.facts) claims.push({ section: "Fact", label: f.label, evidence: f.evidence });
  return claims;
}

export function evidenceCounts(guide: Guide) {
  const counts = { tested: 0, documented: 0, uncertain: 0 };
  for (const c of allClaims(guide)) counts[c.evidence.status]++;
  return counts;
}

export function uncertainClaims(guide: Guide): ClaimRef[] {
  return allClaims(guide).filter((c) => c.evidence.status === "uncertain");
}

export const difficultyLabel: Record<Guide["summary"]["difficulty"]["level"], string> = {
  easy: "Easy",
  moderate: "Moderate",
  hard: "Hard",
};

export type GuideCard = {
  slug: string;
  name: string;
  website: string;
  category: string;
  difficulty: Guide["summary"]["difficulty"]["level"];
  reason: string;
  handsOn: string;
  wait: string;
  waitWeeks: number;
  flags: string[];
  origin: Guide["meta"]["origin"];
  managed: Guide["composio"]["managedAuthAvailable"];
  lastVerified: string;
  logo: string | null;
};

export function toCard(guide: Guide, logo: string | null = null): GuideCard {
  const { applicable } = headlineRequirements(guide);
  return {
    slug: guide.slug,
    name: guide.app.name,
    website: guide.app.website,
    category: guide.app.category,
    difficulty: guide.summary.difficulty.level,
    reason: guide.summary.difficulty.reason,
    handsOn: formatDuration(guide.summary.time.handsOn),
    wait: guide.summary.time.approvalWait ? formatDuration(guide.summary.time.approvalWait) : "None",
    waitWeeks: guide.summary.time.approvalWait ? toMinutes(guide.summary.time.approvalWait, "max") / 10080 : 0,
    flags: applicable.filter((r) => r.impact !== "info").slice(0, 3).map((r) => r.title),
    origin: guide.meta.origin,
    managed: guide.composio.managedAuthAvailable,
    lastVerified: guide.meta.lastVerified,
    logo,
  };
}
