# Build log

This is project documentation for milestones 1 to 4 of the OAuth setup guide app. Milestone 5 (README, deploy, polish) was out of scope. Nothing was committed or pushed.

## Quick start

```bash
npm install
cp .env.example .env.local   # then set ANTHROPIC_API_KEY to try live generation
npm run dev                  # http://localhost:3000
```

| Command | What it does |
| --- | --- |
| `npm run validate` | Validates every library guide against the zod schema, including cross-reference and evidence rules |
| `npm test` | Offline tests for the live generation finalize step (citation checks, evidence downgrades, schema errors) |
| `npm run check-quotes` | Fetches every cited page, checks every verbatim quote and link, and writes `src/content/quote-check.json` |
| `npm run reprobe` | Re-runs the library's GET probes against live providers and writes `src/content/reprobe-report.json` |
| `npm run build` | Production build (passes) |

### What you need to add to test live generation

1. Create `.env.local` with `ANTHROPIC_API_KEY=sk-ant-...`. This is required. Without it, `/generate` shows "Live generation is not configured" and nothing else runs.
2. Optional: `ANTHROPIC_MODEL` (default `claude-opus-5-5`) and `ANTHROPIC_EFFORT` (`low`, `medium` or `high`; default `medium`).
3. Optional locally, needed on Vercel: `BLOB_READ_WRITE_TOKEN` from a Vercel Blob store. Locally, generated guides are saved to `.data/generated-guides/`, which is gitignored. On Vercel without a token they go to `/tmp`, which is per instance and temporary, so shared links can break. See "Double check" below.
4. Restart `npm run dev`, open `/generate?app=Notion` (or type a name on the home page), and watch the stream.

**The agent loop has not run against the real API.** No key was available while building. Everything around it was tested without the model: probes, citation checks, schema validation, the SSE route, the UI states, and the no-key, library-match and cached paths. The first real run is the most important thing to check. See "Double check".

---

## Milestone 1: scaffold, schema, GitHub guide, guide page

### What was built

- Next.js 16.4 (App Router, Turbopack, Cache Components on by default), TypeScript, Tailwind 4, zod 4.
- `src/lib/guide-schema.ts` is the guide schema. `GuideBaseSchema` is the plain object. `GuideSchema` adds cross-checks: every `sourceId` and `probeId` must exist, ids must be unique, and tested evidence must cite a decisive probe.
- `src/content/guides/github.json` is the hand-researched GitHub guide.
- `src/app/guides/[slug]/page.tsx` and `src/components/guide/guide-view.tsx` render the guide page.
- `src/components/evidence.tsx` is the evidence tag. It is a click-to-open popover built on `<details>`, so it works without JavaScript and shows the quote, note, probe, or source links behind each tag.
- `src/lib/guide-view.ts` holds the derived views: requirement ordering, who-does-what, phases, evidence counts, and the list of uncertain claims.

### Schema decisions

You approved these before the page was built.

- **Added:** `verdict`; a `composio` block (whether a managed app exists, why bring your own, the callback URL); `appTypeChoice`; `applies: not-required`, so "no review" is an evidenced claim; `impact` (blocker, friction or info); `waitsOn` on steps; shared `sources[]` and `probes[]` registries referenced by id; `facts[]`; `openQuestions[]`.
- **Dropped:** a stored who-does-what list (derived from `steps[].owner` and `agentAssist`); a separate gotchas list (gotchas are requirements with `impact: friction`); a stored uncertainty list (derived from claims tagged uncertain).
- **Added later:** URLs must be `http` or `https` (`webUrl`). This blocks `javascript:` links in agent-written guides. Tested evidence must also cite at least one probe that is not inconclusive (see milestone 4).

### Page decisions

- **Above the fold:** four cards (difficulty, time split into hands-on and approval wait, requirements and gotchas, who does what), then the evidence legend. Screenshots at 1440×900 show all four cards above the fold.
- **Requirements card:** shows applicable items sorted by impact, then by required before conditional. "Not needed" items are listed separately, because "no app review" is good news a developer needs to see.
- **Below the summary:**
  - Composio panel with a copyable callback URL
  - App type choice
  - Steps grouped by phase, each with an owner badge, effort, a "waits on" badge and an evidence tag
  - If you get blocked
  - Requirements in detail
  - Technical reference
  - What we couldn't verify
  - Sources and probes
