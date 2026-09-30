/**
 * Page compositions: which sections appear on each page, in what order,
 * bound to the content in SITE_DATA.
 */
(function (SAQ) {
  'use strict';

  const { html, links, routes } = SAQ.core;
  const ui = SAQ.components;

  const TONES = ['default', 'muted'];
  const CHANNEL_BUTTON_VARIANTS = { whatsapp: 'whatsapp' };

  /**
   * Wraps section descriptors ({ id?, className?, content }) in <section> elements,
   * alternating background tones and skipping empty (null) sections.
   */
  function withAlternatingTones(descriptors, { startWith = 'default' } = {}) {
    const offset = TONES.indexOf(startWith);
    return descriptors
      .filter(Boolean)
      .map((descriptor, index) => ui.section({ ...descriptor, tone: TONES[(index + offset) % TONES.length] }));
  }

  function createSections(data) {
    const { labels } = data;
    const servicesById = new Map(data.services.map((service) => [service.id, service]));

    const helpActions = () =>
      data.contactChannels.map((channel) =>
        ui.button({ label: channel.title, action: channel.action }, { variant: CHANNEL_BUTTON_VARIANTS[channel.id] || 'secondary', size: 'sm' })
      );

    return {
      servicesGrid: (copy) => ({
        id: 'services',
        content: [
          ui.sectionHeader({ ...copy, align: 'split' }),
          html`<div class="grid grid--3" data-reveal>
            ${data.services.map((service) => ui.serviceCard(service, { href: routes.service(service.id), linkLabel: labels.learnMore }))}
          </div>`,
        ],
      }),

      serviceGroups: () => ({
        content: data.serviceGroups.map(
          (group, index) => html`<div class="service-group" id="${group.id}">
            <div class="service-group__header" data-reveal>
              ${group.image ? ui.image(group.image, { className: 'service-group__image' }) : ''}
              <div class="service-group__heading">
                <span class="service-group__index">${String(index + 1).padStart(2, '0')}</span>
                <h2 class="service-group__title">${group.title}</h2>
                <p class="service-group__text">${group.text}</p>
              </div>
            </div>
            <div class="grid grid--2" data-reveal>
              ${group.serviceIds
                .map((id) => servicesById.get(id))
                .filter(Boolean)
                .map((service) =>
                  ui.serviceDetail(service, {
                    anchorId: routes.serviceAnchor(service.id),
                    enquireHref: routes.enquiry({ services: service.id }),
                    labels,
                  })
                )}
            </div>
          </div>`
        ),
      }),

      steps: (copy) => ({
        content: copy.image
          ? ui.mediaSplit({
              content: [
                ui.sectionHeader({ ...copy, align: 'left' }),
                ui.stepList(data.steps, { stepLabel: labels.step, stacked: true }),
              ],
              media: ui.mediaFrame(copy.image, { className: 'split__frame' }),
            })
          : [ui.sectionHeader(copy), ui.stepList(data.steps, { stepLabel: labels.step })],
      }),

      features: (copy, items, { variant = 'card', columns = 3 } = {}) => ({
        content: [
          ui.sectionHeader(copy),
          html`<div class="grid grid--${columns}" data-reveal>${items.map((item) => ui.featureCard(item, { variant }))}</div>`,
        ],
      }),

      featureSplit: (copy, items, { reverse = false } = {}) => ({
        content: ui.mediaSplit({
          reverse,
          content: [
            ui.sectionHeader({ ...copy, align: 'left' }),
            html`<div class="feature-list">${items.map((item) => ui.featureCard(item, { variant: 'row' }))}</div>`,
          ],
          media: ui.mediaFrame(copy.image, { className: 'split__frame' }),
        }),
      }),

      destinationCards: (copy) => ({
        content: [
          ui.sectionHeader(copy),
          html`<div class="grid grid--2" data-reveal>
            ${data.destinations.map((destination) =>
              ui.destinationCard(destination, { href: routes.destination(destination.id), linkLabel: labels.exploreDestination })
            )}
          </div>`,
        ],
      }),

      destinationDetails: () =>
        data.destinations.map((destination) => ({
          id: destination.id,
          content: ui.destinationDetail(destination, {
            enquireHref: routes.enquiry({ targetCountry: destination.formValue }),
            labels,
          }),
        })),

      testimonials: (copy) =>
        data.testimonials.length
          ? {
              content: [
                ui.sectionHeader(copy),
                html`<div class="grid grid--3" data-reveal>${data.testimonials.map(ui.testimonialCard)}</div>`,
              ],
            }
          : null,

      faq: (copy) => ({
        content: html`<div class="faq-layout">
          <div class="faq-layout__aside">
            ${ui.sectionHeader({ eyebrow: copy.eyebrow, title: copy.title, text: copy.text, align: 'left' })}
            ${ui.helpCard({ title: copy.helpTitle, text: copy.helpText, actions: helpActions() })}
          </div>
          ${ui.faqList(data.faqs)}
        </div>`,
      }),

      aboutStory: (copy) => ({
        content: html`<div class="story">
          <div class="story__content" data-reveal>
            <p class="eyebrow">${copy.story.eyebrow}</p>
            <h2 class="section-title">${copy.story.title}</h2>
            ${copy.story.paragraphs.map((paragraph) => html`<p class="story__text">${paragraph}</p>`)}
          </div>
          <div class="mission-card" data-reveal>
            <p class="mission-card__title">${copy.mission.title}</p>
            <p class="mission-card__text">${copy.mission.text}</p>
            ${ui.checklist(copy.mission.points, { className: 'checklist--light' })}
          </div>
        </div>`,
      }),

      contactLayout: (copy) => ({
        className: 'section--contact',
        content: html`<div class="contact-layout">
          <div class="form-card" data-enquiry-form></div>
          <aside class="contact-aside">
            <div class="contact-aside__group">
              ${copy.channels.image ? ui.mediaFrame(copy.channels.image, { className: 'contact-aside__media' }) : ''}
              <h2 class="contact-aside__title">${copy.channels.title}</h2>
              <p class="contact-aside__text">${copy.channels.text}</p>
              <div class="contact-aside__channels">
                ${data.contactChannels.map((channel) => ui.channelCard({ ...channel, ...links.resolve(channel) }))}
              </div>
            </div>
            <div class="next-steps">
              <h2 class="next-steps__title">${copy.nextSteps.title}</h2>
              <ol class="next-steps__list">
                ${copy.nextSteps.items.map((item) => html`<li>${item}</li>`)}
              </ol>
            </div>
          </aside>
        </div>`,
      }),

      notice: (text) => ({ className: 'section--compact', content: ui.notice(text) }),

      privacy: (copy) => ({
        content: ui.prose({
          updated: copy.updated,
          sections: copy.sections,
          footer: html`<div class="prose__contact">
            <h2>${copy.contactTitle}</h2>
            <div class="prose__contact-actions">${helpActions()}</div>
          </div>`,
        }),
      }),

      notFound: (copy) => ({ content: ui.statusPanel(copy) }),

      cta: () => ui.section({ className: 'section--cta', content: ui.ctaBand(data.cta) }),
    };
  }

  function createPages(data) {
    const sections = createSections(data);
    const { pages } = data;

    const serviceGroupLinks = data.serviceGroups.map((group) => ({ label: group.title, href: `#${group.id}` }));
    const destinationLinks = data.destinations.map((destination) => ({ label: destination.name, href: `#${destination.id}` }));

    return {
      home: {
        render: () => [
          ui.hero(pages.home.hero),
          withAlternatingTones(
            [
              sections.servicesGrid(pages.home.services),
              sections.steps(pages.home.steps),
              sections.features(pages.home.audiences, data.audiences),
              sections.destinationCards(pages.home.destinations),
              sections.featureSplit(pages.home.whyUs, data.whyUs, { reverse: true }),
              sections.testimonials(pages.home.testimonials),
              sections.faq(pages.home.faq),
            ],
            { startWith: 'muted' }
          ),
          sections.cta(),
        ],
      },

      services: {
        render: () => [
          ui.pageHeader({ ...pages.services.header, jumpLinks: serviceGroupLinks }),
          withAlternatingTones([sections.serviceGroups(), sections.steps(pages.services.steps), sections.faq(pages.home.faq)]),
          sections.cta(),
        ],
      },

      destinations: {
        render: () => [
          ui.pageHeader({ ...pages.destinations.header, jumpLinks: destinationLinks }),
          withAlternatingTones([...sections.destinationDetails(), sections.notice(pages.destinations.notice)]),
          sections.cta(),
        ],
      },

      about: {
        render: () => [
          ui.pageHeader(pages.about.header),
          withAlternatingTones([
            sections.aboutStory(pages.about),
            sections.features(pages.about.whyUs, data.whyUs, { variant: 'plain', columns: 4 }),
            sections.steps(pages.about.steps),
            sections.features(pages.about.audiences, data.audiences),
          ]),
          sections.cta(),
        ],
      },

      contact: {
        render: () => [
          ui.pageHeader(pages.contact.header),
          withAlternatingTones([sections.contactLayout(pages.contact), sections.faq(pages.contact.faq)]),
        ],
        init: (main) =>
          SAQ.enquiryForm.mount(main.querySelector('[data-enquiry-form]'), {
            copy: data.enquiryForm,
            googleForm: data.googleForm,
            optionSources: { services: data.services.map((service) => ({ id: service.id, value: service.title })) },
            whatsappGreeting: data.contact.whatsappGreeting,
          }),
      },

      privacy: {
        render: () => [ui.pageHeader(pages.privacy.header), withAlternatingTones([sections.privacy(pages.privacy)])],
      },

      notFound: {
        render: () => withAlternatingTones([sections.notFound(pages.notFound)]),
      },
    };
  }

  SAQ.pages = { create: createPages };
})((window.SAQ = window.SAQ || {}));
