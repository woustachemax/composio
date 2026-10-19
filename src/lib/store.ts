import { access, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { get, head, list, put } from "@vercel/blob";
import { GuideSchema, type Guide } from "./guide-schema";

const prefix = "generated-guides/";
const localDir = process.env.VERCEL ? "/tmp/generated-guides" : join(process.cwd(), ".data", "generated-guides");

function blobEnabled() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

export function storageMode(): "vercel-blob" | "local-files" | "ephemeral-tmp" {
  if (blobEnabled()) return "vercel-blob";
  return process.env.VERCEL ? "ephemeral-tmp" : "local-files";
}

function parse(raw: string): Guide | null {
  try {
    const result = GuideSchema.safeParse(JSON.parse(raw));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

export async function saveGeneratedGuide(guide: Guide): Promise<void> {
  const body = JSON.stringify(guide, null, 2);
  if (blobEnabled()) {
    await put(`${prefix}${guide.slug}.json`, body, {
      access: "private",
      contentType: "application/json",
      allowOverwrite: true,
      addRandomSuffix: false,
    });
    return;
  }
  await mkdir(localDir, { recursive: true });
  await writeFile(join(localDir, `${guide.slug}.json`), body, "utf8");
}

export async function getGeneratedGuide(slug: string): Promise<Guide | null> {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) return null;
  if (blobEnabled()) {
    const result = await get(`${prefix}${slug}.json`, { access: "private", useCache: false });
    if (!result) return null;
    return parse(await new Response(result.stream).text());
  }
  try {
    return parse(await readFile(join(localDir, `${slug}.json`), "utf8"));
  } catch {
    return null;
  }
}

export async function generatedGuideExists(slug: string): Promise<boolean> {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) return false;
  try {
    if (blobEnabled()) {
      await head(`${prefix}${slug}.json`);
      return true;
    }
    await access(join(localDir, `${slug}.json`));
    return true;
  } catch {
    return false;
  }
}

export async function listGeneratedGuides(): Promise<Guide[]> {
  const guides: Guide[] = [];
  if (blobEnabled()) {
    const { blobs } = await list({ prefix, limit: 100 });
    for (const b of blobs) {
      const slug = b.pathname.slice(prefix.length).replace(/\.json$/, "");
      const g = await getGeneratedGuide(slug);
      if (g) guides.push(g);
    }
  } else {
    try {
      for (const f of await readdir(localDir)) {
        if (!f.endsWith(".json")) continue;
        const g = parse(await readFile(join(localDir, f), "utf8"));
        if (g) guides.push(g);
      }
    } catch {
      return [];
    }
  }
  return guides.sort((a, b) => b.meta.lastVerified.localeCompare(a.meta.lastVerified) || a.app.name.localeCompare(b.app.name));
}