- **Header:** last-verified date, origin (hand-researched or agent-generated), and counts by evidence tag. Agent-generated guides also show a banner.
- **Rejected:**
  - Hover tooltips: they don't work on touch screens and aren't accessible.
  - A tabbed layout: it hides the steps from people skimming a shared link.
  - Rendering steps as markdown: plain strings are easier for an agent to produce reliably. URLs inside instructions are styled as code.

### Research and testing for GitHub

- **Sources:** read the `github/docs` repository source rather than relying only on AI summaries of rendered pages. Two details only showed up there: the token limit reusable, and the wildcard redirect reusable (apps that had a single callback URL before August 3, 2026 have wildcard matching on).
- **Probes:**
  - The authorize endpoint redirects to sign-in.
  - Both OIDC and OAuth discovery URLs return 404.
  - The token endpoint with made-up credentials returned `{"error":"Not Found"}`, not the documented `incorrect_client_credentials`.
  - Comparing the console URL with a control path was later corrected (see milestone 4).
- **Learned:** a signed-out probe cannot tell a valid client ID from a made-up one at GitHub's authorize endpoint. So the end-to-end test is a "you" step, not an agent step.

---

## Milestone 2: library of five apps and searchable home page

### What was built

- Four more guides: `gmail.json`, `slack.json`, `x.json`, `shopify.json`, all registered in `src/content/guides/index.ts`.
- Home page (`src/app/page.tsx`, `src/components/home/*`):
  - Client-side search over name, category, website and gotcha titles
  - Difficulty filter
  - A cards grid showing difficulty, hands-on time, approval wait and the top gotchas
- Search input:
  - Enter on an exact name opens the guide.
  - Anything else offers "Generate a guide for X".
  - A "Generated by the agent" section lists saved generated guides at request time.

### Why these five

| App | Difficulty | Hands-on | Approval wait | Composio managed | What it teaches |
| --- | --- | --- | --- | --- | --- |
| GitHub | Easy | 15–45 min | None | Yes | The baseline: no review, but org approval and 8-hour token expiry |
| Gmail | Hard | 1–4 h | 6–12 weeks | Yes | Restricted scopes, CASA security assessment, testing-mode limits |
| Slack | Hard (commercial) | 30–90 min | 2–12 weeks | Yes, but in Marketplace review | Distribution is a toggle, but rate limits on unlisted commercial apps and Marketplace prerequisites make production hard |
| X | Moderate | 30–90 min | None | No | Paid access (pay-per-use credits) and policy gates (AI replies need approval) instead of app review |
| Shopify | Hard (public) | 1–16 h | 1–8 weeks | No | A permanent distribution choice, per-shop OAuth, and a conflict between App Store rules and Composio's shop-domain prompt |

Shopify replaced LinkedIn as the fifth app. It teaches something none of the others do: no managed app exists, the distribution choice is irreversible, and there is a real conflict between Composio's flow and the provider's review rules.

### How the four guides were researched

- **Agents:** four research agents ran in parallel. Each read the schema and the GitHub guide as the exemplar, used official docs, and ran only benign unauthenticated GET or POST probes (no sign-ups, logins or form submissions). Each validated its own file and reported contradictions, its uncertain items and four claims to spot-check. Their findings are reflected in each guide's `openQuestions` and uncertain claims.
- **Rejected:** writing all four by hand (too slow for the time budget), and having one agent write all four (shallower, and one bad assumption spreads to every guide).

### Notable findings from the research

- **Slack:**
  - Composio's own Slack page says its managed app is still in Marketplace review and recommends your own app.
  - Commercially distributed apps outside the Marketplace created after May 29, 2025 get 1 request per minute on `conversations.history` and `conversations.replies`.
  - Marketplace submission needs 10 or more active workspaces first.
- **Gmail:**
  - Google's own pages disagree on review times: 3–5 vs 10 business days for sensitive scopes; "several weeks", 6 weeks and "several months" for restricted scopes.
  - CASA cost is not published.
- **X:**
  - Pricing is now pay-per-use, and docs conflict on whether Basic and Pro still exist.
  - Composio removed its managed Twitter credentials in February 2026.
  - The server metadata lists only S256 for PKCE, while the docs say `S256` or `plain`.
- **Shopify:**
  - App Store requirement 2.3.1 forbids asking merchants for their shop domain, but Composio's flow asks for it. This is our inference and is labeled as such.
  - Public apps must use expiring offline tokens by January 1, 2027.

---

## Milestone 3: live generation

### What was built

