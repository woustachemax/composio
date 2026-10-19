import type { Guide, Requirement } from "@/lib/guide-schema";
import { formatDuration, phaseLabels, shortName } from "@/lib/guide-view";
import { Reveal } from "@/components/reveal";
import { TimelineHover } from "./timeline-hover";
import { buildTimeline, formatMinutes, type Lane, type Timeline, type TimelineSeg } from "@/lib/timeline";

const INK = "#0f0f0f";
const BRAND = "#0007cd";
const WARN = "#c98a0b";
const BAD = "#dc2626";
const LINE = "#e5e5e5";

const laneLabel: Record<Lane, string> = { agent: "AGENT", you: "YOU", wait: "WAITING" };
const laneColor: Record<Lane, string> = { agent: BRAND, you: INK, wait: WARN };

function segTip(s: TimelineSeg, guide: Guide) {
  const who = s.step.owner === "agent" ? "Agent" : "You";
  const time =
    s.kind === "wait"
      ? `Waits on ${s.step.waitsOn === "provider" ? shortName(guide) : "a third party"}`
      : s.kind === "unestimated"
        ? "Not estimated"
        : s.step.effort
          ? `${formatDuration(s.step.effort)} hands-on`
          : "";
  const kind = `Step ${String(s.n).padStart(2, "0")} · ${who}${s.step.optional ? " · optional" : ""}`;
  return {
    "aria-label": `Step ${s.n}: ${s.step.title}. ${who}. ${time}${s.step.optional ? ". Optional" : ""}`,
    "data-tip-title": s.step.title,
    "data-tip-kind": kind,
    "data-tip-time": time,
    "data-tip-tone": s.kind === "wait" ? "wait" : s.step.owner,
  };
}

export function appliesText(req: Requirement) {
  if (req.applies === "required") return "Applies to every app";
  if (!req.condition) return "Applies in some setups";
  return req.condition.charAt(0).toUpperCase() + req.condition.slice(1);
}

function Hatch({ id, color }: { id: string; color: string }) {
  return (
    <pattern id={id} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="6" height="6" fill={color} fillOpacity="0.12" />
      <line x1="0" y1="0" x2="0" y2="6" stroke={color} strokeWidth="2" />
    </pattern>
  );
}

function HatchedRect({ id, x, y, w, h, color }: { id: string; x: number; y: number; w: number; h: number; color: string }) {
  return (
    <g>
      <clipPath id={`${id}-clip`}>
        <rect x={x} y={y} width={w} height={h} />
      </clipPath>
      <g clipPath={`url(#${id}-clip)`}>
        <rect x={x - 12} y={y} width={w + 24} height={h} fill={`url(#${id.split("-")[0]}-hatch)`} className="anim-hatch" />
      </g>
      <rect x={x + 0.5} y={y + 0.5} width={Math.max(0, w - 1)} height={h - 1} fill="none" stroke={color} />
    </g>
  );
}

function Overview({ guide, t, width, prefix, stacked = false }: { guide: Guide; t: Timeline; width: number; prefix: string; stacked?: boolean }) {
  const o = t.overview;
  if (!o) return null;
  const wait = guide.summary.time.approvalWait;
  const handsW = Math.max(3, o.handsOnEnd * width);
  const minEnd = o.waitMinEnd * width;
  const pct = o.handsOnShare * 100;
  const share = pct < 1 ? "under 1%" : `${Math.round(pct)}%`;
  return (
    <g>
      <rect x={0} y={0} width={handsW} height={18} fill={INK} />
      <HatchedRect id={`${prefix}-ovmin`} x={handsW + 2} y={0} w={Math.max(0, minEnd - handsW - 2)} h={18} color={WARN} />
      <g>
        <rect x={minEnd} y={0.5} width={Math.max(0, width - minEnd - 0.5)} height={17} fill="none" stroke={WARN} strokeDasharray="3 3" />
      </g>
      <path d="M 0 33 L 4 25 L 8 33 Z" fill={INK} />
      <text x={13} y={34} fontSize={11} fontFamily="var(--font-mono)" fill={INK}>
        {formatDuration(guide.summary.time.handsOn)} hands-on · {share} of the calendar
      </text>
      <path d={`M ${width - 8} ${(stacked ? 50 : 34) - 1} L ${width - 4} ${(stacked ? 50 : 34) - 9} L ${width} ${(stacked ? 50 : 34) - 1} Z`} fill={WARN} />
      <text x={width - 13} y={stacked ? 50 : 34} fontSize={11} fontFamily="var(--font-mono)" fill={WARN} textAnchor="end">
        {wait ? formatDuration(wait) : ""} waiting on approval
      </text>
    </g>
  );
}

