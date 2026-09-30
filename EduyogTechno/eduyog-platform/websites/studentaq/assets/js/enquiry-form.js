/**
 * Enquiry form: renders fields from config, validates input and submits to Google Forms.
 */
(function (SAQ) {
  'use strict';

  const { html, attrs, mount: mountContent, links, prefersReducedMotion } = SAQ.core;
  const { icon, components: ui } = SAQ;

  const ID_PREFIX = 'enquiry';
  const HONEYPOT_NAME = 'website_url';
  const MIN_PHONE_DIGITS = 8;
  const MAX_PHONE_DIGITS = 15;
  const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const PHONE_PATTERN = /^\+?[\d\s().-]+$/;
  const TEXTAREA_ROWS = 5;

  /** Field types that are validated but never sent to Google Forms. */
  const LOCAL_ONLY_TYPES = ['consent'];
  const TEXT_TYPES = ['text', 'email', 'tel', 'textarea'];
  const REQUIRED_MESSAGE_KEY = { select: 'selectOne', radio: 'selectOne', checkbox: 'selectAtLeastOne', consent: 'consent' };

  const fieldId = (name) => `${ID_PREFIX}-${name}`;
  const hintId = (name) => `${fieldId(name)}-hint`;
  const errorId = (name) => `${fieldId(name)}-error`;
  const isEmpty = (value) => (Array.isArray(value) ? value.length === 0 : !value);
  const countDigits = (value) => value.replace(/\D/g, '').length;

  /* ---------------------------------------------------------------------
   * Options & prefill
   * ------------------------------------------------------------------ */
  function resolveOptions(field, optionSources) {
    if (field.optionsFrom) return optionSources[field.optionsFrom] || [];
    return (field.options || []).map((option) => (typeof option === 'string' ? { id: option, value: option } : option));
  }

  /** Pre-selects options from the URL, e.g. contact.html?services=cv&targetCountry=UK */
  function prefilledOptionValues(field, params) {
    const requested = params.getAll(field.name);
    return field.options.filter((option) => requested.includes(option.id) || requested.includes(option.value)).map((option) => option.value);
  }

  /* ---------------------------------------------------------------------
   * Templates
   * ------------------------------------------------------------------ */
  const fieldClass = (field, modifier) => ['field', field.width === 'full' && 'field--full', modifier].filter(Boolean).join(' ');
  const describedBy = (field) => [field.hint && hintId(field.name), errorId(field.name)].filter(Boolean).join(' ');

  const hintTemplate = (field) => (field.hint ? html`<p class="field__hint" id="${hintId(field.name)}">${field.hint}</p>` : '');
  const errorTemplate = (field) =>
    html`<p class="field__error" id="${errorId(field.name)}" hidden>${icon('alert-circle', { size: 16 })}<span></span></p>`;

  function labelContent(field, copy) {
    return html`${field.label}${field.required ? '' : html` <span class="field__optional">${copy.optionalLabel}</span>`}`;
  }

  function controlAttrs(field) {
    return attrs({
      id: fieldId(field.name),
      name: field.name,
      autocomplete: field.autocomplete,
      inputmode: field.inputmode,
      placeholder: field.placeholder,
      maxlength: field.maxLength,
      required: field.required,
      'aria-describedby': describedBy(field),
    });
  }

  const CONTROL_TEMPLATES = {
    select: (field, copy) => html`<select class="input select"${controlAttrs(field)}>
      <option value="">${copy.selectPlaceholder}</option>
      ${field.options.map((option) => html`<option value="${option.value}">${option.value}</option>`)}
    </select>`,
    textarea: (field) => html`<textarea class="input textarea" rows="${TEXTAREA_ROWS}"${controlAttrs(field)}></textarea>`,
    input: (field) => html`<input class="input" type="${field.type}"${controlAttrs(field)}>`,
  };

  function singleField(field, { copy }) {
    const renderControl = CONTROL_TEMPLATES[field.type] || CONTROL_TEMPLATES.input;
    return html`<div class="${fieldClass(field)}" data-field="${field.name}">
      <label class="field__label" for="${fieldId(field.name)}">${labelContent(field, copy)}</label>
      ${renderControl(field, copy)}
      ${hintTemplate(field)}
      ${errorTemplate(field)}
    </div>`;
  }

  function optionsField(field, { copy, params }) {
    const selected = new Set(prefilledOptionValues(field, params));
    const isRadio = field.type === 'radio';

    return html`<fieldset class="${fieldClass(field, 'field--group')}" data-field="${field.name}" aria-describedby="${describedBy(field)}">
      <legend class="field__label">${labelContent(field, copy)}</legend>
      ${hintTemplate(field)}
      <div class="options options--${field.type}">
        ${field.options.map(
          (option) => html`<label class="option">
            <input${attrs({
              type: field.type,
              name: field.name,
              value: option.value,
              checked: selected.has(option.value),
              required: isRadio && field.required,
            })}>
            <span class="option__ui">
              <span class="option__box" aria-hidden="true">${icon('check', { size: 12 })}</span>
              <span>${option.value}</span>
            </span>
          </label>`
        )}
      </div>
      ${errorTemplate(field)}
    </fieldset>`;
  }

  function consentField(field) {
    return html`<div class="${fieldClass(field, 'field--consent')}" data-field="${field.name}">
      <label class="consent">
        <input${attrs({ type: 'checkbox', id: fieldId(field.name), name: field.name, value: 'yes', required: field.required, 'aria-describedby': errorId(field.name) })}>
        <span>${field.label} <a href="${field.link.href}" target="_blank" rel="noopener">${field.link.label}</a>.</span>
      </label>
      ${errorTemplate(field)}
    </div>`;
  }

  const FIELD_TEMPLATES = {
    text: singleField,
    email: singleField,
    tel: singleField,
    select: singleField,
    textarea: singleField,
    radio: optionsField,
    checkbox: optionsField,
    consent: consentField,
  };

  function formTemplate(fields, context) {
    const { copy } = context;

    return html`<div class="form-card__header">
        <h2 class="form-card__title">${copy.title}</h2>
        <p class="form-card__text">${copy.text}</p>
      </div>
      <form class="form" novalidate>
        ${fields.map((field) => FIELD_TEMPLATES[field.type](field, context))}
        <div class="hp-field" aria-hidden="true">
          <label for="${fieldId(HONEYPOT_NAME)}">Leave this field empty</label>
          <input id="${fieldId(HONEYPOT_NAME)}" name="${HONEYPOT_NAME}" type="text" tabindex="-1" autocomplete="off">
        </div>
        <div class="form__alert" data-form-alert hidden></div>
        <div class="form__footer">
          <p class="form__note">${icon('lock', { size: 16 })}<span>${copy.privacyNote}</span></p>
          <button class="btn btn--primary btn--lg" type="submit" data-submit>
            <span class="btn__spinner" aria-hidden="true"></span>
            <span data-submit-label>${copy.submitLabel}</span>
          </button>
        </div>
      </form>`;
  }

  function errorAlertTemplate(copy, whatsappHref) {
    return html`<div class="alert alert--error" role="alert">
      ${icon('alert-circle', { size: 20 })}
      <div class="alert__body">
        <p class="alert__title">${copy.error.title}</p>
        <p>${copy.error.text}</p>
        ${ui.button({ label: copy.error.whatsappLabel, href: whatsappHref, external: true }, { variant: 'whatsapp', size: 'sm', iconName: 'whatsapp', className: 'alert__action' })}
      </div>
    </div>`;
  }

  function successTemplate(copy) {
    return html`<div class="form-success" tabindex="-1" data-form-success>
      <span class="form-success__icon">${icon('check', { size: 28 })}</span>
      <h2 class="form-success__title">${copy.success.title}</h2>
      <p class="form-success__text">${copy.success.text}</p>
      <div class="form-success__actions">
        ${ui.button({ label: copy.success.whatsappLabel, action: 'whatsapp' }, { variant: 'secondary' })}
        <button class="btn btn--ghost" type="button" data-form-reset>${copy.success.resetLabel}</button>
      </div>
    </div>`;
  }

  /* ---------------------------------------------------------------------
   * Values & validation (pure)
   * ------------------------------------------------------------------ */
  function readValues(form, fields) {
    const formData = new FormData(form);
    return Object.fromEntries(
      fields.map((field) => [
        field.name,
        field.type === 'checkbox' ? formData.getAll(field.name) : String(formData.get(field.name) ?? '').trim(),
      ])
    );
  }

  function validateField(field, value, messages) {
    if (isEmpty(value)) {
      return field.required ? messages[REQUIRED_MESSAGE_KEY[field.type]] || messages.required : null;
    }
    if (field.maxLength && value.length > field.maxLength) return messages.tooLong;
    if (field.type === 'email' && !EMAIL_PATTERN.test(value)) return messages.email;
    if (field.type === 'tel') {
      const digits = countDigits(value);
      if (!PHONE_PATTERN.test(value) || digits < MIN_PHONE_DIGITS || digits > MAX_PHONE_DIGITS) return messages.phone;
    }
    return null;
  }

  /** Plain-text summary of the enquiry, used for the WhatsApp fallback. */
  function enquirySummary(greeting, fields, values) {
    const lines = fields
      .filter((field) => !LOCAL_ONLY_TYPES.includes(field.type) && !isEmpty(values[field.name]))
      .map((field) => `${field.label}: ${[].concat(values[field.name]).join(', ')}`);
    return [greeting, '', ...lines].join('\n');
  }

  /* ---------------------------------------------------------------------
   * Google Forms
   * ------------------------------------------------------------------ */
  function configurationProblems(googleForm, fields) {
    const missingEntries = fields
      .filter((field) => !LOCAL_ONLY_TYPES.includes(field.type) && !googleForm.entries?.[field.name])
      .map((field) => field.name);

    return [!googleForm.formId && 'formId', ...missingEntries.map((name) => `entries.${name}`)].filter(Boolean);
  }

  async function submitToGoogleForm(googleForm, fields, values) {
    const problems = configurationProblems(googleForm, fields);
    if (problems.length) {
      throw new Error(`Google Form is not configured in data.js (missing: ${problems.join(', ')}). See README.md.`);
    }

    const body = new URLSearchParams();
    fields
      .filter((field) => !LOCAL_ONLY_TYPES.includes(field.type))
      .forEach((field) => {
        [].concat(values[field.name]).filter(Boolean).forEach((value) => body.append(googleForm.entries[field.name], value));
      });

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), googleForm.timeoutMs);

    try {
      // Google Forms does not send CORS headers, so the response is opaque.
      // A resolved request means it reached Google; network failures and timeouts reject.
      await fetch(`https://docs.google.com/forms/d/e/${encodeURIComponent(googleForm.formId)}/formResponse`, {
        method: 'POST',
        mode: 'no-cors',
        body,
        signal: controller.signal,
      });
    } finally {
      window.clearTimeout(timeout);
    }
  }

  /* ---------------------------------------------------------------------
   * DOM state
   * ------------------------------------------------------------------ */
  function setFieldError(form, field, message) {
    const wrapper = form.querySelector(`[data-field="${field.name}"]`);
    const error = form.querySelector(`#${errorId(field.name)}`);
    const invalid = Boolean(message);

    wrapper.classList.toggle('is-invalid', invalid);
    error.hidden = !invalid;
    error.querySelector('span').textContent = message || '';
    form.querySelectorAll(`[name="${field.name}"]`).forEach((control) => {
      if (invalid) control.setAttribute('aria-invalid', 'true');
      else control.removeAttribute('aria-invalid');
    });
  }

  function focusField(form, field) {
    const wrapper = form.querySelector(`[data-field="${field.name}"]`);
    const control = form.querySelector(`[name="${field.name}"]`);
    control.focus({ preventScroll: true });
    wrapper.scrollIntoView({ block: 'center', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  }

  function scrollIntoViewIfAbove(element) {
    if (element.getBoundingClientRect().top < 0) {
      element.scrollIntoView({ block: 'start', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    }
  }

  /* ---------------------------------------------------------------------
   * Entry point
   * ------------------------------------------------------------------ */
  function mount(container, { copy, googleForm, optionSources = {}, whatsappGreeting }) {
    if (!container) return;

    const params = new URLSearchParams(window.location.search);
    const fields = copy.fields
      .filter((field) => {
        if (FIELD_TEMPLATES[field.type]) return true;
        console.warn(`[enquiry-form] Unsupported field type "${field.type}" for "${field.name}"`);
        return false;
      })
      .map((field) => ({ ...field, options: resolveOptions(field, optionSources) }));
    const fieldsByName = new Map(fields.map((field) => [field.name, field]));

    function renderForm() {
      mountContent(container, formTemplate(fields, { copy, params }));
      bindForm(container.querySelector('form'));
    }

    function renderSuccess() {
      mountContent(container, successTemplate(copy));
      container.querySelector('[data-form-reset]').addEventListener('click', () => {
        renderForm();
        container.querySelector('input, select, textarea')?.focus();
      });
      container.querySelector('[data-form-success]').focus({ preventScroll: true });
      scrollIntoViewIfAbove(container);
    }

    function bindForm(form) {
      const submitButton = form.querySelector('[data-submit]');
      const submitLabel = form.querySelector('[data-submit-label]');
      const alertBox = form.querySelector('[data-form-alert]');
      let isSubmitting = false;

      function setSubmitting(submitting) {
        isSubmitting = submitting;
        submitButton.disabled = submitting;
        submitButton.classList.toggle('is-loading', submitting);
        form.setAttribute('aria-busy', String(submitting));
        submitLabel.textContent = submitting ? copy.submittingLabel : copy.submitLabel;
      }

      function revalidate(field) {
        const value = readValues(form, [field])[field.name];
        setFieldError(form, field, validateField(field, value, copy.messages));
      }

      function handleLiveValidation(event) {
        const field = fieldsByName.get(event.target.name);
        const wrapper = field && form.querySelector(`[data-field="${field.name}"]`);
        if (wrapper?.classList.contains('is-invalid')) revalidate(field);
      }

      form.addEventListener('input', handleLiveValidation);
      form.addEventListener('change', handleLiveValidation);

      form.addEventListener('focusout', (event) => {
        const field = fieldsByName.get(event.target.name);
        if (!field || !TEXT_TYPES.includes(field.type)) return;
        if (!isEmpty(readValues(form, [field])[field.name])) revalidate(field);
      });

      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (isSubmitting) return;

        alertBox.hidden = true;
        const values = readValues(form, fields);
        const results = fields.map((field) => ({ field, message: validateField(field, values[field.name], copy.messages) }));
        results.forEach(({ field, message }) => setFieldError(form, field, message));

        const firstInvalid = results.find((result) => result.message);
        if (firstInvalid) {
          focusField(form, firstInvalid.field);
          return;
        }

        // Bots fill the hidden honeypot field; silently accept without sending.
        if (form.elements[HONEYPOT_NAME].value) {
          renderSuccess();
          return;
        }

        setSubmitting(true);
        try {
          await submitToGoogleForm(googleForm, fields, values);
          renderSuccess();
        } catch (error) {
          console.error('[enquiry-form] Enquiry could not be submitted.', error);
          const whatsappHref = links.whatsappUrl(enquirySummary(whatsappGreeting, fields, values));
          mountContent(alertBox, errorAlertTemplate(copy, whatsappHref));
          alertBox.hidden = false;
          setSubmitting(false);
        }
      });
    }

    renderForm();
  }

  SAQ.enquiryForm = { mount };
})((window.SAQ = window.SAQ || {}));
