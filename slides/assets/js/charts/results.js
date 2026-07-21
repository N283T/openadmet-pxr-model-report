(function () {
  'use strict';
  window.DeckCharts = window.DeckCharts || {};
  window.DeckCharts.results = {
    init: function (el, data) {
      const theme = window.DeckTheme.get();
      window.echarts.registerTheme('deck', theme);
      const chart = window.echarts.init(el, 'deck', { renderer: 'svg' });
      chart.setOption({
        grid: { left: 60, right: 20, top: 40, bottom: 40 },
        legend: { data: ['Phase 1', 'Phase 2'], top: 0 },
        xAxis: { type: 'category', data: data.metrics },
        yAxis: { type: 'value' },
        series: [
          { name: 'Phase 1', type: 'bar', data: data.phase1 },
          { name: 'Phase 2', type: 'bar', data: data.phase2 },
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