- `src/app/api/generate/route.ts`: a POST endpoint that streams Server-Sent Events. In order, it:
  1. cleans the input (strips `<>` and control characters, caps length at 120)
  2. short-circuits to a library guide when the name, slug or website matches
  3. reuses a generated guide less than 7 days old unless `force` is set
  4. rejects duplicate in-flight runs for the same slug
  5. sends 15-second keep-alive comments while running
  6. passes `request.signal` through, so closing the tab cancels the run

  `maxDuration` is 300 seconds.
- `src/lib/generate/agent.ts`: a manual agent loop on the Anthropic SDK (beta messages stream).
  - **Tools:** server-side `web_search_20260209` (max 8 uses) and `web_fetch_20260209` (max 16 uses, 12k tokens per page); client tools `probe_discovery`, `probe_authorize_endpoint`, `probe_developer_console`, `submit_guide` and `report_cannot_generate`.
  - **Model settings:** adaptive thinking with `display: "updates"`, so the model's progress notes stream to the UI; effort `medium`; `fallbacks: "default"` for refusal fallback; prompt caching on the system prompt, which includes the GitHub guide as the exemplar.
  - **Edge cases handled:** `pause_turn`, `max_tokens` (asks for a shorter resubmit), `refusal`, unparseable tool input (retried twice), typed API errors, up to 3 submit attempts, 24 turns, and a 200-second soft deadline. After the deadline the agent is told to submit now and mark unverified claims uncertain.
- `src/lib/generate/prompt.ts`: the system prompt (context, process, evidence rules, style, failure cases). User input is wrapped in `<app_request>` and labeled as data, not instructions.
- `src/lib/generate/finalize.ts`: the deterministic gate between the agent and storage, described below.
- `src/lib/store.ts`: storage for generated guides. It uses Vercel Blob (private) when `BLOB_READ_WRITE_TOKEN` is set, `.data/generated-guides/` locally, and `/tmp` on Vercel without a token. Reads are re-validated with zod.
- `src/app/generate/page.tsx`, `src/components/generate/generate-runner.tsx` and `generation-store.ts`: the live progress UI. It shows searches, pages read, probes with their outcomes, model progress notes, submit attempts, validation issues and automatic citation checks. It then redirects to `/guides/<slug>`. Failure states are separate:
  - not found
  - ambiguous (suggested names are clickable)
  - no OAuth
  - no public docs
  - errors, with a retry button

### Design decisions

- **The agent proposes; the server decides the evidence tags.** `finalize.ts`:
  - Fills in slug, dates, origin and the Composio callback URL.
  - Replaces `probes` with the probes that actually ran. The agent cannot make up probe results.
  - Removes any cited source the agent never opened with `web_fetch`. Search-result snippets do not count.
  - Downgrades claims that rested only on those sources to uncertain, with a reason.
  - Downgrades tested claims with no decisive probe.
  - Rejects the guide if no opened source remains.
  - Appends what it changed to `researchNotes`, so a reader can see it.

  This is the main protection against made-up citations.
- **Failure is a structured tool, not free text.** `report_cannot_generate` has four reasons. The prompt tells the agent to use it only when an evidence-backed guide is impossible, because a guide with uncertain claims is still useful.
- **Fetch POST stream, not EventSource.** EventSource auto-reconnects, and a reconnect would start a second paid run. It also only supports GET.
- **Manual loop, not the SDK tool runner.** The loop needed streaming progress, `pause_turn` handling, a soft deadline nudge and custom finalization on submit. The SDK's tool runner doesn't resume `pause_turn` automatically.
- **Model:** `claude-opus-5-5` at `medium` effort, the default the API guidance recommends. Override with `ANTHROPIC_MODEL` or `ANTHROPIC_EFFORT` if demos run long.
- **Rejected:**
  - Structured output via `output_config.format`: the guide is large, and a submit tool can return validation errors for the agent to fix in the same conversation.
  - Vercel Workflow or Queues for durable runs: too much infrastructure for a demo-sized feature. Note that a run dies if the function times out.
  - Letting the agent run arbitrary HTTP requests: the probes are three narrow, GET-only tools.

### Security

- `src/lib/probes.ts`: probes only `http(s)` on default ports, with no credentials in URLs. It rejects IP literals, single-label, `.local` and `.internal` hosts. It resolves DNS and rejects private, loopback, link-local, CGNAT, multicast and IPv6 local addresses. It never follows redirects (`redirect: "manual"`), times out after 8 seconds and reads at most 64 KB. Tested: `127.0.0.1`, `localhost:3100`, `169.254.169.254`, `[::1]`, `file://` and a non-default port are all blocked.
- **Known gap:** DNS rebinding between the check and the request is possible in theory. Pinning the resolved IP would close it.
- **Prompt injection:** web content can try to instruct the agent. The agent has no tool with side effects beyond read-only probes, and all output is rendered as React text. Links are restricted to `http(s)` by the schema.

