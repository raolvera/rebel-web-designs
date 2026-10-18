import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { Package } from "../types";
import { getPackages, startCheckout, formatPrice } from "../api";

export default function Pricing() {
  const [packages, setPackages] = useState<Package[]>([]);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getPackages()
      .then(setPackages)
      .catch(() => setError("Could not load packages. Is the server running?"));
  }, []);

  async function buy(id: string) {
    setError(null);
    setLoadingId(id);
    try {
      await startCheckout(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout failed");
    } finally {
      setLoadingId(null);
    }
  }

  const LANES = [
    "Front-End",
    "Branding & Design",
    "UX/UI Design",
    "Platform Builds",
    "Full-Stack & Custom",
  ];
  const LANE_NOTE: Record<string, string> = {
    "Front-End": "Static HTML/CSS sites at a flat $100 per page. Buy now.",
    "Branding & Design": "Logos, flyers, graphic design, and photo editing.",
    "UX/UI Design": "Tailored Figma design systems with your logo integrated.",
    "Platform Builds": "Sites and stores built on Wix, GoDaddy, or Shopify.",
    "Full-Stack & Custom": "Front-end plus back-end builds, tailored to your audience and priced to scope. Request a quote.",
  };

  return (
    <section id="pricing" className="relative mx-auto max-w-6xl px-5 py-16">
      {error && (
        <div className="mb-6 rounded-md border border-blood/40 bg-blood/10 px-4 py-3 text-sm text-ember">
          {error}
        </div>
      )}

      {/* Discounted-rates note + market-research credibility line */}
      <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-blood/50 bg-blood/10 px-5 py-2 text-sm font-semibold text-ember shadow-glow">
        <span className="h-1.5 w-1.5 rounded-full bg-ember pulse-dot" />
        Limited-time discounted rates
      </div>
      <p className="mb-10 max-w-2xl text-xs leading-relaxed text-ash">
        These rates are set below the current market. Based on 2026 industry data,
        freelance web design averages about $75/hr, with a basic small-business site
        averaging around $6,760 to build. Rebel Web Designs offers comparable work at a
        discounted rate. Check the source yourself:{" "}
        <a
          href="https://www.freshbooks.com/hub/estimates/how-much-do-web-designers-charge"
          target="_blank"
          rel="noopener noreferrer"
          className="text-silver underline underline-offset-2 transition hover:text-ember"
        >
          FreshBooks
        </a>{" "}
        (2026).
      </p>

      {LANES.map((lane) => {
        const items = packages.filter((p) => p.lane === lane);
        if (items.length === 0) return null;
        return (
          <div key={lane} className="mb-14">
            <div className="mb-5">
              <h2 className="font-display text-2xl font-bold text-chrome">{lane}</h2>
              <p className="mt-1 text-sm text-ash">{LANE_NOTE[lane]}</p>
            </div>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {items.map((p) => (
                <TiltCard key={p.id}>
                  <PriceCard
                    p={p}
                    loading={loadingId === p.id}
                    onBuy={() => buy(p.id)}
                  />
                </TiltCard>
              ))}
            </div>
          </div>
        );
      })}
    </section>
  );
}

function PriceCard({ p, loading, onBuy }: { p: Package; loading: boolean; onBuy: () => void }) {
  return (
    <div
      className={`relative flex h-full flex-col rounded-md border bg-coal p-6 transition ${
        p.popular ? "border-blood/60 shadow-glow" : "border-white/5"
      }`}
    >
      {p.popular && (
        <span className="absolute -top-3 left-6 rounded-full bg-blood px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-white">
          Most popular
        </span>
      )}
      <span className="text-xs font-semibold uppercase tracking-widest text-silver">{p.tag}</span>
      <h3 className="mt-2 font-display text-xl font-bold text-silver">{p.name}</h3>
      <div className="mt-3 font-display text-3xl font-bold text-chrome">
        {p.priceCents != null ? (
          <>
            {p.fromPrice && <span className="mr-1 text-sm font-medium text-ash">from</span>}
            {formatPrice(p.priceCents)}
          </>
        ) : (
          <span className="text-2xl">Custom quote</span>
        )}
      </div>
      <p className="mt-3 text-sm text-ash">{p.description}</p>

      <ul className="mb-6 mt-4 space-y-2 text-sm text-ash">
        {p.features.map((f) => (
          <li key={f} className="flex items-start gap-2">
            <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-silver" />
            {f}
          </li>
        ))}
      </ul>

      {p.buyable ? (
        <button
          onClick={onBuy}
          disabled={loading}
          className="btn-silver sheen mt-auto w-full rounded-sm py-3 font-display font-semibold disabled:opacity-60"
        >
          {loading ? "Redirecting…" : "Buy with Stripe"}
        </button>
      ) : (
        <Link
          to="/contact"
          className="btn-silver sheen mt-auto block w-full rounded-sm py-3 text-center font-display font-semibold"
        >
          Request a quote
        </Link>
      )}
    </div>
  );
}

/** Pointer-tracking tilt + glow for that premium, head-turning feel. */
function TiltCard({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  function onMove(e: React.MouseEvent) {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    const rx = (py - 0.5) * -8;
    const ry = (px - 0.5) * 8;
    el.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) translateZ(0)`;
    el.style.setProperty("--mx", `${px * 100}%`);
    el.style.setProperty("--my", `${py * 100}%`);
  }

  function reset() {
    const el = ref.current;
    if (el) el.style.transform = "perspective(900px) rotateX(0) rotateY(0)";
  }

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={reset}
      className="relative h-full transition-transform duration-200 ease-out [transform-style:preserve-3d]"
      style={{
        backgroundImage:
          "radial-gradient(400px circle at var(--mx,50%) var(--my,50%), rgba(201,204,209,0.14), transparent 60%)",
        borderRadius: "0.375rem",
      }}
    >
      {children}
    </div>
  );
}
