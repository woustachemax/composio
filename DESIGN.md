# Design reference: composio.dev

Extracted on 2026-10-20 from the live site's HTML, its three Next.js CSS bundles, computed styles read with headless Chrome, and full-page screenshots at 1440 px.

## Fonts

| Role | composio.dev | Here |
| --- | --- | --- |
| Sans (headings, body) | `geistSans` (Geist) | Geist via `next/font/google` |
| Mono (labels, buttons, nav, numbers, code) | `JetBrains Mono` | JetBrains Mono via `next/font/google` |
| Display (some product pages) | Roobert TRIAL, Flecha Test S | Not used. These are trial licenses |

Type scale, from computed styles:

| Element | Size / line height | Weight | Tracking |
| --- | --- | --- | --- |
| Hero h1 | 64 / 69 px | 400 | -1.6 px (-0.025em) |
| Section h2 | 44 / 48 px | 400 | -1.1 px (-0.025em) |
| Card title h4 | 20 / 24 px | 500 | normal |
| Lead paragraph | 18 / 27 px | 400 | -0.198 px, 65% opacity |
| Body | 16 / 24 px | 400 | normal |
| Mono label ("TRUSTED BY") | 12 / 16 px | 400 | +0.6 px (0.05em), uppercase, 40% opacity |
| Mono button | 14 / 21 px | 400 | -0.154 px, text set in caps |
| Mono tab / chip | 12 / 18 px | 400 | -0.132 px |

Headings are regular weight (400), never bold. Weight comes from size and tight tracking.

## Color tokens (from `:root`)

| Token | Value | Use |
| --- | --- | --- |
| `--background` | `#f6f6f6` | Light page background |
| `--card` / `--panel` | `#ffffff` | Panels on light bands |
| `--foreground` | `#0f0f0f` | Text, primary buttons, dark bands |
| `--border` | `oklch(92.2% 0 0)` ≈ `#e5e5e5` | Hairlines on light |
| dark border | `rgb(44,44,44)` = `#2c2c2c` | Hairlines on dark |
| dark raised | `#1e1e1e` | Active tab on dark |
| dark chip | `#2a2a2a` | Chips on dark |
| `--brand` | `#51a2ff` | Light blue, used on dark |
| `--brand-readable` | `#0007cd` | Deep blue: headline highlight block, active number chip, active tab border, top banner |
| `--highlight` | `#d4ff4a` | Lime accent, used sparingly |
| `--success` | `oklch(54.6% .16 155.8)` | Green |
| `--warning` | `oklch(66.6% .16 75)` | Amber |
| `--destructive` | `oklch(57.7% .215 27.3)` | Red |
| showcase surfaces | `#e9e5f5`, `#e3ece4`, `#f0e8da` | Purple, green and sand tints behind illustrations |
| muted text on light | `rgba(15,15,15,.65)` | Lead copy |
| muted text on dark | `rgba(255,255,255,.4–.6)` | Labels and secondary copy |

## Shape, borders, spacing

- **Radius is 0.** Buttons, inputs, panels, tabs and chips are all square. The only rounding is the 4 px number chip (`01`).
- **1 px hairlines carry the layout.** Panels are separated by borders and shared edges, not shadows. Grids look like ruled tables: cells share borders.
- **No shadows** on cards. The nav is a white bar with a hairline border.
- Max content width is about 1240 px with 100 px side gutters at 1440. Sections have 120–160 px vertical padding. Cards use 20 px padding.
- **Bands alternate** between `#0f0f0f` dark and `#f6f6f6` light, each full-bleed.

## Patterns

1. **Uppercase mono labels.** "TRUSTED BY", "WORKS WITH", footer column heads. 12 px JetBrains Mono, 0.05em tracking, low opacity. They sit above content and act as eyebrows.
2. **Numbered sections and tabs.** A vertical tab list: `01 NO CONTEXT BLOAT`, `02 BETTER EVERY TIME`. The active tab gets a `#0007cd` filled number chip, a `#1e1e1e` background and a blue 1 px border. The matching panel repeats the number in a small bordered chip above a 32 px heading.
3. **Highlight block.** A key phrase in the hero ("in minutes") sits on a solid `#0007cd` block with white text. It is not a gradient or an underline.
4. **Mono buttons.** Primary: solid white on dark or solid black on light, 12×24 px padding, caps text. Secondary: transparent with a 1 px border at 30% opacity. Small inline actions ("READ THE DOCS") are 6×8 px with a 15% border.
5. **Framed label strips.** "WORKS WITH" is a 1 px bordered strip: a mono label, a vertical divider, then a row of small monochrome logos.
6. **Code as decoration.** Dark panels show short code (`tools = session.tools()`, `agent = Agent(...)`) in mono at about 11 px with low-contrast syntax colors. Code is shown as part of the product, not hidden in docs.
7. **App logos.** Real full-color logos at 16–20 px next to a mono label (`Gmail`, `Google Calendar`, `Slack`), in rows under use-case cards, or as 64 px white tiles with a subtle border in illustrations. The logo service is `https://logos.composio.dev/api/<slug>`.
8. **Ruled lists for detail.** Feature bullets are short lines with a 2 px vertical bar on the left. FAQ rows are hairline-separated with a `+` at the right edge.
9. **Prompt chips.** Example prompts sit in small bordered rectangles inside cards.
10. **Copy.** Short headlines that state an outcome ("Everything between the ask and the result, handled"). One-sentence subheads. Mono labels in caps.

## Logo service behavior (checked with curl)

- `GET /api/<slug>` always returns HTTP 200 SVG. An unknown slug returns a grid placeholder with the header `x-logo-fallback: true`. It never 404s.
- `/api/x` returns the placeholder. `/api/twitter` returns the X logo.
- So a client-side `onError` is not enough. We check the header on the server (cached), try a few slug candidates, and fall back to a monogram tile. We also keep `onError` for network failures.

## How this maps to the app

| Token or pattern | Applied as |
| --- | --- |
| Geist + JetBrains Mono | Root layout fonts. Mono for every label, button, number, nav item and code value |
| `#f6f6f6` / `#fff` / `#0f0f0f` | Page background / panels / text and dark bands |
| Dark band | Home hero, guide header, generate pipeline, verification header |
| 0 radius, hairlines, no shadows | Every surface. Grids are ruled tables, not floating cards |
| Numbered sections | Guide sections `01`–`08` with a sticky numbered index on desktop. Verification sections too |
| `#0007cd` highlight block | One phrase in each page headline. The active section number |
| Mono caps buttons | All buttons and links that act |
| Code as decoration | Callback URL, technical reference and probe requests render as dark code panels. The generate log is a terminal |
| App logos | Library rows, guide header, framed "Guides for" strip in the hero |
| Ruled lists with a left bar | Requirements, blockers and instructions |

### Evidence colors

These come from the site's own semantic tokens, so tags read as part of the palette:

| Tag | Color | Mark |
| --- | --- | --- |
| Tested | success green `#16a34a` | Filled square |
| Documented | brand-readable blue `#0007cd` | Filled square |
| Uncertain | warning amber `#c98a0b` | Hollow square |

### Owner colors (timeline and steps)

| Owner | Color |
| --- | --- |
| Agent | `#0007cd` blue |
| You | `#0f0f0f` black |
| Waiting on provider or third party | Amber diagonal hatch |
| Blocker | `#dc2626` red marker |

### Motion

- Timeline segments draw in left to right, staggered by 30 ms.
- Wait hatching drifts slowly to read as "waiting".
- The OAuth diagram moves a dot along the active path.
- Pipeline stages pulse while active.
- Everything is off under `prefers-reduced-motion`.
