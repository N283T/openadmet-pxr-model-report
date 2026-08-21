(function () {
  'use strict';

  function css(prop) {
    return getComputedStyle(document.documentElement).getPropertyValue(prop).trim();
  }

  window.DeckCharts = window.DeckCharts || {};
  window.DeckCharts.eda = {
    init: function (el, data) {
      const theme = window.DeckTheme.get();
      window.echarts.registerTheme('deck', theme);
      const chart = window.echarts.init(el, 'deck', { renderer: 'svg' });

      const blue = css('--color-blue');
      const coral = css('--color-coral');
      const muted = css('--muted');
      const rule = css('--color-line');
      const mono = 'PlemolJP, monospace';
      const axisLabel = { fontSize: 15, color: muted, fontFamily: mono };
      const nameStyle = { fontSize: 16, color: muted };

      function render(name) {
        const p = data.properties[name];
        if (!p) return;

        const centres = p.train.percent.map(function (_, i) {
          return (p.low + (i + 0.5) * p.width).toFixed(p.places);
        });

        const testName = 'Test ' + data.counts.test;
        // Test pEC50 only exists because the answers were released afterwards.
        // Every other property here is computed from SMILES, which were public
        // from the first day — so those two series can sit side by side, and
        // this one starts hidden and is revealed by clicking the legend.
        const hindsight = name === 'pec50';

        const series = [
          {
            name: 'Train ' + data.counts.train,
            type: 'bar',
            data: p.train.percent,
            itemStyle: { color: blue, opacity: 0.75 },
            barCategoryGap: '18%',
            barGap: '0%',
          },
          {
            name: testName,
            type: 'bar',
            data: p.test.percent,
            itemStyle: { color: coral, opacity: 0.9 },
          },
        ];

        if (p.line) {
          // Placed by fractional bin index so it lands on the real value rather
          // than snapping to a bar edge.
          series[0].markLine = {
            silent: true,
            symbol: 'none',
            lineStyle: { color: muted, type: 'dashed', width: 2 },
            label: {
              formatter: p.line.label,
              position: 'end',
              rotate: 0,
              distance: [0, 4],
              fontSize: 17,
              color: muted,
              fontFamily: mono,
            },
            data: [{ xAxis: (p.line.at - p.low) / p.width - 0.5 }],
          };
        }

        chart.setOption(
          {
            legend: {
              top: 0,
              left: 'center',
              itemGap: 24,
              textStyle: { fontSize: 17, color: muted, fontFamily: mono },
              // Rebuilt on every property change, so switching away from
              // pEC50 and back puts the reveal back where it started.
              selected: hindsight ? (function () { const m = {}; m[testName] = false; return m; })() : {},
            },
            grid: { left: '1%', right: '1%', top: 34, bottom: 30, containLabel: true },
            tooltip: {
              trigger: 'axis',
              axisPointer: { type: 'shadow' },
              valueFormatter: function (v) { return v.toFixed(1) + ' %'; },
            },
            xAxis: {
              type: 'category',
              data: centres,
              name: p.axis,
              nameLocation: 'middle',
              nameGap: 34,
              nameTextStyle: nameStyle,
              axisLabel: Object.assign({}, axisLabel, { interval: p.bins > 12 ? 4 : 0 }),
              axisTick: { show: false },
            },
            yAxis: {
              type: 'value',
              name: '%',
              nameTextStyle: Object.assign({ align: 'left' }, nameStyle),
              axisLabel: axisLabel,
              splitLine: { lineStyle: { color: rule } },
            },
            series: series,
          },
          { replaceMerge: ['series'] }
        );
      }

      // The readout beside the buttons carries the same two numbers as the
      // bars, so it has to follow the same reveal. eda-picks.js reads this.
      function publishTestState(visible) {
        el.dataset.edaTest = visible ? 'on' : 'off';
        el.dispatchEvent(new CustomEvent('eda:test', { detail: visible, bubbles: true }));
      }
      chart.on('legendselectchanged', function (event) {
        const key = Object.keys(event.selected).filter(function (k) { return k.indexOf('Test') === 0; })[0];
        if (key) publishTestState(event.selected[key]);
      });

      const first = el.dataset.property || 'pec50';
      render(first);
      publishTestState(first !== 'pec50');

      // The buttons live outside this element, so they ask for a redraw by
      // event rather than reaching into the handle deck.js keeps private.
      el.addEventListener('eda:property', function (event) {
        render(event.detail);
        publishTestState(event.detail !== 'pec50');
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
