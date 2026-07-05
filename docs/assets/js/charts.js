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
      axisLine: { lineStyle: { color: p.line } },
      axisTick: { lineStyle: { color: p.line } },
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

  var SPECS = [
    { el: "chart-phase", file: "phase_metrics.json", build: optPhase },
    { el: "chart-shap", file: "shap_families.json", build: optShap },
    { el: "chart-members", file: "ensemble_members.json", build: optMembers },
    { el: "chart-calibration", file: "calibration_bins.json", build: optCalibration },
    { el: "chart-leaderboard", file: "leaderboard.json", build: optLeaderboard },
    { el: "chart-scatter", file: "scatter_pred_actual.json", build: optScatter },
    { el: "chart-proxy", file: "proxy_as1_as2.json", build: optProxy },
  ];

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
