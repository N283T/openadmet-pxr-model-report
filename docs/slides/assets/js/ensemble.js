(function () {
  'use strict';

  // The member table, from assets/data/ensemble.js so it cannot drift from the
  // charts that read the same file. Deliberately not a DeckChart: a table is
  // markup, not a figure.

  function memberRows(data) {
    return data.members.map(function (m, i) {
      const strategy = m.strategy
        ? '<span class="strat-ref">' + m.strategy + '</span>'
        : '—';
      return (
        '<tr class="member-row--' + m.family + '">' +
        '<th scope="row"><span class="member-tbl__i">' + (i + 1) + '</span>' + m.alias + '</th>' +
        '<td>' + m.desc + '</td>' +
        '<td class="member-tbl__family">' + m.familyLabel + '</td>' +
        '<td class="member-tbl__flag">' + strategy + '</td>' +
        '<td class="member-tbl__num"><span class="mono">' + m.oofMae.toFixed(3) + '</span></td>' +
        '<td class="member-tbl__num"><span class="mono">' + m.weight.toFixed(3) + '</span></td>' +
        '</tr>'
      );
    }).join('');
  }

  function init() {
    const data = window.DeckData && window.DeckData.ensemble;
    if (!data) return;

    const rows = document.querySelector('[data-member-rows]');
    if (rows) rows.innerHTML = memberRows(data);

    // The family cards say how many members they stand for; counted here so
    // the cards and the table cannot disagree.
    document.querySelectorAll('[data-family-count]').forEach(function (el) {
      const family = el.dataset.familyCount;
      el.textContent = data.members.filter(function (m) {
        return m.family === family;
      }).length;
    });

    document.querySelectorAll('[data-corr-stat]').forEach(function (el) {
      el.textContent = data.summary[el.dataset.corrStat];
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
