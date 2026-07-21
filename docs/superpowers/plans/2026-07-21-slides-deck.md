# Lab Presentation Slide Deck — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a vanilla HTML/CSS/JS slide deck under `slides/` for a 30-minute
lab presentation of the OpenADMET PXR Challenge report, runnable from
`file://` with no build step.

**Architecture:** Single-file HTML deck (`slides/index.html`) with slides as
`<section>` elements; state machine, keyboard nav, overview mode, and
presenter-notes window are all classic scripts writing to global registries.
Charts use the ECharts copy already vendored under `docs/assets/vendor`.
Design tokens mirror the existing report's light-mode palette and typography.

**Tech Stack:** HTML5 + CSS3 (custom properties, grid, transitions) +
vanilla ES2020 JS as classic scripts, ECharts (SVG renderer), Outfit + Zen
Maru Gothic + PlemolJP fonts (already vendored).

**Reference spec:** `docs/superpowers/specs/2026-07-21-slides-deck-design.md`

## Global Constraints

- Runs from `file://` (Chrome and Firefox) with **no network requests at
  runtime**. Concretely:
  - No `import` / `export` (no `<script type="module">`)
  - No `fetch()`, no dynamic `import()`
  - All data is a JS file that assigns to `window.DeckData[<key>]`, loaded
    via `<script>` tag
  - All chart modules assign to `window.DeckCharts[<name>]`
- No build step; no npm; no bundler. Files are edited and reloaded.
- All commits go to the `feature/slides-deck` branch (already created).
- Verification is **manual browser checks**, not an automated test suite —
  the spec explicitly opts out of tests. Each task ends with a scripted
  browser check and a commit.
- Language of user-visible text: Japanese (technical terms in English).
  Filenames, code identifiers, and comments: English (per project rules).
- Palette and typography are copied verbatim from the tokens block in
  `docs/assets/css/style.css` (`:root` custom properties: `--color-ink`,
  `--color-blue`, `--color-teal`, `--color-coral`, `--color-peach`,
  `--color-bg`, `--color-surface`, `--color-line`, `--font-display`,
  `--font-body`, `--font-mono`). Do not introduce new colors before Task 5.

## File Structure

```
slides/
  index.html                # deck entry point
  presenter.html            # presenter-notes companion window
  OUTLINE.md                # content plan (Task 8)
  assets/
    css/
      deck.css              # tokens + typography + chrome
      slide.css             # per-slide layout
      print.css             # PDF fallback
    js/
      deck.js               # state, keyboard, URL sync, fragment reveal
      overview.js           # overview mode toggle
      notes.js              # presenter-notes bridge (both windows load it)
      echarts-theme.js      # CSS-vars → ECharts theme
      charts/
        results.js          # first real chart (Task 5)
    data/
      results.js            # first real chart's data (Task 5)
    img/                    # figures (added during Task 8+)
    vendor/
      echarts.min.js        # copied from docs/assets/vendor
      fonts/                # copied from docs/assets/vendor/fonts
    fonts.css               # @font-face declarations (local paths)
```

---

## Task 1: Bootstrap `slides/` directory and vendor assets

**Files:**
- Create: `slides/index.html`
- Create: `slides/assets/fonts.css`
- Create: `slides/assets/css/deck.css`
- Create: `slides/assets/vendor/echarts.min.js` (copy of `docs/assets/vendor/echarts.min.js`)
- Create: `slides/assets/vendor/fonts/*.woff2` (copies of the six files under `docs/assets/vendor/fonts/`)

**Interfaces:**
- Produces: an `slides/index.html` that opens in a browser and shows a
  centered placeholder heading rendered in the Outfit display font, with
  the report's cream background. No JS yet.

- [ ] **Step 1: Create the directory tree and copy vendored assets**

```bash
mkdir -p slides/assets/{css,js/charts,data,img,vendor/fonts}
cp docs/assets/vendor/echarts.min.js slides/assets/vendor/echarts.min.js
cp docs/assets/vendor/fonts/*.woff2 slides/assets/vendor/fonts/
ls slides/assets/vendor/fonts/
```

Expected: six `.woff2` files listed.

- [ ] **Step 2: Write `slides/assets/fonts.css`**

Copy the `@font-face` blocks for Outfit (Latin + Latin Ext), Zen Maru Gothic
(400/500/700 Latin), and PlemolJP Regular from `docs/assets/css/style.css`,
pointing at the local `vendor/fonts/` paths. Do not include unicode-range
lines — keep it simple:

