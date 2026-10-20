import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { Guide, Probe } from "@/lib/guide-schema";
import { composioProbeEnabled, probeAuthorize, probeComposioToolkit, probeConsole, probeDiscovery } from "@/lib/probes";
import type { GenerationEvent } from "./events";
import { finalizeSubmission, normalizeUrl, SubmissionSchema } from "./finalize";
import { SYSTEM_PROMPT, SYSTEM_PROMPT_WITH_COMPOSIO_PROBE, userPrompt } from "./prompt";
import { cleanText } from "@/lib/text";

export const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";
type Effort = "low" | "medium" | "high";
const EFFORT = (process.env.ANTHROPIC_EFFORT as Effort | undefined) || "medium";
const WRITE_EFFORT = (process.env.ANTHROPIC_WRITE_EFFORT as Effort | undefined) || "low";
const MAX_TURNS = 24;
const MAX_SUBMITS = 3;
const SOFT_DEADLINE_MS = 170_000;
export const RUN_DEADLINE_MS = 285_000;
const QUIET_MS = 5_000;
const BETAS: Anthropic.Beta.AnthropicBeta[] = [
  "server-side-fallback-2026-07-01",
  "thinking-display-updates-2026-08-18",
  "mid-conversation-output-config-2026-07-01",
];
const ENDPOINT_PROBES = new Set(["probe_discovery", "probe_authorize_endpoint", "probe_developer_console"]);

export type GenerationResult =
  | { kind: "guide"; guide: Guide }
  | { kind: "unsupported"; reason: string; message: string; suggestions: string[] }
  | { kind: "error"; message: string; code?: "timeout" };

const TIMEOUT_RESULT: GenerationResult = {
  kind: "error",
  code: "timeout",
  message: "This run took too long and was stopped before it could finish. Nothing was saved. Try again, or try the provider's exact product name.",
};

const ProbeDiscoveryInput = z.object({ issuer_or_url: z.string().min(4).max(500) });
const ProbeAuthorizeInput = z.object({
  authorize_url: z.string().min(8).max(1000),
  extra_params: z.record(z.string(), z.string()).optional(),
});
const ProbeConsoleInput = z.object({ console_url: z.string().min(8).max(1000) });
const ProbeComposioInput = z.object({ toolkit_slug: z.string().min(1).max(64) });

const GUIDE_SECTIONS: [string, string][] = [
  ["app", "app details"],
  ["summary", "summary"],
  ["composio", "Composio"],
  ["requirements", "requirements"],
  ["steps", "steps"],
  ["blockers", "blockers"],
  ["facts", "facts"],
  ["openQuestions", "open questions"],
  ["sources", "sources"],
  ["researchNotes", "research notes"],
];
const SECTION_PATTERNS = GUIDE_SECTIONS.map(([key, label]) => ({ label, pattern: new RegExp(`"${key}"\\s*:`, "g") }));

