import { useEffect, useRef, useState } from "react";
import RwdMark from "./RwdMark";

/**
 * Intro splash. Click ANYWHERE on it → the song starts automatically (that one
 * click is what browsers require to allow audio), the logo holds for ~18s while
 * the song plays, then the site is revealed and the music stops. A small
 * "skip / silent" control is available. Shows once per browser session.
 */
const SESSION_KEY = "rwdIntroSeen";
const HOLD_MS = 45000; // hold the intro ~45s

// When VITE_COMING_SOON=true (public build), the intro is LOCKED: it never
// dismisses and the rest of the site is not reachable. Locally it's false, so
// you can skip into the full site and keep building.
const LOCKED = import.meta.env.VITE_COMING_SOON === "true";

export default function Intro() {
  const [show, setShow] = useState(() => {
    try {
      return sessionStorage.getItem(SESSION_KEY) !== "1";
    } catch {
      return true;
    }
  });

  // Set a synchronous global flag so MusicPlayer knows we're in intro mode even
  // if it mounts after us (no event race). Only when the intro is actually shown.
  if (show && typeof window !== "undefined") {
    (window as any).__rebelIntro = true;
  }
  const [leaving, setLeaving] = useState(false);
  const holdTimer = useRef<number | null>(null);

  // Keep the intro text clear of the music player (which is pinned to the
  // bottom and gets taller at MD/LG). We reserve the player's real height at
  // the bottom and, if the content won't fit above it, scale it down to fit.
  const [playerH, setPlayerH] = useState<number>(() => (window as any).__rebelPlayerH || 0);
  const [vh, setVh] = useState(() => window.innerHeight);
  const [contentH, setContentH] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!show) return;
    const onSize = (e: Event) => setPlayerH((e as CustomEvent<number>).detail || 0);
    const onResize = () => setVh(window.innerHeight);
    window.addEventListener("rebel-player-size", onSize as EventListener);
    window.addEventListener("resize", onResize);
    const el = contentRef.current;
    let ro: ResizeObserver | undefined;
    if (el) {
      setContentH(el.offsetHeight);
      ro = new ResizeObserver(() => setContentH(el.offsetHeight));
      ro.observe(el);
    }
    return () => {
      window.removeEventListener("rebel-player-size", onSize as EventListener);
      window.removeEventListener("resize", onResize);
      ro?.disconnect();
    };
  }, [show]);

  const reserved = playerH + 8 + 20; // player + its 8px bottom gap + breathing room
  const roomyTop = vh * 0.08;
  const tightTop = vh * 0.03;
  const fitsAsIs = !contentH || contentH <= vh - roomyTop - reserved;
  const topPad = fitsAsIs ? roomyTop : tightTop;
  // Shrink only as much as needed; below 50% we let it scroll instead.
  const scale = fitsAsIs ? 1 : Math.max(0.5, Math.min(1, (vh - tightTop - reserved) / contentH));

  function finish(withMusicStop: boolean) {
    if (withMusicStop) window.dispatchEvent(new Event("rebel-pause-music"));
    // exit intro mode (flag + event) and turn the intro's video off
    (window as any).__rebelIntro = false;
    window.dispatchEvent(new CustomEvent("rebel-toggle-video", { detail: false }));
    window.dispatchEvent(new CustomEvent("rebel-intro-mode", { detail: false }));
    setLeaving(true);
    window.setTimeout(() => {
      setShow(false);
      try {
        sessionStorage.setItem(SESSION_KEY, "1");
      } catch {
        /* ignore */
      }
    }, 900);
  }

  // Put the player in INTRO MODE (fixed, centered, with its video window).
  // Music does NOT auto-start — the user presses Play. The intro holds 45s.
  useEffect(() => {
    if (!show) return;
    window.dispatchEvent(new CustomEvent("rebel-intro-mode", { detail: true }));
    // When locked (public coming-soon), never auto-dismiss — it IS the page.
    if (!LOCKED) {
      holdTimer.current = window.setTimeout(() => finish(true), HOLD_MS);
    }
    return () => {
      if (holdTimer.current) clearTimeout(holdTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show]);

  if (!show) return null;

  return (
    <div
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-start overflow-y-auto bg-ink transition-opacity duration-700 ${
        leaving ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
      style={{ paddingTop: topPad, paddingBottom: reserved }}
    >
      <div className="pointer-events-none absolute inset-0 grid-floor" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blood/15 blur-[120px]" />

      {/* Outer box takes the SCALED height so nothing below gets pushed down */}
      <div className="relative w-full shrink-0" style={{ height: contentH ? contentH * scale : undefined }}>
      <div
        ref={contentRef}
        className="flex w-full flex-col items-center"
        style={{ transform: `scale(${scale})`, transformOrigin: "top center", transition: "transform 0.2s ease" }}
      >

      <div className="intro-logo relative">
        <RwdMark size={150} />
      </div>

      {/* "Fuel your fire with" ABOVE the wordmark */}
      <p className="intro-tagline mt-6 font-display text-sm font-semibold uppercase tracking-[0.35em] text-ash sm:text-base">
        Fuel your{" "}
        <span className="fire-wrap" data-text="fire">
          <span className="fire-text">fire</span>
        </span>{" "}
        with
      </p>
      <h1
        data-text="REBEL WEB DESIGNS"
        className="glitch glitch-auto intro-word rwd-word relative mt-2 font-display text-3xl font-bold tracking-[0.3em] text-silver sm:text-5xl"
      >
        REBEL WEB DESIGNS
      </h1>

      <span className="intro-tagline mt-6 rounded-full border border-blood/60 bg-blood/10 px-5 py-2 font-display text-sm font-bold uppercase tracking-[0.3em] text-ember shadow-glow">
        Coming Soon
      </span>

      {LOCKED ? (
        <p className="mt-8 max-w-md px-6 text-center text-sm text-ash">
          Something iconic is being built. Full-stack web development, UX/UI, and graphic
          design. Launching soon.
        </p>
      ) : (
        <>
          <p className="mt-6 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.25em] text-silver">
            <span className="h-1.5 w-1.5 rounded-full bg-ember pulse-dot" />
            Press play on the player to start the music
          </p>

          <button
            onClick={() => {
              if (holdTimer.current) clearTimeout(holdTimer.current);
              finish(true);
            }}
            className="mt-6 rounded-sm border border-silver/30 px-6 py-2 font-display text-sm font-semibold text-silver transition hover:border-silver/60"
          >
            Skip intro →
          </button>
        </>
      )}
      </div>
      </div>
    </div>
  );
}
