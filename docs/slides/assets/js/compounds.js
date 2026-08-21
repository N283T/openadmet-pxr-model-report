(function () {
  'use strict';

  // The compound grid. Structures are pre-drawn into assets/data/compounds.js,
  // so this only lays them out, switches tabs, and pages the long one.
  // Deliberately not a DeckChart: there is no ECharts here, just markup.

  const state = new Map(); // tab key → page index

  function cell(item) {
    const label = item.unnamed
      ? '<span class="compound__name compound__name--id">' + item.name + '</span>'
      : '<span class="compound__name">' + item.name + '</span>';
    const note = item.note
      ? '<span class="compound__note">' + item.note + '</span>'
      : '';
    const role = item.role ? ' compound--' + item.role : '';
    return (
      '<figure class="compound' + role + '">' +
      '<div class="compound__structure">' + item.svg + '</div>' +
      '<figcaption class="compound__caption">' +
      label + note +
      '<span class="compound__meta">pEC50 <b>' + item.pec50.toFixed(2) + '</b>' +
      (item.tag
        ? '<i class="compound__tag">' + item.tag + '</i>'
        : '<i>' + item.mw + ' Da</i>') +
      '</span>' +
      '</figcaption>' +
      // Points at the boxed analog directly below it in the same column.
      (item.role === 'train' ? '<span class="compound__arrow">↓</span>' : '') +
      '</figure>'
    );
  }

  function render(slide, tab) {
    const page = state.get(tab.key) || 0;
    const items = tab.pages[page];

    const grid = slide.querySelector('[data-compound-grid]');
    // Eight fit comfortably four across; a page of twelve needs six, so the
    // cells stay the same height either way.
    grid.style.setProperty('--cols', items.length > 8 ? 6 : 4);
    grid.innerHTML = items.map(cell).join('');

    slide.querySelector('[data-compound-caption]').innerHTML = tab.caption;

    const pager = slide.querySelector('[data-compound-pager]');
    if (tab.pages.length > 1) {
      pager.hidden = false;
      pager.querySelector('[data-page-label]').textContent =
        page + 1 + ' / ' + tab.pages.length;
    } else {
      pager.hidden = true;
    }
  }

  function activate(slide, data, key) {
    const tab = data.tabs.find(function (t) { return t.key === key; });
    if (!tab) return;
    slide.querySelectorAll('.compound-tab').forEach(function (button) {
      const on = button.dataset.tab === key;
      button.classList.toggle('is-active', on);
      button.setAttribute('aria-selected', on ? 'true' : 'false');
      button.tabIndex = on ? 0 : -1;
    });
    slide.dataset.compoundTab = key;
    render(slide, tab);
  }

  function init() {
    const data = window.DeckData && window.DeckData.compounds;
    if (!data) return;

    // The structures reference shared classes rather than repeating their own
    // styles; this is where those land. Once, for the whole document.
    if (data.css) {
      const sheet = document.createElement('style');
      sheet.textContent = data.css;
      document.head.appendChild(sheet);
    }

    document.querySelectorAll('[data-compound-grid]').forEach(function (grid) {
      const slide = grid.closest('.slide');

      slide.querySelector('.compound-tabs').addEventListener('click', function (event) {
        const button = event.target.closest('.compound-tab');
        if (button) activate(slide, data, button.dataset.tab);
      });

      slide.querySelector('[data-compound-pager]').addEventListener('click', function (event) {
        const button = event.target.closest('[data-page-step]');
        if (!button) return;
        const key = slide.dataset.compoundTab;
        const tab = data.tabs.find(function (t) { return t.key === key; });
        const next = (state.get(key) || 0) + Number(button.dataset.pageStep);
        // Wraps, so a presenter can keep clicking one button through all four.
        state.set(key, (next + tab.pages.length) % tab.pages.length);
        render(slide, tab);
      });

      activate(slide, data, data.tabs[0].key);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