### Tested

- **No API key:** a clean error in the UI and the API.
- **Library short-circuit:** works for `GitHub` and `slack.com`.
- **Input:** empty input returns 400.
- **Generated guide storage:** a stored guide renders at `/guides/<slug>` with the agent-generated banner and appears on the home page.
- **Missing slug:** shows "We don't have a guide yet" with a Generate link.
- **Progress UI:** checked in a real browser (puppeteer driving Chrome) with a temporary scripted event stream. Events render, counters update, "done" redirects, and the "ambiguous" state shows clickable suggestions. The scripted stream was removed afterwards.
- **`npm test`:** a full submission passes; unopened sources are removed and their claims downgraded; inconclusive probes downgrade tested claims; nothing opened is rejected; a broken schema returns readable issues.

### Broke and fixed

- **StrictMode double mount:** the dev double mount aborted the first request, and a `startedFor` ref stopped the second mount from restarting it. Generation hung on "Working". Rewrote the client so streaming state lives in a small external store read with `useSyncExternalStore`, and keyed the component by app. This also cleared the `react-hooks/set-state-in-effect` lint error.
- **Lint on the store helper:** a function named `useBlob` tripped the hooks lint rule. Renamed it `blobEnabled`.
- **Truncated write:** the first write of `agent.ts` was cut off mid-file and was rewritten in full.
- **Cache Components warning:** awaiting `params` outside `<Suspense>` triggered a warning. The page now resolves params inside Suspense, and generated guides render behind `connection()`. Library guides are still prerendered with `generateStaticParams`.

---

## Milestone 4: verification probes and the `/verification` page

### What was built

- Probe tools for the agent (see milestone 3). Each returns a probe id that the agent cites for tested evidence.
- `npm run reprobe` (`scripts/reprobe.ts`): re-runs every GET probe recorded in the library guides and records drift against the recorded outcome. POST and templated probes are skipped.
- `npm run check-quotes` (`scripts/check-quotes.ts`): fetches every cited page, checks every verbatim `quote` after normalizing whitespace, markdown and typographic punctuation, and checks that every source URL resolves.
- A stricter schema rule: tested evidence must cite at least one confirmed or refuted probe. This applies to library guides and generated guides alike.
- `/verification` (`src/app/verification/page.tsx` and `src/content/verification.ts`) shows:
  - totals
  - how evidence is produced
  - what was corrected (with how each was caught)
  - what was checked by hand
  - what couldn't be verified
  - evidence counts per guide
  - the latest re-probe table, with explanations for drift
  - the full quote check

### Results

- **Quotes:** 76 of 76 verbatim quotes found on the live source pages.
- **Links:** 95 of 95 cited URLs resolve.
- **Re-probe:** 21 probes in total, 17 re-run, 4 skipped (POST probes), 2 with drift, both explained on the page.
- **Library:** 5 guides with 261 claims: 24 tested, 218 documented, 19 uncertain.

### What I corrected, and how it was caught

1. **GitHub bad-credentials blocker:** tagged tested, but it rested on an inconclusive probe. Changed to documented. Caught by the finalize unit test, which led to the stricter schema rule.
2. **GitHub console deep link:** overclaimed. A made-up path under `/settings/applications/` also redirects to sign-in, so the probe is inconclusive and the step now rests on the documented navigation path. Caught when the re-probe switched to sibling control paths.
3. **Slack authorize URL:** downgraded to documented, then upgraded to tested after a re-check. A made-up sibling path under `/oauth/v2/` returns Slack's 404 error page while the authorize URL returns 200. Confirmed by hand with curl.
4. **Slack verdict:** it overgeneralized the rate limit. It now says "commercially distributed apps outside the Marketplace" and notes that internal apps are exempt. Caught by reading the changelog in full.
5. **Shopify Partner Dashboard probe:** narrowed to the claim it actually supports (the signed-out redirect) and marked confirmed.
6. **My automated authorize probe:** it called any HTTP 200 "live", so it said X's authorize URL was confirmed. X returns the same 200 for made-up paths, and the research agent had been right. The probe now compares against a made-up sibling path.
7. **Quote checker:** results varied between runs because Google served some pages in Turkish. The checker now sends `Accept-Language` and `hl=en`.

### Checked by hand

