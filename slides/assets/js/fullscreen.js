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
})();
