(function () {
  'use strict';
  function css(prop) {
    return getComputedStyle(document.documentElement).getPropertyValue(prop).trim();
  }
  function get() {
    return {
      color: [css('--color-blue'), css('--color-teal'), css('--color-coral'), css('--color-peach')],
      backgroundColor: 'transparent',
      textStyle: {
        color: css('--color-ink'),
        fontFamily: css('--font-body').replace(/"/g, '') || 'sans-serif',
      },
      title: { textStyle: { color: css('--color-ink'), fontFamily: css('--font-display') } },
      axisPointer: { lineStyle: { color: css('--color-line') } },
      splitLine: { lineStyle: { color: css('--color-line') } },
    };
  }
  window.DeckTheme = { get: get };
})();
