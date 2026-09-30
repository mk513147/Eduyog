/**
 * Core helpers shared by every page: safe HTML templating, DOM mounting,
 * link building and route helpers.
 */
(function (SAQ) {
  'use strict';

  /* ---------------------------------------------------------------------
   * Safe HTML templating
   * Interpolated values are escaped unless they are already SafeHtml
   * (i.e. produced by `html` or `raw`).
   * ------------------------------------------------------------------ */
  const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

  class SafeHtml {
    constructor(value) {
      this.value = value;
    }
  }

  const raw = (value) => new SafeHtml(String(value));
  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);

  function toHtml(value) {
    if (value === null || value === undefined || value === false) return '';
    if (Array.isArray(value)) return value.map(toHtml).join('');
    if (value instanceof SafeHtml) return value.value;
    return escapeHtml(value);
  }

  function html(strings, ...values) {
    return raw(strings.reduce((out, chunk, index) => out + toHtml(values[index - 1]) + chunk));
  }

  /** Renders `key="value"` pairs; `true` renders a boolean attribute, empty values are skipped. */
  function attrs(map) {
    return raw(
      Object.entries(map)
        .filter(([, value]) => value !== undefined && value !== null && value !== false && value !== '')
        .map(([key, value]) => (value === true ? ` ${key}` : ` ${key}="${escapeHtml(value)}"`))
        .join('')
    );
  }

  /* ---------------------------------------------------------------------
   * DOM
   * ------------------------------------------------------------------ */
  function mount(target, content) {
    target.innerHTML = toHtml(content);
  }

  function toElement(content) {
    const template = document.createElement('template');
    template.innerHTML = toHtml(content).trim();
    return template.content.firstElementChild;
  }

  const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------------------------------------------------------------
   * Links
   * ------------------------------------------------------------------ */
  const EXTERNAL_HREF = /^https?:\/\//i;
  const GMAIL_COMPOSE_URL = 'https://mail.google.com/mail/';
  const TOUCH_DEVICE_QUERY = '(hover: none) and (pointer: coarse)';

  function createLinks(contact) {
    const whatsappUrl = (message = contact.whatsappGreeting) =>
      `https://wa.me/${contact.whatsappNumber}?text=${encodeURIComponent(message)}`;

    /**
     * Phones and tablets always have a mail app, so `mailto:` opens it.
     * Computers often have no mail app set up, where `mailto:` silently does nothing,
     * so they get Gmail's compose window in a new tab instead.
     */
    function emailLink(subject = contact.emailSubject) {
      if (window.matchMedia(TOUCH_DEVICE_QUERY).matches) {
        return { href: `mailto:${contact.email}?subject=${encodeURIComponent(subject)}`, external: false };
      }
      const params = new URLSearchParams({ view: 'cm', fs: '1', to: contact.email, su: subject });
      return { href: `${GMAIL_COMPOSE_URL}?${params}`, external: true };
    }

    const ACTIONS = {
      whatsapp: () => ({ href: whatsappUrl(), external: true, icon: 'whatsapp' }),
      email: () => ({ ...emailLink(), icon: 'mail' }),
    };

    /** Normalises a CTA ({ label, href } or { label, action }) into { label, href, external, icon }. */
    function resolve(cta) {
      const actionLink = ACTIONS[cta.action];
      if (actionLink) return { ...actionLink(), ...cta };
      return { ...cta, external: cta.external ?? EXTERNAL_HREF.test(cta.href) };
    }

    return { whatsappUrl, emailLink, resolve };
  }

  const externalAttrs = (external) => (external ? attrs({ target: '_blank', rel: 'noopener noreferrer' }) : '');

  /* ---------------------------------------------------------------------
   * Routes (single source for cross-page URLs)
   * ------------------------------------------------------------------ */
  const routes = {
    serviceAnchor: (serviceId) => `service-${serviceId}`,
    service: (serviceId) => `services.html#${routes.serviceAnchor(serviceId)}`,
    destination: (destinationId) => `destinations.html#${destinationId}`,
    enquiry: (prefill = {}) => {
      const query = new URLSearchParams(prefill).toString();
      return query ? `contact.html?${query}` : 'contact.html';
    },
  };

  SAQ.core = {
    html,
    raw,
    attrs,
    escapeHtml,
    toHtml,
    mount,
    toElement,
    prefersReducedMotion,
    externalAttrs,
    routes,
    links: createLinks(window.SITE_DATA.contact),
  };
})((window.SAQ = window.SAQ || {}));
