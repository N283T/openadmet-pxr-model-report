(function () {
  'use strict';

  // Property buttons on the EDA slide. Same shape as the metric buttons on the
  // results slide, but that module is scoped to a round panel and this slide
  // has no rounds, so the two stay apart rather than growing a shared
  // abstraction over two callers.

  // Naming the pair in words pushed the row onto two lines for the wider
  // properties, so the colours carry it alone. The slash stays: it keeps the
  // two readings from running together for anyone not going by colour.
  function pair(trainValue, testValue) {
    return (
      '<span class="eda-readout__train">' + trainValue + '</span>' +
      '<span class="eda-readout__slash">/</span>' +
      '<span class="eda-readout__test">' + testValue + '</span>'
    );
  }

  function writeReadout(slide, key) {
    const slot = slide.querySelector('[data-eda-readout]');
    const data = window.DeckData && window.DeckData.eda;
    if (!slot || !data) return;
    const p = data.properties[key];
    if (!p) return;
    // These are the same two numbers the bars carry, so the test half follows
    // the chart's own reveal — test pEC50 is knowledge from after the answers
    // were released, and the slide should not open holding it.
    const chartEl = slide.querySelector('[data-chart="eda"]');
    const hidden = chartEl && chartEl.dataset.edaTest === 'off';
    const test = function (value) { return hidden ? '—' : value; };
    // The medians arrive at three decimals, which is more precision than the
    // property carries; reuse the axis's own rounding.
    const round = function (v) { return v.toFixed(p.places); };
    const parts = [
      '<span class="eda-readout__label">中央値</span>' + pair(round(p.train.median), test(round(p.test.median))),
    ];
    if (p.line) {
      parts.push(
        '<span class="eda-readout__label">' + p.line.label + '</span>' +
          pair(p.line.trainShare + '%', test(p.line.testShare + '%'))
      );
    }
    slot.innerHTML = parts.join('');
  }

  function activate(slide, key) {
    slide.querySelectorAll('.eda-pick').forEach(function (button) {
      const on = button.dataset.pick === key;
      button.classList.toggle('is-active', on);
      button.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    slide.querySelectorAll('[data-chart="eda"]').forEach(function (el) {
      el.dispatchEvent(new CustomEvent('eda:property', { detail: key }));
    });
    writeReadout(slide, key);
  }

  function init() {
    document.querySelectorAll('.eda-picks').forEach(function (group) {
      const slide = group.closest('.slide');
      group.addEventListener('click', function (event) {
        const button = event.target.closest('.eda-pick');
        if (button) activate(slide, button.dataset.pick);
      });
      const start = group.querySelector('.eda-pick.is-active');
      if (start) writeReadout(slide, start.dataset.pick);
      // Clicking the chart's legend reveals the test bars; the numbers beside
      // the buttons have to arrive at the same moment.
      slide.addEventListener('eda:test', function () {
        const active = group.querySelector('.eda-pick.is-active');
        if (active) writeReadout(slide, active.dataset.pick);
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
