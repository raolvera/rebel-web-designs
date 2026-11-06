import { useEffect, useRef, useState } from "react";
import RwdMark from "./RwdMark";
import CircuitWeb from "./CircuitWeb";

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

/** A phone held sideways: wider than tall, and short. Shared with MusicPlayer. */
export function isSideways(w: number, h: number) {
  return w > h && h < 520;
}

// Spider-web separator for the ticker ribbons (ties into the CircuitWeb motif).
function WebIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="mx-3 h-4 w-4 shrink-0 text-white sm:mx-4" fill="none" stroke="currentColor" strokeWidth="0.6" strokeLinejoin="round" strokeLinecap="round">
      <path d="M12 12L12 3M12 12L18.36 5.64M12 12L21 12M12 12L18.36 18.36M12 12L12 21M12 12L5.64 18.36M12 12L3 12M12 12L5.64 5.64M12 7L15.54 8.46L17 12L15.54 15.54L12 17L8.46 15.54L7 12L8.46 8.46ZM12 3L18.36 5.64L21 12L18.36 18.36L12 21L5.64 18.36L3 12L5.64 5.64Z" />
    </svg>
  );
}

// Skull separator (white) — alternates with the web in the ribbon.
function SkullIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="mx-3 h-4 w-4 shrink-0 text-white sm:mx-4" fill="currentColor">
      <path d="M4 11C4 6.6 7.6 3.4 12 3.4S20 6.6 20 11v5c0 1.4-1 2.4-2.4 2.7l-1.1.3c-.5.1-.8.5-.8 1v1.2a1 1 0 0 1-1 1H9.3a1 1 0 0 1-1-1V20c0-.5-.3-.9-.8-1l-1.1-.3C5 18.4 4 17.4 4 16Z" />
      <circle cx="8.6" cy="11" r="1.8" fill="#0a0a0b" />
      <circle cx="15.4" cy="11" r="1.8" fill="#0a0a0b" />
      <path d="M12 13.6l1.2 1.5a.6.6 0 0 1-.5 1h-1.4a.6.6 0 0 1-.5-1Z" fill="#0a0a0b" />
    </svg>
  );
}

