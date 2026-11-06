import { useEffect, useId, useState } from "react";

/**
 * Decorative site background: spiderwebs wired like circuitry + chrome circuit
 * traces, with crimson data beams running through BOTH. Purely visual
 * (aria-hidden, no pointer events) and sits BEHIND page content.
 * Used on the main site (Layout) and on the Coming Soon intro.
 */

type Pt = [number, number];

/** Build a corner spiderweb: spokes fanning out + sagging silk rings. */
function webPaths(size: number, spokes: number, rings: number) {
  const angles: number[] = [];
  for (let i = 0; i < spokes; i++) {
    // fan across the quarter circle (0..90deg), slightly irregular like real silk
    const jitter = i === 0 || i === spokes - 1 ? 0 : (i % 2 ? 2.5 : -2);
    angles.push(((90 / (spokes - 1)) * i + jitter) * (Math.PI / 180));
  }
  const at = (a: number, r: number): Pt => [Math.cos(a) * r, Math.sin(a) * r];

  // Each spoke is its own path so a beam can run along it from the hub outward.
  const spokeDs = angles.map((a) => {
    const [x, y] = at(a, size);
    return `M0 0 L${x.toFixed(1)} ${y.toFixed(1)}`;
  });

  const ringDs: string[] = [];
  for (let k = 1; k <= rings; k++) {
    const r = (size / (rings + 0.6)) * k;
    let d = "";
    for (let i = 0; i < angles.length - 1; i++) {
      const [x1, y1] = at(angles[i], r);
      const [x2, y2] = at(angles[i + 1], r);
      // control point pulled toward the center = silk sagging between spokes
      const mid = (angles[i] + angles[i + 1]) / 2;
      const [cx, cy] = at(mid, r * 0.86);
      d += `${i === 0 ? `M${x1.toFixed(1)} ${y1.toFixed(1)}` : ""} Q${cx.toFixed(1)} ${cy.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)} `;
    }
    ringDs.push(d);
  }
  const tips = angles.map((a) => at(a, size));
  return { spokeDs, ringDs, tips, angles };
}

// Spokes whose tips get a node that fills red when the beam arrives (some, not
// all): 1 = an upper tip, 7 = the tip on the screen edge where the two webs on
// that side meet.
const LIT_TIPS = [1, 7];

function CornerWeb({ className, flip, glowId, fit, lit }: { className: string; flip: string; glowId: string; fit?: boolean; lit?: boolean }) {
  const S = 400;
  const { spokeDs, ringDs, tips } = webPaths(S, 8, 7);
  // Beams on every spoke, and on alternating rings so it isn't too busy.
  const beamRings = ringDs.filter((_, i) => i % 2 === 1);
  return (
    <svg
      viewBox={`0 0 ${S} ${S}`}
      className={className}
      // fit: exactly half the screen's width or height (whichever is smaller),
      // so the web's edge spokes in neighbouring corners meet in the middle.
      style={{ transform: flip, ...(fit ? { width: "min(50vw, 50vh)" } : null), ...(lit ? { overflow: "visible" } : null) }}
    >
      {/* silver silk (same chrome as the circuit traces) */}
      <g fill="none" stroke="#c9ccd1" strokeLinecap="round">
        {spokeDs.map((d, i) => (
          <path key={`s${i}`} d={d} strokeWidth="1.1" opacity="0.5" />
        ))}
        {ringDs.map((d, i) => (
          <path key={`r${i}`} d={d} strokeWidth="0.8" opacity={0.45 - i * 0.03} />
        ))}
      </g>

      {/* hub pad, like a chip the web is wired to */}
      <circle cx="0" cy="0" r="7" fill="#0a0a0b" stroke="#c9ccd1" strokeWidth="1.2" opacity="0.5" />

      {/* crimson beams running through the web */}
      <g className="cw-beams" fill="none" stroke="#e11d2a" strokeWidth="2" strokeLinecap="round" filter={`url(#${glowId})`}>
        {spokeDs.map((d, i) => (
          <path
            key={`bs${i}`}
            d={d}
            pathLength={100}
            className="cw-pulse"
            style={{ animationDelay: `${(i * 0.9) % 6}s`, animationDuration: `${5 + (i % 3)}s` }}
          />
        ))}
        {beamRings.map((d, i) => (
          <path
            key={`br${i}`}
            d={d}
            pathLength={100}
            className="cw-pulse"
            style={{ animationDelay: `${1.5 + i * 1.7}s`, animationDuration: `${7 + i}s` }}
          />
        ))}
      </g>

      {/* tip nodes: dark chrome pads that fill red the moment the beam reaches
          them (same delay + duration as that spoke's beam, so they stay in sync) */}
      {lit &&
        LIT_TIPS.map((i) => (
          <circle
            key={`n${i}`}
            cx={tips[i][0]}
            cy={tips[i][1]}
            r="5.5"
            className="cw-node"
            style={{ animationDelay: `${(i * 0.9) % 6}s`, animationDuration: `${5 + (i % 3)}s` }}
          />
        ))}
    </svg>
  );
}

