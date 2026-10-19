import { z } from "zod";

const id = z.string().regex(/^[a-z0-9][a-z0-9-]*$/, "kebab-case id");
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD");
const webUrl = z.url({ protocol: /^https?$/ });

export const SourceSchema = z.object({
  id,
  title: z.string(),
  url: webUrl,
  publisher: z.enum(["provider", "composio", "third-party"]),
  accessedAt: isoDate,
});

export const ProbeSchema = z.object({
  id,
  kind: z.enum(["oidc-discovery", "authorize-endpoint", "token-endpoint", "dev-console-url", "other"]),
  description: z.string(),
  request: z.string(),
  observed: z.string(),
  outcome: z.enum(["confirmed", "refuted", "inconclusive"]),
  ranAt: isoDate,
});

export const EvidenceSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("tested"),
    probeIds: z.array(id).min(1),
    sourceIds: z.array(id).default([]),
    note: z.string().optional(),
  }),
  z.object({
    status: z.literal("documented"),
    sourceIds: z.array(id).min(1),
    quote: z.string().optional(),
    note: z.string().optional(),
  }),
  z.object({
    status: z.literal("uncertain"),
    reason: z.string(),
    sourceIds: z.array(id).default([]),
  }),
]);

export const DurationSchema = z
  .object({
    min: z.number().nonnegative(),
    max: z.number().nonnegative(),
    unit: z.enum(["minutes", "hours", "days", "weeks"]),
  })
  .refine((d) => d.max >= d.min, "max must be >= min");

export const RequirementCategory = z.enum([
  "business-verification",
  "privacy-policy",
  "domain-verification",
  "demo-video",
  "paid-plan",
  "partner-program",
  "security-assessment",
  "restricted-scopes",
  "scopes",
  "app-review",
  "end-user-admin-approval",
  "redirect-uri",
  "token-lifecycle",
  "rate-limits",
  "other",
]);

export const RequirementSchema = z.object({
  id,
  category: RequirementCategory,
  title: z.string(),
  applies: z.enum(["required", "conditional", "not-required"]),
  condition: z.string().optional(),
  impact: z.enum(["blocker", "friction", "info"]),
  detail: z.string(),
  evidence: EvidenceSchema,
});

export const StepSchema = z.object({
  id,
  title: z.string(),
  owner: z.enum(["agent", "you"]),
  agentAssist: z.string().optional(),
  phase: z.enum(["decide", "register", "configure", "verify", "launch"]),
  optional: z.boolean().default(false),
  effort: DurationSchema.optional(),
  waitsOn: z.enum(["nobody", "provider", "third-party"]).default("nobody"),
  instructions: z.array(z.string()).min(1),
  url: webUrl.optional(),
  evidence: EvidenceSchema,
});

export const BlockerSchema = z.object({
  id,
  symptom: z.string(),
  cause: z.string(),
  fix: z.array(z.string()).min(1),
  evidence: EvidenceSchema,
});

export const FactSchema = z.object({
  id,
  label: z.string(),
  value: z.string(),
  evidence: EvidenceSchema,
});

export const GuideBaseSchema = z.object({
  schemaVersion: z.literal(1),
  slug: id,
  app: z.object({
    name: z.string(),
    website: webUrl,
    category: z.string(),
    developerConsoleUrl: webUrl,
  }),
  meta: z.object({
    lastVerified: isoDate,
    origin: z.enum(["hand-researched", "agent-generated"]),
    researchNotes: z.string().optional(),
  }),
  summary: z.object({
    verdict: z.string(),
    difficulty: z.object({
      level: z.enum(["easy", "moderate", "hard"]),
      reason: z.string(),
      evidence: EvidenceSchema,
    }),
    time: z.object({
      handsOn: DurationSchema,
      approvalWait: DurationSchema.nullable(),
      note: z.string(),
      evidence: EvidenceSchema,
    }),
  }),
  composio: z.object({
    managedAuthAvailable: z.enum(["yes", "no", "unknown"]),
    whyBringYourOwn: z.array(z.string()),
    callbackUrl: webUrl,
    evidence: EvidenceSchema,
  }),
  appTypeChoice: z
    .object({
      question: z.string(),
      recommendation: z.string(),
      options: z.array(
        z.object({
          name: z.string(),
          bestFor: z.string(),
          tradeoffs: z.array(z.string()),
        }),
      ),
      evidence: EvidenceSchema,
    })
    .optional(),
  requirements: z.array(RequirementSchema).min(1),
  steps: z.array(StepSchema).min(1),
  blockers: z.array(BlockerSchema),
  facts: z.array(FactSchema),
  openQuestions: z.array(z.string()),
  sources: z.array(SourceSchema).min(1),
  probes: z.array(ProbeSchema),
});

export const GuideSchema = GuideBaseSchema.superRefine((g, ctx) => {
  const sourceIds = new Set(g.sources.map((s) => s.id));
  const probeIds = new Set(g.probes.map((p) => p.id));
  const decisive = new Set(g.probes.filter((p) => p.outcome !== "inconclusive").map((p) => p.id));
  const check = (ev: z.infer<typeof EvidenceSchema>, path: (string | number)[]) => {
    for (const s of ev.sourceIds)
      if (!sourceIds.has(s)) ctx.addIssue({ code: "custom", message: `unknown source "${s}"`, path });
    if (ev.status === "tested") {
      for (const p of ev.probeIds)
        if (!probeIds.has(p)) ctx.addIssue({ code: "custom", message: `unknown probe "${p}"`, path });
      if (!ev.probeIds.some((p) => decisive.has(p)))
        ctx.addIssue({ code: "custom", message: "tested evidence needs at least one confirmed or refuted probe", path });
    }
  };
  check(g.summary.difficulty.evidence, ["summary", "difficulty"]);
  check(g.summary.time.evidence, ["summary", "time"]);
  check(g.composio.evidence, ["composio"]);
  if (g.appTypeChoice) check(g.appTypeChoice.evidence, ["appTypeChoice"]);
  g.requirements.forEach((r, i) => check(r.evidence, ["requirements", i]));
  g.steps.forEach((s, i) => check(s.evidence, ["steps", i]));
  g.blockers.forEach((b, i) => check(b.evidence, ["blockers", i]));
  g.facts.forEach((f, i) => check(f.evidence, ["facts", i]));
  const all = [g.sources, g.probes, g.requirements, g.steps, g.blockers, g.facts];
  for (const list of all) {
    const seen = new Set<string>();
    for (const item of list) {
      if (seen.has(item.id)) ctx.addIssue({ code: "custom", message: `duplicate id "${item.id}"` });
      seen.add(item.id);
    }
  }
});

export type Guide = z.infer<typeof GuideSchema>;
export type Evidence = z.infer<typeof EvidenceSchema>;
export type Requirement = z.infer<typeof RequirementSchema>;
export type Step = z.infer<typeof StepSchema>;
export type Duration = z.infer<typeof DurationSchema>;
export type Source = z.infer<typeof SourceSchema>;
export type Probe = z.infer<typeof ProbeSchema>;
