import type { Evidence, Guide } from "@/lib/guide-schema";
import { ArrowUpRight } from "lucide-react";

export const evidenceMeta: Record<Evidence["status"], { label: string; mark: string; text: string; blurb: string }> = {
  tested: {
    label: "Tested",
    mark: "bg-ok",
    text: "text-ok",
    blurb: "A live probe checked this.",
  },
  documented: {
    label: "Documented",
    mark: "bg-brand",
    text: "text-brand",
    blurb: "Stated in a linked source.",
  },
  uncertain: {
    label: "Uncertain",
    mark: "border border-warn bg-transparent",
    text: "text-warn",
    blurb: "Inferred or unverified. Check first.",
  },
};

export function EvidenceMark({ status }: { status: Evidence["status"] }) {
  return <span className={`inline-block h-2 w-2 shrink-0 ${evidenceMeta[status].mark}`} />;
}

export function EvidenceTag({ evidence, guide, align = "left" }: { evidence: Evidence; guide: Guide; align?: "left" | "right" }) {
  const meta = evidenceMeta[evidence.status];
  const sources = evidence.sourceIds
    .map((id) => guide.sources.find((s) => s.id === id))
    .filter((s) => s !== undefined);
  const probes =
    evidence.status === "tested"
      ? evidence.probeIds.map((id) => guide.probes.find((p) => p.id === id)).filter((p) => p !== undefined)
      : [];
  const note = evidence.status === "uncertain" ? evidence.reason : evidence.note;
  const quote = evidence.status === "documented" ? evidence.quote : undefined;

  return (
    <details className="group relative inline-block align-middle">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 border border-line bg-white px-1.5 py-[3px] font-mono text-[11px] leading-none text-ink/70 select-none hover:border-ink/40 group-open:border-ink [&::-webkit-details-marker]:hidden">
        <EvidenceMark status={evidence.status} />
        {meta.label}
      </summary>
      <div
        className={`absolute z-40 mt-1.5 hidden w-80 max-w-[85vw] border border-ink bg-white p-3 text-left text-[13px] leading-relaxed text-ink/80 group-open:block max-sm:fixed max-sm:inset-x-3 max-sm:bottom-3 max-sm:max-h-[60vh] max-sm:w-auto max-sm:max-w-none max-sm:overflow-y-auto ${align === "right" ? "right-0" : "left-0"}`}
      >
        <p className={`label ${meta.text}`}>{meta.label}</p>
        <p className="mt-1 text-ink">{meta.blurb}</p>
        {quote && <blockquote className="mt-2 border-l-2 border-brand pl-2 text-ink/70">“{quote}”</blockquote>}
        {note && <p className="mt-2">{note}</p>}
        {probes.length > 0 && (
          <ul className="mt-2 space-y-1.5">
            {probes.map((p) => (
              <li key={p.id} className="bg-ink p-2 text-white/80">
                <span className="label text-white/40">Probe</span>
                <span className="mt-1 block">{p.description}</span>
                <span className="mt-1 block font-mono text-[11px] break-all text-brand-light">{p.request}</span>
                <span className="mt-1 block text-white/60">{p.observed}</span>
              </li>
            ))}
          </ul>
        )}
        {sources.length > 0 && (
          <ul className="mt-2 space-y-1 border-t border-line pt-2">
            {sources.map((s) => (
              <li key={s.id}>
                <a href={s.url} target="_blank" rel="noreferrer" className="text-brand underline decoration-brand/30 underline-offset-2 hover:decoration-brand">
                  {s.title}
                  <ArrowUpRight aria-hidden className="ml-0.5 inline-block h-3.5 w-3.5 align-[-2px]" strokeWidth={1.75} />
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}

export function EvidenceLegend({ dark = false }: { dark?: boolean }) {
  return (
    <div className={`flex flex-wrap items-center gap-x-5 gap-y-1.5 font-mono text-[12px] ${dark ? "text-white/60" : "text-ink/60"}`}>
      {(Object.keys(evidenceMeta) as Evidence["status"][]).map((k) => (
        <span key={k} className="inline-flex items-center gap-1.5">
          <EvidenceMark status={k} />
          <span className={dark ? "text-white" : "text-ink"}>{evidenceMeta[k].label}</span>
          <span className="hidden md:inline">{evidenceMeta[k].blurb}</span>
        </span>
      ))}
    </div>
  );
}
