(function () {
  'use strict';

  function css(prop) {
    return getComputedStyle(document.documentElement).getPropertyValue(prop).trim();
  }

  const MONO = 'PlemolJP, monospace';

  // Every Phase 2 edit against the answer key. The anchor's own level runs
  // across the figure and every submitted bar stands above it: each change made
  // AS2 worse. The winner's score is the second line, and the one bar that
  // clears it was never submitted.
  window.DeckCharts = window.DeckCharts || {};
  window.DeckCharts['phase2-as2'] = {
    init: function (el, data) {
      window.echarts.registerTheme('deck', window.DeckTheme.get());
      const chart = window.echarts.init(el, 'deck', { renderer: 'svg' });

      const ink = css('--color-ink');
      const blue = css('--color-blue');
      const teal = css('--color-teal');
      const coral = css('--color-coral');
      const muted = css('--muted');
      const rule = css('--color-line');
      const surface = css('--surface');

      const rows = data.rows;
      // Only the Phase 2 submissions are bars. The level they started from and
      // the winning score are the two dashed lines, so the figure is three
      // changes read against two fixed levels rather than five bars to compare.
      const bars = rows.filter(function (r) { return r.kind === 'phase2'; });
      const anchorRow = rows.filter(function (r) { return r.kind === 'phase1'; })[0];

      chart.setOption({
        animation: false,
        grid: { left: 4, right: 116, top: 34, bottom: 0, containLabel: true },
        tooltip: {
          trigger: 'item',
          backgroundColor: surface,
          borderColor: rule,
          textStyle: { color: ink, fontSize: 15 },
          formatter: function (o) {
            const r = bars[o.dataIndex];
            const d = r.delta === 0 ? 'baseline'
              : (r.delta > 0 ? '+' : '') + r.delta.toFixed(4) + ' vs id60';
            return '<b>' + r.label + '</b> ' + r.note
              + '<br/>AS2 MAE <b>' + r.as2Mae.toFixed(4) + '</b><br/>' + d;
          },
        },
        xAxis: {
          type: 'category',
          data: bars.map(function (r) { return r.label; }),
          axisLine: { lineStyle: { color: rule } },
          axisTick: { show: false },
          axisLabel: {
            fontSize: 18, fontFamily: MONO, color: ink, interval: 0,
            // The column is narrow; "(=id55)" is carried by the sentence beside
            // the figure and by the tooltip, so the axis keeps the bare id.
            formatter: function (v) { return v.split(' ')[0]; },
          },
        },
        yAxis: {
          type: 'value',
          name: 'AS2 MAE',
          nameTextStyle: { fontSize: 15, color: muted, align: 'left' },
          min: 0.4,
          max: 0.4145,
          interval: 0.005,
          axisLabel: {
            fontSize: 15, fontFamily: MONO, color: muted,
            formatter: function (v) { return v.toFixed(3); },
          },
          splitLine: { lineStyle: { color: rule } },
        },
        series: [{
          type: 'bar',
          data: bars.map(function (r) {
            return {
              value: r.as2Mae,
              itemStyle: { color: coral },
            };
          }),
          barWidth: '48%',
          itemStyle: { borderRadius: [5, 5, 0, 0] },
          markLine: {
            silent: true,
            symbol: 'none',
            precision: 4,
            data: [
              {
                yAxis: data.anchor,
                lineStyle: { color: blue, type: 'dashed', width: 2 },
                label: {
                  // The two levels sit 0.0014 apart, a dozen pixels on this
                  // axis, so each label is padded with a blank line on the side
                  // it should move away from: the label box centres on the line
                  // and the visible row lands clear of the other one.
                  formatter: anchorRow.label.split(' ')[0] + ' ' + data.anchor.toFixed(4) + '\n\u00a0',
                  position: 'end',
                  distance: 7,
                  fontSize: 15, fontFamily: MONO, color: blue,
                },
              },
              {
                yAxis: data.winnerMae,
                lineStyle: { color: teal, type: 'dashed', width: 2 },
                label: {
                  formatter: '\u00a0\n1st ' + data.winnerMae.toFixed(4),
                  position: 'end',
                  distance: 7,
                  fontSize: 15, fontFamily: MONO, color: teal,
                },
              },
            ],
          },
          label: {
            show: true, position: 'top', distance: 7,
            fontSize: 17, fontFamily: MONO,
            color: muted,
            formatter: function (o) { return o.value.toFixed(4); },
          },
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
