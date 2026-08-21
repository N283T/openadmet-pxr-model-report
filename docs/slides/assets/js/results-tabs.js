(function () {
  'use strict';

  // Two independent controls on the results slide: tabs that swap the scored
  // round, and buttons that pick which metric the histogram draws. They are
  // separate because they answer different questions — which race, and which
  // measure of it — and because the round changes the whole panel while the
  // metric only redraws a chart.

  function activateRound(slide, key) {
    slide.querySelectorAll('.round-tab').forEach(function (tab) {
      const on = tab.dataset.round === key;
      tab.classList.toggle('is-active', on);
      tab.setAttribute('aria-selected', on ? 'true' : 'false');
      tab.tabIndex = on ? 0 : -1;
    });
    slide.querySelectorAll('.round-panel').forEach(function (panel) {
      panel.classList.toggle('is-active', panel.dataset.round === key);
    });
    // A chart laid out while its panel was hidden has zero width. deck.js
    // observes size changes, but the observer does not fire for
    // display:none → block on every engine.
    window.dispatchEvent(new Event('resize'));
  }

  // Where we placed in the metric on screen. The board ranks on MAE alone, so
  // for the other three this is the only place the standing appears. It sits in
  // the button row rather than inside the chart, which kept it at a fixed spot
  // no matter which bin happened to be ours.
  function writeStanding(panel, key) {
    const slot = panel.querySelector('[data-standing]');
    const data = window.DeckData && window.DeckData.results;
    if (!slot || !data) return;
    const metric = (data[panel.dataset.round] || {}).metrics[key];
    if (!metric) return;
    slot.innerHTML =
      '<strong>' + metric.rank + '位</strong> / ' + metric.of +
      (metric.offScale
        ? '<span class="results-standing__off">軸外 ' + metric.offScale + '</span>'
        : '');
  }

  function activateMetric(panel, key) {
    panel.querySelectorAll('.metric-pick').forEach(function (button) {
      const on = button.dataset.pick === key;
      button.classList.toggle('is-active', on);
      button.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    panel.querySelectorAll('[data-chart="results"]').forEach(function (el) {
      el.dispatchEvent(new CustomEvent('results:metric', { detail: key }));
    });
    writeStanding(panel, key);
  }

  function init() {
    document.querySelectorAll('.round-tabs').forEach(function (list) {
      const slide = list.closest('.slide');
      list.addEventListener('click', function (event) {
        const tab = event.target.closest('.round-tab');
        if (tab) activateRound(slide, tab.dataset.round);
      });
      list.addEventListener('keydown', function (event) {
        const tabs = Array.from(list.querySelectorAll('.round-tab'));
        const current = tabs.findIndex(function (t) { return t.classList.contains('is-active'); });
        let next = null;
        if (event.key === 'ArrowRight') next = (current + 1) % tabs.length;
        if (event.key === 'ArrowLeft') next = (current - 1 + tabs.length) % tabs.length;
        if (next === null) return;
        // Deck navigation also listens for arrows; this one is ours.
        event.stopPropagation();
        event.preventDefault();
        activateRound(slide, tabs[next].dataset.round);
        tabs[next].focus();
      });
    });

    document.querySelectorAll('.metric-picks').forEach(function (group) {
      const panel = group.closest('.round-panel');
      group.addEventListener('click', function (event) {
        const button = event.target.closest('.metric-pick');
        if (button) activateMetric(panel, button.dataset.pick);
      });
      const start = group.querySelector('.metric-pick.is-active');
      if (start) writeStanding(panel, start.dataset.pick);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
