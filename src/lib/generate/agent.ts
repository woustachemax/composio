import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { Guide, Probe } from "@/lib/guide-schema";
import { probeAuthorize, probeConsole, probeDiscovery } from "@/lib/probes";
import type { GenerationEvent } from "./events";
import { finalizeSubmission, normalizeUrl, SubmissionSchema } from "./finalize";
import { SYSTEM_PROMPT, userPrompt } from "./prompt";
import { cleanText } from "@/lib/text";

export const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";
const EFFORT = (process.env.ANTHROPIC_EFFORT as "low" | "medium" | "high" | undefined) || "medium";
const MAX_TURNS = 24;
const MAX_SUBMITS = 3;
const SOFT_DEADLINE_MS = 200_000;
const BETAS: Anthropic.Beta.AnthropicBeta[] = ["server-side-fallback-2026-07-01", "thinking-display-updates-2026-08-18"];

export type GenerationResult =
  | { kind: "guide"; guide: Guide }
  | { kind: "unsupported"; reason: string; message: string; suggestions: string[] }
  | { kind: "error"; message: string };

const ProbeDiscoveryInput = z.object({ issuer_or_url: z.string().min(4).max(500) });
const ProbeAuthorizeInput = z.object({
  authorize_url: z.string().min(8).max(1000),
  extra_params: z.record(z.string(), z.string()).optional(),
});
const ProbeConsoleInput = z.object({ console_url: z.string().min(8).max(1000) });
const CannotGenerateInput = z.object({
  reason: z.enum(["not_found", "ambiguous", "no_oauth", "no_public_docs"]),
  message: z.string().min(1).max(1500),
  suggestions: z.array(z.string().max(300)).max(8).default([]),
});

const submissionJsonSchema = z.toJSONSchema(SubmissionSchema, {
  io: "input",
  unrepresentable: "any",
}) as Anthropic.Beta.BetaTool.InputSchema;

const tools: Anthropic.Beta.BetaToolUnion[] = [
  { type: "web_search_20260209", name: "web_search", max_uses: 8 },
  { type: "web_fetch_20260209", name: "web_fetch", max_uses: 16, max_content_tokens: 12000 },
  {
    name: "probe_discovery",
    description:
      "Unauthenticated GET of /.well-known/openid-configuration and /.well-known/oauth-authorization-server for a provider's auth host. Returns the endpoints and PKCE methods if a document is published. Returns a probe id to cite as tested evidence.",
    input_schema: {
      type: "object",
      properties: {
        issuer_or_url: { type: "string", description: "Issuer or auth host, for example https://accounts.google.com" },
      },
      required: ["issuer_or_url"],
    },
  },
  {
    name: "probe_authorize_endpoint",
    description:
      "Unauthenticated GET of an OAuth authorize URL with a placeholder client_id and Composio's redirect_uri, without following redirects. Shows whether the endpoint is live and how it treats an unknown client. Returns a probe id.",
    input_schema: {
      type: "object",
      properties: {
        authorize_url: { type: "string", description: "Documented authorize endpoint URL" },
        extra_params: {
          type: "object",
          additionalProperties: { type: "string" },
          description: "Optional extra query parameters the provider requires, such as scope",
        },
      },
      required: ["authorize_url"],
    },
  },
  {
    name: "probe_developer_console",
    description:
      "Unauthenticated GET of a developer console URL, compared with a made-up path on the same host, to check whether the deep link is a real route. Returns a probe id.",
    input_schema: {
      type: "object",
      properties: { console_url: { type: "string" } },
      required: ["console_url"],
    },
  },
  {
    name: "submit_guide",
    description:
      "Submit the finished guide. The server assigns the slug, dates, and probe records, checks every citation against the pages you actually fetched, and validates the schema. Returns validation issues to fix, or confirms the guide was saved.",
    input_schema: submissionJsonSchema,
    eager_input_streaming: true,
  },
  {
    name: "report_cannot_generate",
    description:
      "Stop without a guide when the app does not exist, is ambiguous, has no OAuth for third-party developers, or has no public docs to support a guide.",
    input_schema: {
      type: "object",
      properties: {
        reason: { type: "string", enum: ["not_found", "ambiguous", "no_oauth", "no_public_docs"] },
        message: { type: "string", description: "Two or three sentences for the developer explaining what you found." },
        suggestions: {
          type: "array",
          items: { type: "string" },
          description: "Concrete next steps, or alternative product names if ambiguous.",
        },
      },
      required: ["reason", "message", "suggestions"],
    },
  },
];