function HorizontalTimeline({ guide, t }: { guide: Guide; t: Timeline }) {
  const W = 1000;
  const L = 78;
  const TW = W - L;
  const lanes: Lane[] = t.totals.waits > 0 ? ["agent", "you", "wait"] : ["agent", "you"];
  const laneH = 24;
  const laneGap = 8;
  const top = t.overview ? 128 : 30;
  const laneY = (l: Lane) => top + lanes.indexOf(l) * (laneH + laneGap);
  const bottom = top + lanes.length * (laneH + laneGap) - laneGap;
  const H = bottom + 34;
  const X = (f: number) => L + f * TW;
  const slots = t.markers.map((m, i) => t.markers.slice(0, i).filter((o) => Math.round(X(o.x)) === Math.round(X(m.x))).length);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={`Setup timeline for ${shortName(guide)}`}>
      <defs>
        <Hatch id="h-hatch" color={WARN} />
      </defs>

      {t.overview && (
        <>
          <text x={0} y={13} fontSize={10.5} fontFamily="var(--font-mono)" fill={INK} fillOpacity={0.5}>TO SCALE</text>
          <g transform={`translate(${L},0)`}>
            <Overview guide={guide} t={t} width={TW} prefix="h" />
          </g>
          <path
            d={`M ${L} 44 L ${L + Math.max(3, t.overview.handsOnEnd * TW)} 44 L ${W} ${top - 22} L ${L} ${top - 22} Z`}
            fill={INK}
            fillOpacity={0.04}
            stroke={INK}
            strokeOpacity={0.2}
            strokeDasharray="2 3"
          />
          <text x={L + TW / 2} y={(44 + top - 22) / 2 + 4} fontSize={10.5} fontFamily="var(--font-mono)" fill={INK} fillOpacity={0.5} textAnchor="middle">
            HANDS-ON STEPS, ZOOMED IN
          </text>
        </>
      )}

      {lanes.map((l) => (
        <g key={l}>
          <text x={0} y={laneY(l) + 16} fontSize={10.5} fontFamily="var(--font-mono)" fill={laneColor[l]}>
            {laneLabel[l]}
          </text>
          <line x1={L} x2={W} y1={laneY(l) + laneH / 2} y2={laneY(l) + laneH / 2} stroke={LINE} />
        </g>
      ))}

      <g>
        {t.segs.map((s, i) => {
          const x = X(s.x0);
          const w = Math.max(1, (s.x1 - s.x0) * TW);
          const y = laneY(s.lane);
          const color = laneColor[s.step.owner];
          const showNum = w >= 16;
          return (
            <a key={s.step.id} href={`#step-${s.step.id}`} {...segTip(s, guide)}>
              {s.kind === "wait" ? (
                <HatchedRect id={`h-s${i}`} x={x} y={y} w={w} h={laneH} color={WARN} />
              ) : s.kind === "unestimated" ? (
                <rect x={x + 0.5} y={y + 0.5} width={w - 1} height={laneH - 1} fill="#fff" stroke={color} strokeDasharray="3 2" />
              ) : (
                <rect x={x} y={y} width={w} height={laneH} fill={color} fillOpacity={s.step.optional ? 0.35 : 1} />
              )}
              {showNum && s.kind === "wait" && <rect x={x + w / 2 - 10} y={y + 5} width={20} height={14} fill="#fff" />}
              {showNum && (
                <text
                  x={x + w / 2}
                  y={y + 16}
                  fontSize={10.5}
                  fontFamily="var(--font-mono)"
                  textAnchor="middle"
                  fill={s.kind === "work" && !s.step.optional ? "#fff" : s.kind === "wait" ? WARN : color}
                >
                  {s.kind === "unestimated" ? `${s.n}?` : s.n}
                </text>
              )}
            </a>
          );
        })}
      </g>

      <g>
        {t.markers.map((m, i) => {
          const x = X(m.x);
          const slot = slots[i];
          const fx = x + slot * 26;
          return (
            <a
              key={m.req.id}
              href={`#req-${m.req.id}`}
              aria-label={`Blocker ${m.label}: ${m.req.title}. ${appliesText(m.req)}`}
              data-tip-title={m.req.title}
              data-tip-kind={`Blocker ${m.label} · step ${String(m.seg.n).padStart(2, "0")}`}
              data-tip-time={appliesText(m.req)}
              data-tip-tone="blocker"
            >
              {slot === 0 && <line x1={x} x2={x} y1={top - 8} y2={bottom + 4} stroke={BAD} strokeWidth={1.5} />}
              <rect x={fx} y={top - 22} width={24} height={14} fill={BAD} />
              <text x={fx + 12} y={top - 11.5} fontSize={10} fontFamily="var(--font-mono)" textAnchor="middle" fill="#fff">
                {m.label}
              </text>
            </a>
          );
        })}
      </g>

      {t.phaseRuns.map((p, i) => {
        const x0 = X(p.x0);
        const x1 = X(p.x1);
        const label = phaseLabels[p.phase].split(" ")[0].toUpperCase();
        const fits = x1 - x0 > label.length * 6.8 + 6;
        return (
          <g key={`${p.phase}-${i}`}>
            <line x1={x0} x2={x0} y1={bottom + 8} y2={bottom + 18} stroke={INK} strokeOpacity={0.3} />
            <line x1={x0} x2={x1} y1={bottom + 13} y2={bottom + 13} stroke={INK} strokeOpacity={0.15} />
            {fits && (
              <text x={x0 + 4} y={bottom + 30} fontSize={10} fontFamily="var(--font-mono)" fill={INK} fillOpacity={0.5}>
                {label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function truncate(s: string, n: number) {
  return s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s;
}

function VerticalTimeline({ guide, t }: { guide: Guide; t: Timeline }) {
  const VW = 360;
  const cols: Lane[] = t.totals.waits > 0 ? ["agent", "you", "wait"] : ["agent", "you"];
  const colW = 16;
  const colX = (l: Lane) => 4 + cols.indexOf(l) * (colW + 6);
  const textX = 4 + cols.length * (colW + 6) + 8;
  const H0 = 760;
  const minH = 26;
  const heights = t.segs.map((s) => Math.max(minH, (s.x1 - s.x0) * H0));
  const rows = t.segs.map((s, i) => ({ s, h: heights[i], y: 28 + heights.slice(0, i).reduce((a, h) => a + h + 3, 0) }));
  const last = rows[rows.length - 1];
  const H = (last ? last.y + last.h : 28) + 9;
  const markersBySeg = new Map<string, string[]>();
  for (const m of t.markers) markersBySeg.set(m.seg.step.id, [...(markersBySeg.get(m.seg.step.id) ?? []), m.label]);

  return (
    <svg viewBox={`0 0 ${VW} ${H}`} className="block h-auto w-full" role="img" aria-label={`Setup timeline for ${shortName(guide)}`}>
      <defs>
        <Hatch id="v-hatch" color={WARN} />
      </defs>
      {cols.map((l) => (
        <g key={l}>
          <rect x={colX(l) + colW / 2 - 3} y={12} width={6} height={6} fill={laneColor[l]} />
          <line x1={colX(l) + colW / 2} x2={colX(l) + colW / 2} y1={22} y2={H - 4} stroke={LINE} />
        </g>
      ))}
      <g>
        {rows.map(({ s, y, h }, i) => {
          const x = colX(s.lane);
          const color = laneColor[s.step.owner];
          const flags = markersBySeg.get(s.step.id) ?? [];
          const effort = s.kind === "wait" ? "wait" : s.kind === "unestimated" ? "?" : s.step.effort ? formatDuration(s.step.effort) : "";
        const effortLabel = effort.replace(" hours", " h").replace(" hour", " h").replace(" days", " d").replace(" day", " d").replace(" weeks", " wk").replace(" week", " wk");
        const room = VW - 4 - flags.length * 24 - effortLabel.length * 6.1 - 10 - (textX + 22);
        const maxChars = Math.max(12, Math.floor(room / 6.2));
          return (
            <a key={s.step.id} href={`#step-${s.step.id}`} {...segTip(s, guide)}>
              {s.kind === "wait" ? (
                <HatchedRect id={`v-s${i}`} x={x} y={y} w={colW} h={h} color={WARN} />
              ) : s.kind === "unestimated" ? (
                <rect x={x + 0.5} y={y + 0.5} width={colW - 1} height={h - 1} fill="#fff" stroke={color} strokeDasharray="3 2" />
              ) : (
                <rect x={x} y={y} width={colW} height={h} fill={color} fillOpacity={s.step.optional ? 0.35 : 1} />
              )}
              <text x={textX} y={y + 16} fontSize={12} fill={INK} fillOpacity={s.step.optional ? 0.5 : 1}>
                <tspan fontFamily="var(--font-mono)" fillOpacity={0.45}>{String(s.n).padStart(2, "0")} </tspan>
                {truncate(s.step.title, maxChars)}
              </text>
              <text x={VW - 4 - flags.length * 24} y={y + 16} fontSize={10} fontFamily="var(--font-mono)" fill={s.kind === "wait" ? WARN : INK} fillOpacity={s.kind === "wait" ? 1 : 0.5} textAnchor="end">
                {effortLabel}
              </text>
              {flags.map((f, k) => (
                <g key={f}>
                  <rect x={VW - 24 * (flags.length - k)} y={y + 5} width={22} height={14} fill={BAD} />
                  <text x={VW - 24 * (flags.length - k) + 11} y={y + 15.5} fontSize={9.5} fontFamily="var(--font-mono)" fill="#fff" textAnchor="middle">
                    {f}
                  </text>
                </g>
              ))}
            </a>
          );
        })}
      </g>
    </svg>
  );
}

function MobileOverview({ guide, t }: { guide: Guide; t: Timeline }) {
  if (!t.overview) return null;
  return (
    <svg viewBox="0 0 360 56" className="block h-auto w-full" role="img" aria-label="Hands-on time compared with approval wait, to scale">
      <defs>
        <Hatch id="m-hatch" color={WARN} />
      </defs>
      <Overview guide={guide} t={t} width={360} prefix="m" stacked />
    </svg>
  );
}

export function SetupTimeline({ guide }: { guide: Guide }) {
  const t = buildTimeline(guide);
  const { totals } = t;
  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[12px] text-ink/60">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 bg-brand" />
          Agent · {totals.agentSteps} steps{totals.agentMinutes > 0 && ` · ~${formatMinutes(totals.agentMinutes)}`}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 bg-ink" />
          You · {totals.youSteps} steps{totals.youMinutes > 0 && ` · ~${formatMinutes(totals.youMinutes)}`}
        </span>
        {totals.waits > 0 && (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 border border-warn bg-[repeating-linear-gradient(45deg,#c98a0b_0_1.5px,transparent_1.5px_4px)]" />
            Waiting on others
          </span>
        )}
        {totals.unestimated > 0 && (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 border border-dashed border-ink" />
            Not estimated
          </span>
        )}
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 border border-ink/40 bg-ink/35" />
          Optional
        </span>
        {t.markers.length > 0 && (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 bg-bad" />
            Blocker
          </span>
        )}
      </div>

      <TimelineHover>
      <Reveal className="mt-5 hidden md:block" wipe="x">
        <HorizontalTimeline guide={guide} t={t} />
      </Reveal>
      <Reveal className="mt-4 md:hidden" wipe="y">
        <MobileOverview guide={guide} t={t} />
        <div className={t.overview ? "mt-4" : ""}>
          <VerticalTimeline guide={guide} t={t} />
        </div>
      </Reveal>
      </TimelineHover>

      {!t.overview && (
        <p className="mt-3 font-mono text-[12px] text-ok">No provider review in the normal path. Hands-on time is the whole timeline.</p>
      )}
      <p className="mt-3 text-[13px] text-ink/50">
        Step widths are hands-on estimates, to scale with each other. Waits are drawn at a fixed width{t.overview ? "; the top bar shows them to scale" : ""}.
      </p>

      {t.markers.length > 0 && (
        <ol className="mt-5 grid border-t border-line sm:grid-cols-2">
          {t.markers.map((m) => (
            <li key={m.req.id} className="border-b border-line sm:odd:border-r">
              <a href={`#req-${m.req.id}`} className="flex items-start gap-3 py-2.5 pr-3 text-[14px] leading-snug hover:bg-white sm:px-3">
                <span className="mt-px bg-bad px-1 font-mono text-[11px] text-white">{m.label}</span>
                <span className="min-w-0 text-ink">
                  {m.req.title}
                  <span className="ml-2 font-mono text-[11px] text-ink/40">STEP {String(m.seg.n).padStart(2, "0")}</span>
                  <span className="mt-0.5 block text-[13px] leading-snug text-ink/55">{appliesText(m.req)}</span>
                </span>
              </a>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
