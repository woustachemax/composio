import Link from "next/link";
import type { Guide, Requirement, Step } from "@/lib/guide-schema";
import { difficultyLabel, evidenceCounts, formatDuration, shortName, headlineRequirements, phaseLabels, sortRequirements, stepsByPhase, timeFigures, uncertainClaims } from "@/lib/guide-view";
import { EvidenceLegend, EvidenceTag } from "@/components/evidence";
import { CopyButton } from "@/components/copy-button";
import { AppLogo } from "@/components/app-logo";
import { Meter, SectionHead } from "@/components/ui";
import { SetupTimeline } from "./setup-timeline";
import { SectionNav } from "./section-nav";
import { ArrowUpRight } from "lucide-react";

const impactMark: Record<Requirement["impact"], string> = {
  blocker: "bg-bad",
  friction: "bg-warn",
  info: "bg-ink/20",
};

const impactLabel: Record<Requirement["impact"], string> = {
  blocker: "Can block launch",
  friction: "Friction",
  info: "Good to know",
};

const appliesLabel: Record<Requirement["applies"], string> = {
  required: "Always",
  conditional: "Sometimes",
  "not-required": "Not needed",
};

function OwnerChip({ owner }: { owner: Step["owner"] }) {
  return owner === "agent" ? (
    <span className="bg-brand px-1.5 py-[3px] font-mono text-[11px] leading-none text-white">AGENT</span>
  ) : (
    <span className="bg-ink px-1.5 py-[3px] font-mono text-[11px] leading-none text-white">YOU</span>
  );
}

