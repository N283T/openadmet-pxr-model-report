(function () {
  'use strict';

  const channelName = 'deck';
  const storageKey = 'deck-sync';
  const bc = (function () { try { return new BroadcastChannel(channelName); } catch (e) { return null; } })();

  function post(msg) {
    if (bc) bc.postMessage(msg);
    else localStorage.setItem(storageKey, JSON.stringify({ msg: msg, t: Date.now() }));
  }
  function subscribe(handler) {
    if (bc) bc.onmessage = function (e) { handler(e.data); };
    else window.addEventListener('storage', function (e) {
      if (e.key !== storageKey || !e.newValue) return;
      try { handler(JSON.parse(e.newValue).msg); } catch (_) {}
    });
  }

  const receiverRoot = document.getElementById('presenter-root');
  if (receiverRoot) {
    // Receiver: presenter.html
    const currentEl = document.getElementById('presenter-current');
    const nextEl = document.getElementById('presenter-next');
    const notesEl = document.getElementById('presenter-notes');
    subscribe(function (msg) {
      if (msg && msg.type === 'state') render(msg);
    });
    function render(msg) {
      currentEl.textContent = 'Slide ' + (msg.index + 1) + ' / ' + msg.total;
      nextEl.textContent = msg.index + 1 < msg.total ? 'Next: Slide ' + (msg.index + 2) : '(end)';
      notesEl.textContent = msg.notes || '(no notes)';
    }
    post({ type: 'hello' });
  } else if (window.Deck) {
    // Sender: main deck
    function currentNotes() {
      const slides = document.querySelectorAll('#deck .slide');
      const s = slides[window.Deck.state.index];
      const aside = s && s.querySelector('aside.notes');
      return aside ? aside.textContent.trim() : '';
    }
    function broadcast() {
      post({
        type: 'state',
        index: window.Deck.state.index,
        total: window.Deck.state.total,
        fragmentStep: window.Deck.state.fragmentStep,
        notes: currentNotes(),
      });
    }
    window.Deck.on('change', broadcast);
    subscribe(function (msg) { if (msg && msg.type === 'hello') broadcast(); });
    window.addEventListener('keydown', function (e) {
      if (e.key === 't' && !e.defaultPrevented) {
        window.open('presenter.html', 'deck-presenter', 'width=900,height=700');
        e.preventDefault();
      }
    });
    // fire once at startup so an already-open presenter catches up
    broadcast();
  }
})();