```css
@font-face {
  font-family: "Outfit"; font-style: normal; font-weight: 100 900; font-display: swap;
  src: url("vendor/fonts/outfit-latin.woff2") format("woff2");
}
@font-face {
  font-family: "Outfit"; font-style: normal; font-weight: 100 900; font-display: swap;
  src: url("vendor/fonts/outfit-latinext.woff2") format("woff2");
}
@font-face {
  font-family: "Zen Maru Gothic"; font-style: normal; font-weight: 400; font-display: swap;
  src: url("vendor/fonts/zenmaru-400-latin.woff2") format("woff2");
}
@font-face {
  font-family: "Zen Maru Gothic"; font-style: normal; font-weight: 500; font-display: swap;
  src: url("vendor/fonts/zenmaru-500-latin.woff2") format("woff2");
}
@font-face {
  font-family: "Zen Maru Gothic"; font-style: normal; font-weight: 700; font-display: swap;
  src: url("vendor/fonts/zenmaru-700-latin.woff2") format("woff2");
}
@font-face {
  font-family: "PlemolJP"; font-style: normal; font-weight: 400; font-display: swap;
  src: url("vendor/fonts/PlemolJP-Regular.woff2") format("woff2");
}
```

- [ ] **Step 3: Write `slides/assets/css/deck.css` — tokens only**

Copy the `:root { ... }` custom properties from `docs/assets/css/style.css`
verbatim (color-ink, color-blue, color-teal, color-coral, color-peach,
color-bg, color-surface, color-line, plus `--bg`, `--surface`, `--ink`,
`--muted`, `--line`, `--font-display`, `--font-body`, `--font-mono`).
Do NOT include the dark-mode overrides yet. Add:

```css
html, body { margin: 0; padding: 0; }
html { background: var(--bg); color: var(--ink); font-family: var(--font-body); }
* { box-sizing: border-box; }
```

- [ ] **Step 4: Write `slides/index.html` stub**

```html
<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8">
    <title>OpenADMET PXR Challenge — Track 1 Report</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="stylesheet" href="assets/fonts.css">
    <link rel="stylesheet" href="assets/css/deck.css">
  </head>
  <body>
    <main style="display:grid; place-items:center; min-height:100vh;">
      <h1 style="font-family: var(--font-display); font-weight: 700; font-size: 4rem;">
        Deck stub
      </h1>
    </main>
  </body>
</html>
```

- [ ] **Step 5: Verify in browser**

Open `slides/index.html` in Chrome via `file://` (drag into a tab).
Expected: cream background (`#fbf7f2`), "Deck stub" centered in the Outfit
display font, no console errors (open DevTools → Console).

- [ ] **Step 6: Commit**

```bash
git add slides/
git commit -m "feat: bootstrap slides/ with vendored fonts and ECharts"
```

---

## Task 2: Base slide layout + three placeholder slides

**Files:**
- Create: `slides/assets/css/slide.css`
- Modify: `slides/assets/css/deck.css` (remove the temporary inline body styles by keeping deck.css but adding chrome for the deck)
- Modify: `slides/index.html` (replace the stub main with a `<div id="deck">` containing three `<section class="slide">` elements)

**Interfaces:**
- Produces: three slides stacked vertically that scroll naturally, each
  filling the viewport. Slide numbering appears bottom-right. No JS nav yet.

- [ ] **Step 1: Write `slides/assets/css/slide.css`**

```css
#deck { display: block; }
.slide {
  min-height: 100vh;
  padding: 6vh 8vw;
  display: grid;
  grid-template-rows: auto 1fr;
  row-gap: 2vh;
  border-bottom: 1px solid var(--line);
  position: relative;
}
.slide h1 { font-family: var(--font-display); font-size: 3.5rem; margin: 0; }
.slide h2 { font-family: var(--font-display); font-size: 2.2rem; margin: 0; color: var(--color-blue); }
.slide .body { font-size: 1.4rem; line-height: 1.6; }
.slide .slide-number {
  position: absolute;
  right: 2vw; bottom: 2vh;
  font-family: var(--font-mono);
  font-size: 0.9rem;
  color: var(--muted);
}
.slide.title { text-align: center; place-content: center; grid-template-rows: 1fr; row-gap: 0; }
.slide.title h1 { font-size: 5rem; }
.slide.title .subtitle { color: var(--muted); font-size: 1.6rem; margin-top: 1rem; }
.slide aside.notes { display: none; }
```

- [ ] **Step 2: Update `slides/index.html`**

Add `<link rel="stylesheet" href="assets/css/slide.css">` after `deck.css`.
Replace the `<main>...</main>` with:

