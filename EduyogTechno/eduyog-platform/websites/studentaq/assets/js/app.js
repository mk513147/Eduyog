/**
 * App bootstrap: renders the layout and the current page (from <body data-page="…">),
 * then wires up scroll reveal and in-page anchors.
 */
(function (SAQ) {
  'use strict';

  const FALLBACK_LOAD_ERROR = 'Something went wrong while loading this page. Please refresh and try again.';
  const REVEAL_CLASS = 'js-reveal';
  const REVEAL_VISIBLE_CLASS = 'is-visible';
  const REVEAL_OPTIONS = { rootMargin: '0px 0px -6% 0px', threshold: 0.05 };

  function initReveal(root) {
    const items = root.querySelectorAll('[data-reveal]');
    if (!items.length) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add(REVEAL_VISIBLE_CLASS);
        observer.unobserve(entry.target);
      });
    }, REVEAL_OPTIONS);

    items.forEach((item) => observer.observe(item));
  }

  /** Content is rendered after load, so the browser's own jump to #hash needs repeating. */
  function scrollToHash() {
    const id = decodeURIComponent(window.location.hash.slice(1));
    const target = id && document.getElementById(id);
    if (target) target.scrollIntoView({ block: 'start', behavior: 'instant' });
  }

  function renderLoadError(message) {
    const main = document.getElementById('main');
    if (!main) return;
    main.innerHTML = '';
    const panel = document.createElement('p');
    panel.className = 'load-error';
    panel.setAttribute('role', 'alert');
    panel.textContent = message;
    main.appendChild(panel);
  }

  function bootstrap() {
    const data = window.SITE_DATA;
    const pageName = document.body.dataset.page;

    try {
      const pages = SAQ.pages.create(data);
      const page = pages[pageName] || pages.notFound;
      const main = document.getElementById('main');

      SAQ.layout.init(data, pageName);

      const supportsReveal = 'IntersectionObserver' in window;
      if (supportsReveal) document.documentElement.classList.add(REVEAL_CLASS);

      SAQ.core.mount(main, page.render());
      page.init?.(main);

      if (supportsReveal) initReveal(main);
      scrollToHash();
    } catch (error) {
      console.error('[app] Page failed to render.', error);
      document.documentElement.classList.remove(REVEAL_CLASS);
      renderLoadError(data?.labels?.loadError || FALLBACK_LOAD_ERROR);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }
})((window.SAQ = window.SAQ || {}));
