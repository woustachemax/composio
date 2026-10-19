import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { GuideSchema } from "../src/lib/guide-schema";
import { FORBIDDEN_PUNCTUATION } from "../src/lib/text";

function punctuationIssues(value: unknown, path: string[] = []): string[] {
  if (typeof value === "string") {
    const m = value.match(FORBIDDEN_PUNCTUATION);
    if (!m || m.index === undefined) return [];
    const at = value.slice(Math.max(0, m.index - 30), m.index + 30);
    return [`${path.join(".")}: "${m[0]}" in "…${at}…"`];
  }
  if (Array.isArray(value)) return value.flatMap((v, i) => punctuationIssues(v, [...path, String(i)]));
  if (value && typeof value === "object") return Object.entries(value).flatMap(([k, v]) => punctuationIssues(v, [...path, k]));
  return [];
}

const dir = join(process.cwd(), "src/content/guides");
let failed = false;
for (const file of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
  const raw = JSON.parse(readFileSync(join(dir, file), "utf8"));
  const result = GuideSchema.safeParse(raw);
  const punctuation = punctuationIssues(raw);
  if (result.success && punctuation.length === 0) {
    console.log(`ok   ${file}`);
    continue;
  }
  failed = true;
  console.error(`fail ${file}`);
  if (!result.success) console.error(z.prettifyError(result.error));
  for (const issue of punctuation) console.error(`  em dash, en dash or text arrow at ${issue}`);
}
process.exit(failed ? 1 : 0);