- Slack's rate-limit changelog in context.
- Gmail's scope sensitivity table. The guide is right; the research agent's own summary had undercounted the add-on scopes.
- Composio's Twitter status: the directory and the February 2026 changelog agree.
- X's authorize probe: curl against a sibling control path.
- GitHub's docs source for every claim in that guide.

### Couldn't verify

- **Anything behind a sign-in:** registration forms, client-secret screens, consent screens, and an end-to-end Composio connection.
- **Hands-on time:** no estimate was timed.
- **Review timelines:** provider maximums and estimates only. Shopify's comes from forum posts.
- **CASA:** cost and duration are not published.
- **X tiers:** which ones a new account can choose (sources conflict).
- **Composio token refresh:** how Composio refreshes expiring tokens for each toolkit.
- **Live generation:** it has not run end to end.

---

## Redesign: composio.dev design language

### What was studied

- Fetched composio.dev, its three CSS bundles, and computed styles of key elements in headless Chrome. Took full-page screenshots at 1440 px.
- Tokens and patterns are in `DESIGN.md`:
  - Geist and JetBrains Mono
  - `#f6f6f6`, `#0f0f0f` and `#0007cd`
  - zero radius, hairline borders, no shadows
  - uppercase mono labels, numbered tabs, the blue highlight block, and code shown as decoration
- **Logo service finding:** `logos.composio.dev` never returns 404. Unknown slugs return HTTP 200 with a grid placeholder and `x-logo-fallback: true`. `/api/x` is itself the placeholder; `/api/twitter` is the X logo. `src/lib/logo.ts` therefore checks that header on the server, tries a few slug candidates, and caches the result (weeks on success, minutes on network failure). `AppLogo` falls back to a monogram tile when there is no logo or the image fails to load.

### Before and after

| Page | Before | After |
| --- | --- | --- |
| Home | Light hero, three-paragraph intro, rounded card grid with pill tags and shadows | Dark hero with a framed "Guides for" logo strip and a highlighted headline. An OAuth sequence diagram with a managed vs your-own-app toggle. The library is a ruled table: logo, difficulty meter, hands-on, a wait bar on a shared scale, managed yes/no, and the top gotcha. Filters are square mono tabs |
| Guide | Four rounded cards above the fold, violet and zinc badges, card-per-step list | Dark header: logo, a one-line time statement with the highlight block, the verdict, and evidence counts. A ruled four-cell stats strip. A sticky numbered index (`01 TIMELINE` to `09 SOURCES`) and numbered sections. The setup timeline comes first. The Composio callback is a dark code panel. Facts and probes are terminal-style panels. Blockers are a `+` accordion like composio.dev's FAQ. Requirements and instructions are ruled lists with a left bar |
| Generate | Paragraph intro and a bordered list of events with emoji-style icons | Dark band with the live five-stage pipeline. The event log is a terminal panel with mono tags (`SEARCH`, `READ`, `PROBE`, `CHECK`) |
| Verification | Stat cards, rounded item cards, plain tables | Dark header with ruled stat cells and a stacked evidence bar. Numbered sections. Ruled item lists with colored left bars. A per-guide mix bar. A dark re-probe table with drift flagged |

Screenshots, desktop 1440 and mobile 390, are in `.data/screenshots/` (gitignored):
- `before/`: the previous UI
- `after/`: the new UI, including `github-vs-gmail.png` side by side and `generate.png` mid-run
- `ref/`: composio.dev

### SVG diagrams

All three are hand-built inline SVG, with no chart library.

1. **OAuth on the home page** (`src/components/home/oauth-diagram.tsx`):
   - A sequence diagram with four lifelines: end user, your agent app, Composio and provider. Six numbered messages.
   - The OAuth app (client ID and secret) is a box on the provider's lifeline. The two steps that use it are drawn in blue: the consent screen and the code-for-token swap.
   - The toggle switches ownership. With managed auth, the consent screen says "Composio wants access". With your own app, it says "Your app wants access", and a dashed line shows you registering the app.
   - A comparison table below covers consent screen, setup, review, quota and availability.
   - A dot travels the message path. Mobile gets a compact variant.
