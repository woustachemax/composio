import type { Duration, Guide, Requirement, Step } from "./guide-schema";

const unitMinutes: Record<Duration["unit"], number> = { minutes: 1, hours: 60, days: 1440, weeks: 10080 };

export function toMinutes(d: Duration, which: "min" | "max" | "mid" = "mid") {
  const v = which === "mid" ? (d.min + d.max) / 2 : d[which];
  return v * unitMinutes[d.unit];
}

export type Lane = "agent" | "you" | "wait";

export type TimelineSeg = {
  n: number;
  step: Step;
  lane: Lane;
  kind: "work" | "wait" | "unestimated";
  x0: number;
  x1: number;
};

export type TimelineMarker = {
  label: string;
  req: Requirement;
  x: number;
  seg: TimelineSeg;
};

export type Timeline = {
  segs: TimelineSeg[];
  markers: TimelineMarker[];
  phaseRuns: { phase: Step["phase"]; x0: number; x1: number }[];
  overview: { handsOnEnd: number; waitMinEnd: number; handsOnShare: number } | null;
  totals: { agentSteps: number; youSteps: number; agentMinutes: number; youMinutes: number; waits: number; unestimated: number };
};

const GAP = 0.004;
const WAIT_W = 0.075;
const UNKNOWN_W = 0.045;
const MIN_W = 0.014;

const categoryPhase: Partial<Record<Requirement["category"], Step["phase"]>> = {
  "paid-plan": "decide",
  "partner-program": "decide",
  "business-verification": "decide",
  "restricted-scopes": "decide",
  scopes: "decide",
  other: "decide",
  "redirect-uri": "configure",
  "privacy-policy": "launch",
  "domain-verification": "launch",
  "token-lifecycle": "verify",
  "rate-limits": "launch",
  "app-review": "launch",
  "security-assessment": "launch",
  "demo-video": "launch",
  "end-user-admin-approval": "launch",
};

const phaseOrder: Step["phase"][] = ["decide", "register", "configure", "verify", "launch"];

export function buildTimeline(guide: Guide): Timeline {
  const raw = guide.steps.map((step, i) => {
    const waiting = step.waitsOn !== "nobody";
    const kind: TimelineSeg["kind"] = waiting ? "wait" : step.effort ? "work" : "unestimated";
    const lane: Lane = waiting ? "wait" : step.owner;
    return { n: i + 1, step, lane, kind, weight: step.effort && !waiting ? toMinutes(step.effort) : 0 };
  });

  const fixed = raw.reduce((a, r) => a + (r.kind === "wait" ? WAIT_W : r.kind === "unestimated" ? UNKNOWN_W : 0), 0);
  const gaps = GAP * Math.max(0, raw.length - 1);
  const room = Math.max(0.2, 1 - fixed - gaps);
  const work = raw.filter((r) => r.kind === "work");
  const widthAt = (s: number) => work.reduce((a, r) => a + Math.max(MIN_W, r.weight * s), 0);
  let lo = 0;
  let hi = 1;
  while (widthAt(hi) < room && hi < 1e9) hi *= 2;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (widthAt(mid) > room) hi = mid;
    else lo = mid;
  }
  const scale = work.length ? lo : 0;
  const totalW = raw.reduce(
    (a, r) => a + (r.kind === "wait" ? WAIT_W : r.kind === "unestimated" ? UNKNOWN_W : Math.max(MIN_W, r.weight * scale)),
    gaps,
  );
  const norm = totalW > 0 ? 1 / totalW : 1;

  let x = 0;
  const segs: TimelineSeg[] = raw.map((r, i) => {
    const w = (r.kind === "wait" ? WAIT_W : r.kind === "unestimated" ? UNKNOWN_W : Math.max(MIN_W, r.weight * scale)) * norm;
    const seg = { n: r.n, step: r.step, lane: r.lane, kind: r.kind, x0: x, x1: x + w };
    x += w + (i < raw.length - 1 ? GAP * norm : 0);
    return seg;
  });

  const phaseRuns: Timeline["phaseRuns"] = [];
  for (const s of segs) {
    const last = phaseRuns[phaseRuns.length - 1];
    if (last && last.phase === s.step.phase) last.x1 = s.x1;
    else phaseRuns.push({ phase: s.step.phase, x0: s.x0, x1: s.x1 });
  }

  const anchorFor = (req: Requirement): TimelineSeg => {
    const phase = categoryPhase[req.category] ?? "decide";
    if (req.category === "app-review" || req.category === "security-assessment") {
      const wait = segs.find((s) => s.kind === "wait");
      if (wait) return wait;
    }
    const start = phaseOrder.indexOf(phase);
    for (let i = start; i < phaseOrder.length; i++) {
      const hit = segs.find((s) => s.step.phase === phaseOrder[i]);
      if (hit) return hit;
    }
    return segs[segs.length - 1];
  };

  const blockers = guide.requirements.filter((r) => r.impact === "blocker" && r.applies !== "not-required");
  const markers = blockers
    .map((req) => {
      const seg = anchorFor(req);
      return { req, seg, x: seg.x0 };
    })
    .sort((a, b) => a.x - b.x)
    .map((m, i) => ({ ...m, label: `B${i + 1}` }));

  const t = guide.summary.time;
  let overview: Timeline["overview"] = null;
  if (t.approvalWait) {
    const hands = toMinutes(t.handsOn, "max");
    const waitMin = toMinutes(t.approvalWait, "min");
    const waitMax = toMinutes(t.approvalWait, "max");
    const total = hands + waitMax;
    overview = { handsOnEnd: hands / total, waitMinEnd: (hands + waitMin) / total, handsOnShare: hands / total };
  }

  const sum = (lane: Lane) => raw.filter((r) => r.lane === lane && r.kind === "work").reduce((a, r) => a + r.weight, 0);
  return {
    segs,
    markers,
    phaseRuns,
    overview,
    totals: {
      agentSteps: raw.filter((r) => r.step.owner === "agent").length,
      youSteps: raw.filter((r) => r.step.owner === "you").length,
      agentMinutes: sum("agent"),
      youMinutes: sum("you"),
      waits: raw.filter((r) => r.kind === "wait").length,
      unestimated: raw.filter((r) => r.kind === "unestimated").length,
    },
  };
}

export function formatMinutes(m: number) {
  if (m < 90) return `${Math.round(m)} min`;
  const h = m / 60;
  return `${h < 10 ? Math.round(h * 10) / 10 : Math.round(h)} h`;
}