```html
<div id="deck">

  <section class="slide title" id="s-01-title">
    <div>
      <h1>OpenADMET PXR Challenge</h1>
      <p class="subtitle">Track 1 Activity — 4th of 95</p>
    </div>
    <div class="slide-number">01</div>
    <aside class="notes">タイトルスライド。挨拶と自己紹介、話す内容の予告。</aside>
  </section>

  <section class="slide" id="s-02-tldr">
    <h2>TL;DR</h2>
    <div class="body">
      <p>PXR pEC50 予測で 4th/95。鍵は multi-fidelity transfer learning。</p>
    </div>
    <div class="slide-number">02</div>
    <aside class="notes">結論を先に。詳細は後続スライドで。</aside>
  </section>

  <section class="slide" id="s-03-challenge">
    <h2>チャレンジ概要</h2>
    <div class="body">
      <p>OpenADMET PXR Induction Challenge — 2026-04-01 → 2026-07-01。</p>
    </div>
    <div class="slide-number">03</div>
    <aside class="notes">課題設定、データ、評価指標を説明。</aside>
  </section>

</div>
```

- [ ] **Step 3: Clean up `deck.css`**

Remove any leftover placeholder styles from Task 1's stub if present. Keep
tokens + the base `html`/`body`/`*` rules only.

- [ ] **Step 4: Verify in browser**

Open `slides/index.html`. Expected:
- Three slides scroll top-to-bottom, each filling the viewport
- Slide 1 is the centered title in Outfit
- Slides 2–3 have a blue `<h2>` and body text
- Bottom-right shows "01" / "02" / "03" in mono
- Presenter notes (`aside.notes`) are not visible
- No console errors

- [ ] **Step 5: Commit**

```bash
git add slides/
git commit -m "feat: add base slide layout and three placeholder slides"
```

---

## Task 3: State machine, keyboard nav, URL sync, fragment reveal

**Files:**
- Create: `slides/assets/js/deck.js`
- Modify: `slides/index.html` (add `<script>` at the end of `<body>`; add `<body data-mode="slide">`; add a hidden `#chrome` for slide counter)
- Modify: `slides/assets/css/slide.css` (only show the active slide when JS is running)

**Interfaces:**
- Produces:
  - `window.Deck` object with:
    - `Deck.state` — `{ index, total, mode, fragmentStep }`
    - `Deck.goto(index, fragmentStep=0)`
    - `Deck.next()`, `Deck.prev()`
    - `Deck.on(event, handler)` — events: `'change'` (fires after any state change)
  - `<body data-mode="slide">` toggled by JS; when JS runs, all slides get
    `display: none` except the active one which gets `display: grid`
  - Fragment elements: `[data-fragment="1"]`, `[data-fragment="2"]`, etc.,
    hidden by default, revealed cumulatively via `.is-visible` class as
    `fragmentStep` advances.
- Consumes: nothing from earlier tasks beyond DOM structure from Task 2.

- [ ] **Step 1: Add the "when JS runs" CSS to `slide.css`**

Append to `slide.css`:

```css
/* JS-driven slide mode: only show the active slide */
body[data-mode="slide"] .slide { display: none; }
body[data-mode="slide"] .slide.is-active { display: grid; }

/* Fragment reveal */
body[data-mode="slide"] [data-fragment] { opacity: 0; transform: translateY(6px); transition: opacity .25s ease, transform .25s ease; pointer-events: none; }
body[data-mode="slide"] [data-fragment].is-visible { opacity: 1; transform: none; pointer-events: auto; }
@media (prefers-reduced-motion: reduce) {
  body[data-mode="slide"] [data-fragment] { transition: none; }
}
```

- [ ] **Step 2: Write `slides/assets/js/deck.js`**

