import type { Metadata } from "next";
import Link from "next/link";
import quoteCheck from "@/content/quote-check.json";
import reprobe from "@/content/reprobe-report.json";
import { checkedByHand, corrections, driftNotes, unverified, type VerificationItem } from "@/content/verification";
import { listLibraryGuides } from "@/lib/library";
import { evidenceCounts } from "@/lib/guide-view";
import { SectionHead } from "@/components/ui";
import { EvidenceMark } from "@/components/evidence";
import { ArrowRight } from "lucide-react";

export const metadata: Metadata = {
  title: "Verification",
};

function ItemList({ items, bar }: { items: VerificationItem[]; bar: string }) {
  return (
    <ul className="border border-line bg-white">
      {items.map((i) => (
        <li key={`${i.guide}-${i.title}`} className="grid gap-x-6 gap-y-1.5 border-b border-line px-4 py-4 last:border-b-0 sm:px-5 md:grid-cols-[160px_1fr]">
          <span className="font-mono text-[11px] text-ink/40 uppercase">{i.guide}</span>
          <div className={`border-l-2 pl-3 ${bar}`}>
            <p className="text-[16px] leading-snug text-ink">{i.title}</p>
            <p className="mt-1.5 text-[14px] leading-relaxed text-ink/70">{i.detail}</p>
            {i.how && <p className="mt-2 font-mono text-[12px] text-ink/45">CAUGHT BY: {i.how}</p>}
          </div>
        </li>
      ))}
    </ul>
  );
}

const steps = [
  {
    title: "Agents research and probe",
    body: "Agents read official docs and send unauthenticated GET probes: OIDC discovery, the authorize endpoint with a placeholder client, and console URLs against a made-up sibling path. No sign-ins, no form posts, no private addresses.",
  },
  {
    title: "Rules set the tag",
    body: "Tested needs a decisive probe. Documented needs a page the agent actually opened. For live runs, the server downgrades everything else to uncertain before saving and records what it changed.",
  },
  {
    title: "Re-checks catch drift",
    body: "npm run check-quotes fetches every cited page and finds each quote. npm run reprobe re-runs the GET probes and flags changed results.",
  },
];

