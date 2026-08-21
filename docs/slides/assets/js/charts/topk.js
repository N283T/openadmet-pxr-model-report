(function () {
  'use strict';

  function css(prop) {
    return getComputedStyle(document.documentElement).getPropertyValue(prop).trim();
  }

  // The four accents of the previous slide, so a family keeps the colour its
  // card had. Boltz and 2D each cover two of the report's families.
  const CARD_COLOR = {
    desc: '#95d0c6',
    chemeleon: '#b0b3bc',
    boltz: '#f2b2a3',
    pred: '#bcd1ec',
  };

  const MONO = 'PlemolJP, monospace';

  function base(el) {
    window.echarts.registerTheme('deck', window.DeckTheme.get());
    return window.echarts.init(el, 'deck', { renderer: 'svg' });
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

  // Gain share per family. Two columns take three quarters of it, so the bars
  // are a near-empty chart with one long bar — which is the finding, not a
  // drawing problem. The column count rides in the category label because the
  // contrast between 2 columns and 1,204 is half the point.
  window.DeckCharts['topk-gain'] = {
    init: function (el, data) {
      const chart = base(el);
      const ink = css('--color-ink');
      const muted = css('--muted');
      const rule = css('--color-line');
      const surface = css('--surface');
      // Weakest first: ECharts' category axis runs bottom-up.
      const fams = data.families.slice().reverse();

      chart.setOption({
        grid: { left: 4, right: 74, top: 4, bottom: 4, containLabel: true },
        tooltip: {
          trigger: 'item',
          backgroundColor: surface,
          borderColor: rule,
          textStyle: { color: ink, fontSize: 15 },
          formatter: function (o) {
            const f = fams[o.dataIndex];
            return '<b>' + f.family + '</b><br/>gain <b>'
              + (f.share * 100).toFixed(1) + '%</b><br/>'
              + f.columns.toLocaleString('en-US') + ' 列';
          },
        },
        xAxis: { type: 'value', max: 0.8, show: false },
        yAxis: {
          type: 'category',
          data: fams.map(function (f) { return f.family + '|' + f.columns; }),
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: {
            fontSize: 17,
            lineHeight: 21,
            formatter: function (v) {
              const part = v.split('|');
              const cols = Number(part[1]).toLocaleString('en-US');
              return '{n|' + part[0] + '}\n{c|' + cols + ' 列}';
            },
            rich: {
              n: { color: ink, fontSize: 17, fontFamily: MONO, lineHeight: 21 },
              c: { color: muted, fontSize: 14, fontFamily: MONO, lineHeight: 17 },
            },
          },
        },
        series: [{
          type: 'bar',
          data: fams.map(function (f) {
            return { value: f.share, itemStyle: { color: CARD_COLOR[f.card] } };
          }),
          barWidth: '58%',
          itemStyle: { borderRadius: [0, 4, 4, 0] },
          label: {
            show: true,
            position: 'right',
            distance: 8,
            fontSize: 18,
            fontFamily: MONO,
            color: ink,
            formatter: function (o) { return (o.value * 100).toFixed(1) + '%'; },
          },
        }],
      });

      return handle(chart);
    },
  };

  // A port of the report's own K-sweep figure: MAE left, Spearman right, each
  // with its full-stack value as a dashed reference, and the chosen K picked
  // out. Same padded bounds, so both curves keep the headroom they have there.
  function bounds(values) {
    const lo = Math.min.apply(null, values);
    const hi = Math.max.apply(null, values);
    const span = (hi - lo) || 0.01;
    return {
      min: Math.floor((lo - span * 0.4) * 1000) / 1000,
      max: Math.ceil((hi + span * 0.4) * 1000) / 1000,
    };
  }

  window.DeckCharts['topk-sweep'] = {
    init: function (el, data) {
      const chart = base(el);
      const blue = css('--color-blue');
      const teal = css('--color-teal');
      const coral = css('--color-coral');
      const ink = css('--color-ink');
      const muted = css('--muted');
      const rule = css('--color-line');
      const surface = css('--surface');
      const axisLabel = { fontSize: 15, color: muted, fontFamily: MONO };
      const chosen = data.chosenK;
      const chosenRow = data.sweep.filter(function (r) { return r.k === chosen; })[0];

      const mae = data.sweep.map(function (r) { return [r.k, r.mae]; });
      const spear = data.sweep.map(function (r) { return [r.k, r.spearman]; });
      const mb = bounds(mae.map(function (x) { return x[1]; }).concat([data.full.mae]));
      const sb = bounds(spear.map(function (x) { return x[1]; }).concat([data.full.spearman]));
      // Ticks on the K that were actually run. A 100 interval lands on all of
      // them; 0 and the two that were skipped are left unlabelled rather than
      // implying a measurement that does not exist.
      const SAMPLED = new Set(data.sweep.map(function (r) { return r.k; }));

      function chosenMark(seriesName, axisIndex, value, text, position) {
        return {
          name: seriesName,
          type: 'scatter',
          yAxisIndex: axisIndex,
          data: [[chosen, value]],
          symbolSize: 17,
          z: 10,
          itemStyle: { color: coral, borderColor: surface, borderWidth: 2 },
          label: {
            show: true,
            formatter: text,
            position: position,
            distance: 8,
            fontSize: 17,
            fontFamily: MONO,
            fontWeight: 700,
            color: coral,
          },
        };
      }

      function reference(color, value, position) {
        return {
          silent: true,
          symbol: 'none',
          precision: 4,
          lineStyle: { color: color, type: 'dashed', width: 2 },
          label: {
            formatter: '全 ' + data.full.k.toLocaleString('en-US') + ' 列 ' + value,
            position: position,
            fontSize: 14,
            fontFamily: MONO,
            color: color,
          },
          data: [{ yAxis: value }],
        };
      }

      chart.setOption({
        grid: { left: 8, right: 8, top: 46, bottom: 40, containLabel: true },
        legend: {
          data: ['OOF MAE', 'Spearman ρ'],
          top: 2,
          itemGap: 26,
          textStyle: { fontSize: 16, color: muted, fontFamily: MONO },
        },
        tooltip: {
          trigger: 'axis',
          backgroundColor: surface,
          borderColor: rule,
          textStyle: { color: ink, fontSize: 15 },
          formatter: function (points) {
            const k = points[0].data[0];
            let out = '<b>top-' + k.toLocaleString('en-US') + '</b>';
            points.forEach(function (s) {
              // The chosen-K marker shares the MAE series' name, so at K = 500
              // it would report the same number a second time.
              if (s.seriesType === 'scatter') return;
              out += '<br/>' + s.marker + s.seriesName
                + ' <b>' + s.data[1].toFixed(4) + '</b>';
            });
            return out;
          },
        },
        // A value axis, not a category one: the sweep skips 900 and 1,100, and
        // on a category axis those gaps close up and bend the curve.
        xAxis: {
          type: 'value',
          min: 0,
          max: 1260,
          interval: 100,
          name: '残した列数 K',
          nameLocation: 'middle',
          nameGap: 34,
          nameTextStyle: { fontSize: 16, color: muted },
          axisLabel: Object.assign({}, axisLabel, {
            formatter: function (v) {
              return SAMPLED.has(v) ? v.toLocaleString('en-US') : '';
            },
          }),
          axisTick: { show: false },
          splitLine: { show: false },
        },
        yAxis: [
          {
            type: 'value',
            name: 'OOF MAE',
            min: mb.min,
            max: mb.max,
            position: 'left',
            nameTextStyle: { fontSize: 15, color: blue },
            axisLabel: Object.assign({}, axisLabel, {
              formatter: function (v) { return v.toFixed(3); },
            }),
            splitLine: { lineStyle: { color: rule } },
          },
          {
            type: 'value',
            name: 'Spearman ρ',
            min: sb.min,
            max: sb.max,
            position: 'right',
            nameTextStyle: { fontSize: 15, color: teal },
            axisLabel: Object.assign({}, axisLabel, {
              formatter: function (v) { return v.toFixed(3); },
            }),
            splitLine: { show: false },
          },
        ],
        series: [
          {
            name: 'OOF MAE',
            type: 'line',
            yAxisIndex: 0,
            data: mae,
            symbolSize: 9,
            lineStyle: { color: blue, width: 3 },
            itemStyle: { color: blue },
            markLine: reference(blue, data.full.mae, 'insideStartTop'),
          },
          {
            name: 'Spearman ρ',
            type: 'line',
            yAxisIndex: 1,
            data: spear,
            symbolSize: 9,
            lineStyle: { color: teal, width: 3 },
            itemStyle: { color: teal },
            markLine: reference(teal, data.full.spearman, 'insideEndBottom'),
          },
          // Marked on both curves: near-lowest MAE and the best Spearman land
          // on the same K, which is the whole reason it is 500 and not the
          // MAE-minimising 600. Above the lines, or the 3px stroke covers them.
          chosenMark('OOF MAE', 0, chosenRow.mae, 'K = ' + chosen, 'bottom'),
          chosenMark('Spearman ρ', 1, chosenRow.spearman, 'ρ 最良', 'top'),
        ],
      });

      return handle(chart);
    },
  };
})();