// Circuit traces in a 1440x900 space: right angles + 45deg bends, like a PCB.
const TRACES: string[] = [
  "M0 140 H260 L300 180 H520 L560 140 H700",
  "M1440 220 H1180 L1140 260 H960 L920 300 V380",
  "M0 620 H180 L220 580 H420 L460 620 H600 L640 660 V760",
  "M1440 700 H1260 L1220 740 H1040 L1000 700 H880",
  "M720 0 V90 L760 130 H880",
  "M560 900 V820 L600 780 H760 L800 740 V680",
  "M1100 900 V840 L1140 800 H1300",
  "M120 900 V800 L160 760 H300",
];

// Endpoints / vias (little solder pads).
const PADS: Pt[] = [
  [700, 140], [920, 380], [640, 760], [880, 700], [880, 130],
  [800, 680], [1300, 800], [300, 760], [260, 140], [1180, 220],
];

// Locked intro: the original PCB look (right angles + 45deg notches, long runs
// in from the screen edge, a solder pad at every end), but built EVEN: one
// top-left quarter of the 1440x900 space, mirrored/flipped through the center
// into all four corners so left = right and top = bottom. Rows are staggered so
// it reads as a dense bus rather than a grid. The last row sits on the center
// line, where its flipped copy turns it into a "<>" shape.
const QUAD: Pt[][] = [];
for (let k = 0; k < 5; k++) {
  const y = 60 + 70 * k;
  const a = 100 + 40 * (k % 3); // where the notch starts (staggered per row)
  const b = a + 120;
  const e = b + 25 + 60; // row end (a solder pad goes here)
  QUAD.push([[0, y], [a, y], [a + 22, y + 22], [b, y + 22], [b + 22, y], [e, y]]);
}
QUAD.push([[0, 450], [150, 450], [172, 428], [300, 428], [322, 450], [390, 450]]);

// Mirror/flip about the center (720,450) of the 1440x900 space.
const QUAD_MIRRORS = [
  undefined, // top-left
  "translate(1440 0) scale(-1 1)", // top-right
  "translate(0 900) scale(1 -1)", // bottom-left
  "translate(1440 900) scale(-1 -1)", // bottom-right
];

// Cut a polyline off at x = xmax (keeps the part nearest the screen edge).
function clipX(pts: Pt[], xmax: number): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    if (p[0] <= xmax) {
      out.push(p);
      continue;
    }
    if (i > 0 && pts[i - 1][0] <= xmax) {
      const q = pts[i - 1];
      const t = (xmax - q[0]) / (p[0] - q[0]);
      out.push([xmax, q[1] + t * (p[1] - q[1])]);
    }
    break;
  }
  return out;
}
const toPath = (pts: Pt[]) => pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");

