import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { LibrarySearch } from "@/components/home/library-search";
import { GuideRow, GuideRowHeader } from "@/components/home/guide-row";
import { OAuthDiagram } from "@/components/home/oauth-diagram";
import { AppLogo } from "@/components/app-logo";
import { EvidenceLegend } from "@/components/evidence";
import { SectionHead } from "@/components/ui";
import { listLibraryGuides } from "@/lib/library";
import { listGeneratedGuides } from "@/lib/store";
import { toCard } from "@/lib/guide-view";
import { logoFor } from "@/lib/logo";
import type { Guide } from "@/lib/guide-schema";

async function withLogos(guides: Guide[]) {
  return Promise.all(guides.map(async (g) => toCard(g, await logoFor({ slug: g.slug, name: g.app.name, website: g.app.website }))));
}

export default async function Home() {
  const cards = await withLogos(listLibraryGuides());
  return (
    <>
      <section className="bg-ink text-white">
        <div className="mx-auto w-full max-w-[1240px] px-4 pt-12 pb-16 sm:px-6 sm:pt-20 sm:pb-24">
          <div className="flex flex-col items-start gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center border border-line-dark">
                <span className="label px-3 py-2 text-white/50">Guides for</span>
                <span className="flex items-center gap-1.5 border-l border-line-dark px-3 py-1.5">
                  {cards.map((c) => (
                    <Link key={c.slug} href={`/guides/${c.slug}`} title={c.name}>
                      <AppLogo src={c.logo} name={c.name} size={22} className="border-transparent" />
                    </Link>
                  ))}
                  <span className="ml-1 font-mono text-[12px] text-white/40">+ any app</span>
                </span>
              </div>
              <h1 className="mt-8 text-[40px] leading-[1.15] tracking-[-0.025em] sm:text-[64px]">
                How long until your users can <span className="whitespace-nowrap"><span className="hl mr-[-0.06em]">connect</span>?</span>
              </h1>
              <p className="mt-6 max-w-2xl text-[18px] leading-relaxed text-white/60">
                Hands-on time, approval wait and blockers for each provider&apos;s OAuth app. Every claim is tested, documented or flagged.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <a href="#library" className="btn btn-light">Browse guides</a>
              <Link href="/generate" className="btn btn-line-dark">Generate a guide</Link>
            </div>
          </div>

          <div className="mt-16 border-t border-line-dark pt-10 sm:mt-20">
            <div className="flex items-center gap-3">
              <span className="num border border-line-dark text-white/70">00</span>
              <span className="label text-white/50">How OAuth fits together</span>
            </div>
            <p className="mt-3 max-w-2xl text-[22px] leading-snug tracking-[-0.02em] sm:text-[28px]">
              Every connection runs through an <span className="text-brand-light">OAuth app</span>. The question is whose.
            </p>
            <div className="mt-8">
              <OAuthDiagram />
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1240px] px-4 py-16 sm:px-6 sm:py-24">
        <SectionHead n="01" id="library" label="Library" title="Pick a provider" aside={<EvidenceLegend />} />
        <div className="mt-8">
          <LibrarySearch cards={cards} />
        </div>
        <Suspense fallback={null}>
          <RecentlyGenerated />
        </Suspense>
      </section>
    </>
  );
}

async function RecentlyGenerated() {
  await connection();
  const library = new Set(listLibraryGuides().map((g) => g.slug));
  const generated = (await listGeneratedGuides()).filter((g) => !library.has(g.slug)).slice(0, 9);
  if (generated.length === 0) return null;
  const cards = await withLogos(generated);
  const maxWeeks = Math.max(0, ...cards.map((c) => c.waitWeeks));
  return (
    <div className="mt-20">
      <SectionHead n="02" label="Agent-generated" title="Researched live" />
      <p className="mt-3 text-[15px] text-ink/60">From public docs and live probes. Not reviewed by a person.</p>
      <div className="mt-6 border border-line bg-white">
        <GuideRowHeader />
        {cards.map((c) => (
          <GuideRow key={c.slug} card={c} maxWeeks={maxWeeks} />
        ))}
      </div>
    </div>
  );
}