function linkify(text: string) {
  const parts = text.split(/(https?:\/\/[^\s)"]+)/g);
  return parts.map((p, i) =>
    /^https?:\/\//.test(p) ? (
      <code key={i} className="bg-ink/[0.06] px-1 py-px font-mono text-[12.5px] break-all text-ink">
        {p}
      </code>
    ) : (
      <span key={i}>{p}</span>
    ),
  );
}


function Header({ guide, logo }: { guide: Guide; logo: string | null }) {
  const counts = evidenceCounts(guide);
  const { handsOn, wait } = timeFigures(guide);
  return (
    <section className="bg-ink text-white">
      <div className="mx-auto w-full max-w-[1240px] px-4 pt-6 pb-8 sm:px-6 sm:pt-8 sm:pb-10">
        <nav className="font-mono text-[12px] text-white/40 uppercase">
          <Link href="/" className="hover:text-white">Library</Link>
          <span className="mx-2">/</span>
          <span className="text-white/80">{guide.app.name}</span>
        </nav>
        <div className="mt-5 flex flex-wrap items-start justify-between gap-6">
          <div className="max-w-3xl">
            <div className="flex items-center gap-4">
              <AppLogo src={logo} name={guide.app.name} size={52} className="border-white/10" />
              <div>
                <p className="label text-white/40">{guide.app.category}</p>
                <h1 className="mt-1 text-[32px] leading-[1.05] tracking-[-0.025em] sm:text-[44px]">{guide.app.name}</h1>
              </div>
            </div>
            <p className="mt-5 text-[22px] leading-snug tracking-[-0.02em] sm:text-[26px]">
              {wait.kind === "unclear" ? (
                <span className="hl">Approval wait unclear.</span>
              ) : wait.kind === "none" ? (
                <span className="hl">No approval wait.</span>
              ) : (
                <>
                  <span className="hl">{wait.value}</span> approval wait.
                </>
              )}{" "}
              {handsOn.value} <span className="whitespace-nowrap">hands-on.</span>
            </p>
            <p className="mt-3 max-w-3xl text-[15.5px] leading-relaxed text-white/65">{guide.summary.verdict}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href={guide.app.developerConsoleUrl} target="_blank" rel="noreferrer" className="btn btn-light">
              Developer console
              <ArrowUpRight aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            </a>
            <CopyButton label="Copy link" className="btn btn-line-dark" />
          </div>
        </div>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-x-8 gap-y-3">
          <p className="flex flex-wrap gap-x-5 gap-y-1 font-mono text-[12px] text-white/45 uppercase">
            <span>Verified {guide.meta.lastVerified}</span>
            <span>{guide.meta.origin === "hand-researched" ? "Hand-researched" : "Agent-generated, not reviewed"}</span>
            <span>
              <span className="text-[#4ade80]">{counts.tested} tested</span> · <span className="text-brand-light">{counts.documented} documented</span> ·{" "}
              <span className="text-[#facc15]">{counts.uncertain} uncertain</span>
            </span>
          </p>
          <EvidenceLegend dark />
        </div>
      </div>
    </section>
  );
}

function StatsStrip({ guide }: { guide: Guide }) {
  const { difficulty } = guide.summary;
  const { handsOn, wait } = timeFigures(guide);
  const managed = guide.composio.managedAuthAvailable;
  const cell = "border-line p-4 sm:p-5";
  return (
    <section aria-label="Summary" className="mx-auto -mt-px w-full max-w-[1240px] px-4 sm:px-6">
      <div className="grid grid-cols-2 border border-t-0 border-line bg-white lg:grid-cols-4">
        <div className={`${cell} border-r border-b lg:border-b-0`}>
          <p className="label text-ink/50">Difficulty</p>
          <div className="mt-2 flex items-center gap-2.5">
            <Meter level={difficulty.level} />
            <span className="text-[24px] leading-none tracking-[-0.025em]">{difficultyLabel[difficulty.level]}</span>
          </div>
          <div className="mt-3">
            <EvidenceTag evidence={difficulty.evidence} guide={guide} />
          </div>
        </div>
        <div className={`${cell} border-b lg:border-r lg:border-b-0`}>
          <p className="label text-ink/50">Hands-on</p>
          <p className="mt-2 text-[24px] leading-none tracking-[-0.025em]">{handsOn.value}</p>
          {handsOn.estimate && <p className="mt-2 font-mono text-[11px] text-ink/45 uppercase">Estimate</p>}
          <div className="mt-3">
            <EvidenceTag evidence={handsOn.evidence} guide={guide} />
          </div>
        </div>
        <div className={`${cell} border-r`}>
          <p className="label text-ink/50">Approval wait</p>
          <p className={`mt-2 text-[24px] leading-none tracking-[-0.025em] ${wait.kind === "unclear" ? "text-ink/50" : wait.kind === "none" ? "text-ok" : "text-warn"}`}>{wait.value}</p>
          <p className="mt-2 font-mono text-[11px] text-ink/45 uppercase">
            {wait.kind === "stated" ? wait.label : wait.kind === "range" ? "Provider review" : wait.kind === "none" ? "No review queue" : wait.detail}
          </p>
          {wait.kind === "stated" && wait.detail && <p className="mt-1 text-[12.5px] leading-snug text-ink/55">{wait.detail}</p>}
          <div className="mt-3">
            <EvidenceTag evidence={wait.evidence} guide={guide} />
          </div>
        </div>
        <div className={cell}>
          <p className="label text-ink/50">Composio managed app</p>
          <p className={`mt-2 text-[24px] leading-none tracking-[-0.025em] ${managed === "yes" ? "text-ok" : managed === "no" ? "text-bad" : "text-ink/50"}`}>
            {managed === "yes" ? "Yes" : managed === "no" ? "No" : "Unknown"}
          </p>
          <p className="mt-3 font-mono text-[11px] text-ink/40 uppercase">
            {managed === "yes" ? "Start without your own app" : managed === "no" ? "Your own app is required" : "Check Composio docs"}
          </p>
        </div>
      </div>
    </section>
  );
}

type Section = { id: string; label: string; render: (n: string) => React.ReactNode };

function TimelineSection({ guide, n }: { guide: Guide; n: string }) {
  const { notRequired } = headlineRequirements(guide);
  const { difficulty, time } = guide.summary;
  return (
    <section className="space-y-6">
      <SectionHead n={n} id="timeline" label="Timeline" title="Who does what, and how long it takes" />
      <div className="border border-line bg-white p-4 sm:p-6">
        <SetupTimeline guide={guide} />
        {notRequired.length > 0 && (
          <p className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[14px]">
            <span className="label text-ok">Not needed</span>
            {notRequired.map((r) => (
              <a key={r.id} href={`#req-${r.id}`} className="text-ink/70 underline decoration-ink/20 underline-offset-2 hover:decoration-ink">
                {r.title}
              </a>
            ))}
          </p>
        )}
      </div>
      <div className="grid gap-px border border-line bg-line md:grid-cols-2">
        <div className="bg-white p-4 sm:p-5">
          <p className="label text-ink/50">Why it&apos;s {difficultyLabel[difficulty.level].toLowerCase()}</p>
          <p className="mt-2 text-[14px] leading-relaxed text-ink/80">{difficulty.reason}</p>
        </div>
        <div className="bg-white p-4 sm:p-5">
          <p className="label text-ink/50">Where the time goes</p>
          <p className="mt-2 text-[14px] leading-relaxed text-ink/80">{time.note}</p>
        </div>
      </div>
    </section>
  );
}

function ComposioSection({ guide, n }: { guide: Guide; n: string }) {
  const c = guide.composio;
  const managed = {
    yes: "Composio has a managed app for this toolkit. Start with it and switch to your own later.",
    no: "Composio has no managed app here. Users can't connect until you register your own.",
    unknown: "We couldn't confirm whether Composio has a managed app for this toolkit.",
  }[c.managedAuthAvailable];
  return (
    <section className="space-y-6">
      <SectionHead n={n} id="composio" label="Composio" title="Plug it into Composio" aside={<EvidenceTag evidence={c.evidence} guide={guide} align="right" />} />
      <div className="grid gap-px border border-line bg-line lg:grid-cols-[1fr_1.1fr]">
        <div className="bg-white p-4 sm:p-6">
          <p className="text-[16px] leading-relaxed text-ink">{managed}</p>
          {c.whyBringYourOwn.length > 0 && (
            <>
              <p className="label mt-5 text-ink/50">Why use your own app</p>
              <ul className="mt-2 space-y-2">
                {c.whyBringYourOwn.map((w) => (
                  <li key={w} className="border-l-2 border-ink/15 pl-3 text-[14px] leading-snug text-ink/80">
                    {w}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
        <div className="bg-ink p-4 font-mono text-[12.5px] leading-[1.9] text-white/80 sm:p-6">
          <div className="flex items-center justify-between">
            <span className="label text-white/40">Composio auth config</span>
            <CopyButton value={c.callbackUrl} label="Copy callback" className="btn btn-sm btn-line-dark" />
          </div>
          <div className="mt-4 overflow-x-auto">
            <p className="text-white/35">{"// register this redirect URL with " + shortName(guide)}</p>
            <p className="break-all whitespace-normal">
              <span className="text-brand-light">callback_url</span> = <span className="text-lime">&quot;{c.callbackUrl}&quot;</span>
            </p>
            <p className="mt-2 text-white/35">{"// then paste these from " + shortName(guide)}</p>
            <p>
              <span className="text-brand-light">client_id</span> = <span className="text-white/50">&quot;…&quot;</span>
            </p>
            <p>
              <span className="text-brand-light">client_secret</span> = <span className="text-white/50">&quot;…&quot;</span>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function AppTypeSection({ guide, n }: { guide: Guide; n: string }) {
  const a = guide.appTypeChoice;
  if (!a) return null;
  return (
    <section className="space-y-6">
      <SectionHead n={n} id="app-type" label="Decide first" title={a.question} aside={<EvidenceTag evidence={a.evidence} guide={guide} align="right" />} />
      <p className="max-w-3xl border-l-2 border-brand pl-4 text-[16px] leading-relaxed text-ink">{a.recommendation}</p>
      <div className={`grid gap-px border border-line bg-line ${a.options.length > 2 ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
        {a.options.map((o, i) => (
          <div key={o.name} className="bg-white p-4 sm:p-5">
            <p className="font-mono text-[11px] text-ink/40">OPTION {String.fromCharCode(65 + i)}</p>
            <p className="mt-1 text-[18px] tracking-[-0.01em] text-ink">{o.name}</p>
            <p className="mt-1 text-[14px] text-ink/60">{o.bestFor}</p>
            <ul className="mt-4 space-y-1.5">
              {o.tradeoffs.map((t) => (
                <li key={t} className="border-l-2 border-ink/15 pl-3 text-[14px] leading-snug text-ink/80">
                  {t}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

function StepsSection({ guide, n }: { guide: Guide; n: string }) {
  const index = new Map(guide.steps.map((s, i) => [s.id, i + 1]));
  return (
    <section className="space-y-6">
      <SectionHead n={n} id="steps" label="Steps" title="Set it up" />
      <div className="border border-line bg-white">
        {stepsByPhase(guide).map(({ phase, steps }) => (
          <div key={phase}>
            <div className="flex items-center justify-between border-b border-line bg-paper px-4 py-2 sm:px-5">
              <span className="label text-ink/60">{phaseLabels[phase]}</span>
              <span className="font-mono text-[11px] text-ink/40">{steps.length} {steps.length === 1 ? "STEP" : "STEPS"}</span>
            </div>
            <ol>
              {steps.map((s) => (
                <li id={`step-${s.id}`} key={s.id} className="grid scroll-mt-20 grid-cols-[40px_1fr] gap-x-3 border-b border-line px-4 py-4 last:border-b-0 sm:grid-cols-[56px_1fr] sm:px-5 sm:py-5">
                  <span className={`font-mono text-[20px] leading-none tracking-[-0.03em] sm:text-[24px] ${s.optional ? "text-ink/25" : "text-ink/40"}`}>
                    {String(index.get(s.id)).padStart(2, "0")}
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                      <OwnerChip owner={s.owner} />
                      <h3 className={`text-[17px] leading-snug tracking-[-0.01em] ${s.optional ? "text-ink/60" : "text-ink"}`}>{s.title}</h3>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 font-mono text-[11px] text-ink/50 uppercase">
                      {s.effort && <span>{formatDuration(s.effort)}</span>}
                      {s.waitsOn !== "nobody" && <span className="text-warn">Waits on {s.waitsOn === "provider" ? shortName(guide) : "a third party"}</span>}
                      {s.optional && <span>Optional</span>}
                      <EvidenceTag evidence={s.evidence} guide={guide} />
                    </div>
                    <ul className="mt-3 space-y-1.5">
                      {s.instructions.map((ins) => (
                        <li key={ins} className="border-l-2 border-ink/10 pl-3 text-[14.5px] leading-relaxed text-ink/80">
                          {linkify(ins)}
                        </li>
                      ))}
                    </ul>
                    {s.agentAssist && (
                      <p className="mt-3 bg-lilac px-3 py-2 text-[14px] leading-snug text-ink">
                        <span className="label mr-2 text-brand">Agent can help</span>
                        {s.agentAssist}
                      </p>
                    )}
                    {s.url && (
                      <a href={s.url} target="_blank" rel="noreferrer" className="mt-3 inline-block font-mono text-[12px] break-all text-brand hover:underline">
                        {new URL(s.url).host}
                        {new URL(s.url).pathname !== "/" ? new URL(s.url).pathname : ""}
                        <ArrowUpRight aria-hidden className="ml-0.5 inline-block h-3.5 w-3.5 align-[-2px]" strokeWidth={1.75} />
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
    </section>
  );
}

function BlockersSection({ guide, n }: { guide: Guide; n: string }) {
  if (guide.blockers.length === 0) return null;
  return (
    <section className="space-y-6">
      <SectionHead n={n} id="blocked" label="Troubleshooting" title="If you get blocked" />
      <div className="border-t border-line">
        {guide.blockers.map((b) => (
          <details key={b.id} className="group border-b border-line">
            <summary className="flex cursor-pointer list-none items-start justify-between gap-4 py-4 [&::-webkit-details-marker]:hidden">
              <span className="text-[15px] leading-snug text-ink">{b.symptom}</span>
              <span className="mt-0.5 font-mono text-[16px] leading-none text-ink/50 transition group-open:rotate-45">+</span>
            </summary>
            <div className="grid gap-4 pb-5 md:grid-cols-[1fr_1fr]">
              <div>
                <p className="label text-ink/50">Why</p>
                <p className="mt-1.5 text-[14px] leading-relaxed text-ink/80">{b.cause}</p>
                <div className="mt-3">
                  <EvidenceTag evidence={b.evidence} guide={guide} />
                </div>
              </div>
              <div>
                <p className="label text-ink/50">Fix</p>
                <ul className="mt-1.5 space-y-1.5">
                  {b.fix.map((f) => (
                    <li key={f} className="border-l-2 border-ok pl-3 text-[14px] leading-relaxed text-ink/80">
                      {linkify(f)}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}

function RequirementsSection({ guide, n }: { guide: Guide; n: string }) {
  return (
    <section className="space-y-6">
      <SectionHead n={n} id="requirements" label="Requirements" title="Requirements and gotchas" />
      <div className="flex flex-wrap gap-x-5 gap-y-1 font-mono text-[12px] text-ink/60">
        {(["blocker", "friction", "info"] as const).map((k) => (
          <span key={k} className="inline-flex items-center gap-1.5">
            <span className={`h-2 w-2 ${impactMark[k]}`} />
            {impactLabel[k]}
          </span>
        ))}
      </div>
      <div className="border border-line bg-white">
        {sortRequirements(guide.requirements).map((r) => (
          <div id={`req-${r.id}`} key={r.id} className="scroll-mt-20 border-b border-line px-4 py-4 last:border-b-0 sm:px-5">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <span className={`h-2 w-2 shrink-0 ${r.applies === "not-required" ? "border border-ok bg-transparent" : impactMark[r.impact]}`} />
              <h3 className={`text-[16px] leading-snug ${r.applies === "not-required" ? "text-ink/60" : "text-ink"}`}>{r.title}</h3>
              <span className={`font-mono text-[11px] uppercase ${r.applies === "not-required" ? "text-ok" : "text-ink/40"}`}>{appliesLabel[r.applies]}</span>
              <span className="sm:ml-auto">
                <EvidenceTag evidence={r.evidence} guide={guide} align="right" />
              </span>
            </div>
            {r.condition && <p className="mt-1.5 pl-5 font-mono text-[12px] text-ink/50">WHEN: {r.condition}</p>}
            <p className="mt-1.5 pl-5 text-[14px] leading-relaxed text-ink/75">{r.detail}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function FactsSection({ guide, n }: { guide: Guide; n: string }) {
  if (guide.facts.length === 0) return null;
  return (
    <section className="space-y-6">
      <SectionHead n={n} id="reference" label="Reference" title="Technical reference" />
      <div className="bg-ink">
        <dl>
          {guide.facts.map((f) => (
            <div key={f.id} className="grid grid-cols-[minmax(0,1fr)] gap-1.5 border-b border-line-dark px-4 py-3 last:border-b-0 sm:grid-cols-[220px_minmax(0,1fr)_auto] sm:items-center sm:gap-5 sm:px-5">
              <dt className="font-mono text-[12px] text-brand-light">{f.label}</dt>
              <dd className="font-mono text-[13px] [overflow-wrap:anywhere] text-white/85">{f.value}</dd>
              <dd>
                <EvidenceTag evidence={f.evidence} guide={guide} align="right" />
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

function UncertaintySection({ guide, n }: { guide: Guide; n: string }) {
  const uncertain = uncertainClaims(guide);
  if (uncertain.length === 0 && guide.openQuestions.length === 0) return null;
  return (
    <section className="space-y-6">
      <SectionHead n={n} id="uncertain" label="Unverified" title="What we couldn't verify" />
      <div className="grid gap-px border border-line bg-line md:grid-cols-2">
        {guide.openQuestions.length > 0 && (
          <div className="bg-sand p-4 sm:p-5">
            <p className="label text-ink/60">Open questions</p>
            <ul className="mt-3 space-y-2.5">
              {guide.openQuestions.map((q) => (
                <li key={q} className="flex gap-3 text-[14px] leading-snug text-ink/85">
                  <span className="font-mono text-warn">?</span>
                  {q}
                </li>
              ))}
            </ul>
          </div>
        )}
        {uncertain.length > 0 && (
          <div className="bg-white p-4 sm:p-5">
            <p className="label text-ink/60">Claims marked uncertain</p>
            <ul className="mt-3 space-y-3">
              {uncertain.map((c) => (
                <li key={`${c.section}-${c.label}`} className="border-l-2 border-warn pl-3">
                  <p className="font-mono text-[11px] text-ink/40 uppercase">{c.section}</p>
                  <p className="text-[14px] text-ink">{c.label}</p>
                  {c.evidence.status === "uncertain" && <p className="mt-0.5 text-[13px] leading-snug text-ink/60">{c.evidence.reason}</p>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}

function SourcesSection({ guide, n }: { guide: Guide; n: string }) {
  const outcome = { confirmed: "text-[#4ade80]", refuted: "text-[#f87171]", inconclusive: "text-white/40" };
  return (
    <section className="space-y-6">
      <SectionHead n={n} id="sources" label="Evidence" title="Sources and probes" />
      {guide.probes.length > 0 && (
        <div className="bg-ink font-mono text-[12.5px]">
          <div className="flex items-center justify-between border-b border-line-dark px-4 py-2.5 sm:px-5">
            <span className="label text-white/40">Live probes</span>
            <span className="text-[11px] text-white/30">{guide.probes.length} {guide.probes.length === 1 ? "PROBE" : "PROBES"}</span>
          </div>
          <ul>
            {guide.probes.map((p) => (
              <li key={p.id} className="border-b border-line-dark px-4 py-3 last:border-b-0 sm:px-5">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className={`uppercase ${outcome[p.outcome]}`}>[{p.outcome}]</span>
                  <span className="font-sans text-[14px] text-white">{p.description}</span>
                  <span className="ml-auto text-[11px] text-white/30">{p.ranAt}</span>
                </div>
                <p className="mt-1.5 break-all text-brand-light">$ {p.request}</p>
                <p className="mt-1 font-sans text-[13px] leading-snug text-white/55">{p.observed}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
      <ul className="grid border-t border-l border-line bg-white sm:grid-cols-2">
        {guide.sources.map((s) => (
          <li key={s.id} className="border-r border-b border-line px-4 py-3">
            <p className="font-mono text-[11px] text-ink/40 uppercase">
              {s.publisher === "provider" ? shortName(guide) : s.publisher === "composio" ? "Composio" : "Third party"} · {s.accessedAt}
            </p>
            <a href={s.url} target="_blank" rel="noreferrer" className="mt-0.5 block text-[14px] leading-snug text-brand hover:underline">
              {s.title}
              <ArrowUpRight aria-hidden className="ml-0.5 inline-block h-3.5 w-3.5 align-[-2px]" strokeWidth={1.75} />
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function GuideView({ guide, logo }: { guide: Guide; logo: string | null }) {
  const sections: Section[] = [
    { id: "timeline", label: "Timeline", render: (n) => <TimelineSection guide={guide} n={n} /> },
    { id: "composio", label: "Composio", render: (n) => <ComposioSection guide={guide} n={n} /> },
  ];
  if (guide.appTypeChoice) sections.push({ id: "app-type", label: "Decide first", render: (n) => <AppTypeSection guide={guide} n={n} /> });
  sections.push({ id: "steps", label: "Steps", render: (n) => <StepsSection guide={guide} n={n} /> });
  if (guide.blockers.length > 0) sections.push({ id: "blocked", label: "If blocked", render: (n) => <BlockersSection guide={guide} n={n} /> });
  sections.push({ id: "requirements", label: "Requirements", render: (n) => <RequirementsSection guide={guide} n={n} /> });
  if (guide.facts.length > 0) sections.push({ id: "reference", label: "Reference", render: (n) => <FactsSection guide={guide} n={n} /> });
  if (uncertainClaims(guide).length > 0 || guide.openQuestions.length > 0)
    sections.push({ id: "uncertain", label: "Unverified", render: (n) => <UncertaintySection guide={guide} n={n} /> });
  sections.push({ id: "sources", label: "Sources", render: (n) => <SourcesSection guide={guide} n={n} /> });

  return (
    <div className="pb-24">
      <Header guide={guide} logo={logo} />
      <StatsStrip guide={guide} />

      <div className="mx-auto w-full max-w-[1240px] px-4 sm:px-6">
        {guide.meta.origin === "agent-generated" && (
          <p className="mt-6 border-l-2 border-brand bg-lilac px-4 py-3 text-[14px] text-ink">
            <span className="label mr-2 text-brand">Agent-generated</span>
            Built from public docs and live probes. Check the evidence tag before you rely on a claim.
          </p>
        )}
        <div className="mt-10 grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[200px_minmax(0,1fr)]">
          <SectionNav sections={sections.map(({ id, label }) => ({ id, label }))} />
          <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-16">
            {sections.map((s, i) => (
              <div key={s.id}>{s.render(String(i + 1).padStart(2, "0"))}</div>
            ))}
            {guide.meta.researchNotes && (
              <div className="border-t border-line pt-5">
                <p className="label text-ink/50">How this guide was researched</p>
                <p className="mt-2 max-w-3xl text-[13px] leading-relaxed text-ink/60">{guide.meta.researchNotes}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
