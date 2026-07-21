(function () {
  'use strict';
  window.DeckCharts = window.DeckCharts || {};
  window.DeckCharts.results = {
    init: function (el, data) {
      const theme = window.DeckTheme.get();
      window.echarts.registerTheme('deck', theme);
      const chart = window.echarts.init(el, 'deck', { renderer: 'svg' });
      chart.setOption({
        grid: { left: 60, right: 20, top: 50, bottom: 50 },
        legend: { data: ['Phase 1', 'Phase 2'], top: 0 },
        tooltip: {
          trigger: 'axis',
          axisPointer: { type: 'shadow' },
          valueFormatter: function (v) { return typeof v === 'number' ? v.toFixed(4) : v; },
        },
        xAxis: { type: 'category', data: data.metrics, axisLabel: { fontSize: 14 } },
        yAxis: { type: 'value', axisLabel: { fontSize: 14 } },
        series: [
          { name: 'Phase 1', type: 'bar', data: data.phase1, emphasis: { focus: 'series' } },
          { name: 'Phase 2', type: 'bar', data: data.phase2, emphasis: { focus: 'series' } },
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
