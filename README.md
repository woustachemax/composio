# OAuth Guides

Live app at:https://composio-indol.vercel.app/ . Walkthrough at: https://www.loom.com/share/8ec6c325d3fa41a386019f4f55071c7e.

You look up an app and get a guide to registering your own OAuth app with that provider and getting it approved. The top of each guide shows the difficulty, the hands-on time, the approval wait and whether Composio already manages the app. If the app isn't in the library, an agent researches it live and writes a shareable guide.

## The problem

A developer registers an OAuth app with the provider once. On Composio, an auth config holds its client ID and secret, and each end user gets their own connection through consent. Composio manages the OAuth app for many providers. Developers bring their own when Composio doesn't manage one, or when they want their own name on the consent screen.

Registration is where they lose time. GitHub takes minutes. Gmail needs a verified domain, a demo video and a yearly paid security assessment. The docs rarely say which kind of provider you're dealing with.

## What I built

Five hand-built guides, picked for the different ways they slow you down. GitHub has no review. Gmail has restricted scopes and CASA. Slack has a marketplace review for commercial apps. X bills every call. Shopify has no Composio managed app and a distribution choice you can't undo.

Each guide draws the setup on a timeline to scale, so a six week review visibly dwarfs thirty minutes of work.

## Evidence

Every claim is tagged tested, documented or uncertain. Tested means a live probe. Documented means a linked source with a quote. Uncertain says why.

The server enforces this. It drops citations to pages the agent never opened. A time figure needs a quoted source. Hands-on time is always labelled an estimate. Approval wait shows a number only when a source gives one, and says whose figure it is. The /verification page lists what I re-checked and what I fixed.

## The agent

It searches the provider's docs, reads them, then runs GET-only probes against the authorize endpoint, the OIDC discovery URL and the developer console. It also calls Composio's toolkit API to check managed auth, and the server trusts that over the agent's reading. The guide must pass the same checks as the hand-built ones. Progress streams to the page. If the app doesn't exist or has no OAuth, it stops and says so.

## What I learned

GitHub's docs name one error for bad credentials. My probe got a 404. The guide lists both.

Composio's managed auth list renders in the browser, so the agent saw nothing and marked Calendly unknown. I then moved to Composio's API, which confirmed Calendly is managed.

My first honesty fix went too far and turned every hands-on time into "unclear". However, hands-on time is always an estimate, so I labelled it as one and kept "unclear" for approval waits with no source.

The agent refetched the same page up to four times because each turn lost its tool session. Reusing the session cut fetches from sixteen to eight.

Runs had three silent minutes while the model planned. The page now streams thinking and writing progress. A run takes two to three minutes.

## Building it

I used Claude Code. Four research agents wrote the Slack, Gmail, X and Shopify guides in parallel. I tested in a real browser and fed fixes back. BUILD_LOG.md has the decisions in order. DESIGN.md has the tokens taken from composio.dev.

## Running locally

```
git clone [REPO_LINK]
cd composio-takhome
npm install
cp .env.example .env.local
npm run dev
```

`ANTHROPIC_API_KEY` must belong to a Claude Console workspace. `COMPOSIO_API_KEY` is a Composio project key with read access to toolkits. `BLOB_READ_WRITE_TOKEN` is only needed on Vercel. The library works without any keys.

`npm run validate` checks every guide. `npm test` runs the tests. `npm run reprobe:composio` re-checks managed auth without calling the model.

## Limitations

I didn't register a real app or go through an approval, so hands-on times are estimates. Probes run signed out, so they prove an endpoint exists, not that your app works. Live guides aren't reviewed by a person and say so. A run costs fifty cents to a dollar on Opus. Sonnet was faster and cheaper but thinner, so I kept Opus. The rate limit is five runs per IP per hour, held in memory, so it's approximate on Vercel.

## Next

Batch generate the remaining guides with a human review step. Re-probe on a schedule to catch provider changes. Collect real approval times from developers, since providers publish that number least.