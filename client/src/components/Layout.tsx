import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Navbar from "./Navbar";
import Footer from "./Footer";
import RebelChat from "./RebelChat";
import MusicPlayer from "./MusicPlayer";
import CircuitWeb from "./CircuitWeb";

const PAGE_TITLES: Record<string, string> = {
  "/": "Home | Rebel Web Designs",
  "/services": "Services | Rebel Web Designs",
  "/work": "Work | Rebel Web Designs",
  "/pricing": "Pricing | Rebel Web Designs",
  "/arcade": "Arcade | Rebel Web Designs",
  "/contact": "Contact | Rebel Web Designs",
};

export default function Layout() {
  const location = useLocation();
  const [banner, setBanner] = useState<null | "success" | "cancel">(null);

  // Scroll to top + set the tab title (using "|") on every route change.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    document.title =
      PAGE_TITLES[location.pathname] || "Rebel Web Designs | Fuel your fire";
  }, [location.pathname]);

  // Stripe checkout return banner (?checkout=success|cancel).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const checkout = params.get("checkout");
    if (checkout === "success" || checkout === "cancel") {
      setBanner(checkout);
      window.history.replaceState({}, "", window.location.pathname);
      const t = setTimeout(() => setBanner(null), 6000);
      return () => clearTimeout(t);
    }
  }, []);

  return (
    <div className="relative min-h-screen">
      {/* No z-index/isolate on this wrapper on purpose: the music player must
          stack ABOVE the intro overlay (which lives outside this Layout). The
          black comes from <body>, and CircuitWeb (-z-10) paints just above it. */}
      <CircuitWeb />
      {banner && (
        <div
          className={`fixed inset-x-0 top-20 z-50 mx-auto w-fit rounded-md border px-5 py-3 text-sm shadow-card ${
            banner === "success"
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
              : "border-blood/40 bg-blood/10 text-ember"
          }`}
        >
          {banner === "success"
            ? "Payment received, thank you! Rebel will be in touch shortly."
            : "Checkout canceled. No charge was made."}
        </div>
      )}

      <Navbar />
      <main>
        <Outlet />
      </main>
      <Footer />
      <RebelChat />
      <MusicPlayer />
    </div>
  );
}
