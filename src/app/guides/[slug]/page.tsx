import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { GuideView } from "@/components/guide/guide-view";
import { MissingGuide } from "@/components/guide/missing-guide";
import { getLibraryGuide, listLibraryGuides } from "@/lib/library";
import { getGeneratedGuide } from "@/lib/store";
import { logoFor } from "@/lib/logo";
import { shortName } from "@/lib/guide-view";
import type { Guide } from "@/lib/guide-schema";

export function generateStaticParams() {
  return listLibraryGuides().map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }: PageProps<"/guides/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  let guide: Guide | null = getLibraryGuide(slug) ?? null;
  if (!guide) {
    await connection();
    guide = await getGeneratedGuide(slug).catch(() => null);
  }
  if (!guide) return { title: "No guide yet" };
  return {
    title: `${shortName(guide)} OAuth setup`,
    description: guide.summary.verdict,
  };
}

export default function Page({ params }: PageProps<"/guides/[slug]">) {
  return (
    <Suspense fallback={<GuideSkeleton />}>
      {params.then(({ slug }) => {
        const guide = getLibraryGuide(slug);
        if (guide) return <GuideWithLogo guide={guide} />;
        return (
          <Suspense fallback={<GuideSkeleton />}>
            <GeneratedGuide slug={slug} />
          </Suspense>
        );
      })}
    </Suspense>
  );
}

async function GeneratedGuide({ slug }: { slug: string }) {
  await connection();
  const guide = await getGeneratedGuide(slug);
  if (!guide) return <MissingGuide slug={slug} />;
  return <GuideWithLogo guide={guide} />;
}

async function GuideWithLogo({ guide }: { guide: Guide }) {
  const logo = await logoFor({ slug: guide.slug, name: guide.app.name, website: guide.app.website });
  return <GuideView guide={guide} logo={logo} />;
}

function GuideSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="bg-ink">
        <div className="mx-auto w-full max-w-[1240px] px-4 pt-10 pb-14 sm:px-6">
          <div className="h-3 w-32 bg-white/10" />
          <div className="mt-8 h-12 w-80 max-w-full bg-white/10" />
          <div className="mt-6 h-7 w-[32rem] max-w-full bg-white/10" />
        </div>
      </div>
      <div className="mx-auto w-full max-w-[1240px] px-4 sm:px-6">
        <div className="h-28 border border-t-0 border-line bg-white" />
      </div>
    </div>
  );
}
