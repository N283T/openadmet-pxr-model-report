(function () {
  'use strict';
  window.DeckCharts = window.DeckCharts || {};

  // One interactive demo, four views. Every panel starts from the same eight
  // compounds and the same wrong predictions, so switching tabs changes only
  // what the metric pays attention to — which is the point being made.
  //
  //   mae / rae  errors as bars between measured and predicted
  //   r2         predicted against measured, with the perfect-fit diagonal
  //   rho        the same points, redrawn as ranks
  //
  // The mode comes from data-mode on the chart element.

  function mean(values) {
    return values.reduce(function (a, b) { return a + b; }, 0) / values.length;
  }

  // Ranks, averaging ties the way Spearman requires.
  function ranks(values) {
    const order = values
      .map(function (v, i) { return { v: v, i: i }; })
      .sort(function (a, b) { return a.v - b.v; });
    const out = new Array(values.length);
    let k = 0;
    while (k < order.length) {
      let j = k;
      while (j + 1 < order.length && order[j + 1].v === order[k].v) j += 1;
      const shared = (k + j) / 2 + 1;
      for (let m = k; m <= j; m += 1) out[order[m].i] = shared;
      k = j + 1;
    }
    return out;
  }

  function pearson(a, b) {
    const ma = mean(a);
    const mb = mean(b);
    let num = 0;
    let da = 0;
    let db = 0;
    for (let i = 0; i < a.length; i += 1) {
      const x = a[i] - ma;
      const y = b[i] - mb;
      num += x * y;
      da += x * x;
      db += y * y;
    }
    return da && db ? num / Math.sqrt(da * db) : 0;
  }

  const METRICS = {
    mae: function (actual, pred) {
      return mean(actual.map(function (a, i) { return Math.abs(a - pred[i]); }));
    },
    // Error relative to the laziest possible model: always answer the mean.
    rae: function (actual, pred) {
      const baseline = mean(actual);
      const err = actual.reduce(function (s, a, i) { return s + Math.abs(a - pred[i]); }, 0);
      const base = actual.reduce(function (s, a) { return s + Math.abs(a - baseline); }, 0);
      return base ? err / base : 0;
    },
    r2: function (actual, pred) {
      const baseline = mean(actual);
      const ssRes = actual.reduce(function (s, a, i) { return s + Math.pow(a - pred[i], 2); }, 0);
      const ssTot = actual.reduce(function (s, a) { return s + Math.pow(a - baseline, 2); }, 0);
      return ssTot ? 1 - ssRes / ssTot : 0;
    },
    rho: function (actual, pred) {
      return pearson(ranks(actual), ranks(pred));
    },
  };

  window.DeckCharts.metricDemo = {
    init: function (el, data) {
      const mode = el.dataset.mode || 'mae';
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

      const panel = el.closest('.metric-panel') || document;
      const predicted = data.predicted.slice();
      const isScatter = mode === 'r2';
      const isRank = mode === 'rho';

      // Rank mode works on a permutation rather than on values: the whole
      // point is that ρ cannot see anything else. predRank[i] is where
      // compound i sits in the predicted ordering, 1 = weakest.
      const actualRank = ranks(data.actual);
      // ρ opens from a perfect ordering. Breaking a correct ranking and
      // watching the number fall explains the metric better than arriving at
      // a jumble and having to fix it.
      let predRank = actualRank.slice();

      // Move one compound to a new position and let the others close ranks,
      // which is what "swapping two predictions" actually does.
      function moveTo(compound, target) {
        const order = predRank
          .map(function (r, i) { return { r: r, i: i }; })
          .sort(function (a, b) { return a.r - b.r; })
          .map(function (o) { return o.i; });
        const from = order.indexOf(compound);
        order.splice(from, 1);
        const to = Math.max(0, Math.min(order.length, Math.round(target) - 1));
        order.splice(to, 0, compound);
        order.forEach(function (c, idx) { predRank[c] = idx + 1; });
      }

      function shown() {
        return isRank
          ? { actual: ranks(data.actual), predicted: ranks(predicted) }
          : { actual: data.actual, predicted: predicted };
      }

      const baselineMae = mean(data.actual.map(function (a) {
        return Math.abs(a - mean(data.actual));
      }));

      function publish() {
        const target = panel.querySelector('[data-metric-value]');
        if (target) {
          const value = isRank
            ? pearson(actualRank, predRank)
            : METRICS[mode](data.actual, predicted);
          target.textContent = value.toFixed(3);
        }
        // RAE is a ratio; spelling out the two numbers it divides makes the
        // formula above it readable as arithmetic rather than notation.
        const detail = panel.querySelector('[data-metric-detail]');
        if (detail && mode === 'rae') {
          const m = METRICS.mae(data.actual, predicted);
          detail.textContent = 'MAE ' + m.toFixed(3) + ' ÷ 平均モデル ' + baselineMae.toFixed(3);
        }
      }

      function errorBars() {
        const v = shown();
        return v.actual.map(function (a, i) {
          return [i, Math.min(a, v.predicted[i]), Math.max(a, v.predicted[i])];
        });
      }

      const renderError = function (params, api) {
        const i = api.value(0);
        const lo = api.coord([i, api.value(1)]);
        const hi = api.coord([i, api.value(2)]);
        return {
          type: 'rect',
          shape: { x: lo[0] - 5, y: hi[1], width: 10, height: lo[1] - hi[1] },
          style: { fill: coral, opacity: 0.28 },
        };
      };

      const axisText = { color: muted, fontSize: 19 };
      // Ranks are whole numbers, so the axis has to land on them; a padded
      // range like 0.4–8.6 puts every gridline on a fraction instead.
      const rankRange = [0, data.actual.length + 1];

      function categoryOption() {
        const v = shown();
        return {
          animation: false,
          grid: { left: 70, right: 30, top: 56, bottom: 54 },
          legend: {
            data: ['実測', '予測'],
            top: 4, right: 8, icon: 'circle', itemGap: 26,
            itemWidth: 14, itemHeight: 14, selectedMode: false,
            textStyle: axisText,
          },
          xAxis: {
            type: 'category',
            data: data.labels,
            axisLabel: { fontSize: 20, color: muted },
            axisTick: { show: false },
            axisLine: { lineStyle: { color: line } },
            name: '化合物', nameLocation: 'middle', nameGap: 34, nameTextStyle: axisText,
          },
          yAxis: {
            type: 'value',
            min: isRank ? rankRange[0] : data.yRange[0],
            max: isRank ? rankRange[1] : data.yRange[1],
            interval: isRank ? 1 : null,
            axisLabel: { fontSize: 19, color: muted },
            splitLine: { lineStyle: { color: line, opacity: 0.6 } },
            axisLine: { show: true, lineStyle: { color: line } },
            name: isRank ? '順位（小さいほど弱い）' : 'pEC50',
            nameLocation: 'middle', nameGap: 46, nameTextStyle: axisText,
          },
          series: [
            {
              type: 'custom', renderItem: renderError, silent: true, data: errorBars(), z: 1,
              // The line RAE divides by: what a model that always answers the
              // mean would be compared against.
              markLine: mode !== 'rae' ? undefined : {
                silent: true,
                symbol: 'none',
                lineStyle: { color: muted, type: 'dashed', width: 1.5, opacity: 0.8 },
                label: {
                  show: true, formatter: '実測の平均', position: 'insideEndTop',
                  color: muted, fontSize: 18,
                },
                data: [{ yAxis: mean(data.actual) }],
              },
            },
            {
              name: '実測', type: 'scatter', symbolSize: 20, silent: true, z: 3,
              itemStyle: { color: teal },
              data: v.actual.map(function (a, i) { return [i, a]; }),
            },
            {
              name: '予測', type: 'scatter', symbolSize: 20, silent: true, z: 4,
              itemStyle: { color: coral, borderColor: '#fff', borderWidth: 2 },
              data: v.predicted.map(function (p, i) { return [i, p]; }),
            },
          ],
          // The mean-answer baseline is what RAE divides by, so it is drawn.
          graphic: [],
        };
      }

      // Slope chart: measured ranking on the left, predicted on the right,
      // one line per compound. Lines that cross are pairs the model put in the
      // wrong order — which is exactly what ρ counts.
      function slopeOption() {
        const n = data.actual.length;
        const series = data.labels.map(function (label, i) {
          const crossed = (actualRank[i] - predRank[i]) !== 0;
          return {
            name: label,
            type: 'line',
            silent: true,
            // The compound name sits inside its marker, so the eye follows one
            // object across the chart instead of pairing a dot with a letter
            // beside it. Line series default to a hollow marker, which leaves
            // nothing for white text to sit on — hence the explicit 'circle'.
            symbol: 'circle',
            symbolSize: 40,
            data: [[0, actualRank[i]], [1, predRank[i]]],
            lineStyle: { color: crossed ? coral : teal, width: crossed ? 3 : 2, opacity: crossed ? 0.9 : 0.5 },
            itemStyle: {
              color: crossed ? coral : teal,
              // A rim in the page colour keeps a marker from merging into the
              // line it sits on, or into another marker it passes.
              borderColor: css('--color-bg'),
              borderWidth: 3,
            },
            label: {
              show: true,
              position: 'inside',
              formatter: label,
              fontSize: 20,
              fontFamily: css('--font-mono'),
              color: '#fff',
            },
            z: crossed ? 5 : 3,
          };
        });
        return {
          animation: false,
          grid: { left: 158, right: 96, top: 84, bottom: 96 },
          xAxis: {
            // Ticks have to land exactly on 0 and 1 for the two column labels
            // to appear; padding comes from the grid box instead.
            type: 'value', min: 0, max: 1,
            axisLabel: {
              // The bottom-ranked marker sits on the axis line; its radius has
              // to clear these captions.
              fontSize: 22, color: muted, margin: 44,
              formatter: function (v) { return v === 0 ? '実測' : (v === 1 ? '予測' : ''); },
            },
            axisTick: { show: false },
            splitLine: { show: false },
            axisLine: { show: false },
            interval: 1,
          },
          yAxis: {
            // Exactly the ranks, no padded fractions: the grid lines are the
            // positions compounds can occupy. Padding lives in the grid box.
            type: 'value', min: 1, max: n, interval: 1, inverse: true,
            axisLabel: { fontSize: 19, color: muted, margin: 46 },
            splitLine: { lineStyle: { color: line, opacity: 0.5 } },
            axisLine: { show: false },
            axisTick: { show: false },
            name: '順位（1 = 最も強い）',
            nameLocation: 'middle', nameGap: 88, nameTextStyle: axisText,
          },
          series: series,
        };
      }

      function scatterOption() {
        const lo = data.yRange[0];
        const hi = data.yRange[1];
        return {
          animation: false,
          grid: { left: 78, right: 34, top: 30, bottom: 60 },
          xAxis: {
            type: 'value', min: lo, max: hi,
            axisLabel: { fontSize: 19, color: muted },
            splitLine: { lineStyle: { color: line, opacity: 0.6 } },
            axisLine: { lineStyle: { color: line } },
            name: '実測 pEC50', nameLocation: 'middle', nameGap: 38, nameTextStyle: axisText,
          },
          yAxis: {
            type: 'value', min: lo, max: hi,
            axisLabel: { fontSize: 19, color: muted },
            splitLine: { lineStyle: { color: line, opacity: 0.6 } },
            axisLine: { show: true, lineStyle: { color: line } },
            name: '予測 pEC50', nameLocation: 'middle', nameGap: 48, nameTextStyle: axisText,
          },
          series: [
            {
              name: '完全一致', type: 'line', silent: true, showSymbol: false, z: 1,
              data: [[lo, lo], [hi, hi]],
              lineStyle: { color: teal, type: 'dashed', width: 2 },
            },
            {
              name: '予測', type: 'scatter', symbolSize: 20, silent: true, z: 4,
              itemStyle: { color: coral, borderColor: '#fff', borderWidth: 2 },
              data: data.actual.map(function (a, i) { return [a, predicted[i]]; }),
            },
          ],
        };
      }

      function fullOption() {
        if (isScatter) return scatterOption();
        if (isRank) return slopeOption();
        return categoryOption();
      }

      chart.setOption(fullOption());

      function seriesPatch() {
        if (isRank) return slopeOption().series;
        if (isScatter) {
          return [{}, { data: data.actual.map(function (a, i) { return [a, predicted[i]]; }) }];
        }
        const v = shown();
        return [
          { data: errorBars() },
          { data: v.actual.map(function (a, i) { return [i, a]; }) },
          { data: v.predicted.map(function (p, i) { return [i, p]; }) },
        ];
      }

      // Handles live in pixel space on top of each prediction; ECharts has no
      // drag for series data. In rank mode the marks show ranks, so a handle
      // has to be placed at the rank while editing the underlying value.
      function handles() {
        const v = shown();
        if (isRank) {
          return predRank.map(function (rank, i) {
            return {
              type: 'circle',
              id: 'h' + i,
              position: chart.convertToPixel({ gridIndex: 0 }, [1, rank]),
              shape: { r: 22 },
              style: { fill: 'transparent' },
              draggable: 'vertical',
              cursor: 'ns-resize',
              z: 200,
              ondrag: function () {
                const point = chart.convertFromPixel({ gridIndex: 0 }, [this.x, this.y]);
                moveTo(i, point[1]);
                chart.setOption({ series: seriesPatch() });
                publish();
              },
              ondragend: syncHandles,
            };
          });
        }
        return predicted.map(function (value, i) {
          const at = isScatter
            ? [data.actual[i], value]
            : [i, value];
          return {
            type: 'circle',
            id: 'h' + i,
            position: chart.convertToPixel({ gridIndex: 0 }, at),
            shape: { r: 20 },
            style: { fill: 'transparent' },
            draggable: 'vertical',
            cursor: 'ns-resize',
            z: 200,
            ondrag: function () {
              const point = chart.convertFromPixel({ gridIndex: 0 }, [this.x, this.y]);
              let next = point[1];
              if (isRank) {
                // Dragging a rank moves the value to that position in the
                // ordering; ranks themselves are not free parameters.
                const sorted = data.actual.slice().sort(function (a, b) { return a - b; });
                const idx = Math.round(Math.max(1, Math.min(sorted.length, next))) - 1;
                next = sorted[idx];
              }
              predicted[i] = Math.max(data.yRange[0], Math.min(data.yRange[1], next));
              chart.setOption({ series: seriesPatch() });
              publish();
            },
            ondragend: syncHandles,
          };
        });
      }

      function syncHandles() {
        chart.setOption({ graphic: handles() });
      }

      function apply() {
        chart.setOption({ series: seriesPatch() });
        syncHandles();
        publish();
      }

      const ACTIONS = {
        reset: function () {
          data.predicted.forEach(function (v, i) { predicted[i] = v; });
          predRank = actualRank.slice();
        },
        perfect: function () {
          data.actual.forEach(function (v, i) { predicted[i] = v; });
          predRank = actualRank.slice();
        },
        // Nudge every prediction a fixed fraction of the way towards its
        // measurement. Pressing it repeatedly walks the metric down smoothly,
        // which is easier to narrate than dragging eight points by hand.
        improve: function () {
          data.actual.forEach(function (a, i) {
            predicted[i] = predicted[i] + (a - predicted[i]) * 0.4;
          });
        },
        // The same step outwards. A prediction already sitting on its
        // measurement has no side to move away from, so it goes up.
        worsen: function () {
          data.actual.forEach(function (a, i) {
            const away = predicted[i] < a ? -1 : 1;
            const next = predicted[i] + away * 0.35;
            predicted[i] = Math.max(data.yRange[0], Math.min(data.yRange[1], next));
          });
        },
        // One adjacent pair put the wrong way round: the smallest mistake a
        // rank metric can register.
        swap: function () {
          const order = predRank
            .map(function (r, i) { return { r: r, i: i }; })
            .sort(function (a, b) { return a.r - b.r; })
            .map(function (o) { return o.i; });
          const at = Math.floor(order.length / 2) - 1;
          const tmp = order[at];
          order[at] = order[at + 1];
          order[at + 1] = tmp;
          order.forEach(function (c, idx) { predRank[c] = idx + 1; });
        },
      };

      panel.querySelectorAll('[data-demo-action]').forEach(function (button) {
        button.addEventListener('click', function () {
          (ACTIONS[button.dataset.demoAction] || ACTIONS.reset)();
          apply();
        });
      });

      syncHandles();
      publish();

      return {
        chart: chart,
        resize: function () { chart.resize(); syncHandles(); },
        dispose: function () { chart.dispose(); },
        onEnter: function () { chart.resize(); syncHandles(); publish(); },
        onLeave: function () {},
      };
    },
  };
})();
