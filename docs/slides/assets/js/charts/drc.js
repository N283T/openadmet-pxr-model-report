(function () {
  'use strict';
  window.DeckCharts = window.DeckCharts || {};

  function hill(x, c) {
    return c.emax / (1 + Math.pow(10, c.hill * (c.logEC50 - x)));
  }

  function curve(c, range, steps) {
    const out = [];
    const span = range[1] - range[0];
    for (let i = 0; i <= steps; i += 1) {
      const x = range[0] + (span * i) / steps;
      out.push([x, hill(x, c)]);
    }
    return out;
  }

  window.DeckCharts.drc = {
    init: function (el, data) {
      const theme = window.DeckTheme.get();
      window.echarts.registerTheme('deck', theme);
      const chart = window.echarts.init(el, 'deck', { renderer: 'svg' });

      const css = function (prop) {
        return getComputedStyle(document.documentElement).getPropertyValue(prop).trim();
      };
      const teal = css('--color-teal');
      const coral = css('--color-coral');
      const line = css('--color-line');
      const muted = '#6b7488';

      // Two grids side by side: the same axes, one panel per measurement regime.
      const axisCommon = {
        min: data.xRange[0],
        max: data.xRange[1],
        type: 'value',
        axisLabel: { show: false },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLine: { lineStyle: { color: line } },
        name: '濃度 (log)',
        nameLocation: 'middle',
        nameGap: 22,
        nameTextStyle: { color: muted, fontSize: 18 },
      };
      const yCommon = {
        min: data.yRange[0],
        max: data.yRange[1],
        type: 'value',
        axisLabel: { show: false },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLine: { show: true, lineStyle: { color: line } },
        name: '応答',
        nameLocation: 'middle',
        nameGap: 22,
        nameTextStyle: { color: muted, fontSize: 18 },
      };

      const ideal = data.ideal;
      const series = [
        {
          name: 'dose-response',
          type: 'line',
          xAxisIndex: 0,
          yAxisIndex: 0,
          data: curve(ideal, data.xRange, 120),
          showSymbol: false,
          lineStyle: { color: teal, width: 3 },
          silent: true,
          // EC50 is the concentration at half-maximal response, so the figure
          // has to show that half-height first: plateau, then the 50% level
          // across to the curve, then straight down to the axis.
          markLine: {
            silent: true,
            symbol: 'none',
            label: { show: false },
            lineStyle: { color: teal, type: 'dashed', width: 1.5, opacity: 0.75 },
            data: [
              [
                { coord: [data.xRange[0], ideal.emax] },
                {
                  coord: [data.xRange[1], ideal.emax],
                  label: {
                    show: true, formatter: 'Emax', position: 'insideEndTop',
                    color: muted, fontSize: 17,
                  },
                },
              ],
              [
                {
                  coord: [data.xRange[0], ideal.emax / 2],
                  label: {
                    show: true, formatter: '50%', position: 'insideStartTop',
                    color: muted, fontSize: 17,
                  },
                },
                { coord: [ideal.logEC50, ideal.emax / 2] },
              ],
              [
                { coord: [ideal.logEC50, ideal.emax / 2] },
                {
                  coord: [ideal.logEC50, data.yRange[0]],
                  label: {
                    // markLine labels follow the line's angle by default, which
                    // stands this one on its side; rotate 0 keeps it readable.
                    // Anchored to the middle of the drop line rather than its
                    // end, so tightening the y-axis cannot push it into the
                    // x-axis label underneath.
                    show: true, formatter: 'EC50', position: 'middle', rotate: 0,
                    offset: [30, 0], color: muted, fontSize: 17,
                  },
                },
              ],
            ],
          },
        },
        {
          name: 'measured',
          type: 'scatter',
          xAxisIndex: 0,
          yAxisIndex: 0,
          symbolSize: 13,
          silent: true,
          itemStyle: { color: teal },
          data: data.samples.map(function (x) { return [x, hill(x, ideal)]; }),
        },
      ];

      // Right panel: every candidate curve fits both readouts exactly.
      data.candidates.forEach(function (c, i) {
        series.push({
          name: 'candidate ' + i,
          type: 'line',
          xAxisIndex: 1,
          yAxisIndex: 1,
          data: curve(c, data.xRange, 120),
          showSymbol: false,
          silent: true,
          lineStyle: { color: coral, width: 2, type: 'dashed', opacity: 0.85 },
        });
      });
      series.push({
        name: 'readouts',
        type: 'scatter',
        xAxisIndex: 1,
        yAxisIndex: 1,
        symbolSize: 17,
        silent: true,
        itemStyle: { color: coral },
        label: {
          show: true,
          position: 'bottom',
          distance: 10,
          color: muted,
          fontSize: 17,
          formatter: function (p) { return data.readouts[p.dataIndex].label; },
        },
        data: data.readouts.map(function (r) { return [r.x, r.y]; }),
      });

      chart.setOption({
        animation: false,
        grid: [
          { left: '5%', right: '54%', top: 58, bottom: 46 },
          { left: '54%', right: '5%', top: 58, bottom: 46 },
        ],
        title: [
          {
            text: '8 点の用量反応',
            left: '5%',
            top: 8,
            textStyle: { color: css('--color-ink'), fontSize: 22, fontWeight: 'normal' },
          },
          {
            text: '2 濃度だけ',
            left: '54%',
            top: 8,
            textStyle: { color: css('--color-ink'), fontSize: 22, fontWeight: 'normal' },
          },
        ],
        xAxis: [
          Object.assign({ gridIndex: 0 }, axisCommon),
          Object.assign({ gridIndex: 1 }, axisCommon),
        ],
        yAxis: [
          Object.assign({ gridIndex: 0 }, yCommon),
          Object.assign({ gridIndex: 1 }, yCommon),
        ],
        series: series,
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
