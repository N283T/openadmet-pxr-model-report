(function () {
  'use strict';

  // Any figure marked data-lightbox opens over its slide at full size. The one
  // user is the assay diagram, which is 1200x583 of small type: sized to fit
  // beside the text it is evidence you can point at, and sized to fill the
  // canvas it is finally readable. A deck on paper has to pick one.

  const figures = document.querySelectorAll('figure[data-lightbox]');
  if (!figures.length) return;

  let open = null;

  function close() {
    if (!open) return;
    open.remove();
    open = null;
    document.body.classList.remove('is-lightbox-open');
  }

  function openFor(figure) {
    close();
    const source = figure.querySelector('img');
    if (!source) return;

    const box = document.createElement('div');
    box.className = 'lightbox';
    // Not content: an audit of what fits the canvas should not measure it, and
    // a capture should be the slide rather than whatever was last clicked.
    box.setAttribute('data-overflow-ignore', '');

    const image = document.createElement('img');
    image.src = source.src;
    image.alt = source.alt;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'lightbox__close';
    button.textContent = 'esc';

    box.appendChild(image);
    box.appendChild(button);
    // Inside the slide, so it lands under the same 1920x1080 transform the
    // rest of the deck is drawn with rather than over the letterboxing.
    (figure.closest('.slide') || document.body).appendChild(box);

    box.addEventListener('click', close);
    open = box;
    document.body.classList.add('is-lightbox-open');
  }

  figures.forEach(function (figure) {
    figure.addEventListener('click', function (event) {
      // The caption carries a link out to the source; let it be a link.
      if (event.target.closest('a')) return;
      openFor(figure);
    });
  });

  // Escape closes it, and so does anything that moves the deck — a slide change
  // with the overlay still up would leave it covering the next slide. Capture
  // phase, and stop the keys the deck navigates with: with the figure open,
  // the first press should put it away rather than also advancing.
  document.addEventListener('keydown', function (event) {
    if (!open) return;
    if (event.key === 'Escape' || event.key === ' ' || event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      event.stopPropagation();
      close();
    }
  }, true);

  if (window.Deck && typeof window.Deck.on === 'function') window.Deck.on('change', close);
})();