2. **Setup timeline on every guide** (`src/lib/timeline.ts` and `src/components/guide/setup-timeline.tsx`):
   - Built only from guide data, so it works for agent-generated guides. Tested with a generated-guide fixture, since removed.
   - Swimlanes for agent, you and waiting. Steps are segments in data order, with widths to scale by hands-on effort midpoint (minimum width so tiny steps stay visible).
   - Steps that wait on the provider or a third party are hatched blocks of fixed width. Steps with no estimate are dashed. Optional steps are faded.
   - When there is an approval wait, a top bar shows hands-on vs wait to true scale (Gmail's hands-on is under 1% of the calendar), with a zoom connector down to the step track.
   - Blockers (requirements with `impact: blocker` that apply) are red `B1`, `B2` flags on the track, listed and linked below.
   - Mobile gets a vertical version.
3. **Pipeline on the generate page** (`src/components/generate/pipeline.tsx`):
   - Five stages: find app, read docs, run probes, check citations, write guide.
   - Stages light up from streamed events: searches go to stage 1, fetches to 2, probes to 3, submit and checks to 4, done to 5. Each stage shows a live count.
   - Error and unsupported results mark the current stage red. Library and cache hits show as skipped.

### Copy and em dashes

- Cut the multi-sentence intros on home, guide, generate and verification. Labels are short mono caps. No guide facts or evidence were changed.
- **Em dashes:**
  - The only one in the guide data was inside a verbatim X pricing quote. It is now a hyphen. `check-quotes` already normalizes both to `-`, so the quote still matches. `quote-check.json` was updated to match.
  - The UI placeholder that had one was rewritten.
  - The agent prompt now says never to output an em dash, and to write one inside a quote as a hyphen.
  - As a backstop, `src/lib/text.ts` strips em dashes from the whole submission in `finalize.ts` (hyphen inside `quote`, comma elsewhere) and from streamed notes and "can't generate" messages. `npm test` covers it.
  - All 10 routes were checked over HTTP: 0 em dashes in the rendered HTML.

### Broke and fixed

- **Timeline animation looked stuck.** Per-element SVG transforms, then clip-path wipes, appeared frozen on an early frame. The cause was Puppeteer's element and full-page capture (`captureBeyondViewport`), not the browser. A normal viewport screenshot rendered correctly. The fixes still made the animation better:
  - The wipe is on an HTML wrapper.
  - It plays on load if the chart is visible, otherwise once it scrolls into view.
  - It uses `fill-mode: backwards`, so no clip is left behind.
  - It is off under reduced motion.
  - The after screenshots were stitched from viewport captures.
- **IntersectionObserver never fired for the hidden timeline.** A fully clipped target counts as not intersecting. The observer now watches an unclipped outer wrapper.
- **Mobile horizontal overflow** on guide and verification pages:
  - Closed evidence popovers still took up layout. They are now `hidden` until open, and on mobile they open as a bottom sheet.
  - Grid tracks sized to long URLs. They now use `minmax(0,1fr)`.
- **Stale stream events:** a superseded generation stream could still append events (seen with a scripted stream under StrictMode). The store now ignores reads from a stream it has replaced.
- **Lint:** reassigning a layout variable during render (`react-hooks/immutability`) was rewritten as a pure computation. `<img>` moved to `next/image` with `unoptimized`, and `logos.composio.dev` was added to `images.remotePatterns`.

### Checked

- `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run validate` and `npm run build` all pass.
- No horizontal overflow at 390 px on any route.
- Not checked: Safari and Firefox rendering, and live generation end to end (still no API key).

### Follow-up polish

- **Nav:** the full-width white sticky bar is now part of the dark hero. It is contained to the 1240 px content width and scrolls away with the page. The guide index stays sticky.
- **Highlight block:** `.hl` was an inline background, so at tight line heights it overlapped the line above. It is now an inline block with its own line height, and the headlines that use it got `leading-[1.15]`.
- **Overscroll:** `html` is now ink and `overscroll-behavior: none` is set, so no white shows past the footer.
- **Scrollbars:** hidden on every element.
- **Favicon:** the default `favicon.ico` was replaced with `src/app/icon.svg`, a dark square with a white bar and a blue block. The nav logo now uses the same artwork, without the outline border it had before.
- **Name:** the site title is "OAuth Guides" everywhere: the nav, the footer, and the title template ("Gmail OAuth setup · OAuth Guides").

### Punctuation cleanup

**What was replaced**
- **Ranges:** `formatDuration` now writes "6 to 12 weeks". Hyphen ranges in Gmail's prose became "2 to 3 business days" and "3 to 5 business days". The matching verbatim Google quotes still say "2-3" and "3-5" with plain hyphens, because they are evidence and `check-quotes` matches them.
- **Navigation-path arrows** in steps (GitHub, Gmail, X, Slack) were rewritten as sentences, for example "open Settings, then Your account, then Automation". The Shopify forum source title "app - Review" became "app: Review".
- **Probe output:** said "HTTP 302 → url" and now says "HTTP 302 redirect to url", in `probes.ts` and the committed `reprobe-report.json`. Page text extracted by probes is stripped of arrows and dashes. That is where Shopify's "Store unavailable ←" came from.
- **UI arrows are now lucide-react icons** (new dependency):
  - `ArrowUpRight` on external links and the developer console button
  - `ArrowRight` on library rows, "Open guide", ambiguous-name suggestions and verification guide links
  - `ArrowLeft` on the generate page's back link
- **Timeline markers:** the ▲ text characters are now drawn SVG triangles.
- **OAuth diagram:** the "ID + secret → tokens" label became "Gets tokens".
- **Left alone:** code operators (`=>`) and the dash characters inside regexes.

**Agent and validator**
- The system prompt has explicit rules: no em or en dashes, no double hyphens, ranges in words, no text arrows, and nav paths written with "then". Characters are named by code point, so the prompt contains none.
- `src/lib/text.ts` (renamed to `cleanText` and `cleanTextDeep`) enforces the same rules on every agent submission, note and failure message. In quotes, dashes become hyphens and arrows become `>`.
- `npm run validate` now fails on any em dash, en dash, text arrow (`→ ← ⟶ ⇒ › » -> =>`) or spaced `--` anywhere in a guide JSON, and prints the field path. Tested by planting an arrow in `x.json`, which failed, then removing it.
- `npm test` covers dash, range and arrow cleanup in finalize.

**Read-through**
- Dumped the full text of `/`, all five guides, `/generate`, `/verification`, a missing guide and a 404. This includes hidden popovers, SVG labels, titles, meta and aria labels. Scanned it and read it; screenshotted the generate no-key error and a scripted "ambiguous" result.
- **Fixed:**
  - Parenthetical names inside sentences: "waits on Gmail (Google OAuth)" and "register this redirect URL with X (formerly Twitter)" now use a short name ("Gmail", "X"). Page titles do too ("Gmail OAuth setup"). Headings keep the full name.
  - The mobile timeline's "2 to 10m" shorthand is now "2 to 10 min". Titles truncate to fit the effort label, so they no longer collide.
  - Verification's "CAUGHT BY: Caught by the stricter schema rule" no longer repeats itself.
  - The probes panel said "4 RUN" and now says "4 PROBES".
  - On the diagram, Composio's sublabel "Your ID + secret, tokens" is now "Holds your ID and secret", and "Its own app + tokens" is now "Uses its own app". The comparison cell reads "Sometimes. These guides show how long it takes".
  - The empty agent log after an error now shows a line instead of a blank box.
  - The missing-guide title "OAuth setup guide" became "No guide yet".
  - Added a styled 404 (`src/app/not-found.tsx`) in place of Next's default.
  - Short pages fill the viewport, so there is no light band above the footer.
- **OAuth diagram collision:** in managed mode, "COMPOSIO ALREADY HAS ONE" overlapped the OAuth app box. The box now sits lower. Both connectors run along a line above it and drop into its top edge, so the labels are clear of the box.

### Section index tracks scroll

- `src/components/guide/section-nav.tsx` highlights the guide section you are reading in the sticky index. The active row gets the hover background and a blue number chip, like composio.dev's active tab.
- **How it works:** a scroll listener throttled with `requestAnimationFrame` picks the last section whose heading has passed 140 px from the top. It picks the last section once you reach the bottom of the page.
- **Accessibility:** the active link has `aria-current="location"`.
- **Verified** in headless Chrome by scrolling the Gmail guide to the timeline, steps, requirements and sources sections, and reading which item was active.

### Browser-test fixes

- **Input validation (client and server):** `src/lib/app-input.ts` trims and collapses whitespace. It rejects empty input, anything containing `<` or `>`, control characters, and names over 80 characters. The API returns 400 with `code: "invalid_input"`. `/generate` and the home search run the same check before navigating or calling the API: the inputs have `maxLength=80`, errors show inline, and an invalid `?app=` value never reaches the API (checked: 0 requests for `<b>hi</b>`).
- **Rate limit:** 5 model runs per IP per hour (`src/lib/rate-limit.ts`), keyed on `x-forwarded-for` or `x-real-ip`. Only real runs count: library matches, cache hits, duplicate in-flight requests and servers with no API key don't. Over the limit, the route returns 429 with `retry-after`, and `/generate` shows a "Limit reached" panel with the wait time and a link to the library. The counter is in memory per instance, which is fine for a demo; a shared store would be needed for strict limits across instances.
- **Title:** "OAuth Guides" everywhere, including metadata and the footer.
- **Mobile nav:** Generate stays visible. The Library link is hidden below `sm` to fit, and the logo still links home.
- **Guide URLs:**
  - `src/proxy.ts` 308-redirects mixed-case slugs to lowercase (`/guides/GitHub` goes to `/guides/github`).
  - Slugs that are neither a library guide nor a stored generated guide are rewritten to `/guide-missing/[slug]`. That route calls `notFound()` before streaming starts, so the response is a real 404. Its `not-found.tsx` renders the same "Nothing on X yet" page with the generate button. The Next docs say a `notFound()` inside Suspense keeps a 200 status.
  - Checked with curl: `/guides/github` 200, `/guides/GMAIL` 308, `/guides/flurblesnap` 404 with the generate prompt, `/nope` 404.
- **Sequence diagram:** checked against Composio's docs (`connected_accounts.link()` returns a hosted Connect Link with a `callback_url`; tool execution injects credentials server-side). It now has 9 steps:
  1. The user clicks Connect.
  2. Your app requests a Connect Link.
  3. The user opens the Composio-hosted link.
  4. The user approves the consent screen.
  5. The provider redirects with a code to Composio's callback.
  6. Composio swaps the code for tokens using the client ID and secret.
  7. Composio stores the tokens and returns the user to your app.
  8. The agent calls a tool through Composio.
  9. Composio runs the call with the stored token.
- **Hero and headlines:** removed the gap between the highlighted "connect" and "?", and kept them together on one line. "hands-on." no longer breaks across lines in guide headlines.
- **Blocker cards:** "SOMETIMES" is replaced by the requirement's own condition (for example "External user type with publishing status Testing"). Always-on blockers say "Applies to every app".
- **Timeline hover:** native SVG `<title>` tooltips are replaced by a styled hover card (`timeline-hover.tsx`). It shows the step number, owner and title, plus hands-on time or what the step waits on; blocker flags show their condition. It also appears on keyboard focus, and each block keeps an `aria-label`.
- **Checks:** `npm run validate`, `npm test` (now also `scripts/test-generate-input.ts` for the validator and the limiter), lint, typecheck and `npm run build` all pass.

---

## Double check

1. **Run live generation with a key.** Try `/generate?app=Notion` first, then a made-up name (for example `Flurblesnap`), then an app without public OAuth docs. On the first run, watch:
   - whether `thinking` with `display: "updates"` and `fallbacks: "default"` are accepted with your key, together with these betas: `server-side-fallback-2026-07-01` and `thinking-display-updates-2026-08-18`
   - whether the zod-generated JSON Schema for `submit_guide` is accepted
   - how long a run takes against the 300-second `maxDuration`

   If a beta is rejected, remove it from `BETAS` in `src/lib/generate/agent.ts`, and remove `display` or `fallbacks` with it.
2. **Run time.** Opus at `medium` effort with up to 8 searches and 16 fetches may take 2–5 minutes. If it is close to 300 seconds, set `ANTHROPIC_EFFORT=low`, lower the `max_uses` values, or set `ANTHROPIC_MODEL=claude-sonnet-5-5`.
3. **Storage on Vercel.** Without `BLOB_READ_WRITE_TOKEN`, generated guides are saved to `/tmp` on one instance. The redirect after generation can land on a different instance and show "not found". Add a Blob store before the demo.
4. **In-flight dedupe and caching are per instance**, held in memory. Two instances could generate the same app at the same time. That's fine for a demo.
5. **X shows "Approval wait: None"**, but AI-generated replies need prior approval from X. That is a policy approval for one use case, not app review, so I left it as a requirement rather than a wait. Decide whether the summary should reflect it.
6. **Shopify's hands-on range is 1–16 hours.** That is very wide because it spans custom vs public distribution. Consider splitting it, or stating the custom-distribution number in the verdict.
7. **Slack is rated hard.** It is easy for internal or pilot use and hard for commercial distribution. The verdict says this, but the card shows only "Hard".
8. **`/guides/<unknown>` returns HTTP 200** with a "no guide yet" page instead of a 404 status. That was deliberate, so the page can offer generation, but it may not be what you want for SEO.
9. **Leftover scaffold files.** The `create-next-app` boilerplate `README.md`, `AGENTS.md` and `CLAUDE.md` are still in the repo. I didn't write a README, as asked.
10. **`src/content/quote-check.json` and `reprobe-report.json` are generated files** that are committed as evidence. Re-run both scripts before the demo so the dates are fresh.
