(function () {
  'use strict';

  function css(prop) {
    return getComputedStyle(document.documentElement).getPropertyValue(prop).trim();
  }

  const MONO = 'PlemolJP, monospace';

  // Eleven submissions, and the shape is the argument: a flat run. Both axes are
  // zoomed onto the range the scores occupy, which makes the wobble look larger
  // than it is, so the anchor's own level is drawn across the full width —
  // anything sitting on that line is not a result.
  window.DeckCharts = window.DeckCharts || {};
  window.DeckCharts['phase1-run'] = {
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
      const anchor = rows.filter(function (r) { return r.anchor; })[0];
      const anchorIndex = rows.indexOf(anchor);
      const pad = function (values, room) {
        const lo = Math.min.apply(null, values);
        const hi = Math.max.apply(null, values);
        const span = (hi - lo) || 0.001;
        return { min: lo - span * room, max: hi + span * room };
      };
      const mb = pad(rows.map(function (r) { return r.lbMae; }), 0.5);
      const sb = pad(rows.map(function (r) { return r.spearman; }), 0.5);

      // The resubmission carries the anchor's numbers, so its markers would sit
      // exactly on the anchor's and read as a result. Hollow, and the line stops
      // before it.
      const symbol = function (r) {
        return r.resubmit ? 'emptyCircle' : 'circle';
      };

      chart.setOption({
        animation: false,
        grid: { left: 12, right: 12, top: 46, bottom: 26, containLabel: true },
        legend: {
          data: ['MAE', 'Spearman'],
          top: 2,
          itemGap: 24,
          textStyle: { fontSize: 17, color: muted, fontFamily: MONO },
        },
        tooltip: {
          trigger: 'axis',
          backgroundColor: surface,
          borderColor: rule,
          textStyle: { color: ink, fontSize: 15 },
          formatter: function (points) {
            const r = rows[points[0].dataIndex];
            return '<b>' + r.id + '</b> ' + r.label
              + '<br/>MAE <b>' + r.lbMae.toFixed(4) + '</b>'
              + '<br/>Spearman <b>' + r.spearman.toFixed(4) + '</b>'
              + '<br/>rank ' + r.rank
              + (r.anchor ? '<br/><b>Phase 1 anchor</b>' : '')
              + (r.resubmit ? '<br/>id55 と同じモデル' : '');
          },
        },
        xAxis: {
          type: 'category',
          data: rows.map(function (r) { return r.id; }),
          boundaryGap: false,
          axisLine: { lineStyle: { color: rule } },
          axisTick: { show: false },
          axisLabel: { fontSize: 18, fontFamily: MONO, color: ink },
        },
        yAxis: [
          {
            type: 'value',
            name: 'MAE',
            position: 'left',
            min: mb.min,
            max: mb.max,
            nameTextStyle: { fontSize: 16, color: blue },
            axisLabel: {
              fontSize: 15, fontFamily: MONO, color: muted,
              formatter: function (v) { return v.toFixed(3); },
            },
            splitLine: { lineStyle: { color: rule } },
          },
          {
            type: 'value',
            name: 'Spearman',
            position: 'right',
            min: sb.min,
            max: sb.max,
            nameTextStyle: { fontSize: 16, color: teal },
            axisLabel: {
              fontSize: 15, fontFamily: MONO, color: muted,
              formatter: function (v) { return v.toFixed(3); },
            },
            splitLine: { show: false },
          },
        ],
        series: [
          {
            name: 'MAE',
            type: 'line',
            yAxisIndex: 0,
            data: rows.map(function (r) {
              return { value: r.lbMae, symbol: symbol(r), symbolSize: r.anchor ? 15 : 10 };
            }),
            lineStyle: { color: blue, width: 3 },
            itemStyle: { color: blue },
            markLine: {
              silent: true,
              symbol: 'none',
              precision: 4,
              lineStyle: { color: coral, type: 'dashed', width: 2 },
              label: {
                formatter: 'anchor ' + anchor.lbMae.toFixed(4),
                position: 'insideStartBottom',
                fontSize: 16,
                fontFamily: MONO,
                color: coral,
              },
              data: [{ yAxis: anchor.lbMae }],
            },
            markPoint: {
              symbol: 'circle',
              symbolSize: 17,
              itemStyle: { color: coral, borderColor: surface, borderWidth: 2 },
              label: {
                formatter: anchor.id,
                position: 'bottom',
                distance: 10,
                fontSize: 17,
                fontFamily: MONO,
                fontWeight: 700,
                color: coral,
              },
              data: [{ coord: [anchorIndex, anchor.lbMae] }],
            },
          },
          {
            name: 'Spearman',
            type: 'line',
            yAxisIndex: 1,
            data: rows.map(function (r) {
              return { value: r.spearman, symbol: symbol(r), symbolSize: 10 };
            }),
            lineStyle: { color: teal, width: 3 },
            itemStyle: { color: teal },
          },
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
