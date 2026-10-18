// Service catalog. priceCents is the server-authoritative source of truth
// (the client cannot change the amount). `lane` groups cards on the pricing
// page. `buyable` = purchasable now via Stripe; otherwise it's a quote request.
// `fromPrice` shows "from $X" for scoped builds.

export const packages = [
  // ---- FRONT-END: static HTML/CSS, flat $100/page ----
  {
    id: "page1", lane: "Front-End", name: "1-Page Site",
    description: "A clean, responsive single-page HTML/CSS website.",
    priceCents: 10000, tag: "Static", buyable: true,
    features: ["1 responsive page", "Mobile-friendly", "Contact info / links", "Basic SEO"],
  },
  {
    id: "page2", lane: "Front-End", name: "2-Page Site",
    description: "Two-page HTML/CSS site, like Home plus About or Contact.",
    priceCents: 20000, tag: "Static", buyable: true,
    features: ["2 responsive pages", "Mobile-friendly", "Contact section", "Basic SEO"],
  },
  {
    id: "page3", lane: "Front-End", name: "3-Page Site",
    description: "Three-page HTML/CSS site for a small business presence.",
    priceCents: 30000, tag: "Static", popular: true, buyable: true,
    features: ["3 responsive pages", "Mobile-friendly", "Contact form-ready", "Basic SEO + polish"],
  },
  {
    id: "page4", lane: "Front-End", name: "4-Page Site",
    description: "Four-page HTML/CSS site for a growing small business.",
    priceCents: 40000, tag: "Static", buyable: true,
    features: ["4 responsive pages", "Mobile-friendly", "Contact section", "Basic SEO + polish"],
  },
  {
    id: "page5", lane: "Front-End", name: "5-Page Site",
    description: "Five-page HTML/CSS site, a full starter web presence.",
    priceCents: 50000, tag: "Static", buyable: true,
    features: ["5 responsive pages", "Mobile-friendly", "Contact section", "Basic SEO + polish"],
  },

  // ---- BRANDING & DESIGN ----
  {
    id: "flyer", lane: "Branding & Design", name: "Flyer / Graphic",
    description: "A custom flyer, poster, or graphic, print or social ready.",
    priceCents: 7500, tag: "Design", buyable: true,
    features: ["1 custom design", "Print + web formats", "2 revision rounds", "Made in Illustrator/Photoshop"],
  },
  {
    id: "photo", lane: "Branding & Design", name: "Photo Editing",
    description: "Pro retouching and repair for 10 images. Sunburn, tattoo, and blemish removal.",
    priceCents: 12000, tag: "Design", buyable: true,
    features: ["10 images", "Retouch + color", "Blemish / tattoo removal", "2 revision rounds"],
  },
  {
    id: "logo", lane: "Branding & Design", name: "Logo Design",
    description: "Custom logo in Illustrator with concepts, revisions, and vector plus raster files.",
    priceCents: 30000, tag: "Branding", buyable: true,
    features: ["2 concepts", "Up to 3 revisions", "SVG + PNG delivery", "Usage guide"],
  },
  {
    id: "logo-starter", lane: "Branding & Design", name: "Starter Logo + 1-Page",
    description: "A simple logo plus a 1-page site. The budget-friendly way to get online.",
    priceCents: 20000, tag: "Budget", buyable: true,
    features: ["Simple custom logo", "1-page responsive site", "Mobile-friendly", "Great starter option"],
  },
  {
    id: "logo-site", lane: "Branding & Design", name: "Logo + Website",
    description: "A custom logo plus a 3-page responsive site. Your starter brand package.",
    priceCents: 60000, tag: "Bundle", popular: true, buyable: true,
    features: ["Custom logo (SVG + PNG)", "3-page responsive site", "Matching brand colors", "Bundle rate"],
  },

  // ---- UX/UI DESIGN ----
  {
    id: "uxui", lane: "UX/UI Design", name: "Figma Design System",
    description: "Tailored UX/UI in Figma. Wireframes, prototype, and a design system with your logo integrated, ready to build from.",
    priceCents: 60000, fromPrice: true, tag: "UX/UI", buyable: false,
    features: ["Figma wireframes + prototype", "Reusable design system", "Logo + brand integration", "Tailored to your audience"],
  },

  // ---- PLATFORM BUILDS (Wix / GoDaddy / Shopify) ----
  {
    id: "wix", lane: "Platform Builds", name: "Wix / GoDaddy Site",
    description: "A polished site built and set up on Wix or GoDaddy, easy for you to manage.",
    priceCents: 45000, fromPrice: true, tag: "Platform", buyable: false,
    features: ["Built on Wix or GoDaddy", "Responsive + branded", "You can edit it after", "Launch assistance"],
  },
  {
    id: "shopify", lane: "Platform Builds", name: "Shopify Store",
    description: "A branded Shopify store with products, cart, and checkout, ready to sell.",
    priceCents: 90000, fromPrice: true, tag: "Platform", buyable: false,
    features: ["Shopify setup + theme", "Product catalog + cart", "Payments ready", "Tailored to your brand"],
  },

  // ---- FULL-STACK / CUSTOM (front-end + back-end) ----
  {
    id: "webapp", lane: "Full-Stack & Custom", name: "Starter Web App",
    description: "Interactive JavaScript/React build with a form or small database.",
    priceCents: 80000, fromPrice: true, tag: "Full-Stack", buyable: false,
    features: ["React / JS front-end", "Node back-end", "Form or small database", "Deploy assistance"],
  },
  {
    id: "cms", lane: "Full-Stack & Custom", name: "Business CMS Site",
    description: "Multi-page site with a CMS so you can edit content without code.",
    priceCents: 150000, fromPrice: true, tag: "Full-Stack", buyable: false,
    features: ["CMS content editing", "Multi-page + UX/UI", "Responsive + accessible", "Analytics setup"],
  },
  {
    id: "custom", lane: "Full-Stack & Custom", name: "Custom / Tailored",
    description: "A fully custom website tailored to your specific audience. Special features, integrations, AI, and e-commerce. Quoted to scope.",
    tag: "Custom", buyable: false,
    features: ["Fully bespoke build", "Integrations / AI / e-commerce", "Scaled to your needs", "Tailored to your audience"],
  },
];
