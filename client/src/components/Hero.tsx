import { Link } from "react-router-dom";

export default function Hero() {
  return (
    <section
      id="top"
      className="relative flex min-h-screen items-center overflow-hidden pt-20"
    >
      {/* Animated grid floor */}
      <div className="pointer-events-none absolute inset-0 grid-floor" />

      {/* Radial silver glow with a faint red core as the accent */}
      <div className="pointer-events-none absolute left-1/2 top-1/3 h-[480px] w-[480px] -translate-x-1/2 rounded-full bg-silver/10 blur-[120px]" />
      <div className="pointer-events-none absolute left-1/2 top-1/3 h-[220px] w-[220px] -translate-x-1/2 rounded-full bg-blood/15 blur-[100px]" />

      {/* Speed streaks */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="streak absolute left-0 top-[28%] h-px w-1/3 bg-gradient-to-r from-transparent via-silver/70 to-transparent" />
        <div
          className="streak absolute left-0 top-[64%] h-px w-1/4 bg-gradient-to-r from-transparent via-silver/50 to-transparent"
          style={{ animationDelay: "1.2s" }}
        />
        {/* the single red streak = the pop */}
        <div
          className="streak absolute left-0 top-[46%] h-px w-1/2 bg-gradient-to-r from-transparent via-blood to-transparent"
          style={{ animationDelay: "2.1s" }}
        />
      </div>

      <div className="relative mx-auto max-w-6xl px-5">
        <p className="rise mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-steel/60 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.25em] text-ash">
          <span className="h-1.5 w-1.5 rounded-full bg-ember pulse-dot" />
          New era · new rules · new web
        </p>

        <h1 className="rise font-display text-3xl font-bold leading-[1.05] sm:text-5xl md:text-7xl">
          <span className="text-chrome">FUEL YOUR </span>
          {/* hover "FIRE" and it ignites (see .fire-wrap in index.css) */}
          <span className="fire-wrap" data-text="FIRE">
            <span className="fire-text text-chrome">FIRE</span>
          </span>
          <span className="text-chrome"> WITH</span>
          <br />
          <span className="relative inline-block">
            <span data-text="REBEL WEB DESIGNS" className="glitch text-chrome">
              REBEL WEB DESIGNS
            </span>
            {/* red underline = the single pop of color */}
            <span className="absolute -bottom-2 left-0 h-1 w-2/5 rounded-full bg-blood shadow-glow" />
          </span>
        </h1>

        <p className="rise mt-4 font-display text-sm font-semibold uppercase tracking-[0.25em] text-silver sm:text-base" style={{ animationDelay: "0.05s" }}>
          Full-Stack Web Developer <span className="text-blood">|</span> UX/UI Specialist <span className="text-blood">|</span> Graphic Designer
        </p>

        <p className="rise mt-5 max-w-xl text-lg text-ash" style={{ animationDelay: "0.1s" }}>
          I build high-performance digital products from logo to launch. Everything is
          mobile-first, fully responsive, and accessible. From websites and web apps to
          logos, flyers, photo retouching, and video, every project is engineered to compete.
        </p>

        <div className="rise mt-9 flex flex-wrap items-center gap-4" style={{ animationDelay: "0.2s" }}>
          <Link
            to="/pricing"
            className="btn-silver sheen group rounded-sm px-7 py-3.5 font-display font-semibold"
          >
            See the packages
          </Link>
          <Link
            to="/work"
            className="btn-silver sheen group rounded-sm px-7 py-3.5 font-display font-semibold"
          >
            View the work
          </Link>
        </div>

        <div className="rise mt-14 flex flex-wrap gap-8 text-sm text-ash" style={{ animationDelay: "0.3s" }}>
          <Stat n="Full-stack" label="React · Node · Python · C/C++" />
          <Stat n="Graphic design" label="Logos · flyers · photo · video" />
          <Stat n="Rebel AI" label="RAG chatbot on-site" />
        </div>
      </div>
    </section>
  );
}

function Stat({ n, label }: { n: string; label: string }) {
  return (
    <div className="border-l border-silver/40 pl-4">
      <div className="font-display text-base font-semibold text-silver">{n}</div>
      <div className="text-xs">{label}</div>
    </div>
  );
}
