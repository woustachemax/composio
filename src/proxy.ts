import { NextResponse, type NextRequest } from "next/server";
import { libraryGuideData } from "@/content/guides";
import { generatedGuideExists } from "@/lib/store";

const librarySlugs = new Set(libraryGuideData.map((g) => (g as { slug: string }).slug));

export async function proxy(request: NextRequest) {
  const raw = request.nextUrl.pathname.split("/")[2] ?? "";
  let slug = raw;
  try {
    slug = decodeURIComponent(raw);
  } catch {}
  const lower = slug.toLowerCase();
  if (slug !== lower) {
    const url = request.nextUrl.clone();
    url.pathname = `/guides/${encodeURIComponent(lower)}`;
    return NextResponse.redirect(url, 308);
  }
  if (librarySlugs.has(slug) || (await generatedGuideExists(slug))) return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = `/guide-missing/${encodeURIComponent(slug)}`;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: "/guides/:slug",
};
