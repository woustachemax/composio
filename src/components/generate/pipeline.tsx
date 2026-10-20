import type { GenerationEvent } from "@/lib/generate/events";
import type { Status } from "./generation-store";

export type StageState = "pending" | "active" | "done" | "failed" | "skipped";

export const stages = [
  { key: "find", label: "Find app", sub: "Web search" },
  { key: "docs", label: "Read docs", sub: "Official pages" },
  { key: "probes", label: "Run probes", sub: "Live GET checks" },
  { key: "write", label: "Write guide", sub: "Draft sections" },
  { key: "citations", label: "Check citations", sub: "Validate + save" },
] as const;

const stageOf: Partial<Record<GenerationEvent["type"], number>> = {
  started: 0,
  search: 0,
  fetch: 1,
  fetched: 1,
  probe: 2,
  writing: 3,
  invalid: 3,
  submit: 4,
  check: 4,
  checked: 4,
};

function kilo(n: number) {
  return n < 1000 ? `${n}` : `${(n / 1000).toFixed(1)}k`;
}

function stageFor(e: GenerationEvent) {
  if (e.type === "thinking") return e.phase === "planning" ? 3 : undefined;
  return stageOf[e.type];
}

export function activityLine(events: GenerationEvent[]) {
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e.type === "thinking")
      return { title: `${e.phase === "planning" ? "Planning the guide" : "Researching"} · ${e.seconds}s`, detail: e.update };
    if (e.type === "writing") return { title: `Writing the guide${e.section ? `, now on ${e.section}` : ""}`, detail: `${e.chars.toLocaleString("en-US")} characters` };
    if (e.type === "submit" || e.type === "checked" || e.type === "check") return { title: "Checking citations and saving", detail: null };
    if (e.type === "probe") return { title: "Running probes", detail: e.probe.description };
    if (e.type === "fetch") return { title: "Reading docs", detail: e.url };
    if (e.type === "search") return { title: "Searching", detail: e.query };
  }
  return null;
}

export function pipelineState(events: GenerationEvent[], status: Status, final: GenerationEvent | null) {
  let reached = -1;
  for (const e of events) {
    const stage = stageFor(e);
    if (stage === undefined) continue;
    reached = e.type === "invalid" ? stage : Math.max(reached, stage);
  }
  if (status === "running") reached = Math.max(reached, 0);
  const writing = events.findLast((e) => e.type === "writing");
  const lastStaged = events.findLast((e) => stageFor(e) !== undefined);
  const checked = events.findLast((e) => e.type === "checked");
  const submits = events.filter((e) => e.type === "submit").length;
  const searches = events.filter((e) => e.type === "search").length;
  const pages = events.filter((e) => e.type === "fetched" && e.ok).length;
  const probes = events.filter((e) => e.type === "probe").length;
  const skipped = final?.type === "done" && final.source !== "generated";
  const states: StageState[] = stages.map((_, i) => {
    if (skipped) return "skipped";
    if (final?.type === "done") return "done";
    if (status === "error" || status === "unsupported") return i < reached ? "done" : i === Math.max(reached, 0) ? "failed" : "pending";
    if (status === "running") return i < reached ? "done" : i === reached ? "active" : "pending";
    return "pending";
  });
  const writeNote =
    lastStaged?.type === "thinking" && status === "running"
      ? `planning · ${lastStaged.seconds}s`
      : writing
        ? status === "running" && reached === 3
          ? `${kilo(writing.chars)} chars · ${writing.section ?? "starting"}`
          : `${kilo(writing.chars)} chars written`
        : "waiting";
  const citeNote = checked
    ? checked.sourcesDropped > 0
      ? `${checked.sourcesKept} kept · ${checked.sourcesDropped} dropped`
      : `${checked.sourcesKept} sources kept`
    : reached === 4
      ? submits > 1
        ? `checking try ${submits}`
        : "checking"
      : "waiting";
  const notes = [
    `${searches} ${searches === 1 ? "search" : "searches"}`,
    `${pages} ${pages === 1 ? "page" : "pages"}`,
    `${probes} ${probes === 1 ? "probe" : "probes"}`,
    writeNote,
    citeNote,
  ];
  return { states, notes };
}

const WHITE = "#ffffff";
const DIM = "rgba(255,255,255,0.35)";
const LINE = "#2c2c2c";
const BRAND = "#0007cd";
const LIME = "#d4ff4a";
const BAD = "#f87171";

