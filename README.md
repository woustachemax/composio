# OAuth Guides

Live app at:
and a walkthrough video at: .

A developer building an agent on Composio wants their users to connect an app. Sometimes Composio already has a managed OAuth app for it and they can start right away. Other times they need their own, because Composio doesn't manage that provider, or they want their own name on the consent screen, their own scopes, or their own rate limit. That's when the trouble starts. Registering an OAuth app can take ten minutes or three months, and you usually find out which one by hitting the wall yourself.

This app tries to answer that before you start. You look up an app and get a guide that tells you how hard it is, how long the hands-on part takes, how long you'll wait on the provider, what could block you, and which steps an agent can handle for you. If the app isn't in the library, you type its name and an agent researches it live and writes a new guide you can share.

## How I understood the problem

The thing that took me a minute to get straight was that there are three separate pieces. There's the OAuth app, which is registered once with the provider and holds a client ID and secret. There's the developer's integration, which on Composio is an auth config pointing at that OAuth app. And there's each end user's connection, which is a token their consent produces. With Composio managed auth, Composio owns the OAuth app and the user sees "Composio wants access". With your own app, you own it and the user sees your name. The home page diagram has a toggle that shows both flows, because that consent screen difference is most of the reason people bring their own app.

The hard part for developers isn't the OAuth flow itself. It's everything around registration. Google wants a verified domain, a privacy policy, a demo video and a paid security assessment for most Gmail scopes. Shopify makes you pick a distribution method you can never change. X charges per API call. None of this is in one place, and most of it isn't on the first docs page you open.

## What I chose to build

I kept the scope to one question. Can a developer read the top of a guide and know whether this is an afternoon or a quarter? Every guide puts difficulty, hands-on time, approval wait and whether Composio already manages the app above the fold. Steps, blockers, requirements and sources come after.

For the library I picked five apps that fail in different ways rather than five popular ones. GitHub is the easy baseline with no review at all. Gmail is the hard case with restricted scopes and a security assessment. Slack has a marketplace review that only matters if you go commercial. X is quick to register but you pay for every call. Shopify has no Composio managed app, a distribution choice you can't undo, and app store rules that clash with Composio's connect flow. I originally planned LinkedIn instead of Shopify, but Shopify teaches more because it's a case where a developer has no choice but to bring their own app.

Each guide also has a setup timeline drawn to scale. The point is to make the wait visible. Gmail's hands-on time is under one percent of the calendar, and the picture says that faster than a sentence does.

## How the evidence works

Every claim in a guide is tagged as tested, documented or uncertain. Tested means an agent ran a live probe against the provider. Documented means a linked source states it, usually with a short quote. Uncertain means it's inferred or I couldn't confirm it, and the guide says why.

I didn't want the agent to be able to fake this, so the server checks its work before saving. It drops any citation pointing at a page the agent never opened and downgrades the claims that relied on it. A duration only counts as documented if an opened source is quoted stating it, and a probe can never count as evidence for a time estimate. Hands-on time is always shown as an estimate, since nobody times a registration. Approval wait only shows a number when a source gives one, and the card says whose figure it is, like "About 6 weeks, Google's estimate". Otherwise it says the wait is unclear.

The /verification page is the audit trail. It shows how many quotes were found word for word on the live pages, how many cited links resolve, which probes changed when I re-ran them, and what I corrected along the way.

## What the agent does

When you submit an app, the agent searches for the provider's developer docs, reads them, and then runs safe probes. These are GET requests only and refuse private addresses. It checks whether the authorize endpoint is live, whether the provider publishes OIDC metadata, and whether the developer console URL behaves differently from a made-up path next to it. It also calls Composio's toolkit API to check whether Composio manages that app, and that result overrides whatever the agent concluded from reading. Then it writes a guide that has to pass the same schema and evidence rules as the hand-built ones. Progress streams to the page the whole time, so you can watch each search, page and probe as it happens.

If the app doesn't exist, is ambiguous, has no OAuth, or has no public docs, it stops and says so instead of writing something.

## What I learned and corrected

A few things surprised me and changed the guidance.

GitHub's docs say bad client credentials return one error, but my probe got a plain 404 instead. The guide now lists both. A signed-out probe also can't tell a real client ID from a fake one, because both redirect to sign-in, so the end-to-end test became a step the developer does themselves.

Composio's managed auth page lists which toolkits are managed, but that list is rendered in the browser, so a fetch only sees "Loading toolkits". The agent kept saying "unknown" for Calendly. The fix was to ask Composio's API directly, which returned that Calendly is managed. That's now a tested probe on every guide.

My first pass at honest headlines went too far. Notion's guide showed "0 to 2 weeks approval wait" in big letters while admitting further down that it was a placeholder, so I made uncertain numbers say "unclear". That turned every hands-on time in the library into "unclear", which removed the one thing developers came for. I then moved to labelling estimates as estimates and only hiding approval waits that no source states.

The agent was also fetching the same page up to four times per run, which burned its whole budget and left real questions unanswered. The cause was that each turn started a fresh tool session and lost what it had already read. Reusing the session cut a Dropbox run from 16 fetches to 8 with no repeats.

Live runs had about three minutes of a frozen screen while the model planned the guide, which would have looked broken on a call and would have hit the hosting time limit. The page now streams thinking updates and writing progress, and a typical run finishes in two to three minutes.

## How I used agents to build it

I built this with Claude Code. Four research agents wrote the Slack, Gmail, X and Shopify guides in parallel and the main session checked their work against the sources. I then tested the app in a real browser with Claude and fed what I saw back in, which is where most of the corrections above came from. BUILD_LOG.md has the decisions and fixes in the order they happened, and DESIGN.md has the design tokens I pulled from composio.dev so the app would feel like it belongs next to it.

## Running it locally

You need Node 20 or later.

```
git clone [REPO_LINK]
cd composio-takhome
npm install
cp .env.example .env.local
npm run dev
```

Then fill in `.env.local`. `ANTHROPIC_API_KEY` is needed for live generation, and the key has to belong to a workspace in the Claude Console. `COMPOSIO_API_KEY` is a project key from the Composio platform dashboard, and it only needs read access to toolkits. `BLOB_READ_WRITE_TOKEN` is only needed on Vercel so generated guides survive across server instances. Without the Anthropic key the library still works and the generate page tells you it isn't configured.

`npm run validate` checks every guide against the schema and evidence rules, `npm test` runs the tests, and `npm run reprobe:composio` re-checks Composio managed auth for every guide without calling the model.

## Limitations

I didn't register a real OAuth app with any provider or go through an approval, so every hands-on time is an estimate and every approval wait comes from the provider or from developer reports. Probes are unauthenticated, so they prove an endpoint exists, not that your app will work. Guides generated live are not reviewed by a person, and the page says so. A live run costs roughly 50 cents to a dollar on Opus. Sonnet was twice as fast and a third of the cost in my test, but its Dropbox guide was noticeably thinner, so I kept Opus. The rate limit is five runs per IP per hour and lives in memory, so on Vercel it's approximate. The library has five hand-built guides plus whatever has been generated, not a hundred.

## What I'd do next

To get to a hundred guides, I'd batch generate them and put each one through a short human review before it joins the library. I'd run the reprobe scripts on a schedule so a guide flags itself when a provider changes something. And I'd collect real approval times from developers who use the guides, since that's the number everyone wants and the one providers publish least.
