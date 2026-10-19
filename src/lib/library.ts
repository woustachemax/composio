import { libraryGuideData } from "@/content/guides";
import { GuideSchema, type Guide } from "./guide-schema";

const guides: Guide[] = libraryGuideData
  .map((raw) => GuideSchema.parse(raw))
  .sort((a, b) => a.app.name.localeCompare(b.app.name));

export function listLibraryGuides(): Guide[] {
  return guides;
}

export function getLibraryGuide(slug: string): Guide | undefined {
  return guides.find((g) => g.slug === slug);
}
