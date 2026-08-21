(function () {
  'use strict';

  function toggle() {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      const root = document.documentElement;
      const req = root.requestFullscreen
        || root.webkitRequestFullscreen
        || root.mozRequestFullScreen;
      if (req) req.call(root);
    }
  }

  window.addEventListener('keydown', function (e) {
    if (e.defaultPrevented) return;
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    if (e.key === 'f' || e.key === 'F') {
      toggle();
      e.preventDefault();
    }
  });

  const button = document.getElementById('deck-fullscreen');
  if (!button) return;
  button.addEventListener('click', function () {
    toggle();
    // Otherwise Space and Enter would re-fire the button rather than advance.
    button.blur();
  });
  // Escape and the browser's own control leave fullscreen without going
  // through toggle(), so the label follows the document, not the last click.
  document.addEventListener('fullscreenchange', function () {
    button.textContent = document.fullscreenElement ? 'Exit Fullscreen' : 'Fullscreen';
  });
})();
