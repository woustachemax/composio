"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import type { GenerationEvent } from "@/lib/generate/events";
import { createGenerationStore } from "./generation-store";
import { Pipeline, pipelineState } from "./pipeline";
import { APP_INPUT_MAX, validateAppInput } from "@/lib/app-input";
import { RUNS_PER_HOUR } from "@/lib/rate-limit";
import { ArrowLeft, ArrowRight } from "lucide-react";

const reasonTitle: Record<string, string> = {
  not_found: "We couldn't find that app",
  ambiguous: "That name matches more than one product",
  no_oauth: "This app has no OAuth for third-party developers",
  no_public_docs: "No public OAuth docs to build from",
};

function hostOf(url: string) {
  try {
    const u = new URL(url);
    return `${u.hostname.replace(/^www\./, "")}${u.pathname.length > 1 ? u.pathname : ""}`;
  } catch {
    return url;
  }
}

function EventRow({ event }: { event: GenerationEvent }) {
  switch (event.type) {
    case "started":
      return <Row tag="START" tone="text-white/40">Research started with {event.model}</Row>;
    case "note":
      return <Row tag="NOTE" tone="text-white/30"><span className="font-sans text-white/50">{event.text}</span></Row>;
    case "search":
      return <Row tag="SEARCH" tone="text-brand-light">“{event.query}”</Row>;
    case "fetch":
      return <Row tag="OPEN" tone="text-brand-light"><span className="break-all text-white/60">{hostOf(event.url)}</span></Row>;
    case "fetched":
      return event.ok ? (
        <Row tag="READ" tone="text-brand-light"><span className="font-sans text-white">{event.title || hostOf(event.url)}</span></Row>
      ) : (
        <Row tag="FAIL" tone="text-white/30"><span className="text-white/40">Page could not be fetched</span></Row>
      );
    case "probe": {
      const tone = event.probe.outcome === "confirmed" ? "text-[#4ade80]" : event.probe.outcome === "refuted" ? "text-[#f87171]" : "text-white/40";
      return (
        <Row tag="PROBE" tone={tone}>
          <span className={`uppercase ${tone}`}>[{event.probe.outcome}]</span> <span className="font-sans text-white">{event.probe.description}</span>
          <span className="mt-0.5 block font-sans text-white/45">{event.probe.observed}</span>
        </Row>
      );
    }
    case "submit":
      return <Row tag="SUBMIT" tone="text-lime">Draft submitted{event.attempt > 1 ? ` (attempt ${event.attempt})` : ""}</Row>;
    case "invalid":
      return (
        <Row tag="FIX" tone="text-[#facc15]">
          {event.issues.length} validation {event.issues.length === 1 ? "issue" : "issues"}. The agent is fixing them.
          <span className="mt-0.5 block text-[11px] text-white/40">{event.issues.slice(0, 3).join(" · ")}</span>
        </Row>
      );
    case "check":
      return <Row tag="CHECK" tone="text-[#facc15]"><span className="font-sans text-white/80">{event.message}</span></Row>;
    default:
      return null;
  }
}

function Row({ tag, tone, children }: { tag: string; tone: string; children: React.ReactNode }) {
  return (
    <li className="grid grid-cols-[64px_1fr] gap-3 py-1 font-mono text-[12.5px] leading-relaxed text-white/80">
      <span className={tone}>{tag}</span>
      <div className="min-w-0">{children}</div>
    </li>
  );
}

export function GenerateRunner() {
  const app = (useSearchParams().get("app") ?? "").trim();
  return <Runner key={app} app={app} />;
}

