(function () {
  'use strict';

  // Raw against calibrated, from assets/data/calib-fit.js so the table and the
  // figure beside it read the same run. Markup rather than a DeckChart: five
  // rows of two numbers is a table, and a bar chart of three different scales
  // needed normalising before it could even be drawn.
  //
  // Spearman is in the table on purpose. It is identical either side — a
  // positive-slope affine cannot reorder anything — and seeing the same number
  // twice makes that point better than a sentence does.

  const ROWS = ['MAE', 'RAE', 'R2'];

  function cell(value, strong) {
    return '<td class="calib-tbl__num' + (strong ? ' calib-tbl__num--win' : '') +
      '"><span class="mono">' + value + '</span></td>';
  }

  function build(data) {
    const byKey = {};
    data.metrics.forEach(function (m) { byKey[m.key] = m; });

    const out = [
      '<thead><tr>' +
      '<th class="calib-tbl__head calib-tbl__head--metric">metric</th>' +
      '<th class="calib-tbl__head">ens のみ</th>' +
      '<th class="calib-tbl__head calib-tbl__head--win">+ Calibration</th>' +
      '</tr></thead><tbody>',
    ];

    ROWS.forEach(function (key) {
      const m = byKey[key];
      if (!m) return;
      out.push(
        '<tr><th scope="row">' + key + '</th>' +
        cell(m.raw.toFixed(3), false) + cell(m.cal.toFixed(3), true) + '</tr>'
      );
    });

    const rho = data.spearman.toFixed(3);
    out.push(
      '<tr class="calib-tbl__same"><th scope="row">Spearman</th>' +
      cell(rho, false) + cell(rho, false) +
      '</tr>'
    );
    out.push(
      '<tr><th scope="row">bias</th>' +
      cell(data.bias.raw.toFixed(3), false) +
      cell(data.bias.cal.toFixed(3), true) + '</tr>'
    );

    out.push('</tbody>');
    return out.join('');
  }

  function init() {
    const data = window.DeckData && window.DeckData.calibFit;
    if (!data) return;
    document.querySelectorAll('[data-calib-table]').forEach(function (el) {
      el.innerHTML = build(data);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