```js
(function () {
  'use strict';

  const deck = document.getElementById('deck');
  const slides = Array.from(deck.querySelectorAll('.slide'));
  const total = slides.length;

  const state = { index: 0, total, mode: 'slide', fragmentStep: 0 };
  const listeners = { change: [] };

  function emit(event) {
    (listeners[event] || []).forEach(function (fn) { fn(state); });
  }

  function on(event, fn) {
    (listeners[event] = listeners[event] || []).push(fn);
  }

  function fragmentsIn(slide) {
    return Array.from(slide.querySelectorAll('[data-fragment]'))
      .sort(function (a, b) {
        return Number(a.dataset.fragment) - Number(b.dataset.fragment);
      });
  }

  function render() {
    slides.forEach(function (s, i) {
      s.classList.toggle('is-active', i === state.index);
    });
    const active = slides[state.index];
    fragmentsIn(active).forEach(function (el) {
      const step = Number(el.dataset.fragment);
      el.classList.toggle('is-visible', step <= state.fragmentStep);
    });
  }

  function syncUrl(replace) {
    const params = new URLSearchParams();
    params.set('s', state.index);
    if (state.fragmentStep) params.set('f', state.fragmentStep);
    const url = location.pathname + '?' + params.toString();
    if (replace) history.replaceState(state, '', url);
    else history.pushState(state, '', url);
  }

  function goto(i, f) {
    const clamped = Math.max(0, Math.min(total - 1, i));
    state.index = clamped;
    state.fragmentStep = f || 0;
    render();
    syncUrl(false);
    emit('change');
  }

  function next() {
    const active = slides[state.index];
    const frags = fragmentsIn(active);
    if (state.fragmentStep < frags.length) {
      state.fragmentStep += 1;
      render();
      syncUrl(false);
      emit('change');
      return;
    }
    if (state.index < total - 1) goto(state.index + 1, 0);
  }

  function prev() {
    if (state.fragmentStep > 0) {
      state.fragmentStep -= 1;
      render();
      syncUrl(false);
      emit('change');
      return;
    }
    if (state.index > 0) {
      const target = slides[state.index - 1];
      goto(state.index - 1, fragmentsIn(target).length);
    }
  }

  function onKey(e) {
    if (e.defaultPrevented) return;
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    switch (e.key) {
      case 'ArrowRight': case ' ': case 'PageDown': case 'n': next(); e.preventDefault(); break;
      case 'ArrowLeft': case 'PageUp': case 'p': prev(); e.preventDefault(); break;
      case 'Home': goto(0, 0); e.preventDefault(); break;
      case 'End': goto(total - 1, 0); e.preventDefault(); break;
      default:
        if (/^[1-9]$/.test(e.key)) {
          const jump = Number(e.key) - 1;
          if (jump < total) { goto(jump, 0); e.preventDefault(); }
        }
    }
  }

  function loadFromUrl() {
    const params = new URLSearchParams(location.search);
    const s = Number(params.get('s')) || 0;
    const f = Number(params.get('f')) || 0;
    state.index = Math.max(0, Math.min(total - 1, s));
    state.fragmentStep = f;
    render();
    syncUrl(true);
    emit('change');
  }

  window.addEventListener('keydown', onKey);
  window.addEventListener('popstate', loadFromUrl);
  document.body.setAttribute('data-mode', 'slide');
  loadFromUrl();

  window.Deck = { state: state, goto: goto, next: next, prev: prev, on: on };
})();
```

- [ ] **Step 3: Wire the script into `index.html`**

Just before `</body>`, add:

```html
<script src="assets/js/deck.js"></script>
```

Add one fragment element to slide 2 for testing. Inside the `.body` of
`#s-02-tldr`, add:

```html
<p data-fragment="1">Ensemble は 9-member Caruana ＋ TabPFN 読み出し。</p>
```

- [ ] **Step 4: Verify in browser**

Open `slides/index.html`. Expected:
- Only the first slide is visible on load
- `→` / Space advances; slide 2 first reveals the fragment, then next key
  advances to slide 3
- `←` reverses the same way
- URL updates to `?s=1&f=1` etc.
- Reload the page while on slide 3 — you land on slide 3
- Browser back/forward buttons move between visited slides
- Type `1`/`2`/`3` to jump
- No console errors

- [ ] **Step 5: Commit**

```bash
git add slides/
git commit -m "feat: add slide state machine, keyboard nav, and fragment reveal"
```

---

## Task 4: Overview mode (thumbnail grid)

**Files:**
- Create: `slides/assets/js/overview.js`
- Modify: `slides/assets/css/slide.css` (overview-mode grid styles)
- Modify: `slides/index.html` (add `overview.js` `<script>` after `deck.js`)

**Interfaces:**
- Produces: `Esc` / `o` toggles `body[data-mode]` between `"slide"` and
  `"overview"`. In overview, every slide renders scaled down in a grid;
  clicking a thumbnail returns to slide mode on that slide. Number keys
  `1`–`9` still work in overview.
- Consumes: `window.Deck.goto(i)` and `Deck.state.index` from Task 3.

- [ ] **Step 1: Add overview CSS to `slide.css`**

Append:

```css
body[data-mode="overview"] { overflow: auto; }
body[data-mode="overview"] #deck {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 24px;
  padding: 32px;
}
body[data-mode="overview"] .slide {
  min-height: 0;
  aspect-ratio: 16 / 9;
  padding: 3vh 4vw;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--surface);
  cursor: pointer;
  transform-origin: top left;
  overflow: hidden;
  display: grid; /* override the JS-driven display:none */
}
body[data-mode="overview"] .slide.is-active {
  outline: 3px solid var(--color-blue);
  outline-offset: 2px;
}
body[data-mode="overview"] .slide h1 { font-size: 1.4rem; }
body[data-mode="overview"] .slide h2 { font-size: 1rem; }
body[data-mode="overview"] .slide .body { font-size: 0.7rem; }
body[data-mode="overview"] .slide .slide-number { font-size: 0.7rem; }
```