function nodeStyle(s: StageState) {
  if (s === "active") return { fill: BRAND, stroke: BRAND, text: WHITE, sub: "rgba(255,255,255,0.75)" };
  if (s === "done") return { fill: "#0f0f0f", stroke: WHITE, text: WHITE, sub: LIME };
  if (s === "failed") return { fill: "#0f0f0f", stroke: BAD, text: BAD, sub: BAD };
  return { fill: "#0f0f0f", stroke: LINE, text: DIM, sub: DIM };
}

function Mark({ s, x, y }: { s: StageState; x: number; y: number }) {
  if (s === "done") return <path d={`M ${x - 5} ${y} l 3.5 3.5 l 7 -7`} fill="none" stroke={LIME} strokeWidth={1.8} />;
  if (s === "failed") return <path d={`M ${x - 4} ${y - 4} l 8 8 M ${x + 4} ${y - 4} l -8 8`} stroke={BAD} strokeWidth={1.8} />;
  if (s === "active") return <rect x={x - 4} y={y - 4} width={8} height={8} fill={WHITE} className="anim-pulse" />;
  return <rect x={x - 3.5} y={y - 3.5} width={7} height={7} fill="none" stroke={DIM} />;
}

export function Pipeline({ states, notes }: { states: StageState[]; notes: string[] }) {
  const W = 1000;
  const n = stages.length;
  const gap = 26;
  const boxW = (W - gap * (n - 1)) / n;
  const H = 104;
  const mono = "var(--font-mono)";
  return (
    <>
      <svg viewBox={`0 0 ${W} ${H}`} className="hidden h-auto w-full md:block" role="img" aria-label="Agent pipeline progress">
        {stages.map((st, i) => {
          const x = i * (boxW + gap);
          const s = states[i];
          const c = nodeStyle(s);
          const next = states[i + 1];
          return (
            <g key={st.key}>
              {i < n - 1 && (
                <line
                  x1={x + boxW}
                  x2={x + boxW + gap}
                  y1={H / 2}
                  y2={H / 2}
                  stroke={s === "done" ? WHITE : LINE}
                  strokeDasharray={s === "done" && next === "active" ? "4 4" : undefined}
                  className={s === "done" && next === "active" ? "anim-dash" : undefined}
                />
              )}
              <rect x={x + 0.5} y={0.5} width={boxW - 1} height={H - 1} fill={c.fill} stroke={c.stroke} />
              <text x={x + 14} y={24} fontSize={11} fontFamily={mono} fill={s === "active" ? "rgba(255,255,255,0.7)" : DIM}>
                {String(i + 1).padStart(2, "0")}
              </text>
              <Mark s={s} x={x + boxW - 20} y={20} />
              <text x={x + 14} y={58} fontSize={17} fill={c.text}>
                {st.label}
              </text>
              <text x={x + 14} y={84} fontSize={11} fontFamily={mono} fill={c.sub}>
                {(s === "pending" || s === "skipped" ? st.sub : notes[i]).toUpperCase()}
              </text>
            </g>
          );
        })}
      </svg>

      <svg viewBox={`0 0 360 ${n * 52}`} className="block h-auto w-full md:hidden" role="img" aria-label="Agent pipeline progress">
        {stages.map((st, i) => {
          const y = i * 52;
          const s = states[i];
          const c = nodeStyle(s);
          return (
            <g key={st.key}>
              {i < n - 1 && <line x1={18} x2={18} y1={y + 36} y2={y + 52} stroke={s === "done" ? WHITE : LINE} />}
              <rect x={0.5} y={y + 0.5} width={359} height={35} fill={c.fill} stroke={c.stroke} />
              <text x={12} y={y + 22} fontSize={10} fontFamily={mono} fill={DIM}>
                {String(i + 1).padStart(2, "0")}
              </text>
              <text x={40} y={y + 23} fontSize={14} fill={c.text}>
                {st.label}
              </text>
              <text x={320} y={y + 22} fontSize={10} fontFamily={mono} fill={c.sub} textAnchor="end">
                {(s === "pending" || s === "skipped" ? st.sub : notes[i]).toUpperCase()}
              </text>
              <Mark s={s} x={340} y={y + 18} />
            </g>
          );
        })}
      </svg>
    </>
  );
}