export default function VerificationPage() {
  const guides = listLibraryGuides();
  const totals = guides.reduce(
    (acc, g) => {
      const c = evidenceCounts(g);
      acc.tested += c.tested;
      acc.documented += c.documented;
      acc.uncertain += c.uncertain;
      return acc;
    },
    { tested: 0, documented: 0, uncertain: 0 },
  );
  const totalClaims = totals.tested + totals.documented + totals.uncertain;
  const quoteTotal = quoteCheck.rows.length;
  const rerun = reprobe.rows.filter((r) => r.rerun !== "skipped");
  const linksOk = quoteCheck.links.checked - quoteCheck.links.broken.length;

  return (
    <>
      <section className="bg-ink text-white">
        <div className="mx-auto w-full max-w-[1240px] px-4 pt-12 pb-14 sm:px-6 sm:pt-16 sm:pb-20">
          <p className="label text-white/40">Verification</p>
          <h1 className="mt-4 max-w-3xl text-[36px] leading-[1.15] tracking-[-0.025em] sm:text-[56px]">
            What was checked, and <span className="hl">what wasn&apos;t</span>
          </h1>
          <p className="mt-5 max-w-2xl text-[17px] leading-relaxed text-white/60">The audit trail behind every evidence tag in the library.</p>

          <div className="mt-12 grid grid-cols-2 border-t border-l border-line-dark lg:grid-cols-4">
            {[
              { v: totalClaims, l: `Claims in ${guides.length} guides` },
              { v: `${quoteCheck.summary.found}/${quoteTotal}`, l: `Quotes found live · ${quoteCheck.ranAt}` },
              { v: `${linksOk}/${quoteCheck.links.checked}`, l: "Cited URLs resolve" },
              { v: `${rerun.length - reprobe.drift}/${rerun.length}`, l: `Probes unchanged · ${reprobe.ranAt}` },
            ].map((s) => (
              <div key={s.l} className="border-r border-b border-line-dark p-4 sm:p-5">
                <p className="text-[32px] leading-none tracking-[-0.03em] sm:text-[40px]">{s.v}</p>
                <p className="mt-3 font-mono text-[11px] text-white/45 uppercase">{s.l}</p>
              </div>
            ))}
          </div>

          <div className="mt-6">
            <div className="flex h-2 w-full">
              <span className="bg-[#16a34a]" style={{ width: `${(totals.tested / totalClaims) * 100}%` }} />
              <span className="bg-brand" style={{ width: `${(totals.documented / totalClaims) * 100}%` }} />
              <span className="bg-[#c98a0b]" style={{ width: `${(totals.uncertain / totalClaims) * 100}%` }} />
            </div>
            <p className="mt-3 flex flex-wrap gap-x-5 gap-y-1 font-mono text-[12px] text-white/60 uppercase">
              <span className="text-[#4ade80]">{totals.tested} tested</span>
              <span className="text-brand-light">{totals.documented} documented</span>
              <span className="text-[#facc15]">{totals.uncertain} uncertain</span>
            </p>
          </div>
        </div>
      </section>

      <div className="mx-auto grid w-full max-w-[1240px] grid-cols-[minmax(0,1fr)] gap-20 px-4 py-16 sm:px-6 sm:py-24">
        <section className="space-y-8">
          <SectionHead n="01" label="Method" title="How evidence is produced" />
          <ol className="grid gap-px border border-line bg-line md:grid-cols-3">
            {steps.map((s, i) => (
              <li key={s.title} className="bg-white p-5">
                <span className="num bg-brand text-white">{String(i + 1).padStart(2, "0")}</span>
                <p className="mt-4 text-[18px] tracking-[-0.01em] text-ink">{s.title}</p>
                <p className="mt-2 text-[14px] leading-relaxed text-ink/70">{s.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="space-y-8">
          <SectionHead n="02" label="Corrections" title="What I corrected" />
          <p className="-mt-4 text-[15px] text-ink/55">Mostly my own mistakes, caught by the checks above.</p>
          <ItemList items={corrections} bar="border-bad" />
        </section>

        <section className="space-y-8">
          <SectionHead n="03" label="By hand" title="What I checked by hand" />
          <ItemList items={checkedByHand} bar="border-ok" />
        </section>

        <section className="space-y-8">
          <SectionHead n="04" label="Open" title="What I couldn't verify" />
          <ItemList items={unverified} bar="border-warn" />
        </section>

        <section className="space-y-8">
          <SectionHead n="05" label="Per guide" title="Evidence by guide" />
          <div className="overflow-x-auto border border-line bg-white">
            <table className="w-full min-w-[640px] text-[14px]">
              <thead className="border-b border-line text-left font-mono text-[11px] text-ink/40 uppercase">
                <tr>
                  <th className="px-4 py-2.5 font-normal">Guide</th>
                  <th className="px-4 py-2.5 font-normal">Mix</th>
                  <th className="px-4 py-2.5 font-normal">Tested</th>
                  <th className="px-4 py-2.5 font-normal">Documented</th>
                  <th className="px-4 py-2.5 font-normal">Uncertain</th>
                  <th className="px-4 py-2.5 font-normal">Open Qs</th>
                  <th className="px-4 py-2.5 font-normal">Sources</th>
                  <th className="px-4 py-2.5 font-normal">Probes</th>
                </tr>
              </thead>
              <tbody>
                {guides.map((g) => {
                  const c = evidenceCounts(g);
                  const t = c.tested + c.documented + c.uncertain;
                  return (
                    <tr key={g.slug} className="border-b border-line last:border-b-0">
                      <td className="px-4 py-3">
                        <Link href={`/guides/${g.slug}#uncertain`} className="inline-flex items-center gap-1 text-ink hover:text-brand">
                          {g.app.name}
                          <ArrowRight aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                        </Link>
                      </td>
                      <td className="w-40 px-4 py-3">
                        <span className="flex h-1.5 w-32">
                          <span className="bg-ok" style={{ width: `${(c.tested / t) * 100}%` }} />
                          <span className="bg-brand" style={{ width: `${(c.documented / t) * 100}%` }} />
                          <span className="bg-warn" style={{ width: `${(c.uncertain / t) * 100}%` }} />
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-ok">{c.tested}</td>
                      <td className="px-4 py-3 font-mono text-brand">{c.documented}</td>
                      <td className="px-4 py-3 font-mono text-warn">{c.uncertain}</td>
                      <td className="px-4 py-3 font-mono">{g.openQuestions.length}</td>
                      <td className="px-4 py-3 font-mono">{g.sources.length}</td>
                      <td className="px-4 py-3 font-mono">{g.probes.length}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-8">
          <SectionHead n="06" label="Re-probe" title="Latest re-probe" />
          <p className="-mt-4 font-mono text-[12px] text-ink/50 uppercase">
            Ran {reprobe.ranAt} · {rerun.length} re-run · {reprobe.rows.length - rerun.length} skipped (POST or templated) · {reprobe.drift} drifted
          </p>
          <div className="overflow-x-auto bg-ink">
            <table className="w-full min-w-[720px] font-mono text-[12.5px]">
              <thead className="border-b border-line-dark text-left text-[11px] text-white/35 uppercase">
                <tr>
                  <th className="px-4 py-2.5 font-normal">Guide</th>
                  <th className="px-4 py-2.5 font-normal">Probe</th>
                  <th className="px-4 py-2.5 font-normal">Recorded</th>
                  <th className="px-4 py-2.5 font-normal">Re-run</th>
                  <th className="px-4 py-2.5 font-normal">Note</th>
                </tr>
              </thead>
              <tbody className="text-white/80">
                {reprobe.rows.map((r) => {
                  const drift = r.rerun !== "skipped" && r.rerun !== r.recorded;
                  const note = driftNotes[`${r.guide}/${r.probeId}`];
                  const tone = (o: string) => (o === "confirmed" ? "text-[#4ade80]" : o === "refuted" ? "text-[#f87171]" : o === "skipped" ? "text-white/25" : "text-white/45");
                  return (
                    <tr key={`${r.guide}-${r.probeId}`} className={`border-b border-line-dark last:border-b-0 ${drift ? "bg-[#c98a0b]/15" : ""}`}>
                      <td className="px-4 py-2.5 text-white/50">{r.guide}</td>
                      <td className="px-4 py-2.5">{r.probeId}</td>
                      <td className={`px-4 py-2.5 ${tone(r.recorded)}`}>{r.recorded}</td>
                      <td className={`px-4 py-2.5 ${tone(r.rerun)}`}>
                        {r.rerun}
                        {drift && <span className="ml-2 text-[#facc15]">DRIFT</span>}
                      </td>
                      <td className="px-4 py-2.5 font-sans text-[12.5px] text-white/50">{note ?? (r.rerun === "skipped" ? r.observed : drift ? r.observed : "")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-8">
          <SectionHead n="07" label="Quotes" title="Quote check" />
          <p className="-mt-4 text-[15px] text-ink/55">
            Ran {quoteCheck.ranAt}. Each quote is matched against its cited pages after normalizing whitespace, markdown and punctuation.
          </p>
          <details className="group border border-line bg-white">
            <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3.5 [&::-webkit-details-marker]:hidden">
              <span className="font-mono text-[12px] text-ink uppercase">Show all {quoteTotal} quotes</span>
              <span className="font-mono text-[16px] text-ink/50 transition group-open:rotate-45">+</span>
            </summary>
            <ul className="border-t border-line">
              {quoteCheck.rows.map((r, i) => (
                <li key={i} className="grid gap-x-4 gap-y-1 border-b border-line px-4 py-3 last:border-b-0 md:grid-cols-[90px_220px_1fr]">
                  <span className={`flex items-center gap-1.5 font-mono text-[11px] uppercase ${r.result === "found" ? "text-ok" : "text-bad"}`}>
                    <EvidenceMark status={r.result === "found" ? "tested" : "uncertain"} />
                    {r.result}
                  </span>
                  <span className="font-mono text-[11px] text-ink/45 uppercase">
                    {r.guide} · {r.claim}
                  </span>
                  <p className="text-[14px] text-ink/75">“{r.quote}”</p>
                </li>
              ))}
            </ul>
          </details>
        </section>
      </div>
    </>
  );
}
