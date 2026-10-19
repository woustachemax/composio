export type VerificationItem = {
  guide: string;
  title: string;
  detail: string;
  how?: string;
};

export const checkedByHand: VerificationItem[] = [
  {
    guide: "github",
    title: "Read every GitHub claim against the docs source",
    detail:
      "Read the github/docs repository Markdown behind each page I cited, including the reusable snippets for token limits and wildcard redirect matching. Rendered pages and AI summaries dropped those details.",
  },
  {
    guide: "slack",
    title: "Slack's non-Marketplace rate limit, in context",
    detail:
      "Read the May 29, 2025 changelog in full. The 1 request per minute limit applies only to commercially distributed apps outside the Marketplace. Internal customer-built apps and existing installs are exempt. The requirement text was right, but the verdict left this out, so I corrected the verdict.",
  },
  {
    guide: "gmail",
    title: "Which Gmail scopes are restricted",
    detail:
      "Checked the Gmail scopes table. Eight scopes are restricted. gmail.labels and two add-on scopes are non-sensitive. gmail.send and two add-on scopes are sensitive. The guide matches. The research agent's own summary had undercounted the add-on scopes, but that error didn't make it into the guide.",
  },
  {
    guide: "x",
    title: "Composio's X (Twitter) managed app status",
    detail:
      "The managed-auth directory lists Twitter under bring-your-own. Composio's February 12, 2026 changelog says the managed credentials were removed. The guide reflects both.",
  },
  {
    guide: "x",
    title: "Whether X's authorize URL can be probed",
    detail:
      "Compared https://x.com/i/oauth2/authorize with a made-up path under /i/ by hand. Both return the same HTTP 200 app shell, so a signed-out request can't confirm the endpoint. The research agent had already reached this conclusion. My first version of the automated probe got it wrong (see corrections).",
  },
  {
    guide: "all",
    title: "Spot-checked the research agents' highlighted claims",
    detail:
      "Each research agent sent back four claims with exact quotes and URLs. I re-checked them along with every other quote in the library (see the quote check below). I also read the surrounding context for the claims that most affect difficulty and timing.",
  },
];

export const corrections: VerificationItem[] = [
  {
    guide: "github",
    title: "A \"tested\" claim relied on an inconclusive probe",
    detail:
      "The bad-credentials blocker was tagged tested, but its only probe (a POST with a made-up client ID returning {\"error\":\"Not Found\"}) was recorded as inconclusive. I changed it to documented and noted the probe observation.",
    how: "The unit test for the generation pipeline. Tested evidence now needs at least one decisive probe, and the schema enforces this for every guide.",
  },
  {
    guide: "github",
    title: "The console deep link was overclaimed as verified",
    detail:
      "I had compared /settings/applications/new with /settings/this-does-not-exist-xyz (404) and concluded that the form route exists. But a made-up path under /settings/applications/ also redirects to sign-in. The probe is now inconclusive, and the step rests on the documented navigation path.",
    how: "The re-probe script, once it switched to sibling control paths.",
  },
  {
    guide: "slack",
    title: "Authorize endpoint upgraded from documented to tested",
    detail:
      "The research agent's probe got a script-only HTTP 200 page and correctly called it inconclusive. A re-check against a made-up sibling path, /oauth/v2/…, returned Slack's 404 error page, so the route is real. Added the new probe and upgraded the fact.",
    how: "Re-probe script, confirmed by hand with curl.",
  },
  {
    guide: "slack",
    title: "Verdict overgeneralized the rate limit",
    detail:
      "The verdict said all unlisted apps created after May 29, 2025 get 1 request per minute. It now says commercially distributed apps outside the Marketplace, and notes that internal apps are exempt.",
    how: "Hand check of the changelog.",
  },
  {
    guide: "shopify",
    title: "A probe's outcome didn't match its claim",
    detail:
      "The Partner Dashboard probe was recorded as inconclusive but cited as tested. What it observed, a 301 for signed-out visitors, does confirm the narrower claim in the guide. I narrowed the probe description to that claim and marked it confirmed.",
    how: "The stricter schema rule.",
  },
  {
    guide: "slack",
    title: "Authorize fact was tested on an inconclusive probe",
    detail:
      "Before the re-check above, the authorize URL fact cited only the inconclusive probe as tested. It was downgraded to documented first, then upgraded once a decisive probe existed.",
    how: "The stricter schema rule.",
  },
  {
    guide: "probes",
    title: "The automated authorize probe was too generous",
    detail:
      "My first probe treated any HTTP 200 as a live endpoint, so it called X's authorize URL confirmed. X returns the same 200 for made-up paths. The probe now compares against a made-up sibling path and reports inconclusive when the two look the same.",
    how: "The re-probe disagreed with the research agent's recorded result. A manual check showed the agent was right.",
  },
  {
    guide: "quotes",
    title: "Google served some docs in Turkish",
    detail:
      "Quote checks against Google pages failed at random because some requests got localized pages. The checker now sends Accept-Language: en-US and hl=en. After normalizing whitespace, markdown, and punctuation, every quote matched.",
    how: "Quote checker results varied between runs.",
  },
];

export const unverified: VerificationItem[] = [
  {
    guide: "all",
    title: "Anything behind a sign-in",
    detail:
      "No OAuth app was registered with any provider. Exact form labels, client-secret screens, consent screens, and end-to-end connections through Composio are taken from docs and marked uncertain where the docs are silent.",
  },
  {
    guide: "all",
    title: "Hands-on effort estimates",
    detail: "No setup was timed. Every hands-on range is an estimate from the documented steps and is tagged uncertain.",
  },
  {
    guide: "slack, gmail, shopify",
    title: "Review timelines",
    detail:
      "Slack and Google publish maximums or typical estimates, which are not guarantees. Shopify publishes no review time; its range comes from community forum posts, cited as third-party and tagged uncertain.",
  },
  {
    guide: "gmail",
    title: "CASA security assessment cost and duration",
    detail: "Google says the price is between you and the assessor. No figures were found, so none are given.",
  },
  {
    guide: "x",
    title: "Which X access tiers a new account can choose",
    detail:
      "X's pricing page says pay-per-use with no subscriptions, while the changelog and policy pages still mention Basic, Pro, and Free. The guide states the conflict instead of picking a side.",
  },
  {
    guide: "all",
    title: "Whether Composio refreshes expiring tokens for each toolkit",
    detail: "GitHub (8 h), Shopify (1 h), and Slack (12 h with rotation) all issue expiring tokens. Composio's docs don't say how each toolkit handles refresh. Listed as open questions.",
  },
  {
    guide: "token probes",
    title: "POST probes are not re-run automatically",
    detail:
      "Token endpoint probes recorded by the research agents were one-off POSTs with made-up credentials. The live generation agent and the re-probe script only send GET requests.",
  },
  {
    guide: "live generation",
    title: "Live generation has not run end to end here",
    detail:
      "No ANTHROPIC_API_KEY was configured while this was built. The probe tools, citation checks, schema validation, SSE route, and failure paths were tested without the model. The agent loop itself still needs a run with a real key.",
  },
];

export const driftNotes: Record<string, string> = {
  "shopify/probe-authorize-missing-shop":
    "Expected. The recorded probe supports a different claim: an unknown shop returns 404 \"Store unavailable\" before any OAuth checks. The automated re-run asks whether the endpoint is live, which a missing shop can't show.",
  "slack/probe-authorize":
    "Superseded. The original signed-out probe was inconclusive. The re-check with a sibling control (probe-authorize-recheck) is decisive and is now the cited evidence.",
};