function sectionProgress(buffer: string) {
  let section: string | null = null;
  let latest = -1;
  let started = 0;
  for (const { label, pattern } of SECTION_PATTERNS) {
    let at = -1;
    pattern.lastIndex = 0;
    for (let m = pattern.exec(buffer); m; m = pattern.exec(buffer)) at = m.index;
    if (at < 0) continue;
    started++;
    if (at > latest) {
      latest = at;
      section = label;
    }
  }
  return { section, started };
}
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
    name: "probe_composio_toolkit",
    description:
      "Live check of Composio's toolkit API for one toolkit slug. Returns composio_managed_auth_schemes, which says whether Composio has a managed OAuth app for that toolkit. Returns a probe id to cite as tested evidence on the composio block.",
    input_schema: {
      type: "object",
      properties: {
        toolkit_slug: { type: "string", description: "Composio toolkit slug, for example github, gmail, slack, twitter" },
      },
      required: ["toolkit_slug"],
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

function echoableContent(content: Anthropic.Beta.BetaContentBlock[]): Anthropic.Beta.BetaContentBlock[] {
  const boundary = content.findLastIndex((b) => b.type === "fallback");
  if (boundary < 0) return content;
  const before = content.slice(0, boundary);
  const resultFor = new Set(before.flatMap((b) => ("tool_use_id" in b ? [b.tool_use_id] : [])));
  const kept = new Set<string>();
  let changed = true;
  while (changed) {
    changed = false;
    for (const b of before) {
      if (b.type !== "server_tool_use" || kept.has(b.id) || !resultFor.has(b.id)) continue;
      const parent = b.caller && "tool_id" in b.caller ? b.caller.tool_id : null;
      if (parent && !kept.has(parent)) continue;
      kept.add(b.id);
      changed = true;
    }
  }
  const echoed = before.filter((b) => {
    if (b.type === "text") return true;
    if (b.type === "server_tool_use") return kept.has(b.id);
    if ("tool_use_id" in b) return kept.has(b.tool_use_id);
    return false;
  });
  return [...echoed, ...content.slice(boundary + 1)];
}

function toolResult(id: string, content: unknown, isError = false): Anthropic.Beta.BetaToolResultBlockParam {
  return {
    type: "tool_result",
    tool_use_id: id,
    content: typeof content === "string" ? content : JSON.stringify(content),
    ...(isError ? { is_error: true } : {}),
  };
}

function logApiError(err: unknown, turn: number) {
  if (err instanceof Anthropic.APIError) {
    const body = (err.error ?? {}) as { error?: { type?: string; message?: string } };
    console.error(
      `[generate] Anthropic API error ${JSON.stringify({
        turn,
        status: err.status ?? null,
        type: body.error?.type ?? null,
        message: body.error?.message ?? null,
        requestId: err.requestID ?? null,
      })}`,
    );
    return;
  }
  console.error(
    `[generate] Research stream failed ${JSON.stringify({ turn, error: err instanceof Error ? err.message : String(err) })}`,
  );
}

function apiErrorMessage(err: unknown): string {
  if (err instanceof Anthropic.AuthenticationError) return "The Anthropic API key was rejected. Check ANTHROPIC_API_KEY.";
  if (err instanceof Anthropic.RateLimitError) return "The research model is rate limited right now. Try again in a minute.";
  if (err instanceof Anthropic.APIError) return `The research model returned an error (${err.status ?? "network"}). Try again.`;
  return "The research run failed while streaming. Try again.";
}

type RunUsage = {
  turns: number;
  inputTokens: number;
  outputTokens: number;
  cacheWriteTokens: number;
  cacheReadTokens: number;
  webSearches: number;
  webFetches: number;
  models: Set<string>;
  tokenCostUsd: number;
  unpricedTurns: number;
};

const PRICE_PER_MTOK: Record<string, { input: number; output: number; cacheWrite: number; cacheRead: number }> = {
  "claude-opus-5-5": { input: 4, output: 20, cacheWrite: 5, cacheRead: 0.2 },
  "claude-sonnet-5-5": { input: 2, output: 10, cacheWrite: 2.5, cacheRead: 0.2 },
};
const WEB_SEARCH_PRICE = 0.01;

function addUsage(total: RunUsage, message: Anthropic.Beta.BetaMessage) {
  const u = message.usage;
  total.turns++;
  total.inputTokens += u.input_tokens ?? 0;
  total.outputTokens += u.output_tokens ?? 0;
  total.cacheWriteTokens += u.cache_creation_input_tokens ?? 0;
  total.cacheReadTokens += u.cache_read_input_tokens ?? 0;
  total.webSearches += u.server_tool_use?.web_search_requests ?? 0;
  total.webFetches += u.server_tool_use?.web_fetch_requests ?? 0;
  total.models.add(message.model);
  const price = PRICE_PER_MTOK[message.model];
  if (!price) {
    total.unpricedTurns++;
    return;
  }
  total.tokenCostUsd +=
    ((u.input_tokens ?? 0) * price.input +
      (u.output_tokens ?? 0) * price.output +
      (u.cache_creation_input_tokens ?? 0) * price.cacheWrite +
      (u.cache_read_input_tokens ?? 0) * price.cacheRead) /
    1_000_000;
}

function estimateCost(u: RunUsage) {
  if (u.unpricedTurns > 0) return null;
  return Math.round((u.tokenCostUsd + u.webSearches * WEB_SEARCH_PRICE) * 10000) / 10000;
}

export async function runGeneration(
  input: string,
  emit: (e: GenerationEvent) => void,
  signal?: AbortSignal,
): Promise<GenerationResult> {
  const started = Date.now();
  const usage: RunUsage = {
    turns: 0,
    inputTokens: 0,
    outputTokens: 0,
    cacheWriteTokens: 0,
    cacheReadTokens: 0,
    webSearches: 0,
    webFetches: 0,
    models: new Set(),
    tokenCostUsd: 0,
    unpricedTurns: 0,
  };
  let outcome = "error";
  try {
    const result = await runGenerationLoop(input, emit, usage, signal);
    outcome = result.kind;
    return result;
  } finally {
    if (usage.turns > 0)
      console.info(
        `[generate] Run finished ${JSON.stringify({
          app: input,
          outcome,
          seconds: Math.round((Date.now() - started) / 100) / 10,
          turns: usage.turns,
          webSearches: usage.webSearches,
          webFetches: usage.webFetches,
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          cacheWriteTokens: usage.cacheWriteTokens,
          cacheReadTokens: usage.cacheReadTokens,
          models: [...usage.models],
          estimatedCostUsd: estimateCost(usage),
        })}`,
      );
  }
}

async function runGenerationLoop(
  input: string,
  emitEvent: (e: GenerationEvent) => void,
  usage: RunUsage,
  requestSignal?: AbortSignal,
): Promise<GenerationResult> {
  let lastEmitAt = Date.now();
  const emit = (e: GenerationEvent) => {
    lastEmitAt = Date.now();
    emitEvent(e);
  };
  const runAbort = new AbortController();
  let timedOut = false;
  const deadline = setTimeout(() => {
    timedOut = true;
    runAbort.abort();
  }, RUN_DEADLINE_MS);
  const onRequestAbort = () => runAbort.abort();
  requestSignal?.addEventListener("abort", onRequestAbort);
  try {
    return await researchLoop(input, emit, () => lastEmitAt, usage, runAbort.signal, () => timedOut);
  } finally {
    clearTimeout(deadline);
    requestSignal?.removeEventListener("abort", onRequestAbort);
  }
}

async function researchLoop(
  input: string,
  emit: (e: GenerationEvent) => void,
  lastEmitAt: () => number,
  usage: RunUsage,
  signal: AbortSignal,
  timedOut: () => boolean,
): Promise<GenerationResult> {
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN)
    return {
      kind: "error",
      message: "Live generation is not configured on this server. Set ANTHROPIC_API_KEY in .env.local and restart.",
    };

  const workspaceId = process.env.ANTHROPIC_WORKSPACE_ID?.trim();
  const client = new Anthropic({
    maxRetries: 2,
    ...(workspaceId ? { defaultHeaders: { "anthropic-workspace-id": workspaceId } } : {}),
  });
  const started = Date.now();
  const probes: Probe[] = [];
  const fetchedUrls = new Set<string>();
  const searchTitles = new Map<string, string>();
  const seenBlocks = new Set<string>();
  const fetchAttempts = new Map<string, number>();
  const fetchUrlById = new Map<string, string>();
  const searchesRun = new Map<string, number>();
  let remindedFor = "";
  let planning = false;
  let latestUpdate: string | null = null;
  let writingActive = false;
  let activitySince = Date.now();
  const phase = () => (planning ? "planning" : "research") as "planning" | "research";
  const emitThinking = (update: string | null) =>
    emit({ type: "thinking", phase: phase(), update, seconds: Math.round((Date.now() - activitySince) / 1000) });
  const heartbeat = setInterval(() => {
    if (!writingActive && Date.now() - lastEmitAt() >= QUIET_MS) emitThinking(latestUpdate);
  }, 1000);
  try {
    return await turns();
  } finally {
    clearInterval(heartbeat);
  }

  async function turns(): Promise<GenerationResult> {
    let containerId: string | null = null;
    const withComposio = composioProbeEnabled();
    const runTools = withComposio ? tools : tools.filter((t) => !("name" in t) || t.name !== "probe_composio_toolkit");
    const systemPrompt = withComposio ? SYSTEM_PROMPT_WITH_COMPOSIO_PROBE : SYSTEM_PROMPT;
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
      if (timedOut()) return TIMEOUT_RESULT;
      if (signal.aborted) return { kind: "error", message: "Generation was cancelled." };

      if (!planning) activitySince = Date.now();
      const stream = client.beta.messages.stream(
        {
          model: MODEL,
          max_tokens: 64000,
          betas: BETAS,
          fallbacks: "default",
          thinking: { type: "adaptive", display: "updates" },
          output_config: { effort: EFFORT },
          system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
          tools: runTools,
          messages,
          ...(containerId ? { container: containerId } : {}),
        },
        { signal },
      );

      let writing: { index: number; buffer: string; lastEmit: number } | null = null;
      let thinking: { index: number; buffer: string; lastEmit: number } | null = null;
      const shortUpdate = (text: string) => {
        const clean = cleanText(text.trim().replace(/\s+/g, " "));
        return clean.length > 220 ? `${clean.slice(0, 217).trimEnd()}...` : clean;
      };
      const emitWriting = (force: boolean) => {
        if (!writing) return;
        const now = Date.now();
        if (!force && now - writing.lastEmit < 800) return;
        writing.lastEmit = now;
        const { section, started } = sectionProgress(writing.buffer);
        emit({ type: "writing", chars: writing.buffer.length, section, sectionsStarted: started, sectionsTotal: GUIDE_SECTIONS.length });
      };

      stream.on("streamEvent", (event) => {
        if (event.type === "content_block_start" && event.content_block.type === "thinking") {
          thinking = { index: event.index, buffer: "", lastEmit: 0 };
          return;
        }
        if (thinking && event.type === "content_block_delta" && event.index === thinking.index && event.delta.type === "thinking_delta") {
          thinking.buffer += event.delta.thinking;
          if (thinking.buffer.trim() && Date.now() - thinking.lastEmit >= 1000) {
            thinking.lastEmit = Date.now();
            emitThinking(shortUpdate(thinking.buffer));
          }
          return;
        }
        if (thinking && event.type === "content_block_stop" && event.index === thinking.index) {
          if (thinking.buffer.trim()) {
            latestUpdate = shortUpdate(thinking.buffer);
            emitThinking(latestUpdate);
          }
          thinking = null;
          return;
        }
        if (event.type === "content_block_start" && event.content_block.type === "tool_use" && event.content_block.name === "submit_guide") {
          writing = { index: event.index, buffer: "", lastEmit: 0 };
          writingActive = true;
          emitWriting(true);
        } else if (writing && event.type === "content_block_delta" && event.index === writing.index && event.delta.type === "input_json_delta") {
          writing.buffer += event.delta.partial_json;
          emitWriting(false);
        } else if (writing && event.type === "content_block_stop" && event.index === writing.index) {
          emitWriting(true);
          writing = null;
          writingActive = false;
        }
      });

      stream.on("contentBlock", (block) => {
        const blockKey = "id" in block && typeof block.id === "string" ? block.id : "tool_use_id" in block && typeof block.tool_use_id === "string" ? `result:${block.tool_use_id}` : null;
        if (blockKey) {
          if (seenBlocks.has(blockKey)) return;
          seenBlocks.add(blockKey);
        }
        if (block.type === "text" && block.text.trim()) emit({ type: "note", text: cleanText(block.text.trim().slice(0, 400)) });
        if (block.type === "server_tool_use") {
          const inputObj = (block.input ?? {}) as Record<string, unknown>;
          if (block.name === "web_search" && typeof inputObj.query === "string") {
            const key = inputObj.query.trim().toLowerCase();
            const seen = searchesRun.get(key) ?? 0;
            searchesRun.set(key, seen + 1);
            emit({ type: "search", query: inputObj.query, ...(seen > 0 ? { repeat: true } : {}) });
          }
          if (block.name === "web_fetch" && typeof inputObj.url === "string") {
            const key = normalizeUrl(inputObj.url);
            const seen = fetchAttempts.get(key) ?? 0;
            fetchAttempts.set(key, seen + 1);
            fetchUrlById.set(block.id, inputObj.url);
            emit({ type: "fetch", url: inputObj.url, ...(seen > 0 ? { repeat: true } : {}) });
          }
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
            emit({ type: "fetched", url: fetchUrlById.get(block.tool_use_id) ?? "", ok: false });
          }
        }
      });

      let message: Anthropic.Beta.BetaMessage;
      try {
        message = await stream.finalMessage();
        addUsage(usage, message);
        if (message.container?.id) containerId = message.container.id;
        jsonRetries = 0;
      } catch (err) {
        if (timedOut()) return TIMEOUT_RESULT;
        if (signal.aborted) return { kind: "error", message: "Generation was cancelled." };
        logApiError(err, turn);
        if (!(err instanceof Anthropic.APIError) && jsonRetries++ < 2) continue;
        return { kind: "error", message: apiErrorMessage(err) };
      } finally {
        writingActive = false;
      }

      if (message.stop_reason === "refusal") return { kind: "error", message: "The research model declined this request." };

    for (const b of message.content)
      if (b.type === "fallback") {
        console.info(`[generate] Fallback ${JSON.stringify({ turn, from: b.from.model, to: b.to.model, trigger: b.trigger })}`);
        emit({ type: "note", text: `${b.from.model} handed this turn to ${b.to.model}.` });
      }
    message = { ...message, content: echoableContent(message.content) };

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
          if (tu.name === "probe_composio_toolkit") {
            const parsed = ProbeComposioInput.safeParse(tu.input);
            if (!parsed.success) return results.push(toolResult(tu.id, "Invalid input: toolkit_slug is required.", true));
            const out = await probeComposioToolkit(nextProbeId("composio"), parsed.data.toolkit_slug);
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
            emit({ type: "checked", ...outcome.stats });
            for (const c of outcome.checks) emit({ type: "check", message: c });
            finished = { kind: "guide", guide: outcome.guide };
            return results.push(toolResult(tu.id, { saved: true }));
          }
          return results.push(toolResult(tu.id, `Unknown tool ${tu.name}`, true));
        }),
      );

      if (finished) return finished;

      const content: Anthropic.Beta.BetaContentBlockParam[] = [...results];
      const fetchedList = [...fetchedUrls];
      const searchList = [...searchesRun.keys()];
      const reminderKey = `${fetchedList.join(" ")}|${searchList.join("|")}`;
      if (reminderKey !== remindedFor && (fetchedList.length > 0 || searchList.length > 0)) {
        remindedFor = reminderKey;
        content.push({
          type: "text",
          text: [
            fetchedList.length > 0 ? `Pages already fetched in this run. Reuse them and do not fetch them again: ${fetchedList.join(", ")}.` : "",
            searchList.length > 0 ? `Searches already run. Do not repeat them: ${searchList.map((q) => `"${q}"`).join(", ")}.` : "",
          ]
            .filter(Boolean)
            .join(" "),
        });
      }
      if (!nudged && Date.now() - started > SOFT_DEADLINE_MS) {
        nudged = true;
        content.push({
          type: "text",
          text: "Time is almost up. Stop researching and call submit_guide now with what you have. Mark anything unverified as uncertain.",
        });
      }
      messages.push({ role: "user", content });
      if (!planning && toolUses.some((tu) => ENDPOINT_PROBES.has(tu.name))) {
        planning = true;
        activitySince = Date.now();
        latestUpdate = null;
        if (WRITE_EFFORT !== EFFORT) messages.push({ role: "system", content: [], output_config: { effort: WRITE_EFFORT } });
      }
    }

    return { kind: "error", message: "The research run hit its step limit before finishing. Try again." };
  }
}
