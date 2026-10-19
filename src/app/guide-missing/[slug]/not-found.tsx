import { Suspense } from "react";
import { MissingGuideFromPath } from "@/components/guide/missing-guide-from-path";

export const metadata = { title: "No guide yet" };

export default function NotFound() {
  return (
    <Suspense fallback={<section className="flex-1 bg-ink" />}>
      <MissingGuideFromPath />
    </Suspense>
  );
}
