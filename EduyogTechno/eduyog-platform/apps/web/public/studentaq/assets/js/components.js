/**
 * Reusable UI components.
 * Every component is a pure function: props in, SafeHtml out.
 * Components never read SITE_DATA directly — pages pass the content in.
 */
(function (SAQ) {
  'use strict';

  const { html, attrs, links, externalAttrs } = SAQ.core;
  const { icon } = SAQ;

  const classNames = (...names) => names.filter(Boolean).join(' ');

  /* ---------------------------------------------------------------------
   * Primitives
   * ------------------------------------------------------------------ */
  function button(cta, { variant = 'primary', size, block = false, className, iconName } = {}) {
    const link = links.resolve(cta);
    const leadingIcon = iconName ?? link.icon;
    const classes = classNames('btn', `btn--${variant}`, size && `btn--${size}`, block && 'btn--block', className);

    return html`<a class="${classes}" href="${link.href}"${externalAttrs(link.external)}>${
      leadingIcon ? icon(leadingIcon, { size: 18 }) : ''
    }<span>${link.label}</span></a>`;
  }

  function textLink(cta, { className } = {}) {
    const link = links.resolve(cta);
    const trailingIcon = link.external ? 'arrow-up-right' : 'arrow-right';

    return html`<a class="${classNames('text-link', className)}" href="${link.href}"${externalAttrs(link.external)}>
      <span>${link.label}</span>${icon(trailingIcon, { size: 16 })}
    </a>`;
  }

  /**
   * An <img> with sizing and loading hints. `priority: true` is for images that are
   * visible as soon as the page opens; everything else loads lazily.
   */
  function image({ src, alt, width, height }, { className, priority = false } = {}) {
    return html`<img class="${classNames('image', className)}" src="${src}" alt="${alt}" width="${width}" height="${height}"${attrs(
      {
        loading: priority ? 'eager' : 'lazy',
        decoding: 'async',
        fetchpriority: priority ? 'high' : false,
      }
    )}>`;
  }

  /**
   * An image in a rounded frame. The frame keeps the image's own proportions unless
   * `ratio` overrides them, so pictures with text in them are never cropped.
   */
  function mediaFrame(source, { className, priority = false, ratio } = {}) {
    const frameRatio = ratio || `${source.width} / ${source.height}`;
    return html`<figure class="${classNames('media', className)}" style="--media-ratio: ${frameRatio}">
      ${image(source, { priority })}
    </figure>`;
  }

  /** Text on one side, image on the other. `reverse` puts the image first on wide screens. */
  function mediaSplit({ content, media, reverse = false, className }) {
    return html`<div class="${classNames('split', reverse && 'split--reverse', className)}">
      <div class="split__content" data-reveal>${content}</div>
      <div class="split__media" data-reveal>${media}</div>
    </div>`;
  }

  function iconTile(name) {
    return html`<span class="icon-tile">${icon(name, { size: 22 })}</span>`;
  }

  function checklist(items, { className } = {}) {
    return html`<ul class="${classNames('checklist', className)}">
      ${items.map((item) => html`<li><span class="checklist__icon">${icon('check', { size: 14 })}</span><span>${item}</span></li>`)}
    </ul>`;
  }

  function chipList(items, { iconName } = {}) {
    return html`<ul class="chips">
      ${items.map((item) => html`<li class="chip">${iconName ? icon(iconName, { size: 14 }) : ''}${item}</li>`)}
    </ul>`;
  }

  function labelledChips(label, items, options) {
    return html`<div class="chip-group">
      <p class="overline">${label}</p>
      ${chipList(items, options)}
    </div>`;
  }

  function notice(text) {
    return html`<div class="notice" role="note">${icon('info', { size: 20 })}<p>${text}</p></div>`;
  }

  /* ---------------------------------------------------------------------
   * Section scaffolding
   * ------------------------------------------------------------------ */
  function section({ id, tone = 'default', className, content }) {
    const classes = classNames('section', tone !== 'default' && `section--${tone}`, className);
    return html`<section class="${classes}"${id ? html` id="${id}"` : ''}><div class="container">${content}</div></section>`;
  }

  function sectionHeader({ eyebrow, title, text, action, align = 'center' }) {
    return html`<div class="section-header section-header--${align}" data-reveal>
      <div class="section-header__content">
        ${eyebrow ? html`<p class="eyebrow">${eyebrow}</p>` : ''}
        <h2 class="section-title">${title}</h2>
        ${text ? html`<p class="section-text">${text}</p>` : ''}
      </div>
      ${action ? textLink(action, { className: 'section-header__action' }) : ''}
    </div>`;
  }

  function pageHeader({ eyebrow, title, text, jumpLinks = [], image: headerImage }) {
    return html`<section class="page-header${headerImage ? ' page-header--media' : ''}">
      <div class="pattern" aria-hidden="true"></div>
      <div class="container page-header__inner">
        <div class="page-header__content">
          ${eyebrow ? html`<p class="eyebrow">${eyebrow}</p>` : ''}
          <h1 class="page-header__title">${title}</h1>
          ${text ? html`<p class="page-header__text">${text}</p>` : ''}
          ${
            jumpLinks.length
              ? html`<nav class="jump-links" aria-label="${title}">
                  ${jumpLinks.map((link) => html`<a class="jump-link" href="${link.href}">${link.label}</a>`)}
                </nav>`
              : ''
          }
        </div>
        ${headerImage ? mediaFrame(headerImage, { className: 'page-header__media', priority: true }) : ''}
      </div>
    </section>`;
  }

  /* ---------------------------------------------------------------------
   * Home hero
   * ------------------------------------------------------------------ */
  function highlightText(text, highlight) {
    if (!highlight || !text.includes(highlight)) return text;
    const [before, ...after] = text.split(highlight);
    return html`${before}<em>${highlight}</em>${after.join(highlight)}`;
  }

  function roadmapCard({ title, subtitle, progressLabel, statusLabels, items, tags }) {
    const doneCount = items.filter((item) => item.status === 'done').length;
    const progress = items.length ? Math.round((doneCount / items.length) * 100) : 0;

    return html`<div class="roadmap" aria-hidden="true">
      <div class="roadmap__head">
        <span class="roadmap__avatar">${icon('graduation-cap', { size: 22 })}</span>
        <div>
          <p class="roadmap__title">${title}</p>
          <p class="roadmap__subtitle">${subtitle}</p>
        </div>
      </div>
      <div class="roadmap__progress">
        <div class="roadmap__progress-meta"><span>${progressLabel}</span><span>${doneCount}/${items.length}</span></div>
        <div class="roadmap__bar"><span style="width: ${progress}%"></span></div>
      </div>
      <ul class="roadmap__list">
        ${items.map(
          (item) => html`<li class="roadmap__item roadmap__item--${item.status}">
            <span class="roadmap__marker">${item.status === 'done' ? icon('check', { size: 12 }) : ''}</span>
            <span class="roadmap__label">${item.label}</span>
            <span class="roadmap__state">${statusLabels[item.status]}</span>
          </li>`
        )}
      </ul>
      <div class="roadmap__tags">${chipList(tags, { iconName: 'map-pin' })}</div>
    </div>`;
  }

  function hero({ badge, eyebrow, title, highlight, text, primaryCta, secondaryCta, points, roadmap, image: heroImage }) {
    return html`<section class="hero">
      <div class="pattern" aria-hidden="true"></div>
      <div class="container hero__grid">
        <div class="hero__content">
          <p class="pill">${badge ? html`<span class="pill__badge">${badge}</span>` : ''}<span>${eyebrow}</span></p>
          <h1 class="hero__title">${highlightText(title, highlight)}</h1>
          <p class="hero__text">${text}</p>
          <div class="hero__actions">
            ${button(primaryCta, { variant: 'primary', size: 'lg', iconName: 'arrow-right', className: 'btn--icon-end' })}
            ${button(secondaryCta, { variant: 'secondary', size: 'lg' })}
          </div>
          <ul class="hero__points">
            ${points.map((point) => html`<li>${icon('check-circle', { size: 18 })}<span>${point}</span></li>`)}
          </ul>
        </div>
        <div class="hero__visual">
          ${heroImage ? mediaFrame(heroImage, { className: 'hero__media', priority: true }) : ''}
          ${roadmapCard(roadmap)}
        </div>
      </div>
    </section>`;
  }

  /* ---------------------------------------------------------------------
   * Cards
   * ------------------------------------------------------------------ */
  function serviceCard(service, { href, linkLabel }) {
    return html`<article class="card card--interactive">
      ${iconTile(service.icon)}
      <h3 class="card__title"><a class="stretched-link" href="${href}">${service.title}</a></h3>
      <p class="card__text">${service.summary}</p>
      <span class="card__cta" aria-hidden="true">${linkLabel}${icon('arrow-right', { size: 16 })}</span>
    </article>`;
  }

  function serviceDetail(service, { anchorId, enquireHref, labels }) {
    return html`<article class="service-detail" id="${anchorId}">
      <div class="service-detail__head">
        ${iconTile(service.icon)}
        <div>
          <h3 class="service-detail__title">${service.title}</h3>
          <p class="service-detail__summary">${service.summary}</p>
        </div>
      </div>
      <p class="service-detail__text">${service.description}</p>
      ${checklist(service.includes)}
      <div class="service-detail__footer">
        <p class="service-detail__meta"><span class="overline">${labels.bestFor}</span>${service.idealFor}</p>
        ${textLink({ label: labels.enquire, href: enquireHref })}
      </div>
    </article>`;
  }

  function featureCard({ icon: iconName, title, text }, { variant = 'card' } = {}) {
    return html`<article class="feature feature--${variant}">
      ${iconTile(iconName)}
      <h3 class="feature__title">${title}</h3>
      <p class="feature__text">${text}</p>
    </article>`;
  }

  function stepList(steps, { stepLabel, stacked = false }) {
    return html`<ol class="${classNames('steps', stacked && 'steps--stacked')}" data-reveal>
      ${steps.map(
        (step, index) => html`<li class="step">
          <span class="step__badge">${icon(step.icon, { size: 22 })}</span>
          <p class="step__number">${stepLabel} ${String(index + 1).padStart(2, '0')}</p>
          <h3 class="step__title">${step.title}</h3>
          <p class="step__text">${step.text}</p>
        </li>`
      )}
    </ol>`;
  }

  function destinationCard(destination, { href, linkLabel }) {
    return html`<article class="destination-card">
      <div class="destination-card__head">
        ${image(destination.image, { className: 'destination-card__image' })}
        <div class="destination-card__caption">
          <span class="destination-card__code">${destination.code}</span>
          <h3 class="destination-card__title">${destination.name}</h3>
          <p class="destination-card__tagline">${destination.tagline}</p>
        </div>
      </div>
      <div class="destination-card__body">
        ${labelledChips(destination.locationsLabel, destination.locations, { iconName: 'map-pin' })}
        ${checklist(destination.support)}
        ${textLink({ label: linkLabel, href }, { className: 'destination-card__link' })}
      </div>
    </article>`;
  }

  function destinationDetail(destination, { enquireHref, labels }) {
    return html`<div class="destination">
      <div class="destination__main" data-reveal>
        ${mediaFrame(destination.image, { className: 'destination__media' })}
        <span class="destination__code">${destination.code}</span>
        <h2 class="section-title">${destination.name}</h2>
        <p class="destination__tagline">${destination.tagline}</p>
        <p class="destination__intro">${destination.intro}</p>
        ${labelledChips(destination.locationsLabel, destination.locations, { iconName: 'map-pin' })}
        <div class="destination__support">
          <h3 class="subheading">${labels.howWeHelp}</h3>
          ${checklist(destination.support)}
        </div>
        ${button({ label: labels.planYourMove, href: enquireHref }, { variant: 'primary', iconName: 'arrow-right', className: 'btn--icon-end' })}
      </div>
      <aside class="info-card" data-reveal>
        <h3 class="info-card__title">${labels.goodToKnow}</h3>
        <ul class="info-list">
          ${destination.highlights.map(
            (item) => html`<li>
              <p class="info-list__title">${item.title}</p>
              <p class="info-list__text">${item.text}</p>
            </li>`
          )}
        </ul>
        ${labelledChips(labels.popularSectors, destination.sectors)}
        ${textLink(destination.officialLink, { className: 'info-card__link' })}
      </aside>
    </div>`;
  }

  function channelCard({ id, icon: iconName, title, value, text, href, external }) {
    return html`<article class="channel-card channel-card--${id}">
      <span class="channel-card__icon">${icon(iconName, { size: 22 })}</span>
      <div class="channel-card__body">
        <h3 class="channel-card__title"><a class="stretched-link" href="${href}"${externalAttrs(external)}>${title}</a></h3>
        <p class="channel-card__value">${value}</p>
        <p class="channel-card__text">${text}</p>
      </div>
      <span class="channel-card__arrow" aria-hidden="true">${icon('arrow-up-right', { size: 18 })}</span>
    </article>`;
  }

  function testimonialCard({ quote, name, detail }) {
    const initials = name
      .split(/\s+/)
      .map((part) => part.charAt(0))
      .join('')
      .slice(0, 2)
      .toUpperCase();

    return html`<figure class="testimonial">
      ${icon('quote', { size: 28, className: 'testimonial__icon' })}
      <blockquote class="testimonial__quote"><p>${quote}</p></blockquote>
      <figcaption class="testimonial__author">
        <span class="testimonial__avatar" aria-hidden="true">${initials}</span>
        <span><span class="testimonial__name">${name}</span>${detail ? html`<span class="testimonial__detail">${detail}</span>` : ''}</span>
      </figcaption>
    </figure>`;
  }

  /* ---------------------------------------------------------------------
   * Composite blocks
   * ------------------------------------------------------------------ */
  function faqList(items) {
    return html`<div class="faq" data-reveal>
      ${items.map(
        (item) => html`<details class="faq__item">
          <summary class="faq__question"><span>${item.question}</span>${icon('chevron-down', { size: 20, className: 'faq__icon' })}</summary>
          <div class="faq__answer"><p>${item.answer}</p></div>
        </details>`
      )}
    </div>`;
  }

  function ctaBand({ title, text, primary, secondary, image: bandImage }) {
    return html`<div class="cta-band${bandImage ? ' cta-band--media' : ''}" data-reveal>
      <div class="cta-band__body">
        <div class="cta-band__content">
          <h2 class="cta-band__title">${title}</h2>
          <p class="cta-band__text">${text}</p>
        </div>
        <div class="cta-band__actions">
          ${button(primary, { variant: 'light', size: 'lg' })}
          ${secondary ? button(secondary, { variant: 'outline-light', size: 'lg' }) : ''}
        </div>
      </div>
      ${bandImage ? mediaFrame(bandImage, { className: 'cta-band__media' }) : ''}
    </div>`;
  }

  function helpCard({ title, text, actions }) {
    return html`<div class="help-card">
      <p class="help-card__title">${title}</p>
      <p class="help-card__text">${text}</p>
      <div class="help-card__actions">${actions}</div>
    </div>`;
  }

  function prose({ updated, sections, footer }) {
    return html`<div class="prose">
      ${updated ? html`<p class="prose__meta">${updated}</p>` : ''}
      ${sections.map(
        (block) => html`<h2>${block.title}</h2>
          ${(block.paragraphs || []).map((paragraph) => html`<p>${paragraph}</p>`)}
          ${block.list ? html`<ul>${block.list.map((item) => html`<li>${item}</li>`)}</ul>` : ''}`
      )}
      ${footer || ''}
    </div>`;
  }

  function statusPanel({ code, title, text, primary, secondary, image: panelImage }) {
    return html`<div class="status-panel">
      ${panelImage ? mediaFrame(panelImage, { className: 'status-panel__media', priority: true }) : ''}
      <p class="status-panel__code" aria-hidden="true">${code}</p>
      <h1 class="status-panel__title">${title}</h1>
      <p class="status-panel__text">${text}</p>
      <div class="status-panel__actions">
        ${button(primary, { variant: 'primary' })}
        ${secondary ? button(secondary, { variant: 'secondary' }) : ''}
      </div>
    </div>`;
  }

  SAQ.components = {
    button,
    image,
    mediaFrame,
    mediaSplit,
    textLink,
    iconTile,
    checklist,
    chipList,
    labelledChips,
    notice,
    section,
    sectionHeader,
    pageHeader,
    hero,
    serviceCard,
    serviceDetail,
    featureCard,
    stepList,
    destinationCard,
    destinationDetail,
    channelCard,
    testimonialCard,
    faqList,
    ctaBand,
    helpCard,
    prose,
    statusPanel,
  };
})((window.SAQ = window.SAQ || {}));