- [ ] **Step 2: Write `slides/assets/js/overview.js`**

```js
(function () {
  'use strict';

  function setMode(mode) {
    document.body.setAttribute('data-mode', mode);
    if (window.Deck && window.Deck.state) window.Deck.state.mode = mode;
  }

  function toggle() {
    const current = document.body.getAttribute('data-mode');
    setMode(current === 'overview' ? 'slide' : 'overview');
  }

  window.addEventListener('keydown', function (e) {
    if (e.defaultPrevented) return;
    if (e.key === 'Escape' || e.key === 'o') { toggle(); e.preventDefault(); }
  });

  document.getElementById('deck').addEventListener('click', function (e) {
    if (document.body.getAttribute('data-mode') !== 'overview') return;
    const slide = e.target.closest('.slide');
    if (!slide) return;
    const slides = Array.from(document.querySelectorAll('#deck .slide'));
    const i = slides.indexOf(slide);
    if (i >= 0) { setMode('slide'); window.Deck.goto(i, 0); }
  });
})();
```

- [ ] **Step 3: Wire the script into `index.html`**

Add after `deck.js`:

```html
<script src="assets/js/overview.js"></script>
```

- [ ] **Step 4: Verify in browser**

Open the deck. Expected:
- Press `Esc` — all three slides appear as thumbnails in a grid
- Active slide has a blue outline
- Click a thumbnail — return to slide mode on that slide
- Press `Esc` again from slide mode — back to overview
- Number keys still jump directly
- No console errors

- [ ] **Step 5: Commit**

```bash
git add slides/
git commit -m "feat: add overview mode with thumbnail grid"
```

---

## Task 5: Chart module registry, ECharts theme, first real chart

**Files:**
- Create: `slides/assets/js/echarts-theme.js`
- Create: `slides/assets/js/charts/results.js`
- Create: `slides/assets/data/results.js`
- Modify: `slides/assets/js/deck.js` (call `mountCharts()` after `loadFromUrl` and re-fire `onEnter`/`onLeave` on slide change)
- Modify: `slides/index.html` (load `echarts.min.js`, `echarts-theme.js`, `charts/results.js`, `data/results.js`; replace slide 4 body with a chart placeholder)

