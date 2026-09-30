/**
 * StudentAQ — website content & settings
 * ---------------------------------------------------------------------------
 * Every piece of text, link and setting shown on the website lives in this file.
 * To update the site, edit the values below — no other file needs to change.
 *
 * Buttons ("CTAs") use one of two shapes:
 *   { label: 'Text', href: 'contact.html' }   → links to a page or URL
 *   { label: 'Text', action: 'whatsapp' }     → opens WhatsApp (or 'email')
 */
window.SITE_DATA = (function () {
  'use strict';

  /* ------------------------------------------------------------------------
   * Contact details
   * --------------------------------------------------------------------- */
  const contact = {
    whatsappNumber: '917295993480', // Digits only, with country code. Only used inside WhatsApp links, never shown on the page.
    whatsappGreeting: 'Hi StudentAQ, I would like some help with my career.',
    email: 'saritex2024@gmail.com',
    emailSubject: 'Career enquiry from the StudentAQ website',
  };

  /** Shorthand for an image in assets/img. Width and height keep the layout steady while it loads. */
  const image = (file, alt, width, height) => ({ src: `assets/img/${file}.webp`, alt, width, height });

  const enquiryCta = { label: 'Get career help', href: 'contact.html' };
  const whatsappCta = { label: 'Chat on WhatsApp', action: 'whatsapp' };

  /* ------------------------------------------------------------------------
   * Services
   * `id` is used in links (services.html#service-<id>, contact.html?services=<id>).
   * `title` is also the option label sent to Google Forms — keep them identical.
   * --------------------------------------------------------------------- */
  const services = [
    {
      id: 'cv',
      icon: 'file-text',
      title: 'CV creation & improvement',
      summary: 'A clear, recruiter-ready CV that gets you shortlisted.',
      description:
        'Starting from scratch or improving an existing CV, we shape it to the format employers in the UK and Dubai expect — focused, easy to scan and tailored to the roles you want.',
      includes: [
        'New CV written or existing CV rewritten',
        'Tailored to your target roles and country',
        'ATS-friendly layout and keywords',
        'Guidance on writing strong cover letters',
      ],
      idealFor: 'Anyone applying for jobs, internships or placements',
    },
    {
      id: 'linkedin',
      icon: 'linkedin',
      title: 'LinkedIn profile',
      summary: 'A professional profile that gets noticed by recruiters.',
      description:
        'Recruiters in the UK and Dubai search LinkedIn every day. We optimise your profile so it tells a clear story and shows up for the right opportunities.',
      includes: [
        'Headline and About section written for your goals',
        'Experience, skills and education optimised',
        'Keywords that help recruiters find you',
        'Tips to grow a relevant professional network',
      ],
      idealFor: 'Students and graduates building a professional presence',
    },
    {
      id: 'job-search',
      icon: 'search',
      title: 'Job searching',
      summary: 'A focused job search strategy instead of applying blindly.',
      description:
        'Sending hundreds of applications rarely works. We help you target the right roles and employers, and apply in a way that gets responses.',
      includes: [
        'Roles shortlisted to match your profile',
        'Where and how to apply in each country',
        'Tailored applications for priority roles',
        'Interview preparation and follow-ups',
      ],
      idealFor: 'Applicants who are not getting interview calls',
    },
    {
      id: 'part-time',
      icon: 'clock',
      title: 'Part-time jobs',
      summary: 'Flexible work that fits around your studies.',
      description:
        'Earn while you study and gain valuable local work experience. We help you find part-time roles that fit your timetable and follow student work rules.',
      includes: [
        'Roles that fit around your classes',
        'Retail, hospitality, campus and office roles',
        'Guidance on student working-hour limits',
        'CV and interview tips for part-time roles',
      ],
      idealFor: 'Current students who want to earn while studying',
    },
    {
      id: 'internships',
      icon: 'briefcase',
      title: 'Internships',
      summary: 'Real industry experience while you study.',
      description:
        'Internships are often the fastest route to a graduate job. We help you find the right opportunities and apply at the right time.',
      includes: [
        'Summer, winter and year-round internships',
        'Applications timed to recruitment cycles',
        'Cover letter and online assessment preparation',
        'Interview practice for internship roles',
      ],
      idealFor: 'Students building their first industry experience',
    },
    {
      id: 'placements',
      icon: 'building',
      title: 'Placements',
      summary: 'Year-long industry placements as part of your degree.',
      description:
        'A placement year gives you a full year of professional experience before you graduate. We guide you from choosing employers to accepting an offer.',
      includes: [
        'Placement-year opportunities with employers',
        'Application deadlines and planning calendar',
        'Assessment centre preparation',
        'Support from application to offer',
      ],
      idealFor: 'Students on courses with a placement year',
    },
    {
      id: 'graduate-jobs',
      icon: 'graduation-cap',
      title: 'Graduate jobs',
      summary: 'Start your career with the right graduate role.',
      description:
        'Graduate schemes and entry-level roles are competitive. We help you stand out at every stage — from applications to final interviews.',
      includes: [
        'Graduate schemes and entry-level roles',
        'Focus on employers that offer visa sponsorship',
        'Assessment centre and interview preparation',
        'Guidance on comparing and accepting offers',
      ],
      idealFor: 'Final-year students and recent graduates',
    },
    {
      id: 'employer-connections',
      icon: 'users',
      title: 'Employer connections',
      summary: 'Connect with employers and recruiters who are hiring.',
      description:
        'Many roles are filled through networks and referrals. We help you connect with employers and recruiters and make a strong first impression.',
      includes: [
        'Connections with hiring employers and recruiters',
        'Networking and outreach guidance',
        'A confident personal pitch',
        'Follow-up messages that get replies',
      ],
      idealFor: 'Anyone who wants access to more opportunities',
    },
    {
      id: 'career-guidance',
      icon: 'compass',
      title: 'Career guidance',
      summary: 'One-to-one advice to plan your next move.',
      description:
        'Not sure which path is right for you? Our advisors help you understand your options, set clear goals and build a step-by-step plan.',
      includes: [
        'One-to-one career planning sessions',
        'Choosing the right roles, sectors and country',
        'Identifying skills gaps and next steps',
        'Ongoing support as your goals evolve',
      ],
      idealFor: 'Students unsure about their next step',
    },
  ];

  /* ------------------------------------------------------------------------
   * Frequently asked questions
   * --------------------------------------------------------------------- */
  const faqs = [
    {
      question: 'Who is StudentAQ for?',
      answer:
        'Students and recent graduates who want to work in the UK or Dubai — whether you are looking for part-time work, an internship, a placement or your first graduate job.',
    },
    {
      question: 'Do I need to already be in the UK or Dubai?',
      answer:
        'No. We support students wherever they are. Everything can be done online, over WhatsApp and email.',
    },
    {
      question: 'How do I get started?',
      answer:
        'Fill in the enquiry form on our contact page or message us on WhatsApp. We will review your details and get in touch to discuss the best next steps for you.',
    },
    {
      question: 'How much do your services cost?',
      answer:
        'It depends on the support you need. Share your details and we will recommend the right services and explain the costs clearly before you commit.',
    },
    {
      question: 'Can you guarantee me a job?',
      answer:
        'No one can honestly guarantee a job. What we do is make you a much stronger candidate — with a better CV, a stronger profile, targeted applications and interview preparation.',
    },
    {
      question: 'Do you give visa or immigration advice?',
      answer:
        'No. We focus on careers — CVs, job searching, applications and interviews. For visa questions, please check official government websites or speak to a regulated immigration adviser.',
    },
  ];

  return {
    brand: {
      name: 'StudentAQ',
      nameParts: ['Student', 'AQ'], // The second part is shown in brand blue
      logoMark: { src: 'assets/img/logo-mark.png', width: 245, height: 160 },
    },

    contact,

    nav: [
      { label: 'Home', href: 'index.html', page: 'home' },
      { label: 'Services', href: 'services.html', page: 'services' },
      { label: 'Destinations', href: 'destinations.html', page: 'destinations' },
      { label: 'About', href: 'about.html', page: 'about' },
      { label: 'Contact', href: 'contact.html', page: 'contact' },
    ],

    header: { cta: enquiryCta },

    /* Small pieces of interface text used across the site */
    labels: {
      homeLink: 'StudentAQ home',
      openMenu: 'Open menu',
      closeMenu: 'Close menu',
      mainNav: 'Main',
      chatOnWhatsapp: 'Chat on WhatsApp',
      learnMore: 'Learn more',
      enquire: 'Enquire about this',
      bestFor: 'Best for',
      step: 'Step',
      howWeHelp: 'How StudentAQ helps',
      goodToKnow: 'Good to know',
      popularSectors: 'Popular sectors',
      exploreDestination: 'Explore opportunities',
      planYourMove: 'Get career help',
      loadError: 'Something went wrong while loading this page. Please refresh and try again.',
    },

    services,

    serviceGroups: [
      {
        id: 'get-ready',
        title: 'Get application-ready',
        text: 'Make a strong first impression on paper and online.',
        image: image('cv-support', 'A tailored CV with professional, impactful highlights', 393, 303),
        serviceIds: ['cv', 'linkedin'],
      },
      {
        id: 'find-roles',
        title: 'Find the right role',
        text: 'From flexible part-time work to your first graduate job.',
        image: image('job-search', 'A laptop showing a job search for the next opportunity', 372, 259),
        serviceIds: ['job-search', 'part-time', 'internships', 'placements', 'graduate-jobs'],
      },
      {
        id: 'grow',
        title: 'Grow your career',
        text: 'Build your network and a clear plan for the long term.',
        image: image('skills-opportunities', 'A notebook listing new skills, better opportunities and career growth', 279, 231),
        serviceIds: ['employer-connections', 'career-guidance'],
      },
    ],

    steps: [
      { icon: 'edit', title: 'Share your details', text: 'Fill in our short enquiry form or message us on WhatsApp.' },
      { icon: 'message', title: 'Talk to an advisor', text: 'We learn about your background, goals and target country.' },
      { icon: 'map', title: 'Get your plan', text: 'A personalised plan covering your CV, profile and applications.' },
      { icon: 'send', title: 'Apply with confidence', text: 'We support you through applications, interviews and offers.' },
    ],

    audiences: [
      {
        icon: 'globe',
        title: 'New to the UK or Dubai',
        text: 'Understand how hiring works in a new country and find part-time work that fits your studies.',
      },
      {
        icon: 'inbox',
        title: 'Not getting interview calls',
        text: 'Sending applications but hearing nothing back? We fix your CV, profile and approach.',
      },
      {
        icon: 'graduation-cap',
        title: 'Final-year students & graduates',
        text: 'Move into internships, placements and graduate roles with a clear, focused plan.',
      },
    ],

    whyUs: [
      {
        icon: 'user-check',
        title: 'Personal, one-to-one support',
        text: 'Guidance built around your background and goals — never a one-size-fits-all template.',
      },
      {
        icon: 'target',
        title: 'Focused on two markets',
        text: 'We specialise in the UK and Dubai, so our advice stays specific and practical.',
      },
      {
        icon: 'layers',
        title: 'Support from start to finish',
        text: 'From your first CV draft to accepting an offer, we are with you at every step.',
      },
      {
        icon: 'shield',
        title: 'Honest and transparent',
        text: 'Clear, realistic advice so you always know where you stand and what to expect.',
      },
    ],

    destinations: [
      {
        id: 'uk',
        code: 'UK',
        name: 'United Kingdom',
        formValue: 'UK', // Must match an option of the "Where do you want to work?" field
        image: image('uk-opportunities', 'A student looking towards London landmarks', 238, 182),
        tagline: 'Global employers and a structured graduate job market.',
        intro:
          'The UK is home to global companies, fast-growing startups and well-established graduate schemes. We help you understand how hiring works here and position yourself for the right roles.',
        locationsLabel: 'Key cities',
        locations: ['London', 'Manchester', 'Birmingham', 'Leeds', 'Edinburgh', 'Glasgow'],
        sectors: ['Finance & banking', 'Technology', 'Healthcare', 'Engineering', 'Consulting', 'Retail & hospitality'],
        highlights: [
          {
            title: 'Work while you study',
            text: 'Many international students can work part-time during term time, depending on their visa conditions.',
          },
          {
            title: 'Structured graduate schemes',
            text: 'Large employers run graduate and placement programmes with fixed application windows — often opening a year in advance.',
          },
          {
            title: 'Options after graduation',
            text: 'Eligible graduates may be able to stay and work after their course, for example through the Graduate visa route.',
          },
        ],
        support: [
          'UK-format CVs and cover letters',
          'Graduate scheme and placement timelines',
          'Assessment centre and interview preparation',
          'Part-time roles that fit student work rules',
        ],
        officialLink: {
          label: 'Check work visa rules on GOV.UK',
          href: 'https://www.gov.uk/browse/visas-immigration/work-visas',
        },
      },
      {
        id: 'dubai',
        code: 'DXB',
        name: 'Dubai',
        formValue: 'Dubai',
        image: image('dubai-future', 'The Dubai skyline at sunset', 320, 231),
        tagline: 'A global business hub with a fast-growing job market.',
        intro:
          'Dubai attracts international talent across business, technology, hospitality and more. We help you tailor your profile for employers in the region and navigate a job market where networks matter.',
        locationsLabel: 'Key business hubs',
        locations: ['Downtown & Business Bay', 'DIFC', 'Dubai Internet City', 'Dubai Silicon Oasis', 'Jebel Ali'],
        sectors: ['Business & finance', 'Hospitality & tourism', 'Real estate', 'Technology', 'Aviation & logistics', 'Retail'],
        highlights: [
          {
            title: 'International workplaces',
            text: 'Teams bring together people from around the world, so international study and experience are valued.',
          },
          {
            title: 'No personal income tax',
            text: 'The UAE does not charge personal income tax on salaries.',
          },
          {
            title: 'Networks open doors',
            text: 'Many roles are filled through referrals and LinkedIn, which makes a strong professional profile essential.',
          },
        ],
        support: [
          'Dubai-ready CVs and LinkedIn profiles',
          'Targeting the right companies and sectors',
          'Networking and recruiter outreach',
          'Interview and offer guidance',
        ],
        officialLink: {
          label: 'Visit the official UAE government portal',
          href: 'https://u.ae/en/information-and-services/visa-and-emirates-id',
        },
      },
    ],

    /* Add real student testimonials only — the section stays hidden while this is empty.
       Example: { quote: '…', name: 'First name', detail: 'MSc Finance, London' } */
    testimonials: [],

    faqs,

    cta: {
      title: 'Ready to take the next step in your career?',
      text: 'Tell us where you are and where you want to be. We will build the plan to get you there.',
      image: image('invest-in-yourself', 'A calm desk with the words: invest in yourself, it pays the best interest', 299, 231),
      primary: enquiryCta,
      secondary: whatsappCta,
    },

    contactChannels: [
      {
        id: 'whatsapp',
        icon: 'whatsapp',
        title: 'WhatsApp',
        value: 'Start a chat',
        text: 'The quickest way to reach us — share your CV and questions directly.',
        action: 'whatsapp',
      },
      {
        id: 'email',
        icon: 'mail',
        title: 'Email',
        value: contact.email,
        text: 'Send us your questions or CV and we will reply by email.',
        action: 'email',
      },
    ],

    /* ------------------------------------------------------------------------
     * Page copy
     * --------------------------------------------------------------------- */
    pages: {
      home: {
        hero: {
          badge: 'UK & Dubai',
          eyebrow: 'Career support for students',
          title: 'Your career in the UK & Dubai starts here',
          highlight: 'UK & Dubai',
          text: 'From a standout CV to your first graduate role — personal support that gets students hired.',
          image: image('uk-dubai-opportunities', 'Landmarks of the UK and Dubai side by side', 353, 259),
          primaryCta: enquiryCta,
          secondaryCta: whatsappCta,
          points: ['Personal 1:1 guidance', 'Focused on the UK & Dubai', 'For students and graduates'],
          roadmap: {
            title: 'Your career plan',
            subtitle: 'Built with your StudentAQ advisor',
            progressLabel: 'Progress',
            statusLabels: { done: 'Done', active: 'In progress', next: 'Up next' },
            items: [
              { label: 'CV rewritten for UK roles', status: 'done' },
              { label: 'LinkedIn profile optimised', status: 'done' },
              { label: 'Applying to graduate roles', status: 'active' },
              { label: 'Interview preparation', status: 'next' },
            ],
            tags: ['London', 'Dubai'],
          },
        },
        services: {
          eyebrow: 'What we do',
          title: 'Everything you need to get hired',
          text: 'Nine services covering every stage of your job search.',
          action: { label: 'View all services', href: 'services.html' },
        },
        steps: {
          eyebrow: 'How it works',
          title: 'From first message to job offer',
          text: 'Four simple steps, built around your goals.',
          image: image('plan-learn-grow', 'Books stacked and labelled plan, learn, grow, succeed', 307, 231),
        },
        audiences: {
          eyebrow: 'Who we help',
          title: 'Built for students at every stage',
          text: 'Just arrived or about to graduate — we meet you where you are.',
        },
        destinations: {
          eyebrow: 'Destinations',
          title: 'Two destinations, one clear plan',
          text: 'We specialise in the UK and Dubai, so our guidance stays practical.',
        },
        whyUs: {
          eyebrow: 'Why StudentAQ',
          title: 'Support that feels personal',
          text: 'No templates. No mass applications. Just guidance built around you.',
          image: image('bigger-dreams', 'A student with a backpack looking out over a valley at sunrise', 350, 201),
        },
        testimonials: {
          eyebrow: 'Student stories',
          title: 'What students say about us',
        },
        faq: {
          eyebrow: 'FAQs',
          title: 'Questions, answered',
          text: 'The questions students ask us most.',
          helpTitle: 'Still have questions?',
          helpText: 'Message us and we will be happy to help.',
        },
      },

      services: {
        header: {
          eyebrow: 'Services',
          title: 'Career services for every stage of your journey',
          text: 'Choose the support you need, or let us recommend the right mix.',
          image: image('interview-preparation', 'An interview preparation checklist beside a laptop', 403, 259),
        },
        steps: {
          eyebrow: 'How it works',
          title: 'Getting started is simple',
          text: 'Tell us your goals and we build the plan around them.',
          image: image('how-it-works', 'Four steps: tell us what you need, we understand it, get support, move forward', 400, 201),
        },
      },

      destinations: {
        header: {
          eyebrow: 'Destinations',
          title: 'Build your career in the UK or Dubai',
          text: 'What to expect in each market — and how we help you succeed there.',
          image: image('journey-uk-dubai', 'A student between the skylines of the UK and Dubai', 542, 303),
        },
        notice:
          'StudentAQ provides career support, not immigration or legal advice. Visa rules change regularly, so always confirm the latest requirements on official government websites.',
      },

      about: {
        header: {
          eyebrow: 'About us',
          title: 'Helping students turn their education into careers',
          text: 'Career support for students and graduates aiming at the UK and Dubai.',
          image: image('why-studentaq', 'Why choose StudentAQ: student focused, personalised support, UK and Dubai expertise, real results', 388, 201),
        },
        story: {
          eyebrow: 'Our story',
          title: 'Talent is rarely the problem. Knowing how hiring works is.',
          paragraphs: [
            'Studying abroad is a big investment, yet many talented students struggle to find work — not because they lack ability, but because hiring works differently in a new country.',
            'StudentAQ exists to close that gap: practical knowledge of the UK and Dubai job markets, plus one-to-one support.',
          ],
        },
        mission: {
          title: 'Our mission',
          text: 'To give every student clear, honest and practical career support — from their first CV to their first graduate role.',
          points: ['Clear, practical advice', 'Honest expectations', 'Support at every step'],
        },
        whyUs: {
          eyebrow: 'Our approach',
          title: 'How we work with you',
          text: 'Four principles guide every conversation we have with a student.',
        },
        steps: {
          eyebrow: 'The process',
          title: 'What working with us looks like',
          text: 'A simple, personal process designed around your goals.',
          image: image('education-future', 'A graduation cap on books labelled education, experience, better opportunities', 285, 303),
        },
        audiences: {
          eyebrow: 'Who we help',
          title: 'Built for students at every stage',
          text: 'Whether you have just arrived or are about to graduate, we meet you where you are.',
        },
      },

      contact: {
        header: {
          eyebrow: 'Contact us',
          title: 'Let’s plan your next career move',
          text: 'Share a few details and our team will get in touch — or reach us directly on WhatsApp or email.',
        },
        channels: {
          title: 'Prefer to talk directly?',
          text: 'Choose whichever channel suits you best.',
          image: image('whatsapp-support', 'A phone showing a WhatsApp chat with StudentAQ', 380, 259),
        },
        nextSteps: {
          title: 'What happens next',
          items: [
            'We review your details and career goals.',
            'An advisor contacts you on WhatsApp or email.',
            'We recommend the right support for you.',
          ],
        },
        faq: {
          eyebrow: 'FAQs',
          title: 'Before you get in touch',
          text: 'Answers to the questions students ask us most.',
          helpTitle: 'Still have questions?',
          helpText: 'Message us and we will be happy to help.',
        },
      },

      privacy: {
        header: {
          eyebrow: 'Legal',
          title: 'Privacy policy',
          text: 'How StudentAQ collects, uses and protects your personal information.',
        },
        updated: 'Last updated: 17 September 2026',
        contactTitle: 'Contact us about your data',
        sections: [
          {
            title: 'Who we are',
            paragraphs: [
              'StudentAQ provides career support services to students and graduates who want to work in the UK and Dubai. This policy explains how we handle the information you share with us through this website, WhatsApp and email.',
            ],
          },
          {
            title: 'Information we collect',
            paragraphs: ['We only collect the information you choose to share with us, such as:'],
            list: [
              'Your name, email address and WhatsApp number',
              'Where you are based and where you want to work',
              'Your education details and career goals',
              'Any message, CV or documents you send us',
            ],
          },
          {
            title: 'How we use your information',
            list: [
              'To respond to your enquiry and contact you about our services',
              'To understand your goals and recommend the right support',
              'To deliver the services you ask us for',
            ],
          },
          {
            title: 'How your information is stored and shared',
            paragraphs: [
              'Enquiries submitted through our website form are stored using Google Forms. We never sell your personal information. We only share it with others — for example, an employer — when it is needed to provide a service you have asked for, and with your permission.',
            ],
          },
          {
            title: 'How long we keep it',
            paragraphs: [
              'We keep your information only for as long as we need it for the purposes above, or until you ask us to delete it.',
            ],
          },
          {
            title: 'Your rights',
            paragraphs: [
              'You can ask us at any time to access, correct or delete the personal information we hold about you. To make a request, contact us using the details below.',
            ],
          },
        ],
      },

      notFound: {
        code: '404',
        title: 'We could not find that page',
        text: 'The page you are looking for may have moved or no longer exists.',
        image: image('career-signpost', 'A signpost pointing to guidance, opportunities, skills, confidence and success', 285, 303),
        primary: { label: 'Back to home', href: 'index.html' },
        secondary: { label: 'Contact us', href: 'contact.html' },
      },
    },

    /* ------------------------------------------------------------------------
     * Enquiry form (contact page)
     * `name` must match a key in googleForm.entries below.
     * `width: 'full'` spans both columns on larger screens.
     * --------------------------------------------------------------------- */
    enquiryForm: {
      title: 'Tell us about yourself',
      text: 'It takes about two minutes. Fields marked optional can be skipped.',
      optionalLabel: '(optional)',
      selectPlaceholder: 'Select an option',
      submitLabel: 'Send enquiry',
      submittingLabel: 'Sending…',
      privacyNote: 'We never sell your personal information.',
      messages: {
        required: 'This field is required.',
        selectOne: 'Please select an option.',
        selectAtLeastOne: 'Please select at least one option.',
        consent: 'Please accept to continue.',
        email: 'Enter a valid email address.',
        phone: 'Enter a valid phone number, including country code.',
        tooLong: 'This is too long. Please shorten it.',
      },
      success: {
        title: 'Thank you — your enquiry has been sent',
        text: 'Our team will review your details and get in touch on WhatsApp or email.',
        whatsappLabel: 'Chat on WhatsApp',
        resetLabel: 'Send another enquiry',
      },
      error: {
        title: 'Your enquiry could not be sent',
        text: 'Please try again in a moment, or send your details to us directly on WhatsApp.',
        whatsappLabel: 'Send on WhatsApp',
      },
      fields: [
        {
          name: 'fullName',
          label: 'Full name',
          type: 'text',
          required: true,
          autocomplete: 'name',
          placeholder: 'Your full name',
          maxLength: 100,
          width: 'full',
        },
        {
          name: 'email',
          label: 'Email address',
          type: 'email',
          required: true,
          autocomplete: 'email',
          placeholder: 'you@example.com',
          maxLength: 150,
        },
        {
          name: 'phone',
          label: 'WhatsApp number',
          type: 'tel',
          required: true,
          autocomplete: 'tel',
          inputmode: 'tel',
          placeholder: '+44 7123 456789',
          hint: 'Include your country code.',
          maxLength: 20,
        },
        {
          name: 'currentCountry',
          label: 'Where are you based now?',
          type: 'select',
          required: true,
          options: ['United Kingdom', 'United Arab Emirates', 'India', 'Other'],
        },
        {
          name: 'status',
          label: 'Current status',
          type: 'select',
          required: true,
          options: ['Current student', 'Final-year student', 'Recent graduate', 'Working professional'],
        },
        {
          name: 'targetCountry',
          label: 'Where do you want to work?',
          type: 'radio',
          required: true,
          options: ['UK', 'Dubai', 'Both'],
          width: 'full',
        },
        {
          name: 'university',
          label: 'University / college',
          type: 'text',
          required: false,
          autocomplete: 'organization',
          maxLength: 150,
        },
        {
          name: 'course',
          label: 'Course / field of study',
          type: 'text',
          required: false,
          maxLength: 150,
        },
        {
          name: 'services',
          label: 'What do you need help with?',
          type: 'checkbox',
          required: true,
          optionsFrom: 'services', // Uses the service titles above
          hint: 'Select all that apply.',
          width: 'full',
        },
        {
          name: 'message',
          label: 'Anything else we should know?',
          type: 'textarea',
          required: false,
          placeholder: 'Your goals, preferred roles, timelines…',
          maxLength: 1000,
          width: 'full',
        },
        {
          name: 'consent',
          label: 'I agree to StudentAQ contacting me about my enquiry and accept the',
          type: 'consent',
          required: true,
          link: { label: 'privacy policy', href: 'privacy.html' },
          width: 'full',
        },
      ],
    },

    /* ------------------------------------------------------------------------
     * Google Forms connection — see README.md, "Connect the enquiry form".
     * Until formId and every entry below are filled in, submissions show the
     * error message with a "Send on WhatsApp" fallback.
     * --------------------------------------------------------------------- */
      googleForm: {
      formId: "", // From the form link: docs.google.com/forms/d/e/<formId>/viewform
      entries: {
        fullName: "",
        email: "",
        phone: "",
        currentCountry: "",
        status: "",
        targetCountry: "",
        university: "",
        course: "",
        services: "",
        message: "",
      },
      timeoutMs: 15000,
    },

    footer: {
      about: 'Career support for students and graduates building their future in the UK and Dubai.',
      headings: { explore: 'Explore', services: 'Popular services', contact: 'Get in touch' },
      extraLinks: [{ label: 'Privacy policy', href: 'privacy.html' }],
      serviceIds: ['cv', 'linkedin', 'part-time', 'internships', 'graduate-jobs'],
      rights: 'All rights reserved.',
      disclaimer: 'StudentAQ provides career support services and does not give immigration or legal advice.',
    },
  };
})();
