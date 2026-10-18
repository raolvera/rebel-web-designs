import RwdMark from "./RwdMark";

interface Project {
  title: string;
  type: string;
  blurb: string;
  tags: string[];
  live?: string; // live site URL
  caseStudy?: string; // portfolio case study URL
  accent: string; // tailwind gradient classes
}

const PROJECTS: Project[] = [
  {
    title: "Luminary",
    type: "Restaurant Site + CMS · Team Project",
    blurb:
      "A modern, celestial-themed fine-dining site with enterprise-grade features: WCAG 2.1 AA accessibility, a multi-step reservation system, an interactive menu carousel, Decap CMS content editing, and Playwright E2E tests.",
    tags: ["HTML5", "CSS3", "Vanilla JS", "Decap CMS", "Netlify"],
    live: "https://luminaryrestaurant.com/",
    accent: "from-silver/10 to-ink",
  },
  {
    title: "ASU Gameday Hub",
    type: "Production Website · Capstone",
    blurb:
      "A fast, six-page gameday hub for ASU Sun Devils football: clear-bag rules, stadium policies, parking, light rail, traditions, schedule, and an FAQ with structured data. Semantic HTML and modern CSS, no framework. Lighthouse 99 / 100 / 100 / 100.",
    tags: ["Semantic HTML", "Modern CSS", "A11y", "SEO"],
    live: "https://raolvera.github.io/Olvera-Rey-ProductionWebsiteCapstone/",
    accent: "from-steel to-ink",
  },
  {
    title: "Street Tacos",
    type: "Food Vendor · Ordering System",
    blurb:
      "A dynamic ordering system built to streamline operations for local food vendors and enhance the customer experience, with menu search and an animated, interactive UI.",
    tags: ["HTML", "CSS", "JavaScript", "Search"],
    live: "https://raolvera.github.io/StreetTacos/",
    accent: "from-steel to-ink",
  },
  {
    title: "Matching Game",
    type: "Interactive · Logic Game",
    blurb:
      "A high-performance, logic-based web game that challenges players' cognitive memory through a fast-paced and responsive user interface.",
    tags: ["HTML", "CSS", "JavaScript"],
    live: "https://raolvera.github.io/MatchingGame/",
    accent: "from-steel to-ink",
  },
];

export default function Work() {
  return (
    <section id="work" className="relative mx-auto max-w-6xl px-5 py-16">
      <div className="grid gap-5 sm:grid-cols-2">
        {PROJECTS.map((p) => (
          <article
            key={p.title}
            className={`sheen group relative flex flex-col overflow-hidden rounded-md border border-white/5 bg-gradient-to-br ${p.accent} p-7 transition duration-300 hover:-translate-y-1 hover:border-silver/30 hover:shadow-card`}
          >
            <div className="absolute right-4 top-4 opacity-50 transition group-hover:opacity-100">
              <RwdMark size={44} />
            </div>
            <p className="text-xs font-semibold uppercase tracking-widest text-silver">
              {p.type}
            </p>
            <h3 className="mt-2 font-display text-2xl font-bold text-silver">{p.title}</h3>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-ash">{p.blurb}</p>

            <div className="mt-4 flex flex-wrap gap-2">
              {p.tags.map((t) => (
                <span
                  key={t}
                  className="rounded-full border border-white/10 bg-ink/60 px-2.5 py-1 text-[11px] font-medium text-ash"
                >
                  {t}
                </span>
              ))}
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-4">
              {p.live && (
                <a
                  href={p.live}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm font-semibold text-silver transition hover:text-white hover:gap-2"
                >
                  Live site <span aria-hidden>→</span>
                </a>
              )}
              {p.caseStudy && (
                <a
                  href={p.caseStudy}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm font-semibold text-silver transition hover:text-white hover:gap-2"
                >
                  Case study <span aria-hidden>→</span>
                </a>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
