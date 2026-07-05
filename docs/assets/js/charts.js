/* PXR model-report charts. Vendored ECharts + JSON in assets/data/.
   Palette tracks the theme tokens from the personal-site design system. */
(function () {
  "use strict";

  var DATA = "assets/data/";
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

  function baseGrid(p) {
    return {
      textStyle: { color: p.ink, fontFamily: p.font },
      grid: { left: 56, right: 24, top: 48, bottom: 52, containLabel: true },
      tooltip: { trigger: "item", backgroundColor: p.surface, borderColor: p.line,
        textStyle: { color: p.ink, fontFamily: p.font } },
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

  function diagonalSeries(min, max, p) {
    return {
      type: "line", showSymbol: false, silent: true,
      data: [[min, min], [max, max]],
      lineStyle: { color: p.muted, type: "dashed", width: 1 },
      z: 1, tooltip: { show: false },
    };
  }

  function getJSON(name) {
    return fetch(DATA + name).then(function (r) {
      if (!r.ok) throw new Error("failed to load " + name);
      return r.json();
    });
  }

  // ---- Individual chart builders (return ECharts option) ----

  function optPhase(d, p) {
    var metrics = [
      { key: "mae", name: "MAE" }, { key: "rae", name: "RAE" },
      { key: "r2", name: "R²" }, { key: "spearman", name: "Spearman ρ" },
      { key: "kendall", name: "Kendall τ" },
    ];
    var cats = metrics.map(function (m) { return m.name; });
    function series(ph, color) {
      var row = d.phases.find(function (x) { return x.phase === ph; });
      return { name: ph, type: "bar", itemStyle: { color: color, borderRadius: [4, 4, 0, 0] },
        data: metrics.map(function (m) { return row[m.key]; }),
        label: { show: true, position: "top", color: p.muted, fontSize: 10,
          formatter: function (o) { return o.value.toFixed(3); } } };
    }
    return Object.assign(baseGrid(p), {
      tooltip: { trigger: "axis", backgroundColor: p.surface, borderColor: p.line, textStyle: { color: p.ink } },
      legend: { data: ["Phase 1", "Phase 2"], textStyle: { color: p.ink }, top: 8 },
      xAxis: Object.assign({ type: "category", data: cats }, axisStyle(p)),
      yAxis: Object.assign({ type: "value", max: 1 }, axisStyle(p)),
      series: [series("Phase 1", p.blue), series("Phase 2", p.coral)],
    });
  }

  function optShap(d, p) {
    var fams = d.families.slice().sort(function (a, b) { return a.share - b.share; });
    return Object.assign(baseGrid(p), {
      grid: { left: 90, right: 60, top: 20, bottom: 40, containLabel: true },
      tooltip: { trigger: "item", backgroundColor: p.surface, borderColor: p.line, textStyle: { color: p.ink },
        formatter: function (o) {
          var f = fams[o.dataIndex];
          return f.family + "<br/>share " + (f.share * 100).toFixed(1) + "%<br/>" + f.nSelected + " features";
        } },
      xAxis: Object.assign({ type: "value", axisLabel: { formatter: function (v) { return (v * 100) + "%"; } } }, axisStyle(p)),
      yAxis: Object.assign({ type: "category", data: fams.map(function (f) { return f.family; }) }, axisStyle(p)),
      series: [{ type: "bar", itemStyle: { color: p.blue, borderRadius: [0, 4, 4, 0] },
        data: fams.map(function (f) { return f.share; }),
        label: { show: true, position: "right", color: p.muted, fontSize: 11,
          formatter: function (o) { return (o.value * 100).toFixed(1) + "%"; } } }],
    });
  }

  function optMembers(d, p) {
    var m = d.members;
    var names = m.map(function (x) { return x.label; });
    return Object.assign(baseGrid(p), {
      grid: { left: 56, right: 56, top: 40, bottom: 140, containLabel: true },
      tooltip: { trigger: "axis", backgroundColor: p.surface, borderColor: p.line, textStyle: { color: p.ink } },
      legend: { data: ["Caruana weight", "Standalone AS1 MAE"], textStyle: { color: p.ink }, top: 8 },
      xAxis: Object.assign({ type: "category", data: names,
        axisLabel: { color: p.muted, interval: 0, rotate: 32, fontSize: 10, width: 120, overflow: "truncate" } }, axisStyle(p)),
      yAxis: [
        Object.assign({ type: "value", name: "weight", position: "left", max: 0.35 }, axisStyle(p)),
        Object.assign({ type: "value", name: "AS1 MAE", position: "right", min: 0.4, max: 0.52, splitLine: { show: false } }, axisStyle(p)),
      ],
      series: [
        { name: "Caruana weight", type: "bar", yAxisIndex: 0, itemStyle: { color: p.blue, borderRadius: [4, 4, 0, 0] },
          data: m.map(function (x) { return x.weight; }) },
        { name: "Standalone AS1 MAE", type: "line", yAxisIndex: 1, color: p.coral, symbolSize: 7,
          lineStyle: { color: p.coral },
          data: m.map(function (x) { return x.standaloneMae; }),
          markLine: { silent: true, symbol: "none", lineStyle: { color: p.teal, type: "dashed", width: 2 },
            data: [{ yAxis: d.ensembleMae, name: "ensemble" }],
            label: { formatter: "ensemble " + d.ensembleMae, color: p.teal, position: "insideEndTop" } } },
      ],
    });
  }

  function optCalibration(d, p) {
    var pts = d.bins.map(function (b) { return [b.meanTrue, b.meanPred, b.n, b.bin]; });
    var lo = 2, hi = 7;
    return Object.assign(baseGrid(p), {
      tooltip: { trigger: "item", backgroundColor: p.surface, borderColor: p.line, textStyle: { color: p.ink },
        formatter: function (o) {
          if (o.seriesType !== "scatter") return "";
          return "bin " + o.data[3] + " (n=" + o.data[2] + ")<br/>mean true " + o.data[0] +
            "<br/>mean pred " + o.data[1] + "<br/>bias " + (o.data[1] - o.data[0]).toFixed(2);
        } },
      xAxis: Object.assign({ type: "value", name: "mean measured pEC50", min: lo, max: hi }, axisStyle(p)),
      yAxis: Object.assign({ type: "value", name: "mean predicted pEC50", min: lo, max: hi }, axisStyle(p)),
      series: [
        diagonalSeries(lo, hi, p),
        { type: "scatter", itemStyle: { color: p.teal, borderColor: p.surface, borderWidth: 1 },
          data: pts,
          symbolSize: function (v) { return Math.max(12, Math.sqrt(v[2]) * 2.4); },
          label: { show: true, position: "right", color: p.muted, fontSize: 11,
            formatter: function (o) { return o.data[3]; } } },
      ],
    });
  }

  function optLeaderboard(d, p) {
    var others = [], me = [];
    d.rows.forEach(function (r) {
      var pt = [r.mae, r.spearman, r.username, r.rank];
      (r.isMe ? me : others).push(pt);
    });
    return Object.assign(baseGrid(p), {
      tooltip: { trigger: "item", backgroundColor: p.surface, borderColor: p.line, textStyle: { color: p.ink },
        formatter: function (o) {
          return "#" + o.data[3] + " " + o.data[2] + "<br/>MAE " + o.data[0] + "<br/>Spearman " + o.data[1];
        } },
      legend: { data: ["Competitors", "This submission (N283T)"], textStyle: { color: p.ink }, top: 8 },
      xAxis: Object.assign({ type: "value", name: "MAE (lower better)", scale: true }, axisStyle(p)),
      yAxis: Object.assign({ type: "value", name: "Spearman ρ (higher better)", scale: true }, axisStyle(p)),
      series: [
        { name: "Competitors", type: "scatter", data: others, symbolSize: 9,
          itemStyle: { color: p.blue, opacity: 0.5, borderColor: p.line } },
        { name: "This submission (N283T)", type: "scatter", data: me, symbolSize: 20,
          itemStyle: { color: p.coral, borderColor: p.surface, borderWidth: 2, shadowBlur: 8,
            shadowColor: "rgba(0,0,0,0.15)" },
          label: { show: true, formatter: "N283T · #4", position: "right", color: p.coral, fontWeight: "bold" } },
      ],
    });
  }

  function optScatter(d, p) {
    var as1 = [], as2 = [];
    d.points.forEach(function (pt) {
      (pt.set === "AS1" ? as1 : as2).push([pt.true, pt.pred, pt.name]);
    });
    var lo = 2, hi = 8;
    return Object.assign(baseGrid(p), {
      tooltip: { trigger: "item", backgroundColor: p.surface, borderColor: p.line, textStyle: { color: p.ink },
        formatter: function (o) {
          if (o.seriesType !== "scatter") return "";
          return o.data[2] + "<br/>measured " + o.data[0] + "<br/>predicted " + o.data[1];
        } },
      legend: { data: ["AS1 (n=253)", "AS2 (n=260, blinded)"], textStyle: { color: p.ink }, top: 8 },
      xAxis: Object.assign({ type: "value", name: "measured pEC50", min: lo, max: hi }, axisStyle(p)),
      yAxis: Object.assign({ type: "value", name: "predicted pEC50", min: lo, max: hi }, axisStyle(p)),
      series: [
        diagonalSeries(lo, hi, p),
        { name: "AS1 (n=253)", type: "scatter", data: as1, symbolSize: 7,
          itemStyle: { color: p.blue, opacity: 0.65 } },
        { name: "AS2 (n=260, blinded)", type: "scatter", data: as2, symbolSize: 7,
          itemStyle: { color: p.coral, opacity: 0.7 } },
      ],
    });
  }

  function optProxy(d, p) {
    var pts = d.points.map(function (x) { return [x.as1, x.as2, x.label]; });
    var lo = 0.39, hi = 0.55;
    return Object.assign(baseGrid(p), {
      tooltip: { trigger: "item", backgroundColor: p.surface, borderColor: p.line, textStyle: { color: p.ink },
        formatter: function (o) {
          if (o.seriesType !== "scatter") return "";
          return o.data[2] + "<br/>AS1 MAE " + o.data[0] + "<br/>AS2 MAE " + o.data[1];
        } },
      graphic: [{ type: "text", right: 30, top: 40, style: {
        text: "Pearson r = " + d.pearson, fill: p.muted, font: "13px " + p.font } }],
      xAxis: Object.assign({ type: "value", name: "local AS1 MAE", min: lo, max: hi }, axisStyle(p)),
      yAxis: Object.assign({ type: "value", name: "blinded AS2 MAE", min: lo, max: hi }, axisStyle(p)),
      series: [
        diagonalSeries(lo, hi, p),
        { type: "scatter", data: pts, symbolSize: 8, itemStyle: { color: p.blue, opacity: 0.6 } },
      ],
    });
  }

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

  // Assay-flow Sankey (alternative view of the same coverage).
  function optSankey(d, p) {
    var colorFor = {
      "Single-conc screen": p.teal,
      "Direct to dose-response": p.coral,
      "Aux only (log2fc)": p.teal,
      "Dose-response train": p.blue,
      "Counter assay": p.blue,
    };
    var nodes = d.nodes.map(function (n) {
      return { name: n.name, itemStyle: { color: colorFor[n.name] || p.blue, borderColor: p.line } };
    });
    return {
      textStyle: { color: p.ink, fontFamily: p.font },
      tooltip: {
        trigger: "item", backgroundColor: p.surface, borderColor: p.line, textStyle: { color: p.ink },
        formatter: function (o) {
          if (o.dataType === "edge") {
            return o.data.source + " → " + o.data.target + "<br/><b>" +
              o.data.value.toLocaleString() + "</b> compounds";
          }
          return o.name + (o.value ? "<br/><b>" + o.value.toLocaleString() + "</b> compounds" : "");
        },
      },
      series: [{
        type: "sankey", left: 8, right: 158, top: 16, bottom: 16,
        nodeWidth: 20, nodeGap: 20, draggable: false,
        data: nodes, links: d.links,
        label: {
          color: p.ink, fontFamily: p.font, fontSize: 12, fontWeight: 600,
          formatter: function (o) { return o.name + "  " + (o.value != null ? o.value.toLocaleString() : ""); },
        },
        lineStyle: { color: "source", opacity: 0.55, curveness: 0.5 },
        emphasis: { focus: "adjacency", lineStyle: { opacity: 0.75 } },
      }],
    };
  }

  // Feature-vs-pEC50 correlation heatmap: Pearson and Spearman rows x feature columns.
  function optFeatureCorr(d, p) {
    var feats = d.features, rows = d.rows;
    var data = [];
    feats.forEach(function (f, xi) {
      data.push([xi, 0, f.pearson]);
      data.push([xi, 1, f.spearman]);
    });
    return {
      textStyle: { color: p.ink, fontFamily: p.font },
      grid: { left: 6, right: 6, top: 10, bottom: 92, containLabel: true },
      tooltip: {
        backgroundColor: p.surface, borderColor: p.line, textStyle: { color: p.ink },
        formatter: function (o) {
          var f = feats[o.data[0]];
          return f.label + "<br/>" + rows[o.data[1]] + " = <b>" + o.data[2].toFixed(2) +
            "</b><br/>n = " + f.n.toLocaleString();
        },
      },
      xAxis: {
        type: "category", data: feats.map(function (f) { return f.short; }),
        axisLine: { show: false }, axisTick: { show: false }, splitArea: { show: false },
        axisLabel: { color: p.ink, interval: 0, rotate: 45, fontSize: 11, fontFamily: p.font },
      },
      yAxis: {
        type: "category", data: rows, inverse: true,
        axisLine: { show: false }, axisTick: { show: false }, splitArea: { show: false },
        axisLabel: { color: p.ink, fontFamily: p.font, fontWeight: 600 },
      },
      visualMap: {
        show: true, min: -0.85, max: 0.85, dimension: 2, calculable: true,
        orient: "horizontal", left: "center", bottom: 0,
        inRange: { color: ["#e2725b", "#f4efe4", "#4fb79a"] },
        textStyle: { color: p.muted },
      },
      series: [{
        type: "heatmap", data: data,
        itemStyle: { borderColor: p.bg, borderWidth: 2, borderRadius: 4 },
        label: {
          show: true, fontFamily: p.font, fontWeight: 700, color: "#2b333a",
          formatter: function (o) { return o.data[2].toFixed(2); },
        },
        emphasis: { itemStyle: { borderColor: p.coral, borderWidth: 2 } },
      }],
    };
  }

  var SPECS = [
    { el: "chart-coverage", file: "coverage.json", build: optCoverage },
    { el: "chart-featcorr", file: "feature_corr.json", build: optFeatureCorr },
  ];

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
