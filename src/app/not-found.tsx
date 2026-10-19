import Link from "next/link";

export const metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <section className="flex-1 bg-ink text-white">
      <div className="mx-auto w-full max-w-[1240px] px-4 py-24 sm:px-6">
        <p className="label text-white/40">404</p>
        <h1 className="mt-3 max-w-2xl text-[34px] leading-[1.15] tracking-[-0.025em] sm:text-[48px]">
          This page <span className="hl">doesn&apos;t exist</span>
        </h1>
        <p className="mt-4 text-[16px] text-white/60">Check the link, or start from the library.</p>
        <div className="mt-8 flex flex-wrap gap-2">
          <Link href="/" className="btn btn-light">Library</Link>
          <Link href="/generate" className="btn btn-line-dark">Generate a guide</Link>
        </div>
      </div>
    </section>
  );
}
