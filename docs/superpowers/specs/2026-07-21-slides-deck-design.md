# Design: Lab Presentation Slide Deck (Web app)

**Status**: Approved (2026-07-21)
**Author**: N283T (with Claude Code)
**Scope**: A standalone HTML/CSS/JS slide deck for an in-lab presentation of the
OpenADMET PXR Challenge (Track 1 Activity) results, built as a hand-crafted web
app rather than a slide-framework file. Kept intentionally light — this is a
one-off deliverable for a single talk, not a reusable framework.

## Goals

- Present the challenge report (4th of 95) to a **mixed audience** (ML +
  chem/pharma) in a **30+ minute** talk, achievement-report first.
- Try out **hand-crafted HTML/CSS/JS as a slide medium** as a side goal — no
  Reveal.js / Slidev / etc.
- Run **locally** from `file://` or a local server, without network dependencies.

## Non-Goals

- Reusable slide framework
- Perfect responsive design across arbitrary viewports
- Public deployment (may follow later, but not required)
- Automated tests
- Reuse of existing `docs/index.html` charts or data — deck data and visuals
  are authored fresh (aesthetic is inherited, content is not)

## Requirements (from brainstorming)

| Item | Decision |
|---|---|
| Audience / length | Mixed, 30+ min, achievement-report focused |
| Language | Japanese (technical terms in English) |
| Style | Follow `docs/` light-mode palette and typography |
| Framework | Vanilla HTML/CSS/JS, no build step |
| Charts | ECharts (reuse the vendored copy under `docs/assets/vendor`) |
| Interactivity | Medium — in-slide fragment reveals + interactive charts |
| Runtime | Local (`file://` or local static server) |
| Presenter tooling | Keyboard nav, presenter notes (separate window), thumbnail overview |
| Content flow | Auto-draft outline from `MODEL_REPORT.md`, then iterate together |

## Architecture

### Directory layout

```
slides/
  index.html                # single-file deck (all slides as <section>)
  presenter.html            # presenter-notes window (opened via 't' key)
  OUTLINE.md                # content plan; disposable after content lands
  assets/
    css/
      deck.css              # tokens, typography, chrome (nav, overview)
      slide.css             # per-slide layout rules
      print.css             # 1 slide per page for PDF backup
    js/
      deck.js               # state machine, keyboard, URL sync, fragment
      overview.js           # thumbnail-grid mode toggle
      notes.js              # presenter-notes broadcast (sender & receiver)
      echarts-theme.js      # bridge CSS custom props into ECharts theme
      charts/
        <chart-name>.js     # one module per chart, init(el, data) contract
    data/
      *.js                  # per-chart data; assigns to window.DeckData
    img/                    # figures, screenshots
    vendor/
      echarts/              # copied (or symlinked) from docs/assets/vendor
      fonts/                # same fonts as docs, redeclared here
    fonts.css               # @font-face declarations local to the deck
```

**Notes**:

- The deck lives in `slides/` at the repo root, alongside `docs/`. Keeping it
  separate protects the published report from experimental changes.
- Vendor assets (ECharts, fonts) are copied by default so the deck is
  self-contained. Symlinking is an option later if duplication becomes
  annoying; deferred until it actually matters.
- `OUTLINE.md` is a working document. Delete once content is stable.

### Slide model

Every slide is a `<section class="slide" id="s-<slug>">` inside `index.html`.
A slide can contain:

- `<h1>` / `<h2>` for titles
- Regular flow content
- `<div class="chart" data-chart="<name>" data-src="<key>">`
  placeholders for charts (the src key looks up `window.DeckData[<key>]`)
- `<aside class="notes" hidden>` for presenter notes (never shown on stage)
- Elements marked `data-fragment="<n>"` for progressive reveal

The deck is authored declaratively; no per-slide JS file. Anything dynamic
lives in a chart module or in `deck.js`.

### Global state

A single object owned by `deck.js`:

```js
{
  index: 0,          // 0-based slide index
  total: N,          // computed from DOM
  mode: 'slide',     // 'slide' | 'overview'
  fragmentStep: 0,   // progressive reveal step within current slide
}
```

Mirrored to the URL as `?s=<index>&f=<fragmentStep>` so refresh / back-forward
buttons work; also broadcast to `presenter.html` (see below).

### Navigation

| Key | Action |
|---|---|
| `→`, `Space`, `PageDown`, `n` | next fragment → else next slide |
| `←`, `PageUp`, `p` | previous fragment → else previous slide |
| `Home` / `End` | first / last slide |
| `Esc`, `o` | toggle overview |
| `1`–`9` | jump to slide (works in overview too) |
| `.` | toggle blackout |
| `t` | open presenter window |

Transitions are CSS transitions (fade or short horizontal slide). Respects
`prefers-reduced-motion`.

### Overview mode

