import Link from "next/link";

export function MissingGuide({ slug }: { slug: string }) {
  const name = slug.slice(0, 80);
  return (
    <section className="flex-1 bg-ink text-white">
      <div className="mx-auto w-full max-w-[1240px] px-4 py-24 sm:px-6">
        <p className="label text-white/40">No guide yet</p>
        <h1 className="mt-3 max-w-2xl text-[34px] leading-[1.15] tracking-[-0.025em] break-words sm:text-[48px]">
          Nothing on <span className="hl">{name}</span> yet
        </h1>
        <p className="mt-4 text-[16px] text-white/60">An agent can research it now. It takes a few minutes.</p>
        <Link href={`/generate?app=${encodeURIComponent(name)}`} className="btn btn-light mt-8">
          Generate a guide
        </Link>
      </div>
    </section>
  );
}
