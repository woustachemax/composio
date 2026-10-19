import type { Metadata } from "next";
import { Suspense } from "react";
import { GenerateRunner } from "@/components/generate/generate-runner";

export const metadata: Metadata = { title: "Generate a guide" };

export default function GeneratePage() {
  return (
    <Suspense fallback={<div className="h-[520px] bg-ink" />}>
      <GenerateRunner />
    </Suspense>
  );
}
