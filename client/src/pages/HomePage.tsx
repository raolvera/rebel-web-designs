import { Link } from "react-router-dom";
import Hero from "../components/Hero";

export default function HomePage() {
  return (
    <>
      <Hero />

      {/* Quick nav into the other pages */}
      <section className="mx-auto max-w-6xl px-5 py-20">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <TeaserCard
            to="/services"
            title="Services"
            desc="Web dev, UX/UI, photo retouching, logos, and AI apps."
          />
          <TeaserCard
            to="/work"
            title="Work"
            desc="Selected projects and case studies."
          />
          <TeaserCard
            to="/pricing"
            title="Pricing"
            desc="Fixed-price packages you can buy with Stripe."
          />
          <TeaserCard
            to="/contact"
            title="Contact"
            desc="Start a project or request a custom quote."
          />
        </div>
      </section>
    </>
  );
}

function TeaserCard({ to, title, desc }: { to: string; title: string; desc: string }) {
  return (
    <Link
      to={to}
      className="sheen group rounded-md border border-white/5 bg-coal p-6 transition duration-300 hover:-translate-y-1 hover:border-silver/30 hover:shadow-chromeGlow"
    >
      <h3 className="font-display text-xl font-semibold text-silver">{title}</h3>
      <p className="mt-2 text-sm text-ash">{desc}</p>
      <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-silver transition group-hover:gap-2">
        Explore <span aria-hidden>→</span>
      </span>
    </Link>
  );
}
