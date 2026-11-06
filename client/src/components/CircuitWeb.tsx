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

// Spoke tips that get a node that fills red when the web's beam arrives: every
// tip a circuit comes out of (7 = the tip on the side edge where the two webs
// on that side meet).
const LIT_TIPS = [1, 2, 3, 4, 5, 6, 7];

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

// ---------------- Locked intro circuits ----------------
// Every circuit comes out of a web tip and heads for the screen center (one
// 45deg turn, then straight in), ending in a solder pad that flashes red when
// its beam arrives.
// Drawn for the top-left web and mirrored/flipped into the other three corners,
// so left = right and top = bottom.
//
// ADJUST HERE:
//   tip   = which spoke of the web it comes out of. 1 is the tip nearest the
//           top edge; 7 is the tip on the side edge where the two webs on that
//           side meet (that one is the CENTER circuit, on the center line).
//   reach = how far toward the screen center it runs: 1 = all the way (stops
//           CENTER_GAP px short of the middle), 0.5 = half way, 0.25 = a quarter.
//           Delete a line to remove that circuit.
const TIP_CIRCUITS: { tip: number; reach: number }[] = [
  { tip: 1, reach: 1 },
  { tip: 2, reach: 1 },
  { tip: 3, reach: 1 },
  { tip: 4, reach: 1 },
  { tip: 5, reach: 1 },
  { tip: 6, reach: 1 },
  { tip: 7, reach: 1 }, // center circuit
];
const CENTER_GAP = 30; // px kept clear at the middle of the screen
const LANE = 14; // px between neighbouring circuits where they arrive at the center

// Length of a polyline, and the same polyline cut to a fraction of its length.
function polyLen(pts: Pt[]) {
  let n = 0;
  for (let i = 1; i < pts.length; i++) n += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return n;
}
function cutAt(pts: Pt[], frac: number): Pt[] {
  if (frac >= 1) return pts;
  let left = Math.max(0, frac) * polyLen(pts);
  const out: Pt[] = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1];
    const [bx, by] = pts[i];
    const seg = Math.hypot(bx - ax, by - ay);
    if (seg >= left) {
      const t = seg ? left / seg : 0;
      out.push([ax + (bx - ax) * t, ay + (by - ay) * t]);
      return out;
    }
    out.push(pts[i]);
    left -= seg;
  }
  return out;
}

// Spoke tip positions for a web of size 1 (multiply by the web's size in px).
const UNIT_TIPS = webPaths(1, 8, 7).tips;

// Screen size (the intro circuits are drawn in real screen px).
function useViewport(on: boolean) {
  const [vp, setVp] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }));
  useEffect(() => {
    if (!on) return;
    const update = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, [on]);
  return vp;
}

const toPath = (pts: Pt[]) => pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");

export default function CircuitWeb({ allCorners }: { allCorners?: boolean }) {
  // Original web size on the main site. On the intro (allCorners) the webs are
  // sized to the screen instead, so neighbours meet exactly in the middle.
  const webSize = allCorners ? "" : "w-56 sm:w-80 lg:w-[26rem]";
  // Intro: circuits out of the web tips, in real screen px.
  const { w, h } = useViewport(!!allCorners);
  const webPx = Math.min(w / 2, h / 2); // the corner webs are this size (CornerWeb "fit")
  // On a wide screen the top and bottom webs share tip 7 on the center line, so
  // the bottom copies skip it (otherwise the center circuit is drawn twice).
  const sharedCenter = Math.abs(webPx - h / 2) < 1;
  // Each circuit heads for the screen center: out of its tip on a 45deg
  // diagonal, then straight in. They arrive stacked in lanes LANE px apart
  // (tip 7 on the center line), so none of them overlap or cross.
  const tipRuns = (bottom: boolean): Pt[][] =>
    TIP_CIRCUITS.filter((c) => UNIT_TIPS[c.tip] && !(bottom && sharedCenter && c.tip === 7))
      .map((c): Pt[] => {
        const px = UNIT_TIPS[c.tip][0] * webPx;
        const py = UNIT_TIPS[c.tip][1] * webPx;
        const ex = w / 2 - CENTER_GAP;
        const ey = h / 2 - (7 - c.tip) * LANE - (sharedCenter ? 0 : LANE / 2);
        const dx = ex - px;
        const dy = ey - py;
        const d = Math.min(Math.abs(dx), Math.abs(dy));
        const turn: Pt = [px + Math.sign(dx) * d, py + Math.sign(dy) * d];
        return cutAt([[px, py], turn, [ex, ey]], c.reach);
      })
      .filter((p) => polyLen(p) >= 12); // too short to draw
  const mirrors: (string | undefined)[] = [
    undefined, // top-left
    `translate(${w} 0) scale(-1 1)`, // top-right
    `translate(0 ${h}) scale(1 -1)`, // bottom-left
    `translate(${w} ${h}) scale(-1 -1)`, // bottom-right
  ];
  const sets: { t?: string; traces: string[]; pads: Pt[] }[] = allCorners
    ? mirrors.map((t, mi) => {
        const runs = tipRuns(mi >= 2); // mirrors 2 and 3 are the bottom corners
        return { t, traces: runs.map(toPath), pads: runs.map((p) => p[p.length - 1]) };
      })
    : [{ traces: TRACES, pads: PADS }];
  // Beam timing; the end pad uses the same timing so it turns red right as the
  // beam reaches it.
  const timing = (i: number, si: number): React.CSSProperties =>
    allCorners
      ? { animationDelay: `${((i * 0.83 + si * 1.37) % 7).toFixed(2)}s`, animationDuration: `${5.5 + (i % 3) * 1.25}s` }
      : { animationDelay: `${(i * 1.3 + si * 1.7) % 7}s`, animationDuration: `${6 + (i % 3) * 1.5}s` };
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
        viewBox={allCorners ? `0 0 ${w} ${h}` : "0 0 1440 900"}
        preserveAspectRatio={allCorners ? "none" : "xMidYMid slice"}
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

            {/* crimson data pulses travelling along the traces */}
            <g className="cw-beams" fill="none" stroke="#e11d2a" strokeWidth="2" strokeLinecap="round" filter={`url(#${glowId})`}>
              {set.traces.map((d, i) => (
                <path
                  key={i}
                  d={d}
                  pathLength={100}
                  className="cw-pulse"
                  style={timing(i, si)}
                />
              ))}
            </g>

            {/* solder pad at every trace end: turns red when the beam hits it */}
            <g>
              {set.pads.map(([x, y], i) => (
                <circle key={i} cx={x} cy={y} r="4" className="cw-pad" style={timing(i, si)} />
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