export default function CircuitWeb({ allCorners }: { allCorners?: boolean }) {
  // Original web size on the main site. On the intro (allCorners) the webs are
  // sized to the screen instead, so neighbours meet exactly in the middle.
  const webSize = allCorners ? "" : "w-56 sm:w-80 lg:w-[26rem]";
  // Screen size, so the intro circuits can be trimmed to stay clear of the player.
  const [vp, setVp] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }));
  useEffect(() => {
    if (!allCorners) return;
    const on = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", on);
    window.addEventListener("orientationchange", on);
    return () => {
      window.removeEventListener("resize", on);
      window.removeEventListener("orientationchange", on);
    };
  }, [allCorners]);
  // The 1440x900 circuit space is scaled to FILL the screen ("slice"), so one
  // viewBox unit = s screen px. Cut every trace off before it gets within
  // (widest player half-width + breathing room) of the screen center, so the
  // circuits never touch the music player, even large. Same cut on all four
  // corners, so it stays even.
  const s = Math.max(vp.w / 1440, vp.h / 900);
  const xLimit = 720 - (230 + 36) / s;
  const quad = QUAD.map((p) => clipX(p, xLimit)).filter((p) => p.length >= 2);
  const sets: { t?: string; traces: string[]; pads: Pt[] }[] = allCorners
    ? QUAD_MIRRORS.map((t) => ({
        t,
        traces: quad.map(toPath),
        pads: quad.map((p) => p[p.length - 1]),
      }))
    : [{ traces: TRACES, pads: PADS }];
  // Unique per instance, since this can be on screen twice (site + intro).
  const glowId = `cwGlow-${useId().replace(/:/g, "")}`;

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <svg width="0" height="0" className="absolute">
        <defs>
          <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.5" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
      </svg>

      {/* Circuit layer */}
      <svg
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 h-full w-full"
      >
        {sets.map((set, si) => (
          <g key={si} transform={set.t}>
            {/* static chrome traces */}
            <g fill="none" stroke="#c9ccd1" strokeWidth="1.2" strokeLinejoin="round" opacity="0.13">
              {set.traces.map((d, i) => (
                <path key={i} d={d} />
              ))}
            </g>

            {/* solder pads (one at every trace end) */}
            <g fill="#0a0a0b" stroke="#c9ccd1" strokeWidth="1.2" opacity="0.28">
              {set.pads.map(([x, y], i) => (
                <circle key={i} cx={x} cy={y} r="4" />
              ))}
            </g>

            {/* crimson data pulses travelling along the traces */}
            <g className="cw-beams" fill="none" stroke="#e11d2a" strokeWidth="2" strokeLinecap="round" filter={`url(#${glowId})`}>
              {set.traces.map((d, i) => (
                <path
                  key={i}
                  d={d}
                  pathLength={100}
                  className="cw-pulse"
                  style={{ animationDelay: `${(i * 1.3 + si * 1.7) % 7}s`, animationDuration: `${6 + (i % 3) * 1.5}s` }}
                />
              ))}
            </g>
          </g>
        ))}
      </svg>

      {/* Circuit spiderwebs in opposite corners (all four on the locked intro) */}
      <CornerWeb glowId={glowId} fit={allCorners} lit={allCorners} className={`absolute left-0 top-0 ${webSize} ${allCorners ? "opacity-50" : "opacity-60"}`} flip="none" />
      <CornerWeb glowId={glowId} fit={allCorners} lit={allCorners} className={`absolute bottom-0 right-0 ${webSize} opacity-50`} flip="rotate(180deg)" />
      {allCorners && (
        <>
          <CornerWeb glowId={glowId} fit lit className={`absolute right-0 top-0 ${webSize} opacity-50`} flip="scaleX(-1)" />
          <CornerWeb glowId={glowId} fit lit className={`absolute bottom-0 left-0 ${webSize} opacity-50`} flip="scaleY(-1)" />
        </>
      )}

      {/* soft vignette so everything fades into the black */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,#0a0a0b_100%)]" />
    </div>
  );
}
