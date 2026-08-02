(function () {
  'use strict';

  const deck = document.getElementById('deck');
  if (!deck) return;

  const slides = Array.from(deck.querySelectorAll(':scope > .slide'));
  const total = slides.length;
  const TOLERANCE_PX = 2;

  function formatPageNumber(value) {
    return String(value).padStart(2, '0');
  }

  function assignPageNumbers() {
    slides.forEach(function (slide, index) {
      const pageNumberDisabled = slide.dataset.pageNumber === 'off' ||
        (slide.classList.contains('title') && slide.dataset.pageNumber !== 'on');
      let marker = slide.querySelector(':scope > .slide-number');

      if (pageNumberDisabled) {
        if (marker) marker.remove();
        return;
      }

      if (!marker) {
        marker = document.createElement('div');
        marker.className = 'slide-number';
        slide.appendChild(marker);
      }
      marker.textContent = formatPageNumber(index + 1) + ' / ' + formatPageNumber(total);
      marker.setAttribute('aria-label', 'Slide ' + (index + 1) + ' of ' + total);
    });
  }

  function clearDiagnostic(slide) {
    slide.classList.remove('has-overflow');
    delete slide.dataset.overflow;
    const oldBadge = slide.querySelector(':scope > .overflow-warning');
    if (oldBadge) oldBadge.remove();
  }

  function elementLabel(element) {
    if (!element) return 'slide';
    if (element.id) return '#' + element.id;
    const className = Array.from(element.classList || []).slice(0, 2).join('.');
    return element.tagName.toLowerCase() + (className ? '.' + className : '');
  }

  function auditVisibleSlide(slide) {
    clearDiagnostic(slide);

    const issues = [];
    const clippingCandidates = slide.querySelectorAll('.body, .body *, .title-body, .title-body *');
    clippingCandidates.forEach(function (element) {
      if (element.closest('.chart, .mol-viewer, .pxr-figure, .overflow-warning, aside.notes')) return;
      if (element.matches('[data-overflow-ignore], svg, canvas')) return;
      const style = window.getComputedStyle(element);
      const clipsX = /^(auto|clip|hidden|scroll)$/.test(style.overflowX);
      const clipsY = /^(auto|clip|hidden|scroll)$/.test(style.overflowY);
      const overflowX = Math.ceil(element.scrollWidth - element.clientWidth);
      const overflowY = Math.ceil(element.scrollHeight - element.clientHeight);
      if (clipsX && overflowX > TOLERANCE_PX) {
        issues.push({ axis: 'clipped width', pixels: overflowX, element: element });
      }
      if (clipsY && overflowY > TOLERANCE_PX) {
        issues.push({ axis: 'clipped height', pixels: overflowY, element: element });
      }
    });

    const slideRect = slide.getBoundingClientRect();
    const scale = slide.offsetWidth ? slideRect.width / slide.offsetWidth : 1;
    const candidates = slide.querySelectorAll('h1, h2, .body, .body > *, .title-body, .title-body > *');

    candidates.forEach(function (element) {
      if (element.matches('[data-overflow-ignore], .overflow-warning, aside.notes')) return;
      const rect = element.getBoundingClientRect();
      if (!rect.width && !rect.height) return;

      const beyondLeft = slideRect.left - rect.left;
      const beyondRight = rect.right - slideRect.right;
      const beyondTop = slideRect.top - rect.top;
      const beyondBottom = rect.bottom - slideRect.bottom;
      const horizontal = Math.max(beyondLeft, beyondRight) / scale;
      const vertical = Math.max(beyondTop, beyondBottom) / scale;

      if (horizontal > TOLERANCE_PX) {
        issues.push({ axis: 'slide width', pixels: Math.ceil(horizontal), element: element });
      }
      if (vertical > TOLERANCE_PX) {
        issues.push({ axis: 'slide height', pixels: Math.ceil(vertical), element: element });
      }
    });

    if (!issues.length) return [];

    const uniqueIssues = issues.filter(function (issue, index, all) {
      return all.findIndex(function (other) {
        return other.axis === issue.axis && other.element === issue.element;
      }) === index;
    });
    const maxOverflow = Math.max.apply(null, uniqueIssues.map(function (issue) { return issue.pixels; }));
    const badge = document.createElement('div');
    badge.className = 'overflow-warning';
    badge.setAttribute('role', 'status');
    badge.textContent = 'OVERFLOW +' + maxOverflow + 'px';
    slide.appendChild(badge);
    slide.classList.add('has-overflow');
    slide.dataset.overflow = uniqueIssues.map(function (issue) {
      return issue.axis + ' +' + issue.pixels + 'px at ' + elementLabel(issue.element);
    }).join('; ');

    return uniqueIssues;
  }

  function auditAll() {
    if (document.body.getAttribute('data-mode') !== 'slide') return [];

    const activeIndex = window.Deck && window.Deck.state ? window.Deck.state.index : 0;
    const originalTransforms = slides.map(function (slide) { return slide.style.transform; });
    const results = [];
    document.body.classList.add('is-auditing-slides');

    slides.forEach(function (slide, index) {
      slides.forEach(function (candidate, candidateIndex) {
        candidate.classList.toggle('is-active', candidateIndex === index);
        candidate.style.transform = '';
      });
      const issues = auditVisibleSlide(slide);
      if (issues.length) {
        results.push({
          index: index + 1,
          id: slide.id || '(no id)',
          issues: issues.map(function (issue) {
            return issue.axis + ' +' + issue.pixels + 'px at ' + elementLabel(issue.element);
          }),
        });
      }
    });

    slides.forEach(function (slide, index) {
      slide.classList.toggle('is-active', index === activeIndex);
      slide.style.transform = originalTransforms[index];
    });
    document.body.classList.remove('is-auditing-slides');

    if (results.length) {
      console.groupCollapsed('[slides] ' + results.length + ' slide(s) overflow the 1920×1080 canvas');
      results.forEach(function (result) {
        console.warn('Slide ' + result.index + ' #' + result.id + ': ' + result.issues.join(', '));
      });
      console.groupEnd();
    } else {
      console.info('[slides] All ' + total + ' slides fit the 1920×1080 canvas.');
    }

    return results;
  }

  let auditTimer = 0;
  function scheduleAuditAll() {
    window.clearTimeout(auditTimer);
    auditTimer = window.setTimeout(auditAll, 50);
  }

  assignPageNumbers();
  window.addEventListener('load', scheduleAuditAll);
  window.addEventListener('resize', scheduleAuditAll);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(scheduleAuditAll);

  if (window.Deck && typeof window.Deck.on === 'function') {
    window.Deck.on('change', function () {
      window.requestAnimationFrame(function () {
        const active = slides[window.Deck.state.index];
        if (active) auditVisibleSlide(active);
      });
    });
  }

  window.DeckAuthoring = {
    assignPageNumbers: assignPageNumbers,
    audit: auditAll,
    auditSlide: auditVisibleSlide,
  };
})();