function Runner({ app }: { app: string }) {
  const router = useRouter();
  const [store] = useState(() => createGenerationStore((slug) => router.push(`/guides/${slug}`)));
  const { status, events, final, startedAt, endedAt } = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  const [draft, setDraft] = useState<string | null>(null);
  const [now, setNow] = useState(0);
  const [formError, setFormError] = useState<string | null>(null);
  const input = draft ?? app;
  const run = (target: string, force = false) => store.start(target, force);
  const fromUrl = app ? validateAppInput(app) : null;
  const urlError = fromUrl && !fromUrl.ok ? fromUrl.error : null;
  const target = fromUrl?.ok ? fromUrl.value : "";

  useEffect(() => {
    if (!target) return;
    store.start(target);
    return () => store.abort();
  }, [target, store]);

  useEffect(() => {
    if (status !== "running") return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [status]);

  const elapsed = startedAt ? Math.max(0, Math.floor(((endedAt ?? (now || startedAt)) - startedAt) / 1000)) : 0;
  const { states, notes } = pipelineState(events, status, final);
  const statusLabel = status === "running" ? "Running" : status === "done" ? "Done" : status === "unsupported" ? "No guide" : status === "error" ? "Stopped" : "Idle";

  return (
    <>
      <section className="bg-ink text-white">
        <div className="mx-auto w-full max-w-[1240px] px-4 pt-8 pb-12 sm:px-6 sm:pt-10 sm:pb-16">
          <Link href="/" className="inline-flex items-center gap-1.5 font-mono text-[12px] text-white/40 uppercase hover:text-white">
            <ArrowLeft aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
            Library
          </Link>
          <h1 className="mt-6 text-[36px] leading-[1.15] tracking-[-0.025em] sm:text-[56px]">
            {target ? (
              <>
                Researching <span className="hl">{target}</span>
              </>
            ) : (
              "Generate a guide"
            )}
          </h1>
          <p className="mt-4 max-w-2xl text-[17px] leading-relaxed text-white/60">
            An agent reads the official docs and probes the live endpoints. The server drops any citation the agent didn&apos;t open, then saves a shareable guide.
          </p>

          <form
            className="mt-8 flex max-w-2xl border border-line-dark bg-raised"
            onSubmit={(e) => {
              e.preventDefault();
              const checked = validateAppInput(input);
              if (!checked.ok) {
                setFormError(checked.error);
                return;
              }
              setFormError(null);
              setDraft(null);
              if (checked.value === target) run(checked.value);
              else router.push(`/generate?app=${encodeURIComponent(checked.value)}`);
            }}
          >
            <input
              value={input}
              onChange={(e) => {
                setDraft(e.target.value);
                setFormError(null);
              }}
              maxLength={APP_INPUT_MAX}
              aria-invalid={Boolean(formError ?? (draft === null ? urlError : null))}
              placeholder="App name or website, e.g. Notion"
              aria-label="App name or website"
              className="h-12 min-w-0 flex-1 bg-transparent px-4 text-[16px] text-white outline-none placeholder:text-white/30"
            />
            <button type="submit" disabled={status === "running"} className="btn btn-light m-1">
              Generate
            </button>
          </form>
          {(formError ?? (draft === null ? urlError : null)) && (
            <p role="alert" className="mt-3 font-mono text-[12px] text-[#f87171] uppercase">
              {formError ?? urlError}
            </p>
          )}

          <div className="mt-12">
            <div className="mb-4 flex items-center justify-between font-mono text-[12px] uppercase">
              <span className="flex items-center gap-2 text-white/50">
                {status === "running" && <span className="h-2 w-2 bg-lime anim-pulse" />}
                Pipeline · {statusLabel}
              </span>
              <span className="text-white/40 tabular-nums">
                {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}
              </span>
            </div>
            <Pipeline states={states} notes={notes} />
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1240px] px-4 py-10 sm:px-6 sm:py-14">
        {final?.type === "done" && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border border-ok bg-white px-4 py-4">
            <p className="text-[15px] text-ink">
              {final.source === "library" ? "Already in the library, researched by hand." : final.source === "cache" ? "A recent generated guide exists." : "Guide saved."}
            </p>
            <span className="flex gap-2">
              {final.source === "cache" && (
                <button type="button" onClick={() => run(app, true)} className="btn btn-line">Regenerate</button>
              )}
              <Link href={`/guides/${final.slug}`} className="btn btn-dark">
                Open guide
                <ArrowRight aria-hidden className="h-4 w-4" strokeWidth={1.75} />
              </Link>
            </span>
          </div>
        )}

        {final?.type === "unsupported" && (
          <div className="mb-6 border border-warn bg-sand p-5">
            <p className="label text-warn">No guide</p>
            <p className="mt-2 text-[20px] tracking-[-0.01em] text-ink">{reasonTitle[final.reason] ?? "We couldn't build a guide"}</p>
            <p className="mt-2 max-w-3xl text-[15px] leading-relaxed text-ink/75">{final.message}</p>
            {final.suggestions.length > 0 && (
              <ul className="mt-4 flex flex-wrap gap-2">
                {final.suggestions.map((s) =>
                  final.reason === "ambiguous" ? (
                    <li key={s}>
                      <button type="button" onClick={() => router.push(`/generate?app=${encodeURIComponent(s)}`)} className="btn btn-sm btn-line bg-white normal-case">
                        {s}
                        <ArrowRight aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                      </button>
                    </li>
                  ) : (
                    <li key={s} className="border-l-2 border-warn pl-3 text-[14px] text-ink/80">{s}</li>
                  ),
                )}
              </ul>
            )}
          </div>
        )}

        {final?.type === "error" && final.code === "rate_limited" && (
          <div className="mb-6 border border-warn bg-sand p-5">
            <p className="label text-warn">Limit reached</p>
            <p className="mt-2 text-[20px] tracking-[-0.01em] text-ink">That&apos;s {RUNS_PER_HOUR} guide runs this hour</p>
            <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-ink/75">
              Each run reads docs and probes live endpoints, so runs are capped per visitor. You can start another in about{" "}
              {Math.max(1, Math.ceil((final.retryAfter ?? 3600) / 60))} min. The library and any guide already generated still work.
            </p>
            <Link href="/" className="btn btn-dark mt-4">Browse the library</Link>
          </div>
        )}

        {final?.type === "error" && final.code !== "rate_limited" && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border border-bad bg-white px-4 py-4">
            <p className="text-[15px] text-ink">{final.message}</p>
            {target && final.code !== "invalid_input" && (
              <button type="button" onClick={() => run(target)} className="btn btn-dark">Try again</button>
            )}
          </div>
        )}

        <div className="bg-ink">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line-dark px-4 py-2.5 font-mono text-[12px] uppercase">
            <span className="text-white/40">Agent log</span>
            <span className="text-white/30">{events.length} events</span>
          </div>
          <ol className="max-h-[32rem] overflow-y-auto px-4 py-3">
            {events.map((e, i) => (
              <EventRow key={i} event={e} />
            ))}
            {status === "running" && events.length < 2 && <li className="py-1 font-mono text-[12.5px] text-white/40">Starting. Runs take two to four minutes.</li>}
            {status === "idle" && <li className="py-1 font-mono text-[12.5px] text-white/30">$ waiting for an app name</li>}
            {(status === "error" || status === "unsupported") && events.length === 0 && <li className="py-1 font-mono text-[12.5px] text-white/30">$ no events before the run stopped</li>}
          </ol>
        </div>
      </section>
    </>
  );
}
