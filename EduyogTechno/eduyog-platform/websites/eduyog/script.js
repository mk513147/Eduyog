/* Eduyog — public website behaviour (no dependencies). */
(function () {
  'use strict';

  var DEFAULT_API_BASE = 'http://localhost:5000/api';
  var REQUEST_TIMEOUT_MS = 10000;
  var MOBILE_NAV_QUERY = '(max-width: 1080px)';

  function getApiBase() {
    var meta = document.querySelector('meta[name="eduyog-api-base"]');
    var value = meta && meta.getAttribute('content');
    return (value || DEFAULT_API_BASE).replace(/\/+$/, '');
  }

  // ---------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------

  // Creates an element with an optional class and plain-text content.
  // Text is always set with textContent, never parsed as HTML.
  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  // Returns a normalised http(s) URL string, or null for anything else
  // (javascript:, data:, relative paths, malformed values...).
  function safeExternalUrl(value) {
    if (typeof value !== 'string' || value.trim() === '') return null;
    var parsed;
    try {
      parsed = new URL(value.trim());
    } catch (e) {
      return null;
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    if (!parsed.hostname) return null;
    return parsed.href;
  }

  function normalizeKey(value) {
    return typeof value === 'string' ? value.trim().toLowerCase() : '';
  }

  // Keeps only well-formed items and only the fields the page uses.
  function normalizePlatforms(data) {
    if (!data || !Array.isArray(data.platforms)) {
      throw new Error('Unexpected response format');
    }
    var result = [];
    data.platforms.forEach(function (item) {
      if (!item || typeof item.name !== 'string' || item.name.trim() === '') return;
      result.push({
        name: item.name.trim(),
        slug: normalizeKey(item.slug),
        url: safeExternalUrl(item.url),
      });
    });
    return result;
  }

  // ---------------------------------------------------------------------
  // Education platform links
  //
  // The three Education cards are part of the page and always visible.
  // GET /api/platforms (active platforms only) decides whether a card gets a
  // "Learn more" link: a card is linked only when an active platform with a
  // matching slug (or name) and a valid http(s) URL is returned.
  // ---------------------------------------------------------------------

  var statusEl = document.getElementById('platforms-status');
  var cards = Array.prototype.slice.call(document.querySelectorAll('[data-platform-slug]'));

  function cardAction(card) {
    return card.querySelector('[data-platform-action]');
  }

  function cardName(card) {
    return card.getAttribute('data-platform-name') || card.getAttribute('data-platform-slug');
  }

  function setAllActions(className, text) {
    cards.forEach(function (card) {
      var action = cardAction(card);
      if (action) action.replaceChildren(el('span', className, text));
    });
  }

  function findPlatform(platforms, card) {
    var slug = normalizeKey(card.getAttribute('data-platform-slug'));
    var name = normalizeKey(card.getAttribute('data-platform-name'));
    for (var i = 0; i < platforms.length; i++) {
      if (slug && platforms[i].slug === slug) return platforms[i];
    }
    for (var j = 0; j < platforms.length; j++) {
      if (name && normalizeKey(platforms[j].name) === name) return platforms[j];
    }
    return null;
  }

  function createLearnMoreLink(url, name) {
    var link = el('a', 'btn btn--primary btn--sm edu-card__link');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.setAttribute('aria-label', 'Learn more about ' + name + ' (opens in a new tab)');
    link.appendChild(document.createTextNode('Learn more'));
    var arrow = el('span', 'edu-card__arrow', '↗');
    arrow.setAttribute('aria-hidden', 'true');
    link.appendChild(arrow);
    return link;
  }

  function showStatus(node) {
    if (statusEl) statusEl.replaceChildren(node);
  }

  function renderLoading() {
    cards.forEach(function (card) {
      card.classList.remove('edu-card--linked');
    });
    setAllActions('edu-card__pending edu-card__pending--loading', 'Checking website…');
    showStatus(el('p', 'visually-hidden', 'Checking platform websites…'));
  }

  function renderError() {
    cards.forEach(function (card) {
      card.classList.remove('edu-card--linked');
    });
    setAllActions('edu-card__pending', 'Website link unavailable');

    var box = el('div', 'notice notice--compact notice--error');
    var text = el('div');
    text.appendChild(el('p', 'notice__title', 'Platform websites are unavailable right now'));
    text.appendChild(el('p', null, 'We could not load the website links. Please try again in a moment.'));
    box.appendChild(text);
    var button = el('button', 'btn btn--ghost btn--sm', 'Try again');
    button.type = 'button';
    button.addEventListener('click', loadPlatforms);
    box.appendChild(button);
    showStatus(box);
  }

  function renderPlatforms(platforms) {
    var linked = 0;
    cards.forEach(function (card) {
      var action = cardAction(card);
      if (!action) return;
      var match = findPlatform(platforms, card);
      if (match && match.url) {
        action.replaceChildren(createLearnMoreLink(match.url, cardName(card)));
        card.classList.add('edu-card--linked');
        linked++;
      } else {
        action.replaceChildren(el('span', 'edu-card__pending', 'Website coming soon'));
        card.classList.remove('edu-card--linked');
      }
    });

    if (platforms.length === 0) {
      // Empty state: the cards remain, with a short note instead of links.
      var note = el('p', 'edu-status__note', 'Platform websites will be linked here as soon as they go live.');
      showStatus(note);
      return;
    }

    showStatus(
      el(
        'p',
        'visually-hidden',
        linked === 1 ? '1 platform website available.' : linked + ' platform websites available.'
      )
    );
  }

  var activeRequest = null;

  function loadPlatforms() {
    if (!statusEl || cards.length === 0) return;
    if (activeRequest) activeRequest.abort();

    var controller = typeof AbortController === 'function' ? new AbortController() : null;
    activeRequest = controller;
    var timer = controller
      ? setTimeout(function () {
          controller.abort();
        }, REQUEST_TIMEOUT_MS)
      : null;

    renderLoading();

    fetch(getApiBase() + '/platforms', {
      method: 'GET',
      headers: { Accept: 'application/json' },
      // Public endpoint: no credentials, cookies or tokens are sent.
      credentials: 'omit',
      signal: controller ? controller.signal : undefined,
    })
      .then(function (response) {
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.json();
      })
      .then(function (data) {
        if (activeRequest !== controller) return;
        renderPlatforms(normalizePlatforms(data));
      })
      .catch(function () {
        if (activeRequest !== controller) return;
        renderError();
      })
      .then(function () {
        if (timer) clearTimeout(timer);
        if (activeRequest === controller) activeRequest = null;
      });
  }

  // ---------------------------------------------------------------------
  // Mobile navigation
  // ---------------------------------------------------------------------

  function initNavigation() {
    var toggle = document.querySelector('.nav-toggle');
    var nav = document.getElementById('site-nav');
    if (!toggle || !nav) return;

    var mobileQuery = window.matchMedia ? window.matchMedia(MOBILE_NAV_QUERY) : null;

    function setOpen(open, returnFocus) {
      nav.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      if (!open && returnFocus) toggle.focus();
    }

    toggle.addEventListener('click', function () {
      setOpen(toggle.getAttribute('aria-expanded') !== 'true', false);
    });

    // Close after choosing a link on mobile.
    nav.addEventListener('click', function (event) {
      if (event.target.closest && event.target.closest('a')) setOpen(false, false);
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && nav.classList.contains('is-open')) setOpen(false, true);
    });

    // Close when clicking outside the open menu.
    document.addEventListener('click', function (event) {
      if (!nav.classList.contains('is-open')) return;
      if (nav.contains(event.target) || toggle.contains(event.target)) return;
      setOpen(false, false);
    });

    // Reset when switching to the desktop layout.
    if (mobileQuery && mobileQuery.addEventListener) {
      mobileQuery.addEventListener('change', function (event) {
        if (!event.matches) setOpen(false, false);
      });
    }
  }

  // ---------------------------------------------------------------------
  // Footer year
  // ---------------------------------------------------------------------

  function setCurrentYear() {
    var year = document.getElementById('current-year');
    if (year) year.textContent = String(new Date().getFullYear());
  }

  initNavigation();
  setCurrentYear();
  loadPlatforms();
})();
