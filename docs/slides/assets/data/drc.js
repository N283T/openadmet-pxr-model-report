(function () {
  'use strict';
  window.DeckData = window.DeckData || {};

  // Illustrative Hill curves, not measured values. The point of the figure is
  // that two readouts cannot pin a curve down: `candidates` are the Emax/EC50
  // pairs that all pass exactly through both `readouts`, one per Hill slope.
  window.DeckData.drc = {
    xRange: [-7.6, -3.4],
    // Upper bound follows what the curves actually reach inside xRange (~99.6),
    // not the asymptotic Emax of 120.8, which this concentration range never hits.
    yRange: [0, 108],
    ideal: { emax: 100, logEC50: -5.5, hill: 1 },
    // eight-point dose response, evenly spaced in log concentration
    samples: [-7.2, -6.71, -6.23, -5.74, -5.26, -4.77, -4.29, -3.8],
    readouts: [
      { x: -5.084, y: 38, label: '8.25 µM' },
      { x: -4.481, y: 62, label: '33 µM' },
    ],
    candidates: [
      { emax: 120.8, logEC50: -4.52, hill: 0.6 },
      { emax: 78.5, logEC50: -5.06, hill: 1.0 },
      { emax: 64.0, logEC50: -5.16, hill: 2.2 },
    ],
  };
})();
