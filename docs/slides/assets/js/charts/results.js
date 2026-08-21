(function () {
  'use strict';

  function css(prop) {
    return getComputedStyle(document.documentElement).getPropertyValue(prop).trim();
  }

  // Where in the histogram a value falls. Clamped, so a value past the folded
  // tail still points at the last bar rather than off the axis.
  function binOf(metric, value) {
    const index = Math.floor((value - metric.low) / metric.width);
    return Math.min(Math.max(index, 0), metric.counts.length - 1);
  }

  function decimals(metric) {
    // MAE separates the leaders in the third and fourth place after the point;
    // a correlation never needs that much.
    return metric.high - metric.low < 0.3 ? 3 : 2;
  }

  window.DeckCharts = window.DeckCharts || {};
  window.DeckCharts.results = {
    init: function (el, data) {
      const round = data[el.dataset.round];
      const theme = window.DeckTheme.get();
      window.echarts.registerTheme('deck', theme);
      const chart = window.echarts.init(el, 'deck', { renderer: 'svg' });

      const blue = css('--color-blue');
      const coral = css('--color-coral');
      const muted = css('--muted');
      const ink = css('--color-ink');

      let current = el.dataset.metric || 'mae';

      function render(name) {
        const metric = round.metrics[name];
        if (!metric) return;
        current = name;

        const places = decimals(metric);
        const categories = metric.counts.map(function (_, i) {
          return (metric.low + i * metric.width).toFixed(places);
        });
        const mine = binOf(metric, metric.me);

        chart.setOption(
          {
            grid: { left: 8, right: 24, top: 40, bottom: 28, containLabel: true },
            tooltip: {
              trigger: 'axis',
              axisPointer: { type: 'shadow' },
              formatter: function (params) {
                const i = params[0].dataIndex;
                const from = (metric.low + i * metric.width).toFixed(places);
                const to = (metric.low + (i + 1) * metric.width).toFixed(places);
                return from + ' – ' + to + '<br>' + params[0].value + ' チーム';
              },
            },
            xAxis: {
              type: 'category',
              data: categories,
              axisLabel: {
                fontSize: 16,
                color: muted,
                interval: 4,
                fontFamily: 'PlemolJP, monospace',
              },
              axisTick: { show: false },
            },
            yAxis: {
              type: 'value',
              name: 'チーム数',
              nameTextStyle: { fontSize: 15, color: muted, align: 'left' },
              axisLabel: { fontSize: 15, color: muted },
              splitLine: { lineStyle: { color: css('--color-line') } },
            },
            series: [
              {
                type: 'bar',
                data: metric.counts.map(function (count, i) {
                  return {
                    value: count,
                    itemStyle: { color: i === mine ? coral : blue, opacity: i === mine ? 1 : 0.45 },
                  };
                }),
                barCategoryGap: '12%',
                // The marker sits on the bar rather than at a pixel offset, so
                // it follows the bin when the metric changes.
                markPoint: {
                  symbol: 'pin',
                  symbolSize: 46,
                  itemStyle: { color: coral },
                  label: {
                    formatter: '自分',
                    fontSize: 14,
                    color: '#fff',
                    fontFamily: css('--font-body').replace(/"/g, ''),
                  },
                  data: [{ xAxis: mine, yAxis: metric.counts[mine] }],
                },
              },
            ],
          },
          { replaceMerge: ['series'] }
        );
      }

      render(current);

      // The metric buttons live outside this element, so they ask for a redraw
      // by event rather than reaching into the handle deck.js keeps private.
      el.addEventListener('results:metric', function (event) {
        render(event.detail);
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
