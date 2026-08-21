(function () {
  'use strict';

  function css(prop) {
    return getComputedStyle(document.documentElement).getPropertyValue(prop).trim();
  }

  const MONO = 'PlemolJP, monospace';

  function handle(chart) {
    return {
      chart: chart,
      resize: function () { chart.resize(); },
      dispose: function () { chart.dispose(); },
      onEnter: function () { chart.resize(); },
      onLeave: function () {},
    };
  }

  // The build script writes the top band as "6 <=", because the body face has
  // no ≥ and the label is reused in prose. Inside a chart every label is mono,
  // so the real sign is available and reads better.
  const BAND_LABEL = { '6 <=': '≥ 6' };

  // Where the correction earns its keep, band by band on the true pEC50. Bars
  // are the change in MAE, so negative is better; the potent bands sit at the
  // top because that is the end the challenge is about. Mirrors Figure 9 of the
  // model report, off the same run as the table beside it.
  window.DeckCharts['calibration-bands'] = {
    init: function (el, data) {
      window.echarts.registerTheme('deck', window.DeckTheme.get());
      const chart = window.echarts.init(el, 'deck', { renderer: 'svg' });

      const ink = css('--color-ink');
      const coral = css('--color-coral');
      const muted = css('--muted');
      const rule = css('--color-line');
      const surface = css('--surface');

      const bins = data.bins;
      const show = function (label) { return BAND_LABEL[label] || label; };
      const byLabel = {};
      bins.forEach(function (b) { byLabel[show(b.label)] = b; });

      // The two sides are nothing like each other — the worst cost is a fifth of
      // the best gain — so a symmetric axis spends most of its width on empty
      // positive space. Each end instead gets its own edge: the data, plus a
      // slice for the value label that sits past the bar's tip.
      const deltas = bins.map(function (b) { return b.delta; });
      const maxNeg = Math.max(0, -Math.min.apply(null, deltas));
      const maxPos = Math.max(0, Math.max.apply(null, deltas));
      const LABEL_SHARE = 0.13;
      const pad = ((maxNeg + maxPos) / (1 - 2 * LABEL_SHARE)) * LABEL_SHARE;
      // Both ends land on a multiple of the step, so zero is always a tick —
      // ECharts otherwise walks up from a min it did not pick and steps straight
      // over the line the bars are measured from. The smallest step that keeps
      // the count sane wins, which is also the one that wastes the least width.
      const step = [0.01, 0.02, 0.025, 0.04, 0.05, 0.1].find(function (s) {
        return Math.ceil((maxNeg + pad) / s) + Math.ceil((maxPos + pad) / s) + 1 <= 7;
      }) || 0.1;
      const min = -Math.ceil((maxNeg + pad) / step) * step;
      const max = Math.ceil((maxPos + pad) / step) * step;

      chart.setOption({
        animation: false,
        // No gutter on the right: the axis already carries a pad wide enough for
        // the value labels, so reserving margin as well only shortens the bars.
        grid: { left: 8, right: 24, top: 12, bottom: 48, containLabel: true },
        tooltip: {
          trigger: 'item',
          backgroundColor: surface,
          borderColor: rule,
          textStyle: { color: ink, fontSize: 15 },
          formatter: function (o) {
            const b = byLabel[o.name];
            return 'pEC50 ' + o.name + '　n = ' + b.n + '<br>MAE <b>' +
              b.raw.toFixed(3) + '</b> → <b>' + b.cal.toFixed(3) + '</b>';
          },
        },
        xAxis: {
          type: 'value',
          min: min,
          max: max,
          interval: step,
          name: 'MAE の変化（負が改善）',
          nameLocation: 'middle',
          nameGap: 32,
          nameTextStyle: { fontSize: 16, color: muted },
          axisLabel: { fontSize: 15, color: muted, fontFamily: MONO },
          axisTick: { show: false },
          axisLine: { lineStyle: { color: rule } },
          splitLine: { lineStyle: { color: rule } },
        },
        yAxis: {
          type: 'category',
          // Not inverse: the first band is the weakest, so leaving the default
          // bottom-up order runs potency up the axis.
          data: bins.map(function (b) { return show(b.label); }),
          name: '真の pEC50',
          nameLocation: 'middle',
          nameRotate: 90,
          nameGap: 96,
          nameTextStyle: { fontSize: 16, color: muted },
          axisTick: { show: false },
          axisLine: { lineStyle: { color: rule } },
          axisLabel: {
            formatter: function (label) {
              return '{v|' + label + '}  {n|n ' + byLabel[label].n + '}';
            },
            rich: {
              v: { fontSize: 19, color: ink, fontFamily: MONO },
              n: { fontSize: 14, color: muted, fontFamily: MONO },
            },
          },
        },
        series: [
          {
            type: 'bar',
            barWidth: '56%',
            data: bins.map(function (b) {
              return {
                value: b.delta,
                itemStyle: { color: b.delta < 0 ? coral : muted, borderRadius: 4 },
              };
            }),
            // Always clear of the fill: at the zero line for the improvements,
            // past the tip for the costs. In ink, because the label vanished
            // when it took the bar's own colour.
            label: {
              show: true,
              position: 'right',
              distance: 10,
              color: ink,
              fontSize: 18,
              fontFamily: MONO,
              formatter: function (o) {
                return (o.value > 0 ? '+' : '−') + Math.abs(o.value).toFixed(3);
              },
            },
          },
        ],
      });

      return handle(chart);
    },
  };

  // What the correction does, over the 513 unblinded test compounds at the
  // final ensemble weights. Compounds run along x sorted by their true pEC50,
  // so the truth is a clean rising curve and the predictions are a cloud around
  // it. The cloud is visibly flatter than the curve — the ensemble pulls
  // everything toward the middle — and the calibrated cloud is tilted back out.
  window.DeckCharts['calibration-fit'] = {
    init: function (el, data) {
      window.echarts.registerTheme('deck', window.DeckTheme.get());
      const chart = window.echarts.init(el, 'deck', { renderer: 'svg' });

      const ink = css('--color-ink');
      const blue = css('--color-blue');
      const coral = css('--color-coral');
      const muted = css('--muted');
      const rule = css('--color-line');
      const surface = css('--surface');

      const xs = data.true.map(function (_, i) { return i; });
      const pair = function (ys) {
        return xs.map(function (x, i) { return [x, ys[i]]; });
      };

      chart.setOption({
        animation: false,
        grid: { left: 10, right: 18, top: 44, bottom: 48, containLabel: true },
        legend: {
          data: ['true pEC50', 'raw', 'calibrated'],
          top: 2,
          itemGap: 22,
          textStyle: { fontSize: 17, color: muted, fontFamily: MONO },
        },
        tooltip: {
          trigger: 'axis',
          backgroundColor: surface,
          borderColor: rule,
          textStyle: { color: ink, fontSize: 15 },
          valueFormatter: function (v) { return Number(v).toFixed(2); },
        },
        xAxis: {
          type: 'value',
          min: 0,
          max: xs.length - 1,
          name: 'compounds, sorted by true pEC50',
          nameLocation: 'middle',
          nameGap: 30,
          nameTextStyle: { fontSize: 16, color: muted },
          axisLabel: { show: false },
          axisTick: { show: false },
          axisLine: { lineStyle: { color: rule } },
          splitLine: { show: false },
        },
        yAxis: {
          type: 'value',
          name: 'pEC50',
          nameTextStyle: { fontSize: 16, color: muted, align: 'left' },
          axisLabel: { fontSize: 16, color: muted, fontFamily: MONO },
          splitLine: { lineStyle: { color: rule } },
        },
        series: [
          {
            name: 'raw',
            type: 'scatter',
            data: pair(data.raw),
            symbolSize: 6,
            itemStyle: { color: blue, opacity: 0.6 },
          },
          {
            name: 'calibrated',
            type: 'scatter',
            data: pair(data.cal),
            symbolSize: 6,
            itemStyle: { color: coral, opacity: 0.6 },
          },
          {
            name: 'true pEC50',
            type: 'line',
            data: pair(data.true),
            showSymbol: false,
            lineStyle: { color: ink, width: 2 },
            itemStyle: { color: ink },
            z: 5,
          },
        ],
      });

      return handle(chart);
    },
  };
})();
