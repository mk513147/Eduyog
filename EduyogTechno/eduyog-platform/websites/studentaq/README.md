# StudentAQ website

StudentAQ is a multi-page website for a career support portal that helps students and graduates
find work in the UK and Dubai. It is built with plain HTML, CSS and JavaScript: no build step,
no frameworks and no npm packages.

This README explains how to run the site, change content, connect the enquiry form to Google Forms
and deploy. It also explains what every file and function does.

## Contents

1. [Quick start](#1-quick-start)
2. [Folder structure](#2-folder-structure)
3. [How the website works](#3-how-the-website-works)
4. [Editing content (`data.js`)](#4-editing-content-datajs)
5. [Common tasks](#5-common-tasks)
6. [WhatsApp and email links](#6-whatsapp-and-email-links)
7. [Enquiry form and Google Forms](#7-enquiry-form-and-google-forms)
8. [JavaScript reference](#8-javascript-reference)
9. [CSS guide](#9-css-guide)
10. [Images](#10-images)
11. [Accessibility and responsive design](#11-accessibility-and-responsive-design)
12. [Deploy](#12-deploy)
13. [Troubleshooting](#13-troubleshooting)

---

## 1. Quick start

Run a local server from this folder:

```bash
python3 -m http.server 5180
```

Open http://localhost:5180 in your browser.

To change text, services, FAQs or contact details, edit **`assets/js/data.js`** and refresh the page.

---

## 2. Folder structure

```
studentaq/
├── index.html            Home page
├── services.html         All 9 services, grouped
├── destinations.html     UK and Dubai
├── about.html            About StudentAQ
├── contact.html          Enquiry form + WhatsApp and email
├── privacy.html          Privacy policy
├── 404.html              "Page not found"
├── README.md             This file
└── assets/
    ├── css/
    │   └── styles.css    All styles
    ├── img/              Logo, favicons, social share image
    └── js/
        ├── data.js           All content and settings
        ├── core.js           HTML templating, links, routes
        ├── icons.js          SVG icons
        ├── components.js     Reusable UI building blocks
        ├── layout.js         Header, mobile menu, footer, WhatsApp button
        ├── enquiry-form.js   Contact form: render, validate, submit
        ├── pages.js          Which sections each page shows
        └── app.js            Starts everything
```

---

## 3. How the website works

### The big picture

Every HTML page is a small, near-identical shell. The JavaScript builds the visible content
from `data.js` when the page loads.

```
 index.html (shell)
   │  <body data-page="home">
   │  <header id="site-header">, <main id="main">, <footer id="site-footer">
   │
   ├─ loads data.js ─────────► window.SITE_DATA   (all text & settings)
   ├─ loads core.js … pages.js ► window.SAQ        (functions)
   └─ loads app.js ──────────► bootstrap()
                                 1. layout.init()     → header, footer, WhatsApp button
                                 2. pages[page].render() → page sections into <main>
                                 3. pages[page].init()   → extra behaviour (e.g. the form)
                                 4. initReveal()      → fade-in on scroll
                                 5. scrollToHash()    → jump to #anchor if the URL has one
```

**Why build the pages with JavaScript?** All content lives in one file. The header, footer,
services and FAQs are written once and reused on every page, so nothing has to be copied between
HTML files.

### The HTML page shell

Each HTML file contains only:

- `<title>`, meta description and social-share tags. These stay in HTML so Google and link
  previews can read them without running JavaScript.
- Favicon, the preloaded Inter font and the two stylesheet links (`styles.css`, then `premium.css`).
- The 8 script tags, **in a fixed order** (see below).
- `<body data-page="…">`, which tells `app.js` which page to render:

| File | `data-page` |
| --- | --- |
| `index.html` | `home` |
| `services.html` | `services` |
| `destinations.html` | `destinations` |
| `about.html` | `about` |
| `contact.html` | `contact` |
| `privacy.html` | `privacy` |
| `404.html` | `notFound` |

- Empty `<header id="site-header">`, `<main id="main">` and `<footer id="site-footer">`, which
  JavaScript fills in.
- A skip link ("Skip to content") for keyboard users, and a `<noscript>` message.

`404.html` also has `<base href="/">`, so its links and assets still work when a host shows it
for a deep, missing URL such as `/some/old/page`.

### Script order

The scripts are classic `<script defer>` tags, not ES modules. That means no build tool or special
server is needed. They run in the order they appear, and each file uses what the earlier ones
defined:

| # | File | Defines | Needs |
| --- | --- | --- | --- |
| 1 | `data.js` | `window.SITE_DATA` | — |
| 2 | `core.js` | `SAQ.core` | `SITE_DATA.contact` |
| 3 | `icons.js` | `SAQ.icon` | `SAQ.core` |
| 4 | `components.js` | `SAQ.components` | `SAQ.core`, `SAQ.icon` |
| 5 | `layout.js` | `SAQ.layout` | core, icon, components |
| 6 | `enquiry-form.js` | `SAQ.enquiryForm` | core, icon, components |
| 7 | `pages.js` | `SAQ.pages` | core, components (and `SAQ.enquiryForm` at runtime) |
| 8 | `app.js` | — (runs `bootstrap`) | everything above |

> If you add a new script file, add its `<script>` tag to **all 7 HTML files** in the right position.

### Safe HTML templating

Components build HTML with the `html` tagged template from `core.js`:

```js
const { html } = SAQ.core;
const card = html`<h3 class="card__title">${service.title}</h3>`;
```

- Every value inside `${…}` is **escaped** automatically (`<` becomes `&lt;` and so on),
  so text from `data.js` can never break the page or inject code.
- `html` returns a `SafeHtml` object. When you nest one `html` result inside another, it is
  inserted as-is (not escaped twice).
- Arrays are joined, so `${items.map((item) => html`<li>${item}</li>`)}` works.
- `null`, `undefined` and `false` render nothing, so `${condition ? html`…` : ''}` works.

### Buttons and links ("CTAs")

Anywhere `data.js` describes a button, it is either a link (`href`) or an action (`whatsapp` or `email`):

```js
{ label: 'Get career help', href: 'contact.html' }   // normal link
{ label: 'Chat on WhatsApp', action: 'whatsapp' }     // WhatsApp chat
{ label: 'Email', action: 'email' }                   // email (see section 6)
```

`links.resolve()` in `core.js` turns either shape into `{ label, href, external, icon }`.
Links starting with `http://` or `https://` automatically open in a new tab.

---

## 4. Editing content (`data.js`)

Everything a visitor can read comes from `assets/js/data.js`. The only exceptions are in each HTML
file: the page title, meta description, share tags, the "Skip to content" link and the no-JavaScript message. Here is what each key controls:

| Key | What it controls | Shown on |
| --- | --- | --- |
| `contact.whatsappNumber` | WhatsApp number used **inside** WhatsApp links (digits only, with country code). Never displayed. | All WhatsApp buttons |
| `contact.whatsappGreeting` | Message pre-typed when a visitor opens WhatsApp | All WhatsApp buttons |
| `contact.email` | Email address. Shown as text on the Contact page and footer; used as the target of every Email button | Contact page, footer, FAQ help box, privacy page |
| `contact.emailSubject` | Subject line pre-filled in the email | All email buttons |
| `brand` | Name, the two coloured parts of the name ("Student" + "AQ") and the logo file | Header, footer |
| `nav` | Menu links. `page` must match the page's `data-page` so the link is highlighted | Header, mobile menu, footer |
| `header.cta` | Button in the top-right of the header | Header, mobile menu |
| `labels` | Small interface text (menu labels, "Learn more", "Best for", error text…) | Everywhere |
| `services` | The 9 services: `id`, `icon`, `title`, `summary`, `description`, `includes`, `idealFor` | Home, Services, footer, form checkboxes |
| `serviceGroups` | How services are grouped on the Services page (`serviceIds` lists which) | Services |
| `steps` | "How it works" steps | Home, Services, About |
| `audiences` | "Who we help" cards | Home, About |
| `whyUs` | "Why StudentAQ" / "How we work with you" points | Home, About |
| `destinations` | UK and Dubai: tagline, intro, cities, sectors, highlights, support list, official link | Home, Destinations |
| `testimonials` | Student quotes. **Section is hidden while this is empty.** Add real ones only | Home |
| `faqs` | Questions and answers | Home, Services, Contact |
| `cta` | Big navy "Ready to take the next step?" banner | Bottom of most pages |
| `contactChannels` | The WhatsApp and Email cards | Contact page, FAQ help box, privacy page |
| `pages.home` … `pages.notFound` | Headings and intro text for each page and section | Matching page |
| `enquiryForm` | Form title, button text, messages and the list of `fields` | Contact |
| `googleForm` | Google Form ID and entry IDs (see section 7) | Contact (on submit) |
| `footer` | Footer about text, column headings, extra links, which services to list, disclaimer | Footer |

**Tips**

- Keep quotes and commas balanced. A missing comma breaks the whole page (see
  [Troubleshooting](#13-troubleshooting)).
- `icon` values must be names that exist in `icons.js` (see [Add an icon](#add-an-icon)).
- A `destinations[].formValue` must exactly match one option of the "Where do you want to work?" field.

---

## 5. Common tasks

### Change the WhatsApp number or email

Edit `contact.whatsappNumber` (digits only, e.g. `447123456789`) or `contact.email` in `data.js`.

### Add a new service

1. Add an object to `services` in `data.js`:
   ```js
   {
     id: 'interview-prep',            // lowercase, no spaces; used in URLs
     icon: 'users',                   // any icon name from icons.js
     title: 'Interview preparation',  // also the Google Form checkbox label
     summary: 'One line shown on cards.',
     description: 'A short paragraph for the Services page.',
     includes: ['Point one', 'Point two', 'Point three'],
     idealFor: 'Who this is best for',
   },
   ```
2. Add its `id` to one of the `serviceGroups[].serviceIds` lists, or it won't appear on the Services page.
3. Optional: add its `id` to `footer.serviceIds` to list it in the footer.
4. Add the same `title` as a new checkbox option in the Google Form.

The home page grid, the form checkboxes and the links (`services.html#service-interview-prep`)
update automatically.

### Rename a service

Change `title` in `data.js` **and** the matching checkbox option in the Google Form.
If they don't match, Google may not save that choice.

### Add, edit or remove an FAQ

Edit the `faqs` list. It appears on the Home, Services and Contact pages.

### Add testimonials

Add objects to `testimonials`:

```js
testimonials: [
  { quote: 'StudentAQ helped me…', name: 'Priya S.', detail: 'MSc Finance, London' },
],
```

The "Student stories" section appears on the home page automatically. Use real, permitted
quotes only: publishing fake reviews is illegal in the UK.

### Pre-select form options from a link

The contact form reads the URL, so you can link to it with options already ticked:

```
contact.html?services=cv                       → ticks "CV creation & improvement"
contact.html?services=cv&services=linkedin     → ticks two services
contact.html?targetCountry=Dubai               → selects "Dubai"
```

This works for radio and checkbox fields, using either the option's `id` or its exact label.
The site already uses it for "Enquire about this" (Services) and "Get career help" (Destinations).

### Add a field to the enquiry form

1. Add a field to `enquiryForm.fields` in `data.js`:
   ```js
   { name: 'graduationYear', label: 'Graduation year', type: 'select', required: false,
     options: ['2025', '2026', '2027'] },
   ```
2. Add the same `name` to `googleForm.entries` with its Google entry ID.
3. Add a matching question to the Google Form.

Supported `type` values and their options:

| `type` | Renders as | Extra properties |
| --- | --- | --- |
| `text`, `email`, `tel` | Single-line input | `placeholder`, `autocomplete`, `inputmode`, `maxLength`, `hint` |
| `textarea` | Multi-line input | `placeholder`, `maxLength`, `hint` |
| `select` | Dropdown | `options` |
| `radio` | Pick-one chips | `options` |
| `checkbox` | Pick-many chips | `options`, or `optionsFrom: 'services'` |
| `consent` | Agreement checkbox with a link (validated, **not** sent to Google) | `link: { label, href }` |

Common properties: `name` (required, unique), `label`, `required` (true/false) and
`width: 'full'` (spans both columns on larger screens; otherwise half width).
Optional fields show "(optional)" automatically.

### Add a section to a page

1. In `pages.js`, inside `createSections`, add a builder that returns a **section descriptor**:
   ```js
   partners: (copy) => ({
     content: [ui.sectionHeader(copy), html`<div class="grid grid--4" data-reveal>…</div>`],
   }),
   ```
2. Add its copy to `data.pages.<page>` in `data.js`.
3. In `createPages`, add `sections.partners(pages.home.partners)` to the page's list, in the
   position you want.

Descriptors inside `withAlternatingTones([...])` automatically alternate between white and light-grey
backgrounds. A builder that returns `null` is skipped, and the colours still alternate correctly.

### Add a new page

1. Copy `about.html` to e.g. `employers.html`. Change `<title>`, the meta description, the `og:` tags
   and `data-page="employers"`.
2. Add `pages.employers` copy to `data.js`.
3. Add an `employers: { render: () => [...] }` entry in `createPages` in `pages.js`
   (use `ui.pageHeader(...)`, `withAlternatingTones([...])` and `sections.cta()` like the other pages).
4. Add `{ label: 'Employers', href: 'employers.html', page: 'employers' }` to `nav` in `data.js`.

### Change colours or fonts

- **Colours:** edit the tokens at the top of `styles.css` (`--navy-800`, `--blue-600`, etc.).
  Every component uses these variables.
- **Font:** Inter is bundled in `assets/fonts/` (`@font-face` in `styles.css`). To change it, replace the files, the `@font-face` rules, the preload `<link>` in all 7 HTML files and `--font-sans`.
- **Look and feel:** `assets/css/premium.css` (loaded after `styles.css`) holds the Eduyog-ecosystem design tokens and re-skins the components.

### Change the logo

Replace `assets/img/logo-mark.png` (transparent PNG, roughly 1.5:1). If the proportions change,
update `brand.logoMark.width` and `height` in `data.js`. Also regenerate the favicons and
`og-image.png`.

### Add an icon

Icons are outline SVGs from [Lucide](https://lucide.dev) (ISC licence).

1. Find the icon on lucide.dev and copy the SVG code.
2. In `icons.js`, add an entry to `OUTLINE` with **only the inner elements** (`<path …/>`,
   `<circle …/>`), not the outer `<svg>`.
3. Use its name anywhere an `icon` is accepted.

Filled brand glyphs, such as WhatsApp, go in `FILLED`.

Available icons: `alert-circle`, `arrow-right`, `arrow-up-right`, `briefcase`, `building`, `check`,
`check-circle`, `chevron-down`, `clock`, `compass`, `edit`, `external-link`, `file-text`, `globe`,
`graduation-cap`, `inbox`, `info`, `layers`, `linkedin`, `lock`, `mail`, `map`, `map-pin`, `menu`,
`message`, `quote`, `search`, `send`, `shield`, `target`, `user-check`, `users`, `whatsapp`, `x`.

---

## 6. WhatsApp and email links

### WhatsApp: number hidden, links working

The WhatsApp number is **not displayed anywhere** on the site. Buttons say "Chat on WhatsApp"
or "Start a chat". The number is used only inside the link (`https://wa.me/<number>?text=…`),
which WhatsApp needs to open the chat.

Two things are outside the website's control:

- On a computer, the browser shows a link's address at the bottom of the window when you hover over it,
  and that address contains the number.
- Once the chat opens, WhatsApp itself shows the number.

### Email: works with or without a mail app

A plain `mailto:` link opens the computer's mail app. On many computers no mail app is set up
(people use Gmail in the browser), so clicking does nothing. To avoid that, `links.emailLink()`
chooses a link based on the device:

| Device | What happens |
| --- | --- |
| Phone or tablet (touch screen, no mouse hover) | `mailto:` opens the Mail or Gmail app, which is always installed |
| Computer | Gmail's compose window opens in a new tab, with the address and subject filled in |

The device is detected with the CSS media query `(hover: none) and (pointer: coarse)`.

---

## 7. Enquiry form and Google Forms

### How the form behaves

- **Validation:** runs when the visitor clicks "Send enquiry". Every invalid field is marked in red
  with a message, and the page scrolls to the first one.
  - Text, email and phone fields are also checked when the visitor leaves the field (if not empty).
  - Once a field is marked invalid, it re-checks as they type, so the error disappears as soon as it's fixed.
- **Rules:**
  - Required fields must be filled.
  - Email must look like `name@domain.tld`.
  - Phone may contain only digits, spaces, `+ ( ) - .` and must have 8–15 digits.
  - Text can't exceed `maxLength`.
- **Sending:** while the form sends, the button shows a spinner and "Sending…" and is disabled,
  so the enquiry can't be sent twice.
- **Success:** the form is replaced by a "Thank you" message with "Chat on WhatsApp" and
  "Send another enquiry" buttons.
- **Failure:** if there's no internet, the request times out (15 seconds) or Google Forms isn't
  set up, a red message appears with a **Send on WhatsApp** button. That button opens WhatsApp with
  all the visitor's answers already typed, so no enquiry is lost.
- **Spam protection:** a hidden "honeypot" field is invisible to people. Bots that fill it get a
  fake success message and nothing is sent.

### Connect it to Google Forms

Until this is set up, submitting shows the failure message with the WhatsApp fallback.
The browser console lists exactly which settings are missing.

**1. Create the Google Form** at https://forms.google.com with these questions, in this order:

| Question | Type | Options (must match exactly) |
| --- | --- | --- |
| Full name | Short answer | — |
| Email address | Short answer | — |
| WhatsApp number | Short answer | — |
| Where are you based now? | Dropdown | United Kingdom, United Arab Emirates, India, Other |
| Current status | Dropdown | Current student, Final-year student, Recent graduate, Working professional |
| Where do you want to work? | Multiple choice | UK, Dubai, Both |
| University / college | Short answer | — |
| Course / field of study | Short answer | — |
| What do you need help with? | Checkboxes | CV creation & improvement, LinkedIn profile, Job searching, Part-time jobs, Internships, Placements, Graduate jobs, Employer connections, Career guidance |
| Anything else we should know? | Paragraph | — |

- **Don't mark any question as Required** in Google Forms. The website already validates the fields,
  and a required question left empty makes Google silently reject the response.
- In **Settings → Responses**, set *Collect email addresses* to **Do not collect**, and make sure the
  form doesn't require sign-in and isn't restricted to one organisation.
- In the **Responses** tab, click **Link to Sheets** to see enquiries in a spreadsheet.

**2. Copy the form ID.** Click **Send → Link**, then open the link. The URL looks like
`https://docs.google.com/forms/d/e/1FAIpQLSc...XYZ/viewform`. Copy the long part between `/e/` and
`/viewform` into `googleForm.formId` in `data.js`.

**3. Copy the entry IDs.**

1. In the form editor, open the **⋮** menu and choose **Get pre-filled link**.
2. Answer every question with anything. For checkboxes, tick one option.
3. Click **Get link**, then **Copy link**, and paste it somewhere you can read it.
4. The link contains one `entry.123456789=…` per question, in question order. Copy each into
   `googleForm.entries`:

```js
entries: {
  fullName: 'entry.111111111',
  email: 'entry.222222222',
  phone: 'entry.333333333',
  currentCountry: 'entry.444444444',
  status: 'entry.555555555',
  targetCountry: 'entry.666666666',
  university: 'entry.777777777',
  course: 'entry.888888888',
  services: 'entry.999999999',
  message: 'entry.101010101',
},
```

**4. Test it.** Submit the form on the website and check that the response appears in Google Forms.

Google doesn't let websites read its reply (no CORS headers), so the website can only tell whether
the request **reached** Google, not whether Google **accepted** it. **Run a test submission every time
you change the form's questions or options.**

### What is sent

The form sends a `POST` to `https://docs.google.com/forms/d/e/<formId>/formResponse` with each
answer under its entry ID, e.g. `entry.111111111=Priya`. Checkbox fields send one
`entry.999999999=…` per ticked option. The consent checkbox is validated on the website only
and not sent.

---

## 8. JavaScript reference

All functions live on one global object, `window.SAQ`, so they don't clash with anything else.
Every file is wrapped in `(function (SAQ) { … })(window.SAQ = window.SAQ || {})`, which keeps its
private helpers private.

### `data.js`

Sets `window.SITE_DATA`, a plain object holding all content and settings (see section 4).
It has no functions. `enquiryCta` and `whatsappCta` are shared button definitions, written once
and reused in several places inside the file.

### `core.js` → `SAQ.core`

Low-level helpers used by every other file.

| Function | What it does |
| --- | --- |
| `escapeHtml(value)` | Converts `& < > " '` into safe HTML entities |
| `raw(value)` | Marks a string as trusted HTML so `html` won't escape it. Use only for markup you wrote yourself |
| `toHtml(value)` | Turns any value into an HTML string: `null`/`undefined`/`false` → empty, arrays joined, `SafeHtml` inserted as-is, everything else escaped |
| `` html`…` `` | Tagged template that escapes every `${value}` and returns `SafeHtml` (see section 3) |
| `attrs(map)` | Builds HTML attributes from an object. `true` → boolean attribute (`required`); `false`, `null`, `undefined` and `''` are skipped. Example: `attrs({ id: 'x', required: true })` → ` id="x" required` |
| `mount(target, content)` | Renders content into a DOM element (replaces its contents) |
| `toElement(content)` | Renders content and returns it as a real DOM element (used for the floating WhatsApp button) |
| `prefersReducedMotion()` | `true` if the visitor has "reduce motion" turned on in their device settings |
| `externalAttrs(external)` | Returns `target="_blank" rel="noopener noreferrer"` when `external` is true, otherwise nothing |
| `links.whatsappUrl(message?)` | `https://wa.me/<number>?text=<message>`. Defaults to `contact.whatsappGreeting`; the form's WhatsApp fallback passes the visitor's answers |
| `links.emailLink(subject?)` | Returns `{ href, external }`: `mailto:` on touch devices, Gmail compose on computers (see section 6) |
| `links.resolve(cta)` | Turns a CTA (`{ label, href }` or `{ label, action }`) into `{ label, href, external, icon }` |
| `routes.serviceAnchor(id)` | `service-<id>`: the HTML id of a service card |
| `routes.service(id)` | `services.html#service-<id>` |
| `routes.destination(id)` | `destinations.html#<id>` |
| `routes.enquiry(prefill)` | `contact.html?…` with form pre-selections, e.g. `routes.enquiry({ services: 'cv' })` |

### `icons.js` → `SAQ.icon`

| Function | What it does |
| --- | --- |
| `icon(name, { size = 24, className })` | Returns an inline SVG for `name` with classes `icon icon--<name>`. Icons use `currentColor`, so they take the text colour. They are `aria-hidden` (decorative). An unknown name logs a console warning and renders nothing |

`OUTLINE` holds stroke icons (Lucide style, 1.75px line); `FILLED` holds solid brand glyphs.

### `components.js` → `SAQ.components`

Reusable building blocks. Each one takes props and returns `SafeHtml`. **Components never read
`SITE_DATA` directly**: `pages.js` and `layout.js` pass the data in, so every component is reusable
with any content.

**Primitives**

| Component | What it renders |
| --- | --- |
| `button(cta, { variant, size, block, className, iconName })` | A link styled as a button. `variant`: `primary`, `secondary`, `ghost`, `whatsapp`, `light`, `outline-light`. `size`: `sm`, `lg`. `block: true` → full width. Icon defaults to the CTA's icon (WhatsApp/mail) |
| `textLink(cta, { className })` | Blue text link with an arrow (↗ for external links) |
| `iconTile(name)` | Icon inside a light-blue rounded square |
| `checklist(items, { className })` | List with blue tick icons. `checklist--light` for dark backgrounds |
| `chipList(items, { iconName })` | Row of small rounded "chips" (e.g. city names) |
| `labelledChips(label, items, options)` | Small uppercase label above a `chipList` |
| `notice(text)` | Light-blue info box (used for the visa disclaimer) |

**Section scaffolding**

| Component | What it renders |
| --- | --- |
| `section({ id, tone, className, content })` | `<section>` with page-width container. `tone: 'muted'` → light-grey background |
| `sectionHeader({ eyebrow, title, text, action, align })` | Small blue label, heading and intro text. `align`: `center`, `left`, or `split` (heading left, `action` link right) |
| `pageHeader({ eyebrow, title, text, jumpLinks })` | Top banner of inner pages with the `<h1>`. `jumpLinks` adds pill links to sections on the same page |

**Home hero**

| Component | What it renders |
| --- | --- |
| `hero({ badge, eyebrow, title, highlight, text, primaryCta, secondaryCta, points, roadmap })` | Home page top section: headline, buttons, tick points and the career-plan card |
| `highlightText(text, highlight)` *(private)* | Wraps the `highlight` phrase inside `title` in `<em>` (shown in blue) |
| `roadmapCard({ title, subtitle, progressLabel, statusLabels, items, tags })` *(private)* | Illustrative "Your career plan" card. Progress bar is calculated from items with `status: 'done'`. Hidden from screen readers because it's decorative |

**Cards**

| Component | What it renders |
| --- | --- |
| `serviceCard(service, { href, linkLabel })` | Compact service card for the home page. The whole card is clickable |
| `serviceDetail(service, { anchorId, enquireHref, labels })` | Full service card for the Services page (description, includes, "Best for", enquire link). Highlighted when its `#anchor` is in the URL |
| `featureCard(item, { variant })` | Icon + title + text. `variant: 'card'` (bordered) or `'plain'` |
| `stepList(steps, { stepLabel })` | Numbered "How it works" steps: 4 columns with dashed connectors on desktop, a vertical timeline on mobile |
| `destinationCard(destination, { href, linkLabel })` | Home page UK/Dubai card with navy header |
| `destinationDetail(destination, { enquireHref, labels })` | Full destination section: intro, cities, how we help, and a sticky "Good to know" side card |
| `channelCard({ id, icon, title, value, text, href, external })` | Clickable WhatsApp/Email card on the Contact page |
| `testimonialCard({ quote, name, detail })` | Quote card with initials avatar |

**Composite blocks**

| Component | What it renders |
| --- | --- |
| `faqList(items)` | Accordion using native `<details>`/`<summary>`, so it works with keyboard and screen readers without extra JS |
| `ctaBand({ title, text, primary, secondary })` | Big navy call-to-action banner |
| `helpCard({ title, text, actions })` | Small "Still have questions?" box with buttons |
| `prose({ updated, sections, footer })` | Long-form text (privacy policy): headings, paragraphs, bullet lists |
| `statusPanel({ code, title, text, primary, secondary })` | Centred message page (404) |
| `classNames(...names)` *(private)* | Joins class names, skipping empty ones |

### `layout.js` → `SAQ.layout`

Builds the parts shared by every page.

| Function | What it does |
| --- | --- |
| `init(data, page)` | **Exported.** Renders header and footer, adds the floating WhatsApp button, and starts the scroll and menu behaviour |
| `brandLink(data)` | Logo mark + "Student**AQ**" wordmark linking to the home page |
| `navLinks(items, page, { className, trailingIcon })` | Menu links; adds `aria-current="page"` to the current page's link so it is highlighted |
| `headerTemplate(data, page)` | Desktop header (logo, menu, CTA button), the mobile menu toggle, and the mobile menu panel |
| `footerColumn(title, items)` | One footer column of links |
| `footerTemplate(data)` | Full footer: brand + about, Explore links, Popular services, Get in touch (WhatsApp + email), copyright and disclaimer. The year updates automatically |
| `whatsappFloatTemplate(data)` | Round green WhatsApp button fixed to the bottom-right corner |
| `initHeaderScrollState(header)` | Adds `is-scrolled` to the header after 8px of scrolling (shows a border and shadow) |
| `initMobileMenu(header, { labels, inertWhenOpen })` | Mobile menu open/close (see below) |

What the mobile menu does:

- The ☰ button toggles the menu and updates `aria-expanded` and its label ("Open menu" / "Close menu").
- While open, the page behind can't scroll (`body.menu-open`) and can't be focused or clicked (`inert`).
- Clicking a link closes the menu, and so does pressing **Escape** (focus returns to the button).
- Resizing to desktop width closes it.
- Opening the menu with the keyboard moves focus to the first link; tapping it doesn't.

### `enquiry-form.js` → `SAQ.enquiryForm`

**Entry point**

| Function | What it does |
| --- | --- |
| `mount(container, { copy, googleForm, optionSources, whatsappGreeting })` | **Exported.** Renders the form into `container` and wires up validation and submission. `copy` = `data.enquiryForm`, `optionSources.services` = service options, `whatsappGreeting` starts the fallback message |
| `renderForm()` *(inside mount)* | Draws the form and calls `bindForm` |
| `renderSuccess()` *(inside mount)* | Replaces the form with the thank-you message, moves focus to it, scrolls it into view |
| `bindForm(form)` *(inside mount)* | Attaches the input/change/focusout/submit listeners |
| `setSubmitting(bool)` *(inside bindForm)* | Toggles the button spinner, disabled state, "Sending…" label and `aria-busy` |
| `revalidate(field)` / `handleLiveValidation(event)` *(inside bindForm)* | Re-checks a field that is already marked invalid while the visitor types |

**Options and prefill**

| Function | What it does |
| --- | --- |
| `resolveOptions(field, optionSources)` | Normalises a field's options to `{ id, value }`, or loads them from `optionsFrom` (e.g. services) |
| `prefilledOptionValues(field, params)` | Reads `?name=value` from the URL and returns which options to pre-tick |

**Templates**

| Function | What it does |
| --- | --- |
| `formTemplate(fields, context)` | Whole form: header, fields, honeypot, error area, privacy note, submit button |
| `singleField(field, { copy })` | Label + input/select/textarea + hint + error |
| `optionsField(field, { copy, params })` | `<fieldset>` of radio or checkbox chips |
| `consentField(field)` | Agreement checkbox with privacy-policy link (opens in a new tab so answers aren't lost) |
| `CONTROL_TEMPLATES` | Map of `select` / `textarea` / `input` renderers used by `singleField` |
| `FIELD_TEMPLATES` | Map of field `type` → template function. Unknown types are skipped with a console warning |
| `labelContent(field, copy)` | Label text plus "(optional)" for non-required fields |
| `controlAttrs(field)` | `id`, `name`, `autocomplete`, `placeholder`, `maxlength`, `required`, `aria-describedby` for an input |
| `hintTemplate(field)` / `errorTemplate(field)` | Hint line and (initially hidden) error line |
| `errorAlertTemplate(copy, whatsappHref)` | Red failure message with "Send on WhatsApp" |
| `successTemplate(copy)` | Thank-you message |
| `fieldId`, `hintId`, `errorId`, `fieldClass`, `describedBy` | Small helpers that build consistent ids and classes |

**Values and validation** (pure functions, no DOM changes)

| Function | What it does |
| --- | --- |
| `readValues(form, fields)` | Reads answers: a trimmed string per field, or an array for checkbox fields |
| `validateField(field, value, messages)` | Returns an error message or `null` (required → too long → email format → phone format) |
| `enquirySummary(greeting, fields, values)` | Builds the plain-text WhatsApp fallback message ("Full name: …", one line per answer) |
| `isEmpty(value)` / `countDigits(value)` | Helpers for validation |

**Google Forms**

| Function | What it does |
| --- | --- |
| `configurationProblems(googleForm, fields)` | Lists missing settings (`formId`, `entries.<name>`) |
| `submitToGoogleForm(googleForm, fields, values)` | Throws if not configured; otherwise sends the answers with `fetch` (`mode: 'no-cors'`) and aborts after `timeoutMs` |

**DOM state**

| Function | What it does |
| --- | --- |
| `setFieldError(form, field, message)` | Shows or clears a field's error: red border (`is-invalid`), message text and `aria-invalid` |
| `focusField(form, field)` | Focuses a field and scrolls it to the middle of the screen |
| `scrollIntoViewIfAbove(element)` | Scrolls up to an element only if it's above the visible area |

**Constants:** `HONEYPOT_NAME` (hidden spam field), `MIN_PHONE_DIGITS` / `MAX_PHONE_DIGITS`
(8 / 15), `EMAIL_PATTERN`, `PHONE_PATTERN`, `LOCAL_ONLY_TYPES` (types not sent to Google:
`consent`), `TEXT_TYPES` (checked on blur) and `REQUIRED_MESSAGE_KEY` (which message to show per type).

### `pages.js` → `SAQ.pages`

Decides **what appears on each page and in which order**, and connects components to `SITE_DATA`.

| Function | What it does |
| --- | --- |
| `create(data)` | **Exported** (internally `createPages`). Returns `{ home, services, destinations, about, contact, privacy, notFound }`. Each is `{ render(), init?(main) }` |
| `withAlternatingTones(descriptors, { startWith })` | Wraps section descriptors in `<section>`s, alternating white / light grey and skipping `null`s. `startWith: 'muted'` is used after the white home hero |
| `createSections(data)` | Returns the section builders below, bound to `data` |

Section builders (from `createSections`):

| Builder | Section |
| --- | --- |
| `servicesGrid(copy)` | Home: 9 service cards + "View all services" |
| `serviceGroups()` | Services page: each group with its detailed service cards |
| `steps(copy)` | "How it works" |
| `features(copy, items, { variant, columns })` | Grid of feature cards (used for audiences and why-us) |
| `destinationCards(copy)` | Home: UK and Dubai cards |
| `destinationDetails()` | Destinations page: one section per destination (returns an array) |
| `testimonials(copy)` | Student quotes, or `null` (hidden) when there are none |
| `faq(copy)` | FAQ accordion with "Still have questions?" box |
| `aboutStory(copy)` | About: story text + navy mission card |
| `contactLayout(copy)` | Contact: form container + WhatsApp/Email cards + "What happens next" |
| `notice(text)` | Compact info box section |
| `privacy(copy)` | Privacy policy text + contact buttons |
| `notFound(copy)` | 404 message |
| `cta()` | Navy call-to-action banner section |
| `helpActions()` *(private)* | WhatsApp + Email buttons built from `contactChannels` |

Page compositions (inside `createPages`):

| Page | Sections, in order |
| --- | --- |
| `home` | hero → services grid → steps → audiences → destinations → why us → testimonials (if any) → FAQ → CTA |
| `services` | page header (+ group jump links) → service groups → steps → FAQ → CTA |
| `destinations` | page header (+ UK/Dubai jump links) → UK → Dubai → disclaimer notice → CTA |
| `about` | page header → story & mission → why us → steps → audiences → CTA |
| `contact` | page header → form & contact options → FAQ. `init` mounts the enquiry form |
| `privacy` | page header → policy text |
| `notFound` | 404 message |

### `app.js`

Starts the site once the scripts have loaded.

| Function | What it does |
| --- | --- |
| `bootstrap()` | Reads `data-page` and renders the layout and page (see section 3). If anything throws, it logs the error and shows `labels.loadError` instead of a blank page |
| `initReveal(root)` | Fades elements marked `data-reveal` in as they scroll into view, once each, using `IntersectionObserver`. Skipped if the browser doesn't support it; disabled by CSS for "reduce motion" users |
| `scrollToHash()` | Content is created after the page loads, so the browser can't jump to `#anchors` by itself. This does it after rendering (e.g. `services.html#service-cv`) |
| `renderLoadError(message)` | Shows the "Something went wrong" box |

---

## 9. CSS guide

`assets/css/styles.css` is one file split into numbered sections:

| # | Section | Contains |
| --- | --- | --- |
| 1 | Tokens | Colours, font, sizes, radii, shadows, spacing, header height, motion |
| 2 | Base | Reset, typography, focus ring, skip link, `[hidden]` rule |
| 3 | Layout | `.container`, `.section` (+ `--muted`, `--compact`, `--cta`), `.grid--2/3/4`, section headers |
| 4 | Buttons & links | `.btn` and its variants, `.text-link`, `.stretched-link` |
| 5 | Header | Sticky header, desktop nav, mobile menu |
| 6 | Footer | Footer grid and the floating WhatsApp button |
| 7 | Shared UI | Dot pattern, cards, icon tiles, checklists, chips, pill, notice, help card |
| 8 | Hero & page header | Home hero, career-plan card, inner page headers, jump links |
| 9 | Sections | Steps, features, destinations, services page, FAQ, testimonials, about, CTA band, prose, 404 |
| 10 | Contact & form | Contact layout, channel cards, form fields, option chips, alerts, success state |
| 11 | Motion & utilities | Spinner animation, scroll reveal, reduced-motion overrides |

### Design tokens

| Token | Value | Use |
| --- | --- | --- |
| `--navy-800` | `#0e335a` | Logo navy: CTA band, badges, dark cards |
| `--blue-600` | `#1e73bf` | Logo blue: primary buttons, links, accents |
| `--blue-700` | `#185c9c` | Hover state of blue |
| `--blue-50/100/200` | light blues | Tinted backgrounds and borders |
| `--ink` / `--text` / `--muted` / `--subtle` | dark → light greys | Headings / body / secondary text / placeholders |
| `--border` / `--border-strong` | greys | Card borders / input borders |
| `--surface` / `--surface-muted` | white / light grey | Backgrounds |
| `--whatsapp*`, `--success-*`, `--danger-*` | | WhatsApp buttons, success and error states |
| `--font-sans` | Inter (variable, bundled) | All text |
| `--radius-*`, `--shadow-*` | | Rounded corners, soft shadows |
| `--container` | `1160px` | Maximum content width |
| `--gutter` | 16–32px | Side padding (scales with screen) |
| `--section-y` | 64–112px | Vertical space between sections (scales with screen) |
| `--header-h` | 64px mobile / 76px desktop | Header height (also used for sticky offsets and anchor scrolling) |

Colours were sampled from the logo. Heading and body text colours (`--ink`, `--text`, `--muted`) pass WCAG AA contrast on white; `--subtle` is only for placeholders, icons and small status labels.

### Naming

Classes follow **BEM**: `block`, `block__element`, `block--modifier` (e.g. `.card`, `.card__title`,
`.card--interactive`). State classes start with `is-`:

| Class | Meaning | Set by |
| --- | --- | --- |
| `.is-scrolled` | Page scrolled; header shows border | `layout.js` |
| `body.menu-open` | Mobile menu open; page can't scroll | `layout.js` |
| `.is-invalid` | Form field has an error | `enquiry-form.js` |
| `.is-loading` | Submit button shows spinner | `enquiry-form.js` |
| `html.js-reveal` / `.is-visible` | Scroll reveal enabled / element revealed | `app.js` |

### Breakpoints (mobile-first)

| Width | Changes |
| --- | --- |
| < 480px | Hero and CTA buttons go full width |
| ≥ 640px | Grids become 2 columns; form becomes 2 columns; steps leave timeline mode |
| ≥ 768px | Split section headers (heading left, link right) |
| ≥ 960px | Desktop navigation replaces the ☰ menu; taller header |
| ≥ 1024px | 3- and 4-column grids; side-by-side layouts (hero, FAQ, contact, destinations); sticky side cards |

### Useful rules to know

- `[hidden] { display: none !important; }` makes the `hidden` attribute always win, even on elements
  with `display: flex`. Without it, the mobile menu and error messages would show when they shouldn't.
- `.stretched-link::after` stretches a link over its whole card, so the card is clickable while the
  link text stays the accessible name.
- Inputs use a 16px font so iPhones don't zoom in when a field is tapped.

---

## 10. Images

| File | Used for |
| --- | --- |
| `logo-mark.png` | "SA" mark in the header and footer (transparent background) |
| `logo-full.png` | Full logo with "StudentAQ" text, transparent. Not used by the pages; kept for social profiles, documents, etc. |
| `favicon-32.png` | Browser tab icon |
| `icon-192.png` | Android home-screen icon |
| `apple-touch-icon.png` | iPhone/iPad home-screen icon |
| `og-image.png` | Preview image when the link is shared on WhatsApp, LinkedIn, etc. (1200×630) |

All were generated from the original `StudentAQ Logo.png`.

---

## 11. Accessibility and responsive design

- **Keyboard:**
  - Every interactive element is reachable and shows a visible blue focus ring.
  - The "Skip to content" link appears on the first Tab press.
  - The mobile menu closes with Escape.
- **Screen readers:**
  - Semantic landmarks (`header`, `nav`, `main`, `footer`), one `<h1>` per page, and `aria-current` on the active menu link.
  - Form errors are linked to their fields with `aria-describedby` and `aria-invalid`, and the failure message uses `role="alert"`.
  - Decorative icons are hidden with `aria-hidden`.
- **Touch:** buttons, menu items and option chips are at least 44px tall.
- **Motion:** only subtle fade-ins and hover transitions. They are turned off for visitors who choose
  "reduce motion" in their device settings.
- **Responsive:** tested at 375px (phone), 768px (tablet) and 1280px (desktop) with no sideways scrolling.

---

## 12. Deploy

Upload this folder to any static host, such as Netlify (drag and drop the folder), Cloudflare Pages,
GitHub Pages or Vercel. There's nothing to build. These hosts serve `404.html` automatically for
missing pages.

After deploying:

1. **Social previews:** change `og:image` in each HTML file to the full URL, e.g.
   `https://yourdomain.com/assets/img/og-image.png`. WhatsApp and LinkedIn need a full URL to show the image.
2. **Google Forms:** set `formId` and `entries` (section 7) and submit a test enquiry on the live site.
3. **Content review:** check the draft copy in `data.js`: service details, FAQs, the About story and the
   privacy policy.
4. **Subfolder hosting only:** if the site lives in a subfolder (e.g. `example.com/studentaq/`),
   change `<base href="/">` in `404.html` to `<base href="/studentaq/">`.

---

## 13. Troubleshooting

| Problem | Cause and fix |
| --- | --- |
| Changes to `data.js` or CSS don't show | The browser is using its cached copy. Hard refresh with **Cmd + Shift + R** (Mac) or **Ctrl + F5** (Windows) |
| Page shows "Something went wrong while loading this page" or is blank | Usually a typo in `data.js` (missing comma, quote or bracket). Open the browser console (**Cmd + Option + J** / **Ctrl + Shift + J**); the error shows the file and line |
| Console warns `Unknown icon "…"` | An `icon` name in `data.js` doesn't exist in `icons.js`. Fix the name or add the icon |
| Form says "Your enquiry could not be sent" | Google Forms isn't set up yet, or the visitor is offline. The console lists missing settings |
| Form says "sent" but nothing appears in Google Forms | An option label doesn't exactly match the Google Form, a question is marked Required, or the form requires sign-in (section 7) |
| Email button opens Gmail instead of the Mail app | Expected on computers (section 6). Phones open the mail app |
| A service or destination link doesn't scroll to its card | The `id` in the link doesn't match `services[].id` / `destinations[].id` |
| 404 page looks broken locally | `python3 -m http.server` doesn't use `404.html` for missing URLs. Open `/404.html` directly to preview it; hosts use it automatically |