function today() {
  return new Date().toISOString().slice(0, 10);
}

function toolResult(id: string, content: unknown, isError = false): Anthropic.Beta.BetaToolResultBlockParam {
  return {
    type: "tool_result",
    tool_use_id: id,
    content: typeof content === "string" ? content : JSON.stringify(content),
    ...(isError ? { is_error: true } : {}),
  };
}

function apiErrorMessage(err: unknown): string {
  if (err instanceof Anthropic.AuthenticationError) return "The Anthropic API key was rejected. Check ANTHROPIC_API_KEY.";
  if (err instanceof Anthropic.RateLimitError) return "The research model is rate limited right now. Try again in a minute.";
  if (err instanceof Anthropic.APIError) return `The research model returned an error (${err.status ?? "network"}). Try again.`;
  return "The research run failed while streaming. Try again.";
}

export async function runGeneration(
  input: string,
  emit: (e: GenerationEvent) => void,
  signal?: AbortSignal,
): Promise<GenerationResult> {
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN)
    return {
      kind: "error",
      message: "Live generation is not configured on this server. Set ANTHROPIC_API_KEY in .env.local and restart.",
    };

  const client = new Anthropic({ maxRetries: 2 });
  const started = Date.now();
  const probes: Probe[] = [];
  const fetchedUrls = new Set<string>();
  const searchTitles = new Map<string, string>();
  let probeCount = 0;
  let submits = 0;
  let nudged = false;
  let jsonRetries = 0;

  emit({ type: "started", app: input, model: MODEL });

  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: userPrompt(input, today()) }];

  const recordProbe = (p: Probe) => {
    probes.push(p);
    emit({ type: "probe", probe: p });
    return { probe_id: p.id, outcome: p.outcome, observed: p.observed };
  };

  const nextProbeId = (kind: string) => `probe-${kind}-${++probeCount}`;

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    if (signal?.aborted) return { kind: "error", message: "Generation was cancelled." };

    const stream = client.beta.messages.stream(
      {
        model: MODEL,
        max_tokens: 64000,
        betas: BETAS,
        fallbacks: "default",
        thinking: { type: "adaptive", display: "updates" },
        output_config: { effort: EFFORT },
        system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
        tools,
        messages,
      },
      { signal },
    );

    stream.on("contentBlock", (block) => {
      if (block.type === "thinking" && block.thinking.trim()) emit({ type: "note", text: cleanText(block.thinking.trim().slice(0, 400)) });
      if (block.type === "text" && block.text.trim()) emit({ type: "note", text: cleanText(block.text.trim().slice(0, 400)) });
      if (block.type === "server_tool_use") {
        const inputObj = (block.input ?? {}) as Record<string, unknown>;
        if (block.name === "web_search" && typeof inputObj.query === "string") emit({ type: "search", query: inputObj.query });
        if (block.name === "web_fetch" && typeof inputObj.url === "string") emit({ type: "fetch", url: inputObj.url });
      }
      if (block.type === "web_search_tool_result" && Array.isArray(block.content)) {
        for (const r of block.content) if (r.type === "web_search_result") searchTitles.set(normalizeUrl(r.url), r.title);
      }
      if (block.type === "web_fetch_tool_result") {
        if (block.content.type === "web_fetch_result") {
          const url = block.content.url;
          fetchedUrls.add(normalizeUrl(url));
          emit({
            type: "fetched",
            url,
            ok: true,
            title: block.content.content.title ?? searchTitles.get(normalizeUrl(url)),
          });
        } else {
          emit({ type: "fetched", url: "", ok: false });
        }
      }
    });

    let message: Anthropic.Beta.BetaMessage;
    try {
      message = await stream.finalMessage();
      jsonRetries = 0;
    } catch (err) {
      if (signal?.aborted) return { kind: "error", message: "Generation was cancelled." };
      if (!(err instanceof Anthropic.APIError) && jsonRetries++ < 2) continue;
      return { kind: "error", message: apiErrorMessage(err) };
    }

    if (message.stop_reason === "refusal") return { kind: "error", message: "The research model declined this request." };

    if (message.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: message.content });
      continue;
    }

    const toolUses = message.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");

    if (message.stop_reason === "max_tokens") {
      messages.push({ role: "assistant", content: message.content.filter((b) => b.type !== "tool_use") });
      messages.push({
        role: "user",
        content: "Your last output was cut off by the token limit. Call submit_guide again with a more concise guide.",
      });
      continue;
    }

    messages.push({ role: "assistant", content: message.content });

    if (toolUses.length === 0) {
      messages.push({ role: "user", content: "Continue. Finish by calling submit_guide or report_cannot_generate." });
      continue;
    }

    const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
    let finished: GenerationResult | null = null;

    await Promise.all(
      toolUses.map(async (tu) => {
        if (tu.name === "probe_discovery") {
          const parsed = ProbeDiscoveryInput.safeParse(tu.input);
          if (!parsed.success) return results.push(toolResult(tu.id, "Invalid input: issuer_or_url is required.", true));
          const out = await probeDiscovery(nextProbeId("discovery"), parsed.data.issuer_or_url);
          return results.push(toolResult(tu.id, { ...recordProbe(out.probe), data: out.data }));
        }
        if (tu.name === "probe_authorize_endpoint") {
          const parsed = ProbeAuthorizeInput.safeParse(tu.input);
          if (!parsed.success) return results.push(toolResult(tu.id, "Invalid input: authorize_url is required.", true));
          const out = await probeAuthorize(nextProbeId("authorize"), parsed.data.authorize_url, parsed.data.extra_params);
          return results.push(toolResult(tu.id, { ...recordProbe(out.probe), data: out.data }));
        }
        if (tu.name === "probe_developer_console") {
          const parsed = ProbeConsoleInput.safeParse(tu.input);
          if (!parsed.success) return results.push(toolResult(tu.id, "Invalid input: console_url is required.", true));
          const out = await probeConsole(nextProbeId("console"), parsed.data.console_url);
          return results.push(toolResult(tu.id, { ...recordProbe(out.probe), data: out.data }));
        }
        if (tu.name === "report_cannot_generate") {
          const parsed = CannotGenerateInput.safeParse(tu.input);
          if (!parsed.success) return results.push(toolResult(tu.id, "Invalid input: reason and message are required.", true));
          finished = { kind: "unsupported", reason: parsed.data.reason, message: cleanText(parsed.data.message), suggestions: parsed.data.suggestions.map((x) => cleanText(x)) };
          return results.push(toolResult(tu.id, "Recorded."));
        }
        if (tu.name === "submit_guide") {
          submits++;
          emit({ type: "submit", attempt: submits });
          const outcome = finalizeSubmission({ submission: tu.input, probes, fetchedUrls, today: today() });
          if (!outcome.ok) {
            emit({ type: "invalid", issues: outcome.issues });
            if (submits >= MAX_SUBMITS)
              finished = {
                kind: "error",
                message: "The agent could not produce a guide that passes validation. Try again, or try the provider's exact product name.",
              };
            return results.push(
              toolResult(tu.id, { saved: false, issues: outcome.issues, attemptsLeft: MAX_SUBMITS - submits }, true),
            );
          }
          for (const c of outcome.checks) emit({ type: "check", message: c });
          finished = { kind: "guide", guide: outcome.guide };
          return results.push(toolResult(tu.id, { saved: true }));
        }
        return results.push(toolResult(tu.id, `Unknown tool ${tu.name}`, true));
      }),
    );

    if (finished) return finished;

    const content: Anthropic.Beta.BetaContentBlockParam[] = [...results];
    if (!nudged && Date.now() - started > SOFT_DEADLINE_MS) {
      nudged = true;
      content.push({
        type: "text",
        text: "Time is almost up. Stop researching and call submit_guide now with what you have. Mark anything unverified as uncertain.",
      });
    }
    messages.push({ role: "user", content });
  }

  return { kind: "error", message: "The research run hit its step limit before finishing. Try again." };
}
