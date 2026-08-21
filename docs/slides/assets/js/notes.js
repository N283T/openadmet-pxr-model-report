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
    function $(id) { return document.getElementById(id); }

    const positionEl = $('presenter-position');
    const totalEl = $('presenter-total');
    const progressEl = $('presenter-progress');
    const nextTitleEl = $('presenter-next-title');
    const titleEl = $('presenter-title');
    const stepEl = $('presenter-step');
    const notesEl = $('presenter-notes');
    const outlineEl = $('presenter-outline');
    const elapsedEl = $('presenter-elapsed');
    const clockEl = $('presenter-clock');
    const timerToggleBtn = $('presenter-timer-toggle');
    const timerResetBtn = $('presenter-timer-reset');
    const smallerBtn = $('presenter-font-smaller');
    const largerBtn = $('presenter-font-larger');
    const firstBtn = $('presenter-first');
    const lastBtn = $('presenter-last');
    const blankBtn = $('presenter-blank');
    const gridEl = $('presenter-grid');
    const gridItemsEl = $('presenter-grid-items');
    const gridNoteEl = $('presenter-grid-note');
    const gridOpenBtn = $('presenter-grid-open');
    const gridCloseBtn = $('presenter-grid-close');
    const prevBtn = $('presenter-prev');
    const nextBtn = $('presenter-next');

    let titles = [];
    let last = null;

    subscribe(function (msg) {
      if (!msg) return;
      if (msg.type === 'state') render(msg);
      else if (msg.type === 'outline') buildOutline(msg.titles || []);
      else if (msg.type === 'timer' && msg.action === 'start') startTimer();
      else if (msg.type === 'captures') refreshGrid();
    });

    function render(msg) {
      last = msg;
      positionEl.textContent = msg.index + 1;
      totalEl.textContent = '/ ' + msg.total;
      progressEl.style.width = ((msg.index + 1) / msg.total * 100) + '%';
      titleEl.textContent = titles[msg.index] || '';
      // Fragments are steps within the slide, so a bare slide number does not
      // say how far through the reveal the deck actually is.
      stepEl.textContent = msg.fragments
        ? 'Step ' + msg.fragmentStep + ' / ' + msg.fragments
        : '';
      if (msg.notes) notesEl.innerHTML = msg.notes;
      else notesEl.textContent = '(no notes)';
      // A long note left scrolled halfway is the wrong thing to hand the
      // presenter when the slide changes under them.
      notesEl.scrollTop = 0;
      nextTitleEl.textContent = msg.index + 1 < msg.total
        ? (titles[msg.index + 1] || '')
        : '(end)';
      blankBtn.setAttribute('aria-pressed', String(!!msg.blanked));
      // Fragments count as steps, so the ends are the first slide with nothing
      // revealed and the last slide with everything revealed.
      prevBtn.disabled = msg.index === 0 && !msg.fragmentStep;
      nextBtn.disabled = msg.index === msg.total - 1 &&
        msg.fragmentStep >= msg.fragments;
      highlight(msg.index);
      highlightThumb(msg.index);
    }

    // Captures written by scripts/capture_slides.mjs, one per 1-based page
    // number. They are a separate artefact from the deck, so they can be
    // absent or out of date; a tile says so rather than showing a blank box.
    const captureUrl = function (index) {
      return '../output/slide-captures/slide-' +
        String(index + 1).padStart(2, '0') + '.png';
    };
    let missingCaptures = 0;

    function buildGrid() {
      gridItemsEl.textContent = '';
      missingCaptures = 0;
      titles.forEach(function (title, i) {
        const tile = document.createElement('button');
        tile.type = 'button';
        tile.className = 'thumb';

        const img = document.createElement('img');
        img.alt = '';
        img.src = captureUrl(i);
        img.addEventListener('error', function () {
          tile.classList.add('is-missing');
          missingCaptures += 1;
          updateGridNote();
        });

        const placeholder = document.createElement('span');
        placeholder.className = 'thumb__missing';
        placeholder.textContent = 'no capture';

        const label = document.createElement('span');
        label.className = 'thumb__label';
        const num = document.createElement('span');
        num.className = 'thumb__num';
        num.textContent = i + 1;
        const text = document.createElement('span');
        text.className = 'thumb__text';
        text.textContent = title;
        label.appendChild(num);
        label.appendChild(text);

        tile.appendChild(img);
        tile.appendChild(placeholder);
        tile.appendChild(label);
        tile.addEventListener('click', function () { nav('goto', i); closeGrid(); });
        gridItemsEl.appendChild(tile);
      });
      updateGridNote();
      if (last) highlightThumb(last.index);
    }

    function updateGridNote() {
      gridNoteEl.textContent = missingCaptures
        ? missingCaptures + ' missing — node scripts/capture_slides.mjs --all'
        : 'node scripts/capture_slides.mjs --all to refresh';
    }

    function highlightThumb(index) {
      const items = gridItemsEl.children;
      for (let i = 0; i < items.length; i++) {
        items[i].classList.toggle('is-current', i === index);
      }
    }

    // The files behind the tiles have just been rewritten. Dropping them sends
    // the next open back to the network, which returns the new ones because
    // the dev server sends no-store; an open grid is rebuilt where it stands.
    function refreshGrid() {
      const wasOpen = !gridEl.hidden;
      gridItemsEl.textContent = '';
      if (wasOpen) buildGrid();
    }

    function openGrid() {
      // Built on first open and then kept: the server sends no-store, so
      // rebuilding the tiles would re-fetch every capture each time.
      if (!gridItemsEl.children.length) buildGrid();
      gridEl.hidden = false;
      const current = gridItemsEl.children[last ? last.index : 0];
      if (current) current.scrollIntoView({ block: 'nearest' });
    }
    function closeGrid() {
      gridEl.hidden = true;
    }
    function toggleGrid() {
      if (gridEl.hidden) openGrid();
      else closeGrid();
    }

    function buildOutline(list) {
      titles = list;
      outlineEl.textContent = '';
      // Tiles are keyed to these titles, so a new outline invalidates them.
      gridItemsEl.textContent = '';
      list.forEach(function (title, i) {
        const button = document.createElement('button');
        button.type = 'button';
        const num = document.createElement('span');
        num.className = 'outline__num';
        num.textContent = i + 1;
        const label = document.createElement('span');
        label.className = 'outline__label';
        label.textContent = title;
        button.appendChild(num);
        button.appendChild(label);
        button.addEventListener('click', function () { nav('goto', i); button.blur(); });
        outlineEl.appendChild(button);
      });
      if (last) render(last);
    }

    function highlight(index) {
      const items = outlineEl.children;
      for (let i = 0; i < items.length; i++) {
        items[i].classList.toggle('is-current', i === index);
      }
      if (items[index]) items[index].scrollIntoView({ block: 'nearest' });
    }

    const timerKey = 'presenter-timer';
    // Reloading the presenter should not cost a running clock, but a record
    // left over from an earlier talk should not be resurrected either.
    const timerMaxAgeMs = 3 * 60 * 60 * 1000;

    let timer = loadTimer();

    function loadTimer() {
      try {
        const raw = JSON.parse(localStorage.getItem(timerKey));
        if (raw && Date.now() - raw.saved < timerMaxAgeMs) {
          return { base: raw.base || 0, since: raw.since || null };
        }
      } catch (_) {}
      return { base: 0, since: null };
    }
    function saveTimer() {
      try {
        localStorage.setItem(timerKey, JSON.stringify({
          base: timer.base, since: timer.since, saved: Date.now(),
        }));
      } catch (_) {}
    }
    // `since` is an absolute timestamp, so a reload mid-talk resumes at the
    // right reading rather than at the reading it had when it was stored.
    function elapsedSeconds() {
      const ms = timer.base + (timer.since ? Date.now() - timer.since : 0);
      return Math.floor(ms / 1000);
    }
    function toggleTimer() {
      if (timer.since) {
        timer.base += Date.now() - timer.since;
        timer.since = null;
      } else {
        timer.since = Date.now();
      }
      saveTimer();
      updateClock();
    }
    // Driven from the deck, where the button is pressed once at the start.
    // Starting an already-running clock has to be a no-op rather than a
    // restart: slide 1 is also where a question can send the deck back to.
    function startTimer() {
      if (timer.since) return;
      timer.since = Date.now();
      saveTimer();
      updateClock();
    }
    function resetTimer() {
      timer = { base: 0, since: null };
      saveTimer();
      updateClock();
    }

    function mmss(seconds) {
      const s = Math.max(0, Math.floor(seconds));
      return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
    }

    function updateClock() {
      const sec = elapsedSeconds();
      elapsedEl.textContent = mmss(sec);
      const now = new Date();
      clockEl.textContent = String(now.getHours()).padStart(2, '0') + ':' +
        String(now.getMinutes()).padStart(2, '0');
      timerToggleBtn.textContent = timer.since ? 'Pause' : (sec ? 'Resume' : 'Start');
    }

    setInterval(updateClock, 1000);

    const fontKey = 'presenter-notes-font';
    const fontMin = 1.0;
    const fontMax = 2.4;
    let fontSize = clampFont(parseFloat(localStorage.getItem(fontKey)) || 1.4);

    function clampFont(rem) {
      return Math.min(fontMax, Math.max(fontMin, Math.round(rem * 10) / 10));
    }
    function applyFont() {
      notesEl.style.fontSize = fontSize + 'rem';
      try { localStorage.setItem(fontKey, String(fontSize)); } catch (_) {}
    }
    function bumpFont(delta) {
      fontSize = clampFont(fontSize + delta);
      applyFont();
    }

    function nav(action, index) {
      post({ type: 'nav', action: action, index: index });
    }

    function toggleFullscreen() {
      if (document.fullscreenElement) { document.exitFullscreen(); return; }
      const root = document.documentElement;
      const req = root.requestFullscreen || root.webkitRequestFullscreen || root.mozRequestFullScreen;
      if (req) req.call(root);
    }

    // The deck window is the one being projected, so it is usually not the
    // window with focus. Every control here drives it remotely.
    prevBtn.addEventListener('click', function () { nav('prev'); prevBtn.blur(); });
    nextBtn.addEventListener('click', function () { nav('next'); nextBtn.blur(); });
    timerToggleBtn.addEventListener('click', function () { toggleTimer(); timerToggleBtn.blur(); });
    timerResetBtn.addEventListener('click', function () { resetTimer(); timerResetBtn.blur(); });
    smallerBtn.addEventListener('click', function () { bumpFont(-0.1); smallerBtn.blur(); });
    largerBtn.addEventListener('click', function () { bumpFont(0.1); largerBtn.blur(); });
    firstBtn.addEventListener('click', function () { nav('first'); firstBtn.blur(); });
    lastBtn.addEventListener('click', function () { nav('last'); lastBtn.blur(); });
    blankBtn.addEventListener('click', function () { nav('blank'); blankBtn.blur(); });
    gridOpenBtn.addEventListener('click', function () { openGrid(); gridOpenBtn.blur(); });
    gridCloseBtn.addEventListener('click', function () { closeGrid(); gridCloseBtn.blur(); });

    window.addEventListener('keydown', function (e) {
      if (e.defaultPrevented) return;
      // Space and Enter on a focused button already fire a click; handling the
      // key as well would advance twice.
      if (e.target && e.target.tagName === 'BUTTON' && (e.key === ' ' || e.key === 'Enter')) return;
      switch (e.key) {
        case 'g': case 'G': toggleGrid(); break;
        case 'Escape': closeGrid(); break;
        case 'ArrowRight': case ' ': case 'PageDown': case 'n': nav('next'); break;
        case 'ArrowLeft': case 'PageUp': case 'p': nav('prev'); break;
        case 'Home': nav('first'); break;
        case 'End': nav('last'); break;
        case 'b': case 'B': nav('blank'); break;
        case 's': case 'S': toggleTimer(); break;
        // Reset is on the shifted key: an accidental 'r' next to 'e' should not
        // cost the only record of how long the talk has been running.
        case 'R': resetTimer(); break;
        case '+': case '=': bumpFont(0.1); break;
        case '-': bumpFont(-0.1); break;
        case 'f': case 'F': toggleFullscreen(); break;
        default: return;
      }
      e.preventDefault();
    });

    applyFont();
    updateClock();
    post({ type: 'hello' });
  } else if (window.Deck) {
    // Sender: main deck
    function slideList() {
      return Array.from(document.querySelectorAll('#deck .slide'));
    }
    function currentSlide() {
      return slideList()[window.Deck.state.index];
    }
    function currentNotes() {
      const s = currentSlide();
      const aside = s && s.querySelector('aside.notes');
      // Markup, not text. A note is a lead, a few points and the answers held
      // in reserve, and a flat run of characters cannot say which is which —
      // which is the whole reason a note is hard to read at a lectern. Both
      // ends of this channel are the author's own deck on the author's own
      // machine, so there is nothing here to sanitise against.
      return aside ? aside.innerHTML.trim() : '';
    }
    function titleOf(slide) {
      const heading = slide.querySelector('h2') || slide.querySelector('h1');
      if (!heading) return '';
      // A <br> inside a heading carries no whitespace of its own, so the two
      // halves would run together in the presenter's slide list.
      const clone = heading.cloneNode(true);
      Array.from(clone.querySelectorAll('br')).forEach(function (br) {
        br.parentNode.replaceChild(document.createTextNode(' '), br);
      });
      return clone.textContent.trim().replace(/\s+/g, ' ');
    }
    function broadcast() {
      const s = currentSlide();
      post({
        type: 'state',
        index: window.Deck.state.index,
        total: window.Deck.state.total,
        fragmentStep: window.Deck.state.fragmentStep,
        fragments: s ? s.querySelectorAll('[data-fragment]').length : 0,
        blanked: document.body.classList.contains('is-blanked'),
        notes: currentNotes(),
      });
    }
    // The outline never changes while the deck is open, so it is sent on the
    // two occasions either window can have just come up rather than with every
    // navigation.
    function announce() {
      post({ type: 'outline', titles: slideList().map(titleOf) });
      broadcast();
    }
    function navigate(msg) {
      const action = msg.action;
      if (action === 'next') window.Deck.next();
      else if (action === 'prev') window.Deck.prev();
      else if (action === 'first') window.Deck.goto(0, 0);
      else if (action === 'last') window.Deck.goto(window.Deck.state.total - 1, 0);
      else if (action === 'goto') window.Deck.goto(Number(msg.index) || 0, 0);
      else if (action === 'blank') {
        // Deck.goto/next/prev emit 'change' on their own; this one does not
        // go through the deck, so it has to report itself.
        document.body.classList.toggle('is-blanked');
        broadcast();
      }
    }
    window.Deck.on('change', broadcast);
    // authoring.js runs the capture but has no access to the channel.
    window.addEventListener('deck:captures-updated', function () {
      post({ type: 'captures' });
    });
    subscribe(function (msg) {
      if (!msg) return;
      if (msg.type === 'hello') announce();
      // Deck.goto/next/prev emit 'change', so the presenter is refreshed by the
      // same broadcast that a keypress on the deck would produce.
      else if (msg.type === 'nav') navigate(msg);
    });
    function openPresenter() {
      window.open('presenter.html', 'deck-presenter', 'width=1400,height=900');
    }
    window.addEventListener('keydown', function (e) {
      if (e.key === 't' && !e.defaultPrevented) {
        openPresenter();
        e.preventDefault();
      }
    });
    const openButton = document.getElementById('deck-presenter-open');
    if (openButton) {
      openButton.addEventListener('click', function () {
        openPresenter();
        // Otherwise Space and Enter would re-open it rather than advance.
        openButton.blur();
      });
    }
    // Beginning the talk: start the clock and leave the title slide. The clock
    // half is fire and forget — with no presenter window open there is nothing
    // to start and the deck cannot tell, but the clock it drives is on the
    // screen the speaker is already looking at.
    const FADE_MS = 400;
    let beginning = false;

    function beginTalk() {
      if (beginning) return;
      post({ type: 'timer', action: 'start' });
      const reduced = window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduced) { window.Deck.next(); return; }

      beginning = true;
      // Declaring the transition and changing opacity in one style change
      // leaves nothing to interpolate from, and the slide simply cuts. Each
      // reflow below is what separates the two.
      document.body.classList.add('is-fade-transition');
      void document.body.offsetHeight;
      document.body.classList.add('is-fade-out');
      window.setTimeout(function () {
        window.Deck.next();
        // The incoming slide is displayed for the first time here, so it has
        // to paint at zero before it can animate away from it.
        const active = document.querySelector('#deck .slide.is-active');
        if (active) void active.offsetHeight;
        document.body.classList.remove('is-fade-out');
        window.setTimeout(function () {
          document.body.classList.remove('is-fade-transition');
          beginning = false;
        }, FADE_MS);
      }, FADE_MS);
    }

    const startButton = document.getElementById('deck-timer-start');
    if (startButton) {
      startButton.addEventListener('click', function () {
        beginTalk();
        // The button is on the slide just left behind, so focus has to go with
        // it; otherwise Space would press it again instead of advancing.
        startButton.blur();
      });
    }
    // fire once at startup so an already-open presenter catches up
    announce();
  }
})();
