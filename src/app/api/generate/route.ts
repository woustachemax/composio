import { runGeneration } from "@/lib/generate/agent";
import type { GenerationEvent } from "@/lib/generate/events";
import { getLibraryGuide, listLibraryGuides } from "@/lib/library";
import { slugFromInput } from "@/lib/slug";
import { getGeneratedGuide, saveGeneratedGuide } from "@/lib/store";
import { validateAppInput } from "@/lib/app-input";
import { clientIp, RUNS_PER_HOUR, takeRun } from "@/lib/rate-limit";

export const maxDuration = 300;

const CACHE_DAYS = 7;
const inFlight = new Set<string>();

function findLibraryMatch(input: string) {
  const slug = slugFromInput(input);
  const direct = getLibraryGuide(slug);
  if (direct) return direct;
  const lower = input.toLowerCase();
  return listLibraryGuides().find((g) => {
    if (g.app.name.toLowerCase() === lower) return true;
    try {
      const host = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`).hostname.replace(/^www\./, "");
      return new URL(g.app.website).hostname.replace(/^www\./, "") === host;
    } catch {
      return false;
    }
  });
}

function isFresh(lastVerified: string) {
  const age = Date.now() - new Date(`${lastVerified}T00:00:00Z`).getTime();
  return age < CACHE_DAYS * 24 * 60 * 60 * 1000;
}

export async function POST(request: Request) {
  let body: { app?: unknown; force?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Send JSON with an app field." }, { status: 400 });
  }
  const checked = validateAppInput(body.app);
  if (!checked.ok) return Response.json({ error: checked.error, code: "invalid_input" }, { status: 400 });
  const input = checked.value;
  const force = body.force === true;

  const library = findLibraryMatch(input);
  const inputSlug = slugFromInput(input);
  const cached = !library && !force && inputSlug ? await getGeneratedGuide(inputSlug).catch(() => null) : null;
  const cacheHit = cached && isFresh(cached.meta.lastVerified) ? cached : null;
  const configured = Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
  if (!library && !cacheHit && configured && !inFlight.has(inputSlug)) {
    const limit = takeRun(clientIp(request));
    if (!limit.ok)
      return Response.json(
        {
          error: `You've used all ${RUNS_PER_HOUR} guide runs for this hour. Try again in ${Math.ceil(limit.retryAfter / 60)} min.`,
          code: "rate_limited",
          retryAfter: limit.retryAfter,
        },
        { status: 429, headers: { "retry-after": String(limit.retryAfter) } },
      );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const send = (event: GenerationEvent) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          closed = true;
        }
      };
      const finish = () => {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {}
      };

      if (library) {
        send({ type: "done", slug: library.slug, source: "library" });
        return finish();
      }
      if (cacheHit) {
        send({ type: "done", slug: cacheHit.slug, source: "cache" });
        return finish();
      }

      if (inFlight.has(inputSlug)) {
        send({ type: "error", message: "A guide for this app is already being generated. Wait a minute and try again." });
        return finish();
      }
      inFlight.add(inputSlug);

      const heartbeat = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`: keep-alive\n\n`));
        } catch {
          closed = true;
        }
      }, 15000);

      try {
        const result = await runGeneration(input, send, request.signal);
        if (result.kind === "guide") {
          const guide = result.guide;
          if (getLibraryGuide(guide.slug)) {
            send({ type: "done", slug: guide.slug, source: "library" });
          } else {
            try {
              await saveGeneratedGuide(guide);
              send({ type: "done", slug: guide.slug, source: "generated" });
            } catch (err) {
              console.error("saving generated guide failed", err);
              send({ type: "error", message: "The guide was generated but could not be saved. Check the storage configuration (BLOB_READ_WRITE_TOKEN on Vercel)." });
            }
          }
        } else if (result.kind === "unsupported") {
          send({ type: "unsupported", reason: result.reason, message: result.message, suggestions: result.suggestions });
        } else {
          send({ type: "error", message: result.message });
        }
      } catch (err) {
        console.error("generation failed", err);
        send({ type: "error", message: "Something went wrong while generating the guide. Try again." });
      } finally {
        clearInterval(heartbeat);
        inFlight.delete(inputSlug);
        finish();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}
