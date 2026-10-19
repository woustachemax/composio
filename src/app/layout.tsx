import type { Metadata } from "next";
import Link from "next/link";
import { Geist, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "OAuth Guides", template: "%s · OAuth Guides" },
  description: "How long until your users can connect? Evidence-tagged OAuth app setup guides for agent builders on Composio.",
};

function Mark() {
  return (
    <svg viewBox="0 0 32 32" className="h-7 w-7" aria-hidden>
      <rect width="32" height="32" fill="#0f0f0f" />
      <rect x="7" y="7" width="7" height="18" fill="#ffffff" />
      <rect x="17" y="7" width="8" height="8" fill="#0007cd" />
      <rect x="17" y="17" width="8" height="8" fill="none" stroke="#ffffff" strokeOpacity="0.35" strokeWidth="1.5" />
    </svg>
  );
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" data-scroll-behavior="smooth" className={`${geistSans.variable} ${jetbrainsMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <header className="bg-ink text-white">
          <div className="mx-auto flex h-16 w-full max-w-[1240px] items-center justify-between gap-4 px-4 sm:px-6">
            <Link href="/" className="flex items-center gap-2.5 text-[17px] tracking-tight text-white">
              <Mark />
              <span>OAuth Guides</span>
            </Link>
            <nav className="flex items-center gap-0.5 font-mono text-[12px] uppercase sm:gap-6 sm:text-[13px]">
              <Link href="/" className="hidden px-2 py-1 text-white/70 hover:text-white sm:inline">Library</Link>
              <Link href="/verification" className="px-2 py-1 text-white/70 hover:text-white">Verification</Link>
              <Link href="/generate" className="btn btn-sm btn-light ml-1">Generate</Link>
            </nav>
          </div>
        </header>
        <main className="flex flex-1 flex-col">{children}</main>
        <footer className="border-t border-line-dark bg-ink text-white/50">
          <div className="mx-auto flex w-full max-w-[1240px] flex-wrap items-center justify-between gap-3 px-4 py-6 font-mono text-[12px] uppercase sm:px-6">
            <span>OAuth Guides</span>
            <span className="flex gap-5">
              <Link href="/" className="hover:text-white">Library</Link>
              <Link href="/generate" className="hover:text-white">Generate</Link>
              <Link href="/verification" className="hover:text-white">Verification</Link>
            </span>
          </div>
        </footer>
      </body>
    </html>
  );
}
