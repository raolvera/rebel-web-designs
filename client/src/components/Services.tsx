import { Link } from "react-router-dom";

interface Service {
  icon: string;
  title: string;
  desc: string;
  tags: string[];
}

const SERVICES: Service[] = [
  {
    icon: "</>",
    title: "Full-Stack Web Dev",
    desc: "Fast, responsive sites and web apps built in React, Node, and TypeScript. APIs, databases, the works.",
    tags: ["React", "Node", "Python", "C/C++", "C#"],
  },
  {
    icon: "◳",
    title: "UX / UI Design",
    desc: "Clean, bold interfaces that stand out and stay readable. Wireframes, prototypes, design systems.",
    tags: ["Figma", "Prototyping", "Design systems"],
  },
  {
    icon: "camera", // rendered as an SVG camera (see render)
    title: "Photo Retouching & Repair",
    desc: "Fix and enhance photos in Photoshop. Remove sunburn, tattoos, and blemishes, retouch skin, and clean up any imperfection.",
    tags: ["Photoshop", "Retouch", "Restore"],
  },
  {
    icon: "◆",
    title: "Logo & Brand Design",
    desc: "Distinct logos and brand identities in Illustrator. Color, type, and guidelines delivered in vector and raster.",
    tags: ["Illustrator", "Identity", "Vector"],
  },
  {
    icon: "▶",
    title: "Video, Flyers & Print",
    desc: "Video editing in Premiere Pro and print and layout design in InDesign. Flyers, brochures, posters, reels, and promos.",
    tags: ["Premiere Pro", "InDesign", "Flyers"],
  },
];

export default function Services() {
  return (
    <section id="services" className="relative mx-auto max-w-6xl px-5 py-16">
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {SERVICES.map((s) => (
          <article
            key={s.title}
            className="sheen group flex flex-col rounded-md border border-white/5 bg-coal p-6 transition duration-300 hover:-translate-y-1 hover:border-silver/30 hover:shadow-chromeGlow"
          >
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-sm border border-white/10 bg-steel font-display text-lg text-silver">
              {s.icon === "camera" ? (
                <svg viewBox="0 0 24 24" className="h-6 w-6 fill-silver" aria-hidden="true">
                  <path d="M9 3l-1.2 2H4a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-3.8L15 3H9zm3 5a5 5 0 1 1 0 10 5 5 0 0 1 0-10zm0 2.2A2.8 2.8 0 1 0 12 15.8 2.8 2.8 0 0 0 12 10.2z" />
                </svg>
              ) : (
                s.icon
              )}
            </div>
            <h3 className="font-display text-xl font-semibold text-silver">{s.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-ash">{s.desc}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {s.tags.map((t) => (
                <span
                  key={t}
                  className="rounded-full border border-white/10 bg-ink px-2.5 py-1 text-[11px] font-medium text-ash"
                >
                  {t}
                </span>
              ))}
            </div>
            {/* Coming Soon: sends visitors to the contact form for now */}
            <div className="mt-auto pt-6">
              <Link
                to="/contact"
                aria-label={`${s.title}: coming soon, contact me`}
                className="btn-silver sheen block w-full rounded-sm py-3 text-center font-display font-semibold"
              >
                Coming Soon
              </Link>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export function SectionHeading({ kicker, title }: { kicker: string; title: string }) {
  return (
    <div>
      <p className="mb-3 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-silver">
        <span className="h-px w-8 bg-blood" />
        {kicker}
      </p>
      <h2 className="font-display text-3xl font-bold text-chrome sm:text-5xl">{title}</h2>
    </div>
  );
}
