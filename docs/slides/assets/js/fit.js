(function () {
  'use strict';

  const DESIGN_W = 1920;
  const DESIGN_H = 1080;

  function fit() {
    const mode = document.body.getAttribute('data-mode');
    const slides = document.querySelectorAll('#deck .slide');
    if (mode !== 'slide') {
      slides.forEach(function (s) { s.style.transform = ''; });
      return;
    }
    const active = document.querySelector('#deck .slide.is-active');
    if (!active) return;
    slides.forEach(function (s) { if (s !== active) s.style.transform = ''; });
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const scale = Math.min(vw / DESIGN_W, vh / DESIGN_H);
    const tx = (vw - DESIGN_W * scale) / 2;
    const ty = (vh - DESIGN_H * scale) / 2;
    active.style.transform = 'translate(' + tx + 'px, ' + ty + 'px) scale(' + scale + ')';
  }

  window.addEventListener('resize', fit);
  document.addEventListener('fullscreenchange', fit);
  if (window.Deck && typeof window.Deck.on === 'function') {
    window.Deck.on('change', fit);
  }

  const bodyObserver = new MutationObserver(fit);
  bodyObserver.observe(document.body, { attributes: true, attributeFilter: ['data-mode'] });

  fit();
})();
