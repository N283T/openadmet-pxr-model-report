(function () {
  'use strict';

  function css(prop) {
    return getComputedStyle(document.documentElement).getPropertyValue(prop).trim();
  }

  // optFeatureCorr from the model report, with the Spearman row dropped: the
  // previous slide is already a Pearson argument, and only the observed-log2fc
  // column differs materially between the two (0.61 against 0.33), which the
  // notes carry. One row buys cells big enough to read across a room.
  // The five features with any correlation worth reading; the rest sit under
  // 0.4 and are context rather than signal.
  const PRED = new Set(['pred 33µM', 'pred 8.25µM']);
  const NOTABLE = new Set(['obs 8.25µM', 'obs 33µM', 'Boltz aff.', 'logP']);

  window.DeckCharts = window.DeckCharts || {};
  window.DeckCharts['feature-corr'] = {
    init: function (el, data) {
      const feats = data.features;
      const rows = ['Pearson r'];
      const p = {
        ink: css('--color-ink'),
        muted: css('--muted'),
        bg: css('--color-bg'),
        coral: css('--color-coral'),
        font: 'Zen Maru Gothic, system-ui, sans-serif',
      };
      const chart = window.echarts.init(el, null, { renderer: 'svg' });

      const cells = [];
      feats.forEach(function (f, xi) {
        cells.push([xi, 0, f.pearson]);
      });

      chart.setOption({
        textStyle: { color: p.ink, fontFamily: p.font },
        // Report rotates the labels 45° and keeps 82px for them plus the
        // legend. Horizontal reads better, and at two lines the names fit the
        // column width — so upright, wrapped at the space, and less room.
        grid: { left: 80, right: 12, top: 10, bottom: 40 },
        xAxis: {
          type: 'category', data: feats.map(function (f) { return f.short; }),
          axisLine: { show: false }, axisTick: { show: false }, splitArea: { show: false },
          axisLabel: {
            interval: 0, fontSize: 11, fontFamily: p.font,
            lineHeight: 13, align: 'center',
            // Break at the first space so the longest token sets the width,
            // and pick out the handful that carry any real correlation: pred
            // in coral, the next three in ink, everything else quiet.
            formatter: function (v) {
              const style = PRED.has(v) ? 'pred' : (NOTABLE.has(v) ? 'notable' : 'rest');
              return v.split(' ').map(function (part) {
                return '{' + style + '|' + part + '}';
              }).join('\n');
            },
            rich: {
              pred: { color: p.coral, fontWeight: 700, fontSize: 11, fontFamily: p.font, lineHeight: 13 },
              notable: { color: p.ink, fontWeight: 700, fontSize: 11, fontFamily: p.font, lineHeight: 13 },
              rest: { color: p.muted, fontSize: 11, fontFamily: p.font, lineHeight: 13 },
            },
          },
        },
        yAxis: {
          type: 'category', data: rows, inverse: true,
          axisLine: { show: false }, axisTick: { show: false }, splitArea: { show: false },
          axisLabel: { color: p.ink, fontFamily: p.font, fontWeight: 600 },
        },
        visualMap: {
          show: false, min: -0.85, max: 0.85, dimension: 2,
          inRange: { color: ['#e2725b', '#f4efe4', '#4fb79a'] },
        },
        series: [{
          type: 'heatmap', data: cells,
          itemStyle: { borderColor: p.bg, borderWidth: 2, borderRadius: 4 },
          label: {
            show: true, fontFamily: p.font, fontWeight: 700, color: '#2b333a',
            formatter: function (o) { return o.data[2].toFixed(2); },
          },
          emphasis: { itemStyle: { borderColor: p.coral, borderWidth: 2 } },
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
