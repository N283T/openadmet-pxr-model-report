/* PXR model-report charts. Vendored ECharts + JSON in assets/data/.
   Palette tracks the theme tokens from the personal-site design system. */
(function () {
  "use strict";

  /* Data lives next to the English page; translated pages in a subdirectory
     set window.PXR_DATA_BASE to point back at it. */
  var DATA = window.PXR_DATA_BASE || "assets/data/";
  var charts = {}; // id -> echarts instance
  var cache = {};

  function css(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  // Theme-derived palette, re-read on every (re)render.
  function palette() {
    return {
      ink: css("--ink"),
      muted: css("--muted"),
      line: css("--line"),
      surface: css("--surface"),
      bg: css("--bg"),
      blue: css("--color-blue"),
      coral: css("--color-coral"),
      teal: css("--color-teal"),
      font: "Zen Maru Gothic, system-ui, sans-serif",
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

  // Per-load cache-buster so a reload always fetches the current data JSON.
  var DATA_VERSION = "?v=" + Date.now();
  function getJSON(name) {
    return fetch(DATA + name + DATA_VERSION).then(function (r) {
      if (!r.ok) throw new Error("failed to load " + name);
      return r.json();
    });
  }

  // The nine members, drawn from the same JSON the charts use so the table and
  // the numbers cannot drift apart. Rows come sorted by Caruana weight.
  function renderMemberTable() {
    var body = document.querySelector("[data-member-rows]");
    if (!body) return;
    var famClass = { tabular: "fam-tabular", embed: "fam-embed", structural: "fam-structural" };
    var famLabel = { tabular: "tabular core", embed: "frozen embed", structural: "Boltz trunk" };
    getJSON("ensemble_members.json").then(function (d) {
      body.innerHTML = d.members.map(function (m) {
        var strat = m.strategy
          ? '<span class="strat-ref' + (m.strategy === 2 ? " coral" : "") + '">' + m.strategy + "</span>"
          : '<span class="no-strat">—</span>';
        return "<tr><th>" + m.alias + "</th>" +
          "<td>" + m.label + "</td>" +
          '<td><span class="' + famClass[m.family] + '">' + famLabel[m.family] + "</span></td>" +
          '<td class="c">' + strat + "</td>" +
          '<td class="num">' + m.oofMae.toFixed(3) + "</td>" +
          '<td class="num">' + m.weight.toFixed(3) + "</td></tr>";
      }).join("");
    }).catch(function (e) { console.error(e); });
  }

  // ---- Individual chart builders (return ECharts option) ----

  // Label-coverage heatmap: which compound group carries which measured label.
  function optCoverage(d, p) {
    var groups = d.groups, labels = d.labels;
    var data = [];
    d.matrix.forEach(function (row, gi) {
      row.forEach(function (count, li) {
        var frac = groups[gi].n ? count / groups[gi].n : 0;
        data.push([li, gi, frac, count]);
      });
    });
    return {
      textStyle: { color: p.ink, fontFamily: p.font },
      grid: { left: 6, right: 12, top: 32, bottom: 6, containLabel: true },
      tooltip: {
        backgroundColor: p.surface, borderColor: p.line, textStyle: { color: p.ink },
        formatter: function (o) {
          var g = groups[o.data[1]];
          return g.name + "<br/>" + labels[o.data[0]] + ": <b>" + o.data[3].toLocaleString() +
            "</b> of " + g.n.toLocaleString() + " (" + Math.round(o.data[2] * 100) + "%)";
        },
      },
      xAxis: {
        type: "category", data: labels, position: "top",
        axisLine: { show: false }, axisTick: { show: false }, splitArea: { show: false },
        axisLabel: { color: p.ink, fontWeight: 700, interval: 0, fontFamily: p.font },
      },
      yAxis: {
        type: "category", inverse: true, data: groups.map(function (g) { return g.name; }),
        axisLine: { show: false }, axisTick: { show: false }, splitArea: { show: false },
        axisLabel: {
          color: p.ink, interval: 0, fontFamily: p.font,
          formatter: function (name, i) { return name + " (" + groups[i].n.toLocaleString() + ")"; },
        },
      },
      visualMap: { show: false, min: 0, max: 1, dimension: 2, inRange: { color: [p.bg, p.teal] } },
      series: [{
        type: "heatmap", data: data,
        itemStyle: { borderColor: p.line, borderWidth: 1.5, borderRadius: 6 },
        label: {
          show: true, fontFamily: p.font, fontWeight: 700, color: p.ink,
          formatter: function (o) { return o.data[3] > 0 ? o.data[3].toLocaleString() : "—"; },
        },
        emphasis: { itemStyle: { borderColor: p.coral, borderWidth: 2 } },
      }],
    };
  }

  // The metrics table beside that chart, from the same JSON. One column per
  // prediction rather than one row per scope: the comparison is the point, and
  // the scopes agree with each other (the prose says so).
  function renderCalibMetrics() {
    var body = document.querySelector("[data-calib-metrics]");
    if (!body) return;
    var rows = [
      ["MAE", "Mae", 4], ["RAE", "Rae", 4], ["R\u00b2", "R2", 4],
      ["Spearman", "Spearman", 4], ["bias", "Bias", 3],
    ];
    getJSON("calibration_effect.json").then(function (d) {
      var s = d.scopes.filter(function (x) { return x.n === 513; })[0] || d.scopes[0];
      body.innerHTML = rows.map(function (r) {
        var raw = s["raw" + r[1]], cal = s["cal" + r[1]];
        var moved = raw !== cal;
        return "<tr><th>" + r[0] + "</th>" +
          '<td class="num">' + raw.toFixed(r[2]) + "</td>" +
          '<td class="num">' + (moved ? "<b>" + cal.toFixed(r[2]) + "</b>" : cal.toFixed(r[2])) +
          "</td></tr>";
      }).join("");
    }).catch(function (e) { console.error(e); });
  }

  // Calibration on one run: what it changed, per true-pEC50 band. Negative is
  // better, so improvement points one way and the cost points the other.
  function optCalibEffect(d, p) {
    var bands = d.bands;
    var span = Math.max.apply(null, bands.map(function (b) { return Math.abs(b.delta); }));
    // Rounded up so the axis ticks stay tidy, with room for a label past the end.
    var edge = Math.ceil(span * 1.45 * 100) / 100;
    return {
      textStyle: { color: p.ink, fontFamily: p.font },
      grid: { left: 58, right: 24, top: 12, bottom: 40 },
      tooltip: {
        trigger: "item", backgroundColor: p.surface, borderColor: p.line, textStyle: { color: p.ink },
        formatter: function (o) {
          var b = bands[o.dataIndex];
          return "true pEC50 " + b.label + " (n = " + b.n + ")<br/>MAE <b>" +
            b.rawMae.toFixed(3) + "</b> \u2192 <b>" + b.calMae.toFixed(3) + "</b>";
        },
      },
      xAxis: Object.assign({ type: "value", min: -edge, max: edge,
        name: "change in MAE (negative is better)",
        nameLocation: "middle", nameGap: 26, nameTextStyle: { color: p.muted, fontSize: 11 } }, axisStyle(p)),
      // Not inverse: potency runs up the axis, so the strong compounds — the ones
      // the challenge is about — sit at the top.
      yAxis: Object.assign({ type: "category",
        data: bands.map(function (b) { return b.label; }),
        name: "true pEC50", nameLocation: "middle", nameRotate: 90, nameGap: 42,
        nameTextStyle: { color: p.muted, fontSize: 11 } }, axisStyle(p)),
      series: [{
        type: "bar", barWidth: "56%",
        data: bands.map(function (b) {
          return {
            value: b.delta,
            itemStyle: { color: b.delta < 0 ? p.coral : p.muted, borderRadius: 3 },
          };
        }),
        // Always past the bar's right edge — at the zero line for the negative
        // bars, past the tip for the positive ones — in ink rather than the bar's
        // own colour, which made them vanish into the fill.
        label: {
          show: true, color: p.ink, fontSize: 11, fontFamily: p.font,
          position: "right", distance: 8,
          formatter: function (o) {
            return (o.value > 0 ? "+" : "\u2212") + Math.abs(o.value).toFixed(3);
          },
        },
      }],
    };
  }

  // Feature-vs-pEC50 correlation heatmap: Pearson and Spearman rows x feature columns.
  function optFeatureCorr(d, p) {
    var feats = d.features, rows = d.rows;
    // The picked columns keep a coral outline; visualMap still owns the fill.
    var pickStyle = { borderColor: p.coral, borderWidth: 2, borderRadius: 4 };
    // Two things keep the outline whole: the unpicked cells space themselves with
    // a transparent border rather than a background-coloured one, and the picked
    // cells paint last, since within a series the later item goes on top.
    var data = [], picked = [];
    feats.forEach(function (f, xi) {
      var into = f.pick ? picked : data;
      var style = f.pick ? { itemStyle: pickStyle } : null;
      into.push(Object.assign({ value: [xi, 0, f.pearson] }, style));
      into.push(Object.assign({ value: [xi, 1, f.spearman] }, style));
    });
    data = data.concat(picked);
    return {
      textStyle: { color: p.ink, fontFamily: p.font },
      grid: { left: 80, right: 12, top: 10, bottom: 82 },
      tooltip: {
        backgroundColor: p.surface, borderColor: p.line, textStyle: { color: p.ink },
        formatter: function (o) {
          var v = o.data.value || o.data;
          var f = feats[v[0]];
          return f.label + "<br/>" + rows[v[1]] + " = <b>" + v[2].toFixed(2) +
            "</b><br/>n = " + f.n.toLocaleString();
        },
      },
      xAxis: {
        type: "category", data: feats.map(function (f) { return f.short; }),
        axisLine: { show: false }, axisTick: { show: false }, splitArea: { show: false },
        axisLabel: {
          color: p.ink, interval: 0, rotate: 45, fontSize: 11, fontFamily: p.font,
          formatter: function (v, i) { return feats[i].pick ? "{pick|" + v + "}" : v; },
          rich: { pick: { color: p.coral, fontWeight: 800, fontSize: 11, fontFamily: p.font } },
        },
      },
      yAxis: {
        type: "category", data: rows, inverse: true,
        axisLine: { show: false }, axisTick: { show: false }, splitArea: { show: false },
        axisLabel: { color: p.ink, fontFamily: p.font, fontWeight: 600 },
      },
      visualMap: {
        show: true, min: -0.85, max: 0.85, dimension: 2, calculable: true,
        orient: "horizontal", left: "center", bottom: 6, itemWidth: 14,
        inRange: { color: ["#e2725b", "#f4efe4", "#4fb79a"] },
        textStyle: { color: p.muted },
      },
      series: [{
        type: "heatmap", data: data,
        itemStyle: { borderColor: "transparent", borderWidth: 2, borderRadius: 4 },
        label: {
          show: true, fontFamily: p.font, fontWeight: 700, color: "#2b333a",
          formatter: function (o) { return (o.data.value || o.data)[2].toFixed(2); },
        },
        emphasis: { itemStyle: { borderColor: p.coral, borderWidth: 2 } },
      }],
    };
  }

  // Top-K dimension sweep: OOF MAE (left) and Spearman (right), dual axis.
  function optKSweep(d, p) {
    var mae = d.sweep.map(function (s) { return [s.k, s.mae]; });
    var spear = d.sweep.map(function (s) { return [s.k, s.spearman]; });
    // Padded, rounded bounds so the lines get vertical headroom.
    function bounds(arr) {
      var lo = Math.min.apply(null, arr), hi = Math.max.apply(null, arr), r = (hi - lo) || 0.01;
      return { min: Math.floor((lo - r * 0.4) * 1000) / 1000, max: Math.ceil((hi + r * 0.4) * 1000) / 1000 };
    }
    var mb = bounds(mae.map(function (x) { return x[1]; }).concat([d.fullMae]));
    var sb = bounds(spear.map(function (x) { return x[1]; }).concat([d.fullSpearman]));
    return {
      textStyle: { color: p.ink, fontFamily: p.font },
      grid: { left: 20, right: 20, top: 36, bottom: 44, containLabel: true },
      legend: { data: ["OOF MAE", "Spearman ρ"], textStyle: { color: p.ink }, top: 6 },
      tooltip: {
        trigger: "axis", backgroundColor: p.surface, borderColor: p.line, textStyle: { color: p.ink },
        formatter: function (ps) {
          var k = ps[0].data[0];
          var out = "top-" + k;
          ps.forEach(function (s) { out += "<br/>" + s.seriesName + " <b>" + s.data[1].toFixed(4) + "</b>"; });
          return out;
        },
      },
      xAxis: Object.assign({ type: "value", name: "top-K features kept", min: 0, max: 1260,
        nameLocation: "middle", nameGap: 28, nameTextStyle: { color: p.muted, fontSize: 12 } }, axisStyle(p)),
      yAxis: [
        Object.assign({ type: "value", name: "OOF MAE", min: mb.min, max: mb.max, position: "left",
          nameTextStyle: { color: p.blue, fontSize: 11 } }, axisStyle(p)),
        Object.assign({ type: "value", name: "Spearman ρ", min: sb.min, max: sb.max, position: "right",
          splitLine: { show: false }, nameTextStyle: { color: p.teal, fontSize: 11 } }, axisStyle(p)),
      ],
      series: [
        { name: "OOF MAE", type: "line", yAxisIndex: 0, data: mae, symbolSize: 7,
          color: p.blue, lineStyle: { color: p.blue, width: 2 },
          markLine: { silent: true, symbol: "none", precision: 4, lineStyle: { color: p.blue, type: "dashed", width: 1.5 },
            data: [{ yAxis: d.fullMae }],
            label: { formatter: "full " + d.fullMae, color: p.blue, position: "insideStartTop", fontSize: 10 } } },
        { name: "Spearman ρ", type: "line", yAxisIndex: 1, data: spear, symbolSize: 7,
          color: p.teal, lineStyle: { color: p.teal, width: 2 },
          markLine: { silent: true, symbol: "none", precision: 4, lineStyle: { color: p.teal, type: "dashed", width: 1.5 },
            data: [{ yAxis: d.fullSpearman }],
            label: { formatter: "full " + d.fullSpearman, color: p.teal, position: "insideEndBottom", fontSize: 10 } } },
        { name: "OOF MAE", type: "scatter", yAxisIndex: 0, data: [[500, 0.4179]], symbolSize: 14,
          itemStyle: { color: p.coral, borderColor: p.surface, borderWidth: 2 },
          label: { show: true, formatter: "K=500 (used)", position: "bottom", color: p.coral, fontWeight: "bold", fontSize: 11 } },
      ],
    };
  }

  // Share of LGBM-gain by feature family in the top-500 selection.
  function optLgbmGain(d, p) {
    var fams = d.families;
    var cats = fams.map(function (f) { return f.family; });
    var data = fams.map(function (f) {
      return { value: f.gainShare, itemStyle: { color: /log2fc/.test(f.family) ? p.coral : p.blue, borderRadius: [0, 4, 4, 0] } };
    });
    return {
      textStyle: { color: p.ink, fontFamily: p.font },
      grid: { left: 8, right: 58, top: 10, bottom: 40, containLabel: true },
      tooltip: {
        trigger: "item", backgroundColor: p.surface, borderColor: p.line, textStyle: { color: p.ink },
        formatter: function (o) {
          var f = fams[o.dataIndex];
          return f.family + "<br/>gain share <b>" + Math.round(f.gainShare * 100) + "%</b><br/>" +
            f.selected + " of 500 features";
        },
      },
      xAxis: Object.assign({ type: "value", min: 0, max: 0.9, name: "share of LGBM gain",
        nameLocation: "middle", nameGap: 26, nameTextStyle: { color: p.muted, fontSize: 11 },
        axisLabel: { formatter: function (v) { return Math.round(v * 100) + "%"; } } }, axisStyle(p)),
      yAxis: Object.assign({ type: "category", inverse: true, data: cats }, axisStyle(p)),
      series: [{
        type: "bar", data: data, barWidth: "62%",
        label: { show: true, position: "right", color: p.muted, fontSize: 11,
          formatter: function (o) { return Math.round(o.value * 100) + "%"; } },
      }],
    };
  }

  // Member-vs-member prediction correlation heatmap (fixed teal palette, dark labels).
  function optMemberCorr(d, p) {
    var a = d.aliases;
    var data = [];
    d.matrix.forEach(function (row, i) {
      row.forEach(function (v, j) { data.push([j, i, v]); });
    });
    return {
      textStyle: { color: p.ink, fontFamily: p.font },
      grid: { left: 8, right: 8, top: 8, bottom: 10, containLabel: true },
      tooltip: {
        backgroundColor: p.surface, borderColor: p.line, textStyle: { color: p.ink },
        formatter: function (o) {
          return a[o.data[1]] + " vs " + a[o.data[0]] + "<br/>r = <b>" + o.data[2].toFixed(2) + "</b>";
        },
      },
      xAxis: {
        type: "category", data: a, position: "bottom",
        axisLine: { show: false }, axisTick: { show: false }, splitArea: { show: false },
        axisLabel: { color: p.ink, interval: 0, rotate: 45, fontSize: 10, fontFamily: p.font },
      },
      yAxis: {
        type: "category", data: a, inverse: true,
        axisLine: { show: false }, axisTick: { show: false }, splitArea: { show: false },
        axisLabel: { color: p.ink, interval: 0, fontSize: 11, fontFamily: p.font },
      },
      visualMap: { show: false, min: 0.8, max: 1.0, dimension: 2,
        inRange: { color: ["#eaf3ef", "#7fc6b3", "#2f8f79"] } },
      series: [{
        type: "heatmap", data: data,
        itemStyle: { borderColor: p.bg, borderWidth: 2, borderRadius: 3 },
        label: { show: true, fontFamily: p.font, fontWeight: 600, color: "#243036", fontSize: 9,
          formatter: function (o) { return o.data[2].toFixed(2); } },
        emphasis: { itemStyle: { borderColor: p.coral, borderWidth: 2 } },
      }],
    };
  }

  var SPECS = [
    { el: "chart-coverage", file: "coverage.json", build: optCoverage },
    { el: "chart-calib-effect", file: "calibration_effect.json", build: optCalibEffect },
    { el: "chart-featcorr", file: "feature_corr.json", build: optFeatureCorr },
    { el: "chart-membercorr", file: "member_corr.json", build: optMemberCorr },
    { el: "chart-ksweep", file: "topk_sweep.json", build: optKSweep },
    { el: "chart-lgbmgain", file: "lgbm_gain.json", build: optLgbmGain },
    { el: "chart-member-mae", file: "model_cards.json", build: optMemberMae },
    { el: "chart-boltz-pool", file: "boltz_pooling.json", build: optBoltzPooling },
    { el: "chart-calib-journey", file: "calibration_journey.json", build: optCalibJourney },
    { el: "chart-phase2-as2", file: "phase2_as2.json", build: optPhase2As2 },
  ];

  // Phase-1 calibration + tail-gate journey (public-LB MAE across milestones).
  function optCalibJourney(d, p) {
    var m = d.milestones;
    var cats = m.map(function (x) { return x.short; });
    var data = m.map(function (x) {
      var color = x.anchor ? p.coral : (x.short === "raw" ? p.muted : p.blue);
      return { value: x.lbMae, itemStyle: { color: color, borderRadius: [4, 4, 0, 0] } };
    });
    return {
      textStyle: { color: p.ink, fontFamily: p.font },
      grid: { left: 58, right: 20, top: 18, bottom: 28 },
      tooltip: {
        trigger: "item", backgroundColor: p.surface, borderColor: p.line, textStyle: { color: p.ink },
        formatter: function (o) {
          var x = m[o.dataIndex];
          var dv = x.deltaId55;
          return x.label + "<br/>public-LB MAE <b>" + x.lbMae.toFixed(4) + "</b>" +
            "<br/>vs id55 " + (dv > 0 ? "+" : "") + dv.toFixed(4) +
            (x.anchor ? "<br/><b>Phase 1 anchor</b>" : "");
        },
      },
      xAxis: Object.assign({ type: "category", data: cats }, axisStyle(p)),
      yAxis: Object.assign({ type: "value", name: "public-LB MAE", min: 0.4, max: 0.445,
        nameLocation: "middle", nameRotate: 90, nameGap: 46 }, axisStyle(p)),
      series: [{
        type: "bar", data: data, barWidth: "56%",
        label: { show: true, position: "top", color: p.muted, fontSize: 11,
          formatter: function (o) { return o.value.toFixed(3); } },
      }],
    };
  }

  // Phase-2 AS2 MAE regression (true answer-key labels) vs the winner's score.
  function optPhase2As2(d, p) {
    var m = d.milestones;
    var kindColor = { phase1: p.blue, phase2: p.coral, best: p.teal };
    var cats = m.map(function (x) { return x.label; });
    var data = m.map(function (x) {
      return { value: x.as2Mae, itemStyle: { color: kindColor[x.kind] || p.blue, borderRadius: [4, 4, 0, 0] } };
    });
    return {
      textStyle: { color: p.ink, fontFamily: p.font },
      grid: { left: 58, right: 20, top: 18, bottom: 28 },
      tooltip: {
        trigger: "item", backgroundColor: p.surface, borderColor: p.line, textStyle: { color: p.ink },
        formatter: function (o) {
          var x = m[o.dataIndex];
          return x.label + "<br/>AS2 MAE <b>" + x.as2Mae.toFixed(4) + "</b><br/>" + x.note;
        },
      },
      xAxis: Object.assign({ type: "category", data: cats }, axisStyle(p)),
      yAxis: Object.assign({ type: "value", name: "AS2 MAE (true labels)", min: 0.404, max: 0.414,
        nameLocation: "middle", nameRotate: 90, nameGap: 46 }, axisStyle(p)),
      series: [{
        type: "bar", data: data, barWidth: "52%",
        markLine: {
          silent: true, symbol: "none", precision: 4,
          lineStyle: { color: p.ink, type: "dashed", width: 1 },
          label: { formatter: "1st place " + d.winnerMae.toFixed(4), color: p.muted, fontSize: 10, position: "insideEndTop" },
          data: [{ yAxis: d.winnerMae }],
        },
        label: { show: true, position: "top", color: p.muted, fontSize: 11,
          formatter: function (o) { return o.value.toFixed(4); } },
      }],
    };
  }

  // Least-squares fit; returns the two endpoints of the trend line over the data x-range.
  function linfit(pts) {
    var n = pts.length, sx = 0, sy = 0, sxy = 0, sxx = 0, xmin = Infinity, xmax = -Infinity;
    for (var i = 0; i < n; i++) {
      var x = pts[i][0], y = pts[i][1];
      sx += x; sy += y; sxy += x * y; sxx += x * x;
      if (x < xmin) xmin = x;
      if (x > xmax) xmax = x;
    }
    var det = n * sxx - sx * sx;
    var slope = det ? (n * sxy - sx * sy) / det : 0;
    var b = (sy - slope * sx) / n;
    return [[xmin, slope * xmin + b], [xmax, slope * xmax + b]];
  }

  // Feature-vs-pEC50 small-multiples (Strategy section).
  function optFeatPanel(feat, p) {
    return {
      textStyle: { color: p.ink, fontFamily: p.font },
      title: { text: feat.label, left: 14, top: 8,
        textStyle: { color: p.ink, fontSize: 13, fontWeight: 700, fontFamily: p.font } },
      graphic: [{ type: "text", right: 14, top: 11,
        style: { text: "Pearson r = " + feat.r + "   n = " + feat.n.toLocaleString(),
          fill: p.coral, font: "bold 12px " + p.font } }],
      grid: { left: 52, right: 14, top: 42, bottom: 46 },
      tooltip: { show: false },
      xAxis: Object.assign({ type: "value", scale: true, name: feat.label,
        nameLocation: "middle", nameGap: 26, nameTextStyle: { color: p.muted, fontSize: 12 } }, axisStyle(p)),
      yAxis: Object.assign({ type: "value", scale: true, name: "pEC50",
        nameLocation: "middle", nameRotate: 90, nameGap: 34,
        nameTextStyle: { color: p.muted, fontSize: 12 } }, axisStyle(p)),
      series: [
        { type: "scatter", data: feat.points, symbolSize: 4,
          itemStyle: { color: p.blue, opacity: 0.32 }, z: 2 },
        { type: "line", data: linfit(feat.points), showSymbol: false, silent: true,
          lineStyle: { color: p.coral, width: 2 }, z: 3 },
      ],
    };
  }

  function renderFeatureScatter(p) {
    var apply = function (d) {
      cache["feature_vs_pec50.json"] = d;
      d.features.forEach(function (feat, i) {
        var node = document.getElementById("chart-feat-" + i);
        if (!node) return;
        var id = "feat" + i;
        if (charts[id]) charts[id].dispose();
        var inst = echarts.init(node, null, { renderer: "canvas" });
        inst.setOption(optFeatPanel(feat, p));
        charts[id] = inst;
      });
    };
    if (cache["feature_vs_pec50.json"]) apply(cache["feature_vs_pec50.json"]);
    else getJSON("feature_vs_pec50.json").then(apply).catch(function (e) { console.error(e); });
  }

  // Per-member OOF vs test MAE (grouped horizontal bars).
  function optMemberMae(d, p) {
    var rows = Object.keys(d.cards).map(function (k) {
      var c = d.cards[k];
      return { name: k, test: c.testMae, oof: c.oofMae, family: c.family };
    });
    rows.sort(function (a, b) { return b.test - a.test; }); // worst first; inverse axis puts best on top
    var cats = rows.map(function (r) { return r.name; });
    function bar(key, color, name) {
      return {
        name: name, type: "bar", barGap: "28%", barWidth: "34%", barCategoryGap: "34%",
        data: rows.map(function (r) { return r[key]; }),
        itemStyle: { color: color, borderRadius: [0, 4, 4, 0] },
        label: { show: true, position: "right", color: p.muted, fontSize: 10,
          formatter: function (o) { return o.value.toFixed(3); } },
      };
    }
    return {
      textStyle: { color: p.ink, fontFamily: p.font },
      grid: { left: 8, right: 54, top: 36, bottom: 30, containLabel: true },
      legend: { top: 4, itemWidth: 14, itemHeight: 10, textStyle: { color: p.ink },
        data: ["test MAE (AS1+AS2)", "OOF MAE"] },
      tooltip: {
        trigger: "axis", axisPointer: { type: "shadow" },
        backgroundColor: p.surface, borderColor: p.line, textStyle: { color: p.ink },
        formatter: function (arr) {
          var r = rows[arr[0].dataIndex];
          var gap = r.test - r.oof;
          return r.name + "<br/>test MAE <b>" + r.test.toFixed(3) + "</b><br/>OOF MAE <b>" +
            r.oof.toFixed(3) + "</b><br/>gap " + (gap >= 0 ? "+" : "") + gap.toFixed(3);
        },
      },
      xAxis: Object.assign({ type: "value", name: "MAE", min: 0,
        nameLocation: "middle", nameGap: 26, nameTextStyle: { color: p.muted, fontSize: 11 } }, axisStyle(p)),
      yAxis: Object.assign({ type: "category", inverse: true, data: cats }, axisStyle(p)),
      series: [bar("test", p.coral, "test MAE (AS1+AS2)"), bar("oof", p.blue, "OOF MAE")],
    };
  }

  // Boltz trunk-pooling sweep (OOF MAE); kept variants highlighted.
  function optBoltzPooling(d, p) {
    var rows = d.variants.slice().sort(function (a, b) { return b.oofMae - a.oofMae; });
    var cats = rows.map(function (r) { return r.label; });
    var data = rows.map(function (r) {
      return { value: r.oofMae, itemStyle: {
        color: r.kept ? p.coral : p.blue, borderRadius: [0, 4, 4, 0], opacity: r.kept ? 1 : 0.5 } };
    });
    return {
      textStyle: { color: p.ink, fontFamily: p.font },
      grid: { left: 8, right: 48, top: 12, bottom: 30, containLabel: true },
      tooltip: {
        trigger: "item", backgroundColor: p.surface, borderColor: p.line, textStyle: { color: p.ink },
        formatter: function (o) {
          var r = rows[o.dataIndex];
          return r.label + "<br/>OOF MAE <b>" + r.oofMae.toFixed(3) + "</b>" +
            "<br/>vector size <b>" + r.dim + "d</b>" +
            (r.kept ? "<br/><b>kept in ensemble</b>" : "");
        },
      },
      xAxis: Object.assign({ type: "value", name: "OOF MAE", min: 0.45,
        nameLocation: "middle", nameGap: 26, nameTextStyle: { color: p.muted, fontSize: 11 } }, axisStyle(p)),
      yAxis: Object.assign({ type: "category", inverse: true, data: cats }, axisStyle(p)),
      series: [{
        type: "bar", data: data, barWidth: "58%",
        label: { show: true, position: "right", color: p.muted, fontSize: 11,
          formatter: function (o) { return o.value.toFixed(3); } },
      }],
    };
  }

  function renderAll() {
    var p = palette();
    SPECS.forEach(function (spec) {
      var node = document.getElementById(spec.el);
      if (!node) return;
      var apply = function (d) {
        cache[spec.file] = d;
        if (charts[spec.el]) charts[spec.el].dispose();
        var inst = echarts.init(node, null, { renderer: "canvas" });
        inst.setOption(spec.build(d, p));
        charts[spec.el] = inst;
      };
      if (cache[spec.file]) apply(cache[spec.file]);
      else getJSON(spec.file).then(apply).catch(function (e) {
        node.innerHTML = '<p style="padding:20px;color:var(--muted)">Chart data unavailable.</p>';
        console.error(e);
      });
    });
    renderFeatureScatter(p);
    renderMemberTable();
    renderCalibMetrics();
  }

  function setupTheme() {
    var toggle = document.getElementById("theme-toggle");
    var root = document.documentElement;
    if (!toggle) return;
    function sync() {
      toggle.textContent = root.getAttribute("data-theme") === "dark" ? "☾" : "☀";
    }
    sync();
    toggle.addEventListener("click", function () {
      var next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      try { localStorage.setItem("theme", next); } catch (e) {}
      sync();
      requestAnimationFrame(renderAll); // re-read palette under the new theme
    });
  }

  var resizeTimer;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      Object.keys(charts).forEach(function (k) { charts[k].resize(); });
    }, 150);
  });

  document.addEventListener("DOMContentLoaded", function () {
    setupTheme();
    renderAll();
  });
})();
