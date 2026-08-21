(function () {
  'use strict';

  // Tabs on the metrics slide. Panels stay in the DOM and are toggled with a
  // class rather than rebuilt, so the chart inside keeps its state — a
  // prediction the presenter dragged is still where they left it when they
  // come back to the tab.
  function activate(slide, name) {
    slide.querySelectorAll('.metric-tab').forEach(function (tab) {
      const on = tab.dataset.metric === name;
      tab.classList.toggle('is-active', on);
      tab.setAttribute('aria-selected', on ? 'true' : 'false');
      tab.tabIndex = on ? 0 : -1;
    });
    slide.querySelectorAll('.metric-panel').forEach(function (panel) {
      panel.classList.toggle('is-active', panel.dataset.panel === name);
    });
    // A chart laid out while its panel was hidden has zero width; nudge it
    // once the panel is visible. deck.js observes size changes, but the
    // observer does not fire for display:none → block on every engine.
    window.dispatchEvent(new Event('resize'));
  }

  function init() {
    document.querySelectorAll('.metric-tabs').forEach(function (list) {
      const slide = list.closest('.slide');
      list.addEventListener('click', function (event) {
        const tab = event.target.closest('.metric-tab');
        if (tab) activate(slide, tab.dataset.metric);
      });
      list.addEventListener('keydown', function (event) {
        const tabs = Array.from(list.querySelectorAll('.metric-tab'));
        const current = tabs.findIndex(function (t) { return t.classList.contains('is-active'); });
        let next = null;
        if (event.key === 'ArrowRight') next = (current + 1) % tabs.length;
        if (event.key === 'ArrowLeft') next = (current - 1 + tabs.length) % tabs.length;
        if (next === null) return;
        // Deck navigation also listens for arrows; this one is ours.
        event.stopPropagation();
        event.preventDefault();
        activate(slide, tabs[next].dataset.metric);
        tabs[next].focus();
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
