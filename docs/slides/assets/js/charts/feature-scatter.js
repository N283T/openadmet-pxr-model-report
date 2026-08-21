(function () {
  'use strict';

  function css(prop) {
    return getComputedStyle(document.documentElement).getPropertyValue(prop).trim();
  }

  function linfit(points) {
    let sx = 0, sy = 0, sxx = 0, sxy = 0;
    points.forEach(function (p) {
      sx += p[0]; sy += p[1]; sxx += p[0] * p[0]; sxy += p[0] * p[1];
    });
    const n = points.length;
    const slope = (n * sxy - sx * sy) / (n * sxx - sx * sx);
    const intercept = (sy - slope * sx) / n;
    const xs = points.map(function (p) { return p[0]; });
    const lo = Math.min.apply(null, xs);
    const hi = Math.max.apply(null, xs);
    return [[lo, slope * lo + intercept], [hi, slope * hi + intercept]];
  }

  function palette() {
    return {
      ink: css('--color-ink'),
      muted: css('--muted'),
      line: css('--color-line'),
      blue: css('--color-blue'),
      coral: css('--color-coral'),
      font: 'Zen Maru Gothic, system-ui, sans-serif',
    };
  }

  function axisStyle(p) {
    return {
      axisLine: { show: true, onZero: false, lineStyle: { color: p.muted, width: 1.6 } },
      axisTick: { show: true, lineStyle: { color: p.muted, width: 1.6 } },
      axisLabel: { color: p.muted },
      splitLine: { lineStyle: { color: p.line, opacity: 0.5 } },
      nameTextStyle: { color: p.muted },
    };
  }

  // optFeatPanel from the model report (docs/assets/js/charts.js), verbatim.
  // It is rendered at the report's own pixel size and scaled up in CSS, so the
  // proportions and type sizes stay exactly as published.
  window.DeckCharts = window.DeckCharts || {};
  window.DeckCharts['feature-scatter'] = {
    init: function (el, data) {
      const feat = data.panels[Number(el.dataset.panel)];
      const p = palette();
      // Rendered small and scaled up in CSS, so the backing store has to be
      // oversampled or the canvas comes out soft. SVG would dodge this, but
      // 13,000 points is what canvas is for.
      const chart = window.echarts.init(el, null, {
        renderer: 'canvas',
        devicePixelRatio: (window.devicePixelRatio || 1) * 2,
      });

      chart.setOption({
        textStyle: { color: p.ink, fontFamily: p.font },
        title: { text: feat.label, left: 14, top: 8,
          textStyle: { color: p.ink, fontSize: 16, fontWeight: 700, fontFamily: p.font } },
        graphic: [{ type: 'text', right: 14, top: 11,
          style: { text: 'Pearson r = ' + feat.r + '   n = ' + feat.n.toLocaleString('en-US'),
            fill: p.coral, font: 'bold 15px ' + p.font } }],
        grid: { left: 52, right: 14, top: 42, bottom: 46 },
        tooltip: { show: false },
        xAxis: Object.assign({ type: 'value', scale: true, name: feat.label,
          nameLocation: 'middle', nameGap: 26, nameTextStyle: { color: p.muted, fontSize: 12 } }, axisStyle(p)),
        yAxis: Object.assign({ type: 'value', scale: true, name: 'pEC50',
          nameLocation: 'middle', nameRotate: 90, nameGap: 34,
          nameTextStyle: { color: p.muted, fontSize: 12 } }, axisStyle(p)),
        series: [
          { type: 'scatter', data: feat.points, symbolSize: 4, large: true, largeThreshold: 1000,
            itemStyle: { color: p.blue, opacity: 0.32 }, z: 2 },
          { type: 'line', data: linfit(feat.points), showSymbol: false, silent: true,
            lineStyle: { color: p.coral, width: 2 }, z: 3 },
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
