"use client";

import { usePathname } from "next/navigation";
import { MissingGuide } from "./missing-guide";

export function MissingGuideFromPath() {
  const pathname = usePathname() ?? "";
  const last = pathname.split("/").filter(Boolean).pop() ?? "";
  let slug = last;
  try {
    slug = decodeURIComponent(last);
  } catch {}
  return <MissingGuide slug={slug || "this app"} />;
}
