(function () {
  'use strict';

  const deck = document.getElementById('deck');
  const slides = Array.from(deck.querySelectorAll('.slide'));
  const total = slides.length;

  const state = { index: 0, total, mode: 'slide', fragmentStep: 0 };
  const listeners = { change: [] };

  function emit(event) {
    (listeners[event] || []).forEach(function (fn) { fn(state); });
  }

  function on(event, fn) {
    (listeners[event] = listeners[event] || []).push(fn);
  }

  function fragmentsIn(slide) {
    return Array.from(slide.querySelectorAll('[data-fragment]'))
      .sort(function (a, b) {
        return Number(a.dataset.fragment) - Number(b.dataset.fragment);
      });
  }

  function render() {
    slides.forEach(function (s, i) {
      s.classList.toggle('is-active', i === state.index);
    });
    const active = slides[state.index];
    fragmentsIn(active).forEach(function (el) {
      const step = Number(el.dataset.fragment);
      el.classList.toggle('is-visible', step <= state.fragmentStep);
    });
  }

  function syncUrl(replace) {
    const params = new URLSearchParams();
    params.set('s', state.index);
    if (state.fragmentStep) params.set('f', state.fragmentStep);
    const url = location.pathname + '?' + params.toString();
    if (replace) history.replaceState(state, '', url);
    else history.pushState(state, '', url);
  }

  function goto(i, f) {
    const clamped = Math.max(0, Math.min(total - 1, i));
    state.index = clamped;
    state.fragmentStep = f || 0;
    render();
    syncUrl(false);
    emit('change');
  }

  function next() {
    const active = slides[state.index];
    const frags = fragmentsIn(active);
    if (state.fragmentStep < frags.length) {
      state.fragmentStep += 1;
      render();
      syncUrl(false);
      emit('change');
      return;
    }
    if (state.index < total - 1) goto(state.index + 1, 0);
  }

  function prev() {
    if (state.fragmentStep > 0) {
      state.fragmentStep -= 1;
      render();
      syncUrl(false);
      emit('change');
      return;
    }
    if (state.index > 0) {
      const target = slides[state.index - 1];
      goto(state.index - 1, fragmentsIn(target).length);
    }
  }

  function onKey(e) {
    if (e.defaultPrevented) return;
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    switch (e.key) {
      case 'ArrowRight': case ' ': case 'PageDown': case 'n': next(); e.preventDefault(); break;
      case 'ArrowLeft': case 'PageUp': case 'p': prev(); e.preventDefault(); break;
      case 'Home': goto(0, 0); e.preventDefault(); break;
      case 'End': goto(total - 1, 0); e.preventDefault(); break;
      default:
        if (/^[1-9]$/.test(e.key)) {
          const jump = Number(e.key) - 1;
          if (jump < total) { goto(jump, 0); e.preventDefault(); }
        }
    }
  }

  function loadFromUrl() {
    const params = new URLSearchParams(location.search);
    const s = Number(params.get('s')) || 0;
    const f = Number(params.get('f')) || 0;
    state.index = Math.max(0, Math.min(total - 1, s));
    state.fragmentStep = f;
    render();
    syncUrl(true);
    emit('change');
  }

  window.addEventListener('keydown', onKey);
  window.addEventListener('popstate', loadFromUrl);
  document.body.setAttribute('data-mode', 'slide');
  loadFromUrl();

  window.Deck = { state: state, goto: goto, next: next, prev: prev, on: on };
})();
