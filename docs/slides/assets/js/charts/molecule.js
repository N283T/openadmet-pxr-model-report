(function () {
  'use strict';
  window.DeckCharts = window.DeckCharts || {};

  // Palette (mirrors deck.css tokens) so the structure matches the deck.
  const COLOR = {
    protein: 0x5b7bb0, // --color-blue
    bg: 0xfbf7f2,      // --color-bg
  };

  // AlphaFold's own confidence palette, not the deck's. Anyone who has seen an
  // AlphaFold model reads these four colours without a legend, and that
  // recognition is worth more here than matching the slide.
  const PLDDT = [
    { min: 90, color: 0x0053d6 }, // very high
    { min: 70, color: 0x65cbf3 }, // confident
    { min: 50, color: 0xffdb13 }, // low
    { min: 0, color: 0xff7d45 },  // very low
  ];

  // Long enough to read as a move between two framings rather than a cut, so
  // the audience keeps track of where the pocket is inside the domain.
  const FLY_MS = 600;

  // Headless Chrome runs with --disable-gpu, and creating a 3Dmol viewer there
  // hangs the page hard enough that the capture comes out as slide 1 rather
  // than this one. The structure is decoration on a slide whose argument is in
  // the text, so the capture script asks for it to be skipped.
  //
  // Read at load time, not on use: deck.js rewrites the query string to just
  // ?s=&f= as soon as it starts, and it runs after this file.
  const skipViewer = new URLSearchParams(window.location.search).has('capture');

  window.DeckCharts.molecule = {
    init: function (el, data) {
      const structures = data.structures;
      let viewer = null;
      let current = structures[0];
      let view = 'all';
      // The four structures are superimposed (see build_pxr_mol_data.py), so
      // the LBD views share one framing and swapping between them moves
      // nothing: the same pocket changes contents in place, which is the
      // comparison the slide is making. The full-length model is a different
      // size and keeps its own, so it gets its own entry rather than being
      // cropped to a domain's worth of frame.
      const homeViews = {};
      const frameOf = function (structure) { return structure.plddt ? 'full' : 'lbd'; };

      const wrap = el.parentElement;
      const figwrap = wrap && wrap.parentElement;
      const viewButtons = wrap ? Array.prototype.slice.call(wrap.querySelectorAll('.mol-btn')) : [];
      const tabs = figwrap ? Array.prototype.slice.call(figwrap.querySelectorAll('.mol-tab')) : [];
      const caption = wrap && wrap.querySelector('.pxr-figure__caption');

      function markButtons() {
        viewButtons.forEach(function (b) {
          const on = b.getAttribute('data-view') === view;
          b.setAttribute('aria-pressed', String(on));
          b.classList.toggle('is-on', on);
        });
        tabs.forEach(function (t) {
          const on = t.getAttribute('data-structure') === current.key;
          t.setAttribute('aria-pressed', String(on));
          t.classList.toggle('is-on', on);
        });
        // Nothing to zoom to when the pocket is empty, and a dead button on a
        // projector reads as a broken one.
        viewButtons.forEach(function (b) {
          if (b.getAttribute('data-view') === 'ligand') b.disabled = !current.ligands.length;
        });
      }

      // 'reset' restores rotation as well as zoom — a question usually arrives
      // after the structure has been dragged around, and putting it back by
      // hand on a projector is not something to do in front of a room.
      function applyView(next) {
        view = next;
        markButtons();
        if (!viewer) return;
        const home = homeViews[frameOf(current)];
        if (next === 'ligand' && current.ligands.length) {
          viewer.zoomTo({ resn: current.ligands.map(function (l) { return l.resn; }) }, FLY_MS);
        } else if (home) {
          viewer.setView(home, FLY_MS);
        }
        viewer.render();
      }

      function draw(structure) {
        current = structure;
        view = 'all';
        if (caption) caption.textContent = structure.caption;
        markButtons();
        if (!viewer) return;

        viewer.removeAllModels();
        viewer.addModel(structure.pdb, 'pdb');
        if (structure.plddt) {
          // One style per band, selected with a predicate: 3Dmol's numeric
          // range forms ({b: {start, end}}, {b: {gte, lt}}, properties:) all
          // select nothing here, and a custom colorscheme object crashes its
          // renderer. pLDDT rides in the B-factor column, as AlphaFold ships it.
          PLDDT.forEach(function (band, index) {
            const below = index === 0 ? Infinity : PLDDT[index - 1].min;
            viewer.setStyle(
              { predicate: function (atom) { return atom.b >= band.min && atom.b < below; } },
              { cartoon: { color: band.color, thickness: 0.4, arrows: true } }
            );
          });
        } else {
          // Protein ribbon. Select by hetflag:false (ATOM records) — 3Dmol
          // has no `polymer` selector, so that earlier selection matched
          // nothing and no cartoon was drawn.
          viewer.setStyle({ hetflag: false }, {
            cartoon: { color: COLOR.protein, thickness: 0.4, arrows: true },
          });
        }
        // Ligand sticks: standard element colors, then override carbons with
        // the ligand's own hue (a custom colorscheme object crashes 3Dmol's
        // renderer). Where two are bound they get two colours, because that
        // there are two of them is the whole point of the view.
        structure.ligands.forEach(function (ligand) {
          viewer.setStyle({ resn: ligand.resn }, { stick: { radius: 0.22 } });
          viewer.setStyle({ resn: ligand.resn, elem: 'C' }, {
            stick: { radius: 0.22, color: ligand.color },
          });
        });
        // Frame this size of structure once, then hold it. A tab click after
        // that is a content swap under a camera that does not move.
        const frame = frameOf(structure);
        if (homeViews[frame]) {
          viewer.setView(homeViews[frame]);
        } else {
          viewer.zoomTo();
          viewer.zoom(0.9);
          homeViews[frame] = viewer.getView();
        }
        viewer.render();
      }

      viewButtons.forEach(function (b) {
        b.addEventListener('click', function () {
          applyView(b.getAttribute('data-view'));
        });
      });
      tabs.forEach(function (t) {
        t.addEventListener('click', function () {
          const key = t.getAttribute('data-structure');
          const next = structures.filter(function (s) { return s.key === key; })[0];
          if (next && next !== current) draw(next);
        });
      });
      markButtons();

      // 3Dmol must be created while the container is visible and sized —
      // building it on a hidden (display:none) slide yields a 0x0 canvas
      // that never recovers. So we create it lazily on first onEnter.
      function ensureViewer() {
        if (viewer) return true;
        if (skipViewer) return false;
        if (!window.$3Dmol) return false;
        if (!el.clientWidth || !el.clientHeight) return false;

        viewer = window.$3Dmol.createViewer(el, {
          backgroundColor: COLOR.bg,
          antialias: true,
        });
        draw(current);
        return true;
      }

      return {
        chart: null,
        resize: function () {
          if (viewer) { viewer.resize(); viewer.render(); }
        },
        dispose: function () {},
        onEnter: function () {
          if (!ensureViewer()) return;
          viewer.resize();
          viewer.render();
        },
        onLeave: function () {},
      };
    },
  };
})();
