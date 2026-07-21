(function () {
  'use strict';

  function setMode(mode) {
    document.body.setAttribute('data-mode', mode);
    if (window.Deck && window.Deck.state) window.Deck.state.mode = mode;
  }

  function toggle() {
    const current = document.body.getAttribute('data-mode');
    setMode(current === 'overview' ? 'slide' : 'overview');
  }

  window.addEventListener('keydown', function (e) {
    if (e.defaultPrevented) return;
    if (e.key === 'Escape' || e.key === 'o') { toggle(); e.preventDefault(); }
  });

  document.getElementById('deck').addEventListener('click', function (e) {
    if (document.body.getAttribute('data-mode') !== 'overview') return;
    const slide = e.target.closest('.slide');
    if (!slide) return;
    const slides = Array.from(document.querySelectorAll('#deck .slide'));
    const i = slides.indexOf(slide);
    if (i >= 0 && window.Deck) { setMode('slide'); window.Deck.goto(i, 0); }
  });
})();
