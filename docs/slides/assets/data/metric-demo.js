(function () {
  'use strict';
  window.DeckData = window.DeckData || {};

  // Eight made-up compounds. Small enough that the audience can see every
  // error bar at once and count them, which is the point of the demo — the
  // real test set has 513 and would just look like a cloud.
  window.DeckData.metricDemo = {
    labels: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
    actual: [4.2, 5.8, 3.5, 6.4, 4.9, 5.2, 3.9, 6.1],
    // Starting predictions: deliberately off, so dragging them onto the
    // measured values visibly drives MAE down.
    predicted: [4.9, 5.1, 4.2, 5.6, 4.4, 5.9, 4.5, 5.4],
    yRange: [3.0, 7.0],
  };
})();
