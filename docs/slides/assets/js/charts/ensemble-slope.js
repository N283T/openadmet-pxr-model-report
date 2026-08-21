(function () {
  'use strict';

  function css(prop) {
    return getComputedStyle(document.documentElement).getPropertyValue(prop).trim();
  }

  const MONO = 'PlemolJP, monospace';

  // Family colours, the Model Overview figure's three tracks.
  const FAMILY = { tabular: '#5aa89a', embed: '#5b7bb0', boltz: '#e28a72' };

  // The two panels are separate ECharts instances that have to line up row for
  // row, so both place their nine rows at the centre of nine equal bands —
  // which is where a category axis puts them — and both keep these margins.
  const TOP = 12;
  const BOTTOM = 16;

  function bandCentre(index, n) {
    return 1 - (index + 0.5) / n;
  }

  function handle(chart) {
    return {
      chart: chart,
      resize: function () { chart.resize(); },
      dispose: function () { chart.dispose(); },
      onEnter: function () { chart.resize(); },
      onLeave: function () {},
    };
  }

  window.DeckCharts = window.DeckCharts || {};

  // Left panel. Standing alone on the left, weight order on the right, one line
  // per member. Rank, not value: four members sit within 0.012 MAE of each
  // other and their labels would collide. What rank spacing loses — how much of
  // the weight the top few take — the right panel puts back as bar length.
  //
  // The right ends carry no labels: the bar panel's own axis labels sit right
  // there and would say the same names twice.
  window.DeckCharts['ensemble-slope'] = {
    init: function (el, data) {
      window.echarts.registerTheme('deck', window.DeckTheme.get());
      const chart = window.echarts.init(el, 'deck', { renderer: 'svg' });

      const ink = css('--color-ink');
      const rule = css('--color-line');
      const surface = css('--surface');

      const members = data.members;
      const n = members.length;
      const byMae = members.slice().sort(function (a, b) { return a.oofMae - b.oofMae; });
      const byWeight = members.slice().sort(function (a, b) { return b.weight - a.weight; });

      const series = members.map(function (m) {
        const colour = FAMILY[m.family] || ink;
        return {
          type: 'line',
          name: m.alias,
          data: [
            {
              value: [0, bandCentre(byMae.indexOf(m), n)],
              label: {
                position: 'left',
                distance: 34,
                formatter: m.alias + '  ' + m.oofMae.toFixed(3),
              },
            },
            { value: [1, bandCentre(byWeight.indexOf(m), n)], label: { show: false } },
          ],
          symbolSize: 11,
          lineStyle: { color: colour, width: 3 },
          itemStyle: { color: colour },
          label: { show: true, fontSize: 21, fontFamily: MONO, color: ink },
        };
      });

      chart.setOption({
        animation: false,
        grid: { left: 310, right: 12, top: TOP, bottom: BOTTOM },
        tooltip: {
          trigger: 'item',
          backgroundColor: surface,
          borderColor: rule,
          textStyle: { color: ink, fontSize: 15 },
          formatter: function (o) {
            const m = members.filter(function (x) { return x.alias === o.seriesName; })[0];
            return '<b>' + m.alias + '</b><br/>OOF MAE <b>' + m.oofMae.toFixed(3)
              + '</b><br/>weight <b>' + m.weight.toFixed(3) + '</b>';
          },
        },
        xAxis: {
          type: 'value', min: -0.02, max: 1.0,
          axisLine: { show: false }, axisTick: { show: false },
          splitLine: { show: false }, axisLabel: { show: false },
        },
        yAxis: {
          type: 'value', min: 0, max: 1,
          axisLine: { show: false }, axisTick: { show: false },
          splitLine: { show: false }, axisLabel: { show: false },
        },
        series: series,
      });

      return handle(chart);
    },
  };

  // Right panel. The same nine rows in weight order, as bars, so the spread the
  // rank spacing flattened is visible: the top four take most of it.
  window.DeckCharts['ensemble-weight'] = {
    init: function (el, data) {
      window.echarts.registerTheme('deck', window.DeckTheme.get());
      const chart = window.echarts.init(el, 'deck', { renderer: 'svg' });

      const ink = css('--color-ink');
      const muted = css('--muted');
      const rule = css('--color-line');
      const surface = css('--surface');

      const rows = data.members.slice().sort(function (a, b) { return b.weight - a.weight; });

      chart.setOption({
        animation: false,
        grid: { left: 14, right: 104, top: TOP, bottom: BOTTOM, containLabel: true },
        tooltip: {
          trigger: 'item',
          backgroundColor: surface,
          borderColor: rule,
          textStyle: { color: ink, fontSize: 15 },
          formatter: function (o) {
            const m = rows[o.dataIndex];
            return '<b>' + m.alias + '</b><br/>weight <b>' + m.weight.toFixed(3)
              + '</b><br/>OOF MAE <b>' + m.oofMae.toFixed(3) + '</b>';
          },
        },
        xAxis: {
          type: 'value', min: 0,
          axisLine: { show: false }, axisTick: { show: false },
          axisLabel: { show: false }, splitLine: { show: false },
        },
        yAxis: {
          type: 'category',
          // Heaviest at the top, matching the slope's right-hand order.
          inverse: true,
          data: rows.map(function (m) { return m.alias; }),
          axisLine: { show: false }, axisTick: { show: false },
          axisLabel: { fontSize: 21, fontFamily: MONO, color: ink },
        },
        series: [{
          type: 'bar',
          data: rows.map(function (m) {
            return { value: m.weight, itemStyle: { color: FAMILY[m.family] || ink } };
          }),
          barWidth: '52%',
          itemStyle: { borderRadius: [0, 4, 4, 0] },
          label: {
            show: true, position: 'right', distance: 10,
            fontSize: 21, fontFamily: MONO, color: muted,
            formatter: function (o) { return o.value.toFixed(3); },
          },
        }],
      });

      return handle(chart);
    },
  };
})();