// NASDAQ-style scrolling ribbon. `pos` pins it top or bottom; `rev` reverses
// the scroll direction. Lives only in the locked intro so nothing leaks.
function TickerBar({ pos, rev }: { pos: "top" | "bottom"; rev?: boolean }) {
  const border = pos === "top" ? "border-b" : "border-t";
  const pin = pos === "top" ? "top-0" : "bottom-0";
  const track = rev ? "rwd-ticker-track-rev" : "rwd-ticker-track";
  return (
    <div className={`fixed ${pin} inset-x-0 z-[120] flex h-10 items-center overflow-hidden ${border} border-white/10 bg-coal/90 font-display text-xs font-semibold uppercase tracking-[0.2em] text-silver backdrop-blur-sm sm:text-sm`}>
      <div className={track}>
        {Array.from({ length: 2 }).map((_, half) => (
          <span key={half} className="flex shrink-0">
            {Array.from({ length: 6 }).map((_, i) => (
              <span key={i} className="flex shrink-0 items-center">
                <span>Fuel your fire with Rebel Web Designs</span>
                <SkullIcon />
                <span>RWD</span>
                <WebIcon />
              </span>
            ))}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function Intro() {
  const [show, setShow] = useState(() => {
    if (LOCKED) return true; // locked: the Coming Soon page always shows
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
  const [playerW, setPlayerW] = useState<number>(() => (window as any).__rebelPlayerW || 288);
  const [vh, setVh] = useState(() => window.innerHeight);
  const [vw, setVw] = useState(() => window.innerWidth);
  const [contentH, setContentH] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!show) return;
    const onSize = (e: Event) => {
      const d = (e as CustomEvent<{ w: number; h: number }>).detail;
      setPlayerH(d?.h || 0);
      setPlayerW(d?.w || 288);
    };
    const onResize = () => {
      setVh(window.innerHeight);
      setVw(window.innerWidth);
    };
    window.addEventListener("rebel-player-size", onSize as EventListener);
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
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
      window.removeEventListener("orientationchange", onResize);
      ro?.disconnect();
    };
  }, [show]);

  // Phone held sideways: wide but short. The player moves to the bottom-right
  // corner (see MusicPlayer), so the content sits beside it instead of under it.
  // The NASDAQ-style ticker ribbons pinned to the very top and bottom of the intro.
  const TICKER_H = 40;
  const sideways = isSideways(vw, vh);
  // Video window open at md/lg: the content gets scaled down to fit above the
  // player, so bump the small text up (and trim the logo) to keep it readable.
  // Based on the player's height, not the content's, so it can't flip-flop.
  const bigPlayer = playerH > 340;
  const reserved = sideways ? 12 + TICKER_H : playerH + 8 + 20 + TICKER_H; // bottom ticker + player
  const padRight = sideways ? playerW + 20 : 0; // space kept clear for the player
  const roomyTop = vh * (sideways ? 0.04 : 0.08);
  const tightTop = vh * 0.03;
  const fitsAsIs = !contentH || contentH <= vh - roomyTop - reserved - TICKER_H;
  const topPad = fitsAsIs ? roomyTop : tightTop;
  // Shrink only as much as needed; below 50% we let it scroll instead.
  const scale = fitsAsIs ? 1 : Math.max(0.5, Math.min(1, (vh - tightTop - reserved - TICKER_H) / contentH));

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
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-start overflow-y-auto overflow-x-hidden bg-ink transition-opacity duration-700 ${
        leaving ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
      style={{ paddingTop: topPad + TICKER_H, paddingBottom: reserved, paddingRight: padRight }}
    >
      {/* NASDAQ-style scrolling ribbons: tagline + RWD looping forever. Top
          scrolls one way, bottom the opposite; both live only in the locked
          intro so nothing from the full site leaks. */}
      <TickerBar pos="top" />
      <TickerBar pos="bottom" rev />
      {/* circuit traces + circuit spiderwebs with red beams (behind everything) */}
      <CircuitWeb allCorners />
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
        <RwdMark size={bigPlayer ? 115 : 150} />
      </div>

      {/* "Fuel your fire with" ABOVE the wordmark */}
      <p className={`intro-tagline mt-6 font-display font-semibold uppercase tracking-[0.35em] text-ash ${bigPlayer ? "text-base sm:text-xl" : "text-sm sm:text-base"}`}>
        Fuel your{" "}
        <span className="fire-wrap" data-text="fire">
          <span className="fire-text">fire</span>
        </span>{" "}
        with
      </p>
      <h1
        data-text="REBEL WEB DESIGNS"
        className={`glitch glitch-auto intro-word rwd-word relative mt-2 max-w-full whitespace-nowrap px-2 text-center font-display font-bold text-silver ${
          sideways
            ? "text-2xl tracking-[0.12em]" /* phone-size wordmark when sideways */
            : "text-[1.45rem] tracking-[0.12em] min-[400px]:text-2xl sm:text-5xl sm:tracking-[0.3em]"
        }`}
      >
        REBEL WEB DESIGNS
      </h1>

      <span className={`intro-tagline mt-6 rounded-full border border-blood/60 bg-blood/10 px-5 py-2 font-display font-bold uppercase tracking-[0.3em] text-ember shadow-glow ${bigPlayer ? "text-base sm:text-lg" : "text-sm"}`}>
        Coming Soon
      </span>

      {LOCKED ? (
        <p className={`mt-8 px-6 text-center text-ash ${bigPlayer ? "max-w-lg text-base sm:text-lg" : "max-w-md text-sm"}`}>
          Something iconic is being built. Full-stack web development, UX/UI, and graphic
          design services launching soon!
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
