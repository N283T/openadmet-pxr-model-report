(function () {
  'use strict';

  function css(prop) {
    return getComputedStyle(document.documentElement).getPropertyValue(prop).trim();
  }

  const MONO = 'PlemolJP, monospace';

  // The two heaviest members against all nine. Nine rows of nine was a texture
  // rather than a reading: with the rows cut to the pair that carries most of
  // the weight, the question is just whether anything stands apart from them.
  //
  // A chart rather than the hand-built grid this replaced: the column names do
  // not fit across a cell, and rotating them is something the axis already
  // knows how to do, including reserving the space they sweep.
  window.DeckCharts = window.DeckCharts || {};
  window.DeckCharts['ensemble-corr'] = {
    init: function (el, data) {
      window.echarts.registerTheme('deck', window.DeckTheme.get());
      const chart = window.echarts.init(el, 'deck', { renderer: 'svg' });

      const ink = css('--color-ink');
      const rule = css('--color-line');
      const surface = css('--surface');
      const teal = css('--color-teal');
      const blue = css('--color-blue');
      const coral = css('--color-coral');

      const rowAliases = (el.dataset.corrRows || '').split(',').filter(Boolean);
      const rows = rowAliases.length ? rowAliases : data.aliases;
      const familyOf = {};
      data.members.forEach(function (m) { familyOf[m.alias] = m.family; });

      const cells = [];
      rows.forEach(function (alias, y) {
        const i = data.aliases.indexOf(alias);
        data.aliases.forEach(function (_, x) {
          cells.push([x, y, i === x ? null : data.matrix[i][x]]);
        });
      });

      // Family colour on both axes, so a column can be placed without reading
      // it: teal tabular, blue frozen embedding, coral Boltz.
      function richFor(size) {
        return {
          tabular: { color: teal, fontSize: size, fontFamily: MONO },
          embed: { color: blue, fontSize: size, fontFamily: MONO },
          boltz: { color: coral, fontSize: size, fontFamily: MONO },
        };
      }
      function tagged(alias) {
        return '{' + (familyOf[alias] || 'embed') + '|' + alias + '}';
      }

      chart.setOption({
        animation: false,
        grid: { left: 8, right: 20, top: 8, bottom: 8, containLabel: true },
        tooltip: {
          backgroundColor: surface,
          borderColor: rule,
          textStyle: { color: ink, fontSize: 15 },
          formatter: function (o) {
            if (o.data[2] === null) return null;
            return rows[o.data[1]] + ' vs ' + data.aliases[o.data[0]]
              + '<br/>r <b>' + o.data[2].toFixed(2) + '</b>';
          },
        },
        xAxis: {
          type: 'category',
          data: data.aliases,
          axisLine: { show: false },
          axisTick: { show: false },
          splitArea: { show: false },
          axisLabel: {
            interval: 0,
            rotate: 32,
            margin: 12,
            formatter: tagged,
            rich: richFor(16),
          },
        },
        yAxis: {
          type: 'category',
          data: rows,
          inverse: true,
          axisLine: { show: false },
          axisTick: { show: false },
          splitArea: { show: false },
          axisLabel: { margin: 14, formatter: tagged, rich: richFor(18) },
        },
        // Stretched over the observed range: mapping 0 to 1 would make every
        // cell the same shade, since nothing here is below 0.81.
        visualMap: {
          show: false,
          min: data.summary.min,
          max: data.summary.max,
          dimension: 2,
          inRange: { color: ['#fdf1ec', coral] },
        },
        series: [{
          type: 'heatmap',
          data: cells,
          itemStyle: { borderColor: surface, borderWidth: 3, borderRadius: 5 },
          label: {
            show: true,
            fontSize: 19,
            fontFamily: MONO,
            color: ink,
            formatter: function (o) {
              return o.data[2] === null ? '' : o.data[2].toFixed(2);
            },
          },
          emphasis: { itemStyle: { borderColor: ink, borderWidth: 2 } },
        }],
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
