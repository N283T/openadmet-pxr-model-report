(function () {
  'use strict';

  const deck = document.getElementById('deck');
  if (!deck || !window.Deck) return;

  const REPORT_HREF = '../ja/';

  function toReport() {
    location.href = REPORT_HREF;
  }

  // ---- Back to the report ------------------------------------------------
  // Published under the report rather than run from a laptop, so leaving the
  // deck has to be one of the things the title slide offers, alongside the
  // controls for starting a talk.
  const actions = document.querySelector('.slide.title .title-actions');
  if (actions) {
    const link = document.createElement('a');
    link.id = 'deck-report';
    link.href = REPORT_HREF;
    link.textContent = 'Report';
    actions.appendChild(link);
  }

  // Escape leaves for the report. lightbox.js takes Escape in the capture
  // phase while a figure is open, so the first press still closes the figure.
  window.addEventListener('keydown', function (e) {
    if (e.defaultPrevented || e.key !== 'Escape') return;
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    e.preventDefault();
    toReport();
  });

  // ---- The key map on the title slide ------------------------------------
  // A reader arriving from the report did not come to present and has no way
  // to know the deck answers keys at all.
  const KEYS = [
    [['→', 'Space'], '次へ', 'or'],
    [['←'], '戻る'],
    [['1'], '最初へ'],
    [['2'], '最後へ'],
    [['F'], '全画面'],
    [['T'], 'Presenter'],
    [['Esc'], 'レポートへ'],
  ];

  if (actions) {
    const map = document.createElement('div');
    map.className = 'title-keys';
    map.setAttribute('data-overflow-ignore', '');

    KEYS.forEach(function (entry) {
      const caps = entry[0];
      const row = document.createElement('span');
      caps.forEach(function (cap, i) {
        if (i > 0 && entry[2]) {
          const sep = document.createElement('span');
          sep.className = 'sep';
          sep.textContent = entry[2];
          row.appendChild(sep);
        }
        const kbd = document.createElement('kbd');
        kbd.textContent = cap;
        row.appendChild(kbd);
      });
      row.appendChild(document.createTextNode(entry[1]));
      map.appendChild(row);
    });

    actions.insertAdjacentElement('afterend', map);

    // The edge bands are invisible until hovered, so nothing about the page
    // says they are there.
    const hint = document.createElement('p');
    hint.className = 'title-hint';
    hint.setAttribute('data-overflow-ignore', '');
    hint.textContent = '画面の左右端をクリックしてもページを送れます';
    map.insertAdjacentElement('afterend', hint);
  }

  // ---- Click the edges to page through -----------------------------------

  // The bundled faces are subset from the deck's own text, so an arrow written
  // as a character would fall through to whatever the system has. Drawn instead.
  function icon(paths) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '1.9');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML = paths;
    return svg;
  }

  // Bands down either edge, the way a slide host does it. A button rather than
  // a bare div so it takes focus and answers Enter on its own.
  function band(kind, paths, label) {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'site-nav site-nav--' + kind;
    el.setAttribute('aria-label', label);
    el.appendChild(icon(paths));
    document.body.appendChild(el);
    return el;
  }

  const prevBand = band('prev', '<polyline points="15 5 8 12 15 19"/>', '前のスライド');
  const nextBand = band('next', '<polyline points="9 5 16 12 9 19"/>', '次のスライド');

  prevBand.addEventListener('click', function () { window.Deck.prev(); });
  nextBand.addEventListener('click', function () { window.Deck.next(); });

  // Nothing that way to go, at either end. Read off the deck's own state so a
  // jump from the URL updates them too.
  function syncEnds() {
    const state = window.Deck.state;
    prevBand.disabled = state.index === 0 && state.fragmentStep === 0;
    nextBand.disabled = state.index === state.total - 1;
  }

  window.Deck.on('change', syncEnds);
  syncEnds();
})();