`<body data-mode="overview">` toggles a CSS Grid layout that scales every
slide down (`transform: scale()`) into a thumbnail wall. **The DOM is not
duplicated** — the same slides render, just styled differently, so chart state
persists.

### Presenter notes window

`presenter.html` is a companion page opened in a separate window (`window.open`
from the main deck). Layout:

```
┌──────────────────┬───────────────┐
│ current slide    │ next slide    │
│ (scaled preview) │ (scaled prev) │
├──────────────────┴───────────────┤
│ current slide's <aside.notes>    │
└───────────────────────────────────┘
```

Sync uses `BroadcastChannel('deck')` for `index` and `fragmentStep`.
Fallback: `localStorage` + `storage` event, if `BroadcastChannel` turns out
not to work under `file://` in the target browsers.

### Chart integration

Each chart registers to a global registry — **not** an ES module, because
`file://` blocks `import`/`export` in every mainstream browser. Data is also
inlined as `<script>` tags for the same reason (`fetch()` from `file://` is
blocked). No `type="module"`, no `fetch()`; classic scripts and globals only.

```js
// assets/js/charts/results.js — classic script
window.DeckCharts = window.DeckCharts || {};
window.DeckCharts.results = {
  init(el, data) {
    const chart = echarts.init(el, null, { renderer: 'svg' });
    chart.setOption({ /* option */ });
    return {
      chart,
      resize: () => chart.resize(),
      dispose: () => chart.dispose(),
      onEnter: () => { /* fire animation when slide becomes active */ },
      onLeave: () => { /* stop animations if needed */ },
    };
  },
};
```

Data lives under `assets/data/` as JS files that assign to
`window.DeckData['<key>']`, loaded via `<script>` in `index.html` — not JSON
fetched at runtime.

`deck.js` walks all `.chart` elements on startup, looks up
`DeckCharts[el.dataset.chart]` and `DeckData[el.dataset.src]`, calls
`init(el, data)`, and stashes the handle. On slide change it fires
`onEnter` / `onLeave` on the affected slides. `ResizeObserver` handles
resize.

**Rendering**: ECharts `renderer: 'svg'` — crisp on projectors, prints clean,
easy to inspect.

**Theming**: `echarts-theme.js` reads CSS custom properties from `:root`
(color-blue, color-teal, etc.) and hands them to ECharts as a theme, so the
deck stylesheet is the single source of truth.

**Initialization strategy**: initialize all charts at load time. There are on
the order of 7–15 charts total; complexity of lazy init isn't warranted. If
this turns out to be slow on the presentation laptop, revisit with
`IntersectionObserver`.

## Content flow

1. Claude drafts `slides/OUTLINE.md` from `MODEL_REPORT.md`. Outline contains
   per-slide titles, 3–5 bullet points, chart/figure hints, and presenter
   notes drafts.
2. N283T reviews and edits the outline (reorder, drop, add).
3. HTML skeleton implemented from the approved outline.
4. Iterate slide-by-slide on wording, charts, animations.

Working target: ~17–22 slides for a 30-minute talk. Numbers are illustrative;
final count decided during content iteration.

### Provisional table of contents

Titles are placeholders; exact wording is decided during content iteration.

1. Title
2. TL;DR (3-line summary)
3. Challenge overview (PXR, task, metric, data)
4. Final results (Phase 1/2)
5. Strategy core: multi-fidelity transfer learning
6. Feature strength: `pred` (predicted log2fc)
7. Ensemble composition (9-member Caruana, TabPFN, Boltz-2)
8. Calibration and gating decisions
9. Process lessons (knowing when to stop, null results)
10. AI-assisted workflow (light touch — Claude Code + Deep Research)
11. Summary and next
12. References / appendix

## Risks and open questions

- **`file://` CORS constraints** — already addressed in the design: no ES
  modules, no `fetch()`, no dynamic `import`. Classic `<script>` tags with
  global registries only. Called out here so future edits don't
  accidentally reintroduce `import`/`fetch`. If we ever want to serve over
  HTTP we can revisit, but the design must keep working from `file://`.
- **`BroadcastChannel` under `file://`** — needs empirical check in Chrome and
  Firefox. Fallback: `localStorage` `storage` event.
- **Fonts** — `Zen Maru Gothic` in the vendored subset covers Latin only.
  Japanese body text will fall back to system font. If that looks off, add
  a CJK subset from Google Fonts to `assets/vendor/fonts/`.
- **ECharts SVG on large projectors** — should be fine but confirm at rehearsal.
- **PDF export** — `print.css` is the fallback path; verify a browser
  print-to-PDF produces something usable for a distributable handout.

## Success criteria

- The deck runs from a fresh clone by opening `slides/index.html` in a modern
  browser, with no build step and no network.
- Keyboard navigation, overview mode, and the presenter window all work.
- Charts render correctly at a projector-typical resolution.
- One dry-run through the whole deck completes without a hard failure.

That's the bar. No test suite, no CI, no coverage target — this is a talk.
