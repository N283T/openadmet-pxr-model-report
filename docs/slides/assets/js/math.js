(function () {
  'use strict';

  // Formulas are authored as LaTeX in a data-tex attribute rather than as
  // pre-rendered markup, so the source stays readable next to the prose:
  //   <span class="term__eq" data-tex="\mathrm{MAE} = \frac{1}{n}\sum ..."></span>
  // data-tex-display="block" centres it on its own line.
  function renderAll() {
    if (!window.katex) {
      console.warn('[math] katex not loaded; formulas left as-is');
      return;
    }
    document.querySelectorAll('[data-tex]:not([data-tex-done])').forEach(function (el) {
      try {
        window.katex.render(el.dataset.tex, el, {
          displayMode: el.dataset.texDisplay === 'block',
          // A malformed formula should show up as a red string on the slide,
          // not take the whole script down with it.
          throwOnError: false,
          strict: 'ignore',
        });
        el.setAttribute('data-tex-done', '');
      } catch (error) {
        console.error('[math] failed to render:', el.dataset.tex, error);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderAll);
  } else {
    renderAll();
  }
  window.DeckMath = { renderAll: renderAll };
})();
