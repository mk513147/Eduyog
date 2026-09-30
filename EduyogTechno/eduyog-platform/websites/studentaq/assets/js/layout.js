/**
 * Site-wide layout: header (with mobile menu), footer and the floating WhatsApp button.
 */
(function (SAQ) {
  'use strict';

  const { html, attrs, mount, toElement, links, routes, externalAttrs } = SAQ.core;
  const { icon, components: ui } = SAQ;

  const DESKTOP_MEDIA = '(min-width: 960px)';
  const SCROLLED_CLASS_OFFSET = 8;
  const MENU_ID = 'mobile-menu';

  /* ---------------------------------------------------------------------
   * Templates
   * ------------------------------------------------------------------ */
  function brandLink(data) {
    const { name, nameParts, logoMark } = data.brand;
    const [primaryPart, accentPart] = nameParts;

    return html`<a class="brand" href="index.html" aria-label="${data.labels.homeLink}">
      <img class="brand__mark" src="${logoMark.src}" alt="" width="${logoMark.width}" height="${logoMark.height}">
      <span class="brand__name" aria-hidden="true" title="${name}">${primaryPart}<span>${accentPart}</span></span>
    </a>`;
  }

  function navLinks(items, page, { className, trailingIcon }) {
    return items.map(
      (item) => html`<a class="${className}" href="${item.href}"${attrs({ 'aria-current': item.page === page && 'page' })}>
        <span>${item.label}</span>${trailingIcon ? icon(trailingIcon, { size: 18 }) : ''}
      </a>`
    );
  }

  function headerTemplate(data, page) {
    const { labels, header } = data;

    return html`<div class="container header__inner">
        ${brandLink(data)}
        <nav class="nav" aria-label="${labels.mainNav}">
          ${navLinks(data.nav, page, { className: 'nav__link' })}
        </nav>
        <div class="header__actions">
          ${ui.button(header.cta, { variant: 'primary', size: 'sm', className: 'header__cta' })}
          <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="${MENU_ID}" aria-label="${labels.openMenu}">
            ${icon('menu', { size: 22 })}${icon('x', { size: 22 })}
          </button>
        </div>
      </div>
      <div class="mobile-menu" id="${MENU_ID}" hidden>
        <nav class="mobile-menu__nav" aria-label="${labels.mainNav}">
          ${navLinks(data.nav, page, { className: 'mobile-menu__link', trailingIcon: 'arrow-right' })}
        </nav>
        <div class="mobile-menu__actions">
          ${ui.button(header.cta, { variant: 'primary', size: 'lg', block: true })}
          ${ui.button({ label: labels.chatOnWhatsapp, action: 'whatsapp' }, { variant: 'secondary', size: 'lg', block: true })}
        </div>
      </div>`;
  }

  function footerColumn(title, items) {
    return html`<div class="footer__column">
      <h2 class="footer__title">${title}</h2>
      <ul class="footer__links">
        ${items.map((item) => html`<li><a href="${item.href}">${item.label}</a></li>`)}
      </ul>
    </div>`;
  }

  function footerTemplate(data) {
    const { footer, brand, contact, labels } = data;
    const whatsapp = links.resolve({ action: 'whatsapp' });
    const email = links.resolve({ action: 'email' });
    const servicesById = new Map(data.services.map((service) => [service.id, service]));
    const serviceLinks = footer.serviceIds
      .map((id) => servicesById.get(id))
      .filter(Boolean)
      .map((service) => ({ label: service.title, href: routes.service(service.id) }));
    const year = new Date().getFullYear();

    return html`<div class="container">
      <div class="footer__grid">
        <div class="footer__brand">
          ${brandLink(data)}
          <p class="footer__about">${footer.about}</p>
        </div>
        ${footerColumn(footer.headings.explore, [...data.nav, ...footer.extraLinks])}
        ${footerColumn(footer.headings.services, serviceLinks)}
        <div class="footer__column">
          <h2 class="footer__title">${footer.headings.contact}</h2>
          <ul class="footer__links footer__links--contact">
            <li><a href="${whatsapp.href}"${externalAttrs(whatsapp.external)}>${icon(whatsapp.icon, { size: 18 })}<span>${labels.chatOnWhatsapp}</span></a></li>
            <li><a href="${email.href}"${externalAttrs(email.external)}>${icon(email.icon, { size: 18 })}<span>${contact.email}</span></a></li>
          </ul>
        </div>
      </div>
      <div class="footer__bottom">
        <p>© ${year} ${brand.name}. ${footer.rights}</p>
        <p>${footer.disclaimer}</p>
      </div>
    </div>`;
  }

  function whatsappFloatTemplate(data) {
    return html`<a class="whatsapp-float" href="${links.whatsappUrl()}"${externalAttrs(true)} aria-label="${data.labels.chatOnWhatsapp}">
      ${icon('whatsapp', { size: 28 })}
    </a>`;
  }

  /* ---------------------------------------------------------------------
   * Behaviour
   * ------------------------------------------------------------------ */
  function initHeaderScrollState(header) {
    const update = () => header.classList.toggle('is-scrolled', window.scrollY > SCROLLED_CLASS_OFFSET);
    update();
    window.addEventListener('scroll', update, { passive: true });
  }

  function initMobileMenu(header, { labels, inertWhenOpen }) {
    const toggle = header.querySelector('.menu-toggle');
    const menu = header.querySelector(`#${MENU_ID}`);
    const desktopQuery = window.matchMedia(DESKTOP_MEDIA);

    const isOpen = () => toggle.getAttribute('aria-expanded') === 'true';

    function setOpen(open) {
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? labels.closeMenu : labels.openMenu);
      menu.hidden = !open;
      document.body.classList.toggle('menu-open', open);
      inertWhenOpen.forEach((element) => {
        element.inert = open;
      });
    }

    toggle.addEventListener('click', (event) => {
      const open = !isOpen();
      setOpen(open);
      // Move focus into the menu only for keyboard activation (pointer clicks report detail > 0).
      if (open && event.detail === 0) menu.querySelector('a')?.focus();
    });

    menu.addEventListener('click', (event) => {
      if (event.target.closest('a')) setOpen(false);
    });

    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape' || !isOpen()) return;
      setOpen(false);
      toggle.focus();
    });

    desktopQuery.addEventListener('change', (event) => {
      if (event.matches && isOpen()) setOpen(false);
    });
  }

  /* ---------------------------------------------------------------------
   * Entry point
   * ------------------------------------------------------------------ */
  function init(data, page) {
    const header = document.getElementById('site-header');
    const footer = document.getElementById('site-footer');
    const main = document.getElementById('main');

    mount(header, headerTemplate(data, page));
    mount(footer, footerTemplate(data));

    const whatsappFloat = toElement(whatsappFloatTemplate(data));
    document.body.appendChild(whatsappFloat);

    initHeaderScrollState(header);
    initMobileMenu(header, { labels: data.labels, inertWhenOpen: [main, footer, whatsappFloat] });
  }

  SAQ.layout = { init };
})((window.SAQ = window.SAQ || {}));
