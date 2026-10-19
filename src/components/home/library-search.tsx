"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { GuideCard } from "@/lib/guide-view";
import { GuideRow, GuideRowHeader } from "./guide-row";
import { APP_INPUT_MAX, validateAppInput } from "@/lib/app-input";

const difficulties = ["all", "easy", "moderate", "hard"] as const;

export function LibrarySearch({ cards }: { cards: GuideCard[] }) {
  const [query, setQuery] = useState("");
  const [difficulty, setDifficulty] = useState<(typeof difficulties)[number]>("all");
  const router = useRouter();
  const maxWeeks = Math.max(0, ...cards.map((c) => c.waitWeeks));

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return cards.filter((c) => {
      if (difficulty !== "all" && c.difficulty !== difficulty) return false;
      if (!q) return true;
      return [c.name, c.category, c.website, ...c.flags].some((v) => v.toLowerCase().includes(q));
    });
  }, [cards, query, difficulty]);

  const trimmed = query.trim();
  const exact = cards.find((c) => c.name.toLowerCase() === trimmed.toLowerCase());
  const [error, setError] = useState<string | null>(null);
  const generate = () => {
    const checked = validateAppInput(query);
    if (!checked.ok) return setError(checked.error);
    router.push(`/generate?app=${encodeURIComponent(checked.value)}`);
  };

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (exact) router.push(`/guides/${exact.slug}`);
          else if (trimmed) generate();
        }}
        className="flex border border-ink bg-white"
      >
        <span className="hidden items-center pl-4 font-mono text-[13px] text-ink/40 sm:flex">$</span>
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setError(null);
          }}
          maxLength={APP_INPUT_MAX}
          aria-invalid={Boolean(error)}
          placeholder="Search, or type any app name"
          aria-label="Search apps"
          className="h-12 min-w-0 flex-1 bg-transparent px-3 text-[16px] outline-none placeholder:text-ink/35"
        />
        <button type="submit" disabled={!trimmed} className="btn btn-dark m-1 disabled:bg-ink/30">
          {exact ? "Open" : "Generate"}
        </button>
      </form>
      {error && (
        <p role="alert" className="mt-2 font-mono text-[12px] text-bad uppercase">
          {error}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="inline-flex border border-line bg-white">
          {difficulties.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDifficulty(d)}
              aria-pressed={difficulty === d}
              className={`border-r border-line px-3 py-1.5 font-mono text-[12px] uppercase last:border-r-0 ${difficulty === d ? "bg-ink text-white" : "text-ink/60 hover:text-ink"}`}
            >
              {d}
            </button>
          ))}
        </div>
        <span className="ml-auto font-mono text-[12px] text-ink/40 uppercase">
          {results.length} of {cards.length}
        </span>
      </div>

      <div className="mt-4 border border-line bg-white">
        <GuideRowHeader />
        {results.map((c) => (
          <GuideRow key={c.slug} card={c} maxWeeks={maxWeeks} />
        ))}
        {results.length === 0 && <p className="px-4 py-6 text-[14px] text-ink/50">No guide matches.</p>}
      </div>

      {trimmed && !exact && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border border-dashed border-ink/30 px-4 py-4">
          <p className="text-[15px] text-ink">
            {results.length === 0 ? "Not in the library yet." : `Looking for something else?`}{" "}
            <span className="text-ink/50">An agent can research “{trimmed}” in a few minutes.</span>
          </p>
          <button type="button" onClick={generate} className="btn btn-dark">
            Generate “{trimmed}”
          </button>
        </div>
      )}
    </div>
  );
}