**Interfaces:**
- Produces:
  - `window.DeckCharts` — registry of chart modules, each with a
    `init(el, data) → { chart, resize, dispose, onEnter, onLeave }`
    method. First entry: `DeckCharts.results`.
  - `window.DeckData` — registry of chart data. First entry:
    `DeckData.results` (the Phase 1 / Phase 2 comparison numbers from
    `MODEL_REPORT.md` §2).
  - `window.DeckTheme.get()` — returns an ECharts theme object populated
    from CSS custom properties on `:root`.
  - A new slide (#4) that shows a real ECharts bar chart of Phase 1 vs
    Phase 2 MAE / R² / Spearman ρ.
- Consumes: `window.Deck.on('change', fn)` from Task 3, `window.echarts`
  from vendor.

- [ ] **Step 1: Write `slides/assets/js/echarts-theme.js`**

```js
(function () {
  'use strict';
  function css(prop) {
    return getComputedStyle(document.documentElement).getPropertyValue(prop).trim();
  }
  function get() {
    return {
      color: [css('--color-blue'), css('--color-teal'), css('--color-coral'), css('--color-peach')],
      backgroundColor: 'transparent',
      textStyle: {
        color: css('--color-ink'),
        fontFamily: css('--font-body').replace(/"/g, '') || 'sans-serif',
      },
      title: { textStyle: { color: css('--color-ink'), fontFamily: css('--font-display') } },
      axisPointer: { lineStyle: { color: css('--color-line') } },
      splitLine: { lineStyle: { color: css('--color-line') } },
    };
  }
  window.DeckTheme = { get: get };
})();
```

- [ ] **Step 2: Write `slides/assets/data/results.js`**

Numbers copied from `MODEL_REPORT.md` §2 (do not invent).

```js
(function () {
  'use strict';
  window.DeckData = window.DeckData || {};
  window.DeckData.results = {
    metrics: ['MAE', 'RAE', 'R²', 'Spearman ρ', 'Kendall τ'],
    phase1:  [0.4059, 0.5359, 0.6496, 0.8343, 0.6459],
    phase2:  [0.4113, 0.5703, 0.6008, 0.8161, 0.6225],
  };
})();
```

- [ ] **Step 3: Write `slides/assets/js/charts/results.js`**

```js
(function () {
  'use strict';
  window.DeckCharts = window.DeckCharts || {};
  window.DeckCharts.results = {
    init: function (el, data) {
      const theme = window.DeckTheme.get();
      window.echarts.registerTheme('deck', theme);
      const chart = window.echarts.init(el, 'deck', { renderer: 'svg' });
      chart.setOption({
        grid: { left: 60, right: 20, top: 40, bottom: 40 },
        legend: { data: ['Phase 1', 'Phase 2'], top: 0 },
        xAxis: { type: 'category', data: data.metrics },
        yAxis: { type: 'value' },
        series: [
          { name: 'Phase 1', type: 'bar', data: data.phase1 },
          { name: 'Phase 2', type: 'bar', data: data.phase2 },
        ],
      });
      return {
        chart: chart,
        resize: function () { chart.resize(); },
        dispose: function () { chart.dispose(); },
        onEnter: function () { chart.resize(); },
        onLeave: function () {},
      };
    },
  };
})();
```

- [ ] **Step 4: Add chart mounting to `deck.js`**

At the end of the IIFE in `deck.js`, **before** `window.Deck = { ... };`,
insert:

```js
const chartHandles = new Map(); // el → handle

function mountCharts() {
  const nodes = document.querySelectorAll('.chart');
  nodes.forEach(function (el) {
    const name = el.dataset.chart;
    const key = el.dataset.src;
    const mod = window.DeckCharts && window.DeckCharts[name];
    const data = window.DeckData && window.DeckData[key];
    if (!mod || !data) return;
    const handle = mod.init(el, data);
    chartHandles.set(el, handle);
    if (window.ResizeObserver) {
      new ResizeObserver(function () { handle.resize(); }).observe(el);
    }
  });
}

function fireLifecycle() {
  const activeSlide = slides[state.index];
  chartHandles.forEach(function (handle, el) {
    if (activeSlide.contains(el)) handle.onEnter();
    else handle.onLeave();
  });
}

// Hook into state changes
on('change', fireLifecycle);
mountCharts();
fireLifecycle();
```

- [ ] **Step 5: Update `index.html`**

Before `deck.js`, add:

```html
<script src="assets/vendor/echarts.min.js"></script>
<script src="assets/js/echarts-theme.js"></script>
<script src="assets/js/charts/results.js"></script>
<script src="assets/data/results.js"></script>
```

Add a fourth slide with a chart:

```html
<section class="slide" id="s-04-results">
  <h2>最終結果</h2>
  <div class="body">
    <div class="chart" data-chart="results" data-src="results" style="width:100%; height:60vh;"></div>
  </div>
  <div class="slide-number">04</div>
  <aside class="notes">Phase 1 と Phase 2 の比較。テストスライスが違う点だけ補足。</aside>
</section>
```

- [ ] **Step 6: Verify in browser**

Open the deck. Expected:
- Navigate to slide 4 with `→` or `4`
- ECharts bar chart renders using the report's blue/teal palette
- Resize the browser window — chart resizes
- Return to slide 4 later — chart re-fires `onEnter` (resizes cleanly)
- Overview mode still works; slide 4 thumbnail shows a mini chart
- No console errors

- [ ] **Step 7: Commit**

```bash
git add slides/
git commit -m "feat: add chart module registry, ECharts theme, and results chart"
```

---

## Task 6: Presenter notes window with cross-window sync

**Files:**
- Create: `slides/presenter.html`
- Create: `slides/assets/js/notes.js`
- Modify: `slides/index.html` (add `notes.js` `<script>`; add `'t'` key handler through it)

**Interfaces:**
- Produces:
  - `presenter.html` renders "current slide preview | next slide preview /
    current notes" and stays in sync with the main deck.
  - `t` key on the main deck opens `presenter.html` in a new window.
  - `notes.js` runs in **both** windows. In the main deck window it acts
    as a sender; in the presenter window it acts as a receiver. Detection:
    if `document.getElementById('presenter-root')` exists, receiver mode.
  - Sync channel: `BroadcastChannel('deck')` primary; `localStorage`
    `'deck-sync'` key with a `storage` event listener as fallback (used
    automatically if `BroadcastChannel` throws or is undefined).
- Consumes: `window.Deck.on('change')` and `window.Deck.state` from Task 3
  (sender side only).

- [ ] **Step 1: Write `slides/assets/js/notes.js`**

```js
(function () {
  'use strict';

  const channelName = 'deck';
  const storageKey = 'deck-sync';
  const bc = (function () { try { return new BroadcastChannel(channelName); } catch (e) { return null; } })();

  function post(msg) {
    if (bc) bc.postMessage(msg);
    else localStorage.setItem(storageKey, JSON.stringify({ msg: msg, t: Date.now() }));
  }
  function subscribe(handler) {
    if (bc) bc.onmessage = function (e) { handler(e.data); };
    else window.addEventListener('storage', function (e) {
      if (e.key !== storageKey || !e.newValue) return;
      try { handler(JSON.parse(e.newValue).msg); } catch (_) {}
    });
  }

  const receiverRoot = document.getElementById('presenter-root');
  if (receiverRoot) {
    // Receiver: presenter.html
    const currentEl = document.getElementById('presenter-current');
    const nextEl = document.getElementById('presenter-next');
    const notesEl = document.getElementById('presenter-notes');
    subscribe(function (msg) {
      if (msg && msg.type === 'state') render(msg);
    });
    function render(msg) {
      currentEl.textContent = 'Slide ' + (msg.index + 1) + ' / ' + msg.total;
      nextEl.textContent = msg.index + 1 < msg.total ? 'Next: Slide ' + (msg.index + 2) : '(end)';
      notesEl.textContent = msg.notes || '(no notes)';
    }
    post({ type: 'hello' });
  } else if (window.Deck) {
    // Sender: main deck
    function currentNotes() {
      const slides = document.querySelectorAll('#deck .slide');
      const s = slides[window.Deck.state.index];
      const aside = s && s.querySelector('aside.notes');
      return aside ? aside.textContent.trim() : '';
    }
    function broadcast() {
      post({
        type: 'state',
        index: window.Deck.state.index,
        total: window.Deck.state.total,
        fragmentStep: window.Deck.state.fragmentStep,
        notes: currentNotes(),
      });
    }
    window.Deck.on('change', broadcast);
    subscribe(function (msg) { if (msg && msg.type === 'hello') broadcast(); });
    window.addEventListener('keydown', function (e) {
      if (e.key === 't' && !e.defaultPrevented) {
        window.open('presenter.html', 'deck-presenter', 'width=900,height=700');
        e.preventDefault();
      }
    });
    // fire once at startup so an already-open presenter catches up
    broadcast();
  }
})();
```

- [ ] **Step 2: Write `slides/presenter.html`**

```html
<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8">
    <title>Presenter — PXR Deck</title>
    <link rel="stylesheet" href="assets/fonts.css">
    <link rel="stylesheet" href="assets/css/deck.css">
    <style>
      body { margin: 0; padding: 16px; display: grid; grid-template-rows: 1fr auto; gap: 16px; height: 100vh; }
      .row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
      .panel { border: 1px solid var(--line); border-radius: 8px; padding: 16px; background: var(--surface); }
      #presenter-notes { white-space: pre-wrap; font-family: var(--font-body); font-size: 1.1rem; line-height: 1.6; min-height: 6em; }
      h2 { margin: 0 0 8px; font-family: var(--font-display); font-size: 1rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; }
    </style>
  </head>
  <body>
    <div id="presenter-root" class="row">
      <div class="panel"><h2>Current</h2><div id="presenter-current">—</div></div>
      <div class="panel"><h2>Next</h2><div id="presenter-next">—</div></div>
    </div>
    <div class="panel"><h2>Notes</h2><div id="presenter-notes">—</div></div>
    <script src="assets/js/notes.js"></script>
  </body>
</html>
```

- [ ] **Step 3: Wire `notes.js` into main deck**

In `index.html`, after `overview.js`, add:

```html
<script src="assets/js/notes.js"></script>
```

- [ ] **Step 4: Verify in browser**

Open `slides/index.html`. Press `t` — a new window opens with
`presenter.html`. Expected:
- Presenter window shows "Slide 1 / 4", next slide label, and slide 1's
  notes text
- Navigate in the main deck with `→` — presenter window updates
- Close the presenter window; reopen with `t` — still syncs
- Check console in both windows for errors — should be clean

If `BroadcastChannel` fails silently under `file://`, the fallback path
uses `localStorage`; both windows must be same-origin same-file location
for that to work. Confirm by opening from the same `file://` path in both.

- [ ] **Step 5: Commit**

```bash
git add slides/
git commit -m "feat: add presenter notes window with BroadcastChannel sync"
```

---

## Task 7: Print / PDF CSS

**Files:**
- Create: `slides/assets/css/print.css`
- Modify: `slides/index.html` (link `print.css` with `media="print"`)

**Interfaces:**
- Produces: browser "Print → Save as PDF" produces one slide per page.
  Presenter notes and slide numbers hidden in print output.
- Consumes: DOM structure only.

- [ ] **Step 1: Write `slides/assets/css/print.css`**

```css
@page { size: 297mm 167mm; margin: 0; } /* 16:9 landscape */
@media print {
  html, body { background: white; }
  body[data-mode="slide"] .slide,
  body[data-mode="overview"] .slide {
    display: grid !important;
    page-break-after: always;
    break-after: page;
    min-height: 167mm;
    height: 167mm;
    width: 297mm;
    border: none;
    outline: none;
    aspect-ratio: auto;
  }
  body[data-mode="overview"] #deck {
    display: block !important;
    padding: 0 !important;
    gap: 0 !important;
  }
  .slide-number { display: block !important; }
  aside.notes { display: none !important; }
  body[data-mode="slide"] [data-fragment] { opacity: 1 !important; transform: none !important; }
}
```

- [ ] **Step 2: Link the stylesheet in `index.html`**

After `slide.css`:

```html
<link rel="stylesheet" href="assets/css/print.css" media="print">
```

- [ ] **Step 3: Verify**

In Chrome/Firefox, `Ctrl+P` (or `Cmd+P`) → destination "Save as PDF" →
Layout: Landscape → Margins: None. Expected: 4-page PDF, one slide per
page, no presenter notes, chart on slide 4 renders as SVG.

- [ ] **Step 4: Commit**

```bash
git add slides/
git commit -m "feat: add print stylesheet for PDF backup"
```

---

## Task 8: Draft content outline from `MODEL_REPORT.md`

**Files:**
- Create: `slides/OUTLINE.md`

**Interfaces:**
- Produces: a working outline document listing each planned slide with
  title, 3–5 bullet talking points, chart/figure hint, and draft presenter
  notes. This is the working artifact for the content-iteration phase.
- Consumes: `MODEL_REPORT.md` for content.

- [ ] **Step 1: Read `MODEL_REPORT.md` end-to-end**

- [ ] **Step 2: Draft the outline**

Write `slides/OUTLINE.md`. Use this template per slide:

```markdown
### Slide N: <title>

- Bullet 1
- Bullet 2
- Bullet 3

**Chart/figure**: <hint, or "none">

**Presenter notes** (draft): <2–4 sentences>
```

Target 17–22 slides matching the provisional TOC in the spec §Content
flow. Numbers must come from the report, not invention. Where a slide
needs new chart data not present under `docs/assets/data/`, note it as
`**Chart/figure**: NEW — needs data plan`.

- [ ] **Step 3: Commit**

```bash
git add slides/OUTLINE.md
git commit -m "docs: draft slides outline from MODEL_REPORT"
```

- [ ] **Step 4: Hand back for review**

Stop here. Do not start building content slides. Ask the user to review
`OUTLINE.md`; iterate on it in-conversation before starting Task 9.

---

## Task 9: Content build (iterative, jointly authored)

This task is the second half of the project — building the real slides
from the approved outline. It is deliberately not decomposed into
sub-steps here: content decisions are made in conversation, one section at
a time, and each pass may need new chart data, new figures, and rewording.

**Working loop for each outlined section**:

1. Pull the section's bullets and notes from `OUTLINE.md`
2. Draft the `<section class="slide">` markup in `index.html`
3. If a chart is needed:
   - Add a new `assets/data/<key>.js` with source-cited numbers
   - Add a new `assets/js/charts/<name>.js` module (follow the Task 5
     pattern)
   - Wire the new `<script>` tags into `index.html`
4. Preview in browser, refine text, add fragment reveals where useful
5. Commit each cohesive slide (or small group) with a message like
   `feat(slides): write challenge overview section`

**Definition of done for the whole project**:

- Deck opens from a fresh clone via `file://` and shows the full talk
- All planned slides land, dry-run through the deck completes cleanly
- Presenter window and overview mode still work
- `git push -u origin feature/slides-deck && gh pr create` — PR opened for
  merge into `main`

## Self-Review notes

Coverage against the spec:

- File layout — Task 1 sets up the tree; Task 7 adds `print.css` (all
  files from spec §Directory layout are created)
- State model — Task 3 (all four fields, all keyboard bindings including
  Home/End/1–9)
- Fragment reveals — Task 3
- Overview mode — Task 4 (same DOM, CSS grid, no re-init)
- Presenter notes — Task 6 (BroadcastChannel with storage fallback)
- Chart integration — Task 5 (SVG renderer, module registry, theme from
  CSS vars, `ResizeObserver`)
- Content flow — Task 8 (outline) then Task 9 (iterative build)
- Success criteria — Task 9 completion checklist

Constraints deliberately narrower than the spec (documented here so a
reviewer isn't surprised):

- `'.'` (blackout) key: spec listed it; deferred to Task 9 or later — not
  critical for a first working deck. If needed, add a single-line handler
  in `deck.js` that toggles a `.is-blackout` class.
- Dark-mode overrides: spec inherits report tokens including dark mode,
  but the presentation itself is light-mode. Not implemented; can be
  added by copying the `:root[data-theme="dark"]` block from
  `docs/assets/css/style.css` if it turns out to matter.
- Slide transition animation: Task 3 only implements fragment fade; whole-
  slide fade/slide transitions can be added in `deck.css` if desired
  during Task 9 polishing.
