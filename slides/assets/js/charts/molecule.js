(function () {
  'use strict';
  window.DeckCharts = window.DeckCharts || {};

  // Palette (mirrors deck.css tokens) so the structure matches the deck.
  const COLOR = {
    protein: 0x5b7bb0, // --color-blue
    ligandC: 0xef9f8c, // --color-coral (rifampicin carbons)
    bg: 0xfbf7f2,      // --color-bg
  };

  window.DeckCharts.molecule = {
    init: function (el, data) {
      let viewer = null;
      let spinning = false;
      const btn = el.parentElement && el.parentElement.querySelector('.mol-spin');

      function applySpin() {
        if (viewer) viewer.spin(spinning ? 'y' : false);
        if (btn) {
          btn.setAttribute('aria-pressed', String(spinning));
          btn.classList.toggle('is-on', spinning);
        }
      }
      if (btn) {
        btn.addEventListener('click', function () {
          spinning = !spinning;
          applySpin();
        });
      }

      // 3Dmol must be created while the container is visible and sized —
      // building it on a hidden (display:none) slide yields a 0x0 canvas
      // that never recovers. So we create it lazily on first onEnter.
      function ensureViewer() {
        if (viewer) return true;
        if (!window.$3Dmol) return false;
        if (!el.clientWidth || !el.clientHeight) return false;

        viewer = window.$3Dmol.createViewer(el, {
          backgroundColor: COLOR.bg,
          antialias: true,
        });
        viewer.addModel(data.pdb, 'pdb');
        // Protein ribbon. Select by hetflag:false (ATOM records) — 3Dmol
        // has no `polymer` selector, so that earlier selection matched
        // nothing and no cartoon was drawn.
        viewer.setStyle({ hetflag: false }, {
          cartoon: { color: COLOR.protein, thickness: 0.4, arrows: true },
        });
        const lig = { resn: data.ligand };
        // Rifampicin sticks: standard element colors, then override carbons
        // with coral (a custom colorscheme object crashes 3Dmol's renderer).
        viewer.setStyle(lig, { stick: { radius: 0.22 } });
        viewer.setStyle({ resn: data.ligand, elem: 'C' }, {
          stick: { radius: 0.22, color: COLOR.ligandC },
        });
        // Frame the whole protein (rifampicin stays as a coral accent inside).
        viewer.zoomTo();
        viewer.zoom(0.9);
        viewer.render();
        return true;
      }

      return {
        chart: null,
        resize: function () {
          if (viewer) { viewer.resize(); viewer.render(); }
        },
        dispose: function () { if (viewer) viewer.spin(false); },
        onEnter: function () {
          if (!ensureViewer()) return;
          viewer.resize();
          viewer.render();
          applySpin(); // resume whatever the toggle last requested (off by default)
        },
        onLeave: function () { if (viewer) viewer.spin(false); },
      };
    },
  };
})();
