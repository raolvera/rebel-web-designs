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
// Every circuit grows straight out of a web tip, then turns once and aims
// directly at the screen center, ending in a solder pad that flashes red when
// its beam arrives.
// Drawn for the top-left web and mirrored/flipped into the other three corners,
// so left = right and top = bottom.
//
// ADJUST HERE:
//   tip   = which spoke of the web it comes out of. 1 is the tip nearest the
//           top edge; 7 is the tip on the side edge where the two webs on that
//           side meet (that one is the CENTER circuit, on the center line).
//   reach = how much of its full length it draws: 1 = the whole way (stops
//           END_R px from the screen center), 0.5 = half way, 0.25 = a quarter.
//           Delete a line to remove that circuit.
const TIP_CIRCUITS: { tip: number; reach: number }[] = [
  { tip: 0, reach: 1 }, // top edge tip -> top center (bottom webs: bottom center)
  { tip: 1, reach: 1 },
  { tip: 2, reach: 1 },
  { tip: 3, reach: 1 },
  { tip: 4, reach: 1 },
  { tip: 5, reach: 1 },
  { tip: 7, reach: 1 }, // center circuit
];
const TIP_EXT = 40; // px each circuit continues straight out of its tip before turning
// How far toward the center each circuit travels (tips 1..6). Staggered so the
// ends spread out instead of lining up. 1 = all the way, 0.5 = half way.
const SPREAD = [0.72, 0.95, 0.8, 1, 0.86, 0.97];
const STEPS = 2; // left/right stair steps per circuit (each step adds 2 bends)
const AVOID_PAD = 16; // px kept clear around the logo, words, pill and player
const TOP_AIM = 54; // px from the top the highest circuit aims for (smaller = higher; bottom mirrors it)
const CENTER_GAP = 30; // px left between the left and right top/bottom-center circuits
const EDGE_Y = 58; // px from the top (and bottom) edge for the top/bottom-center circuits

// Octilinear stair-steps from a to b: straight, 45deg, straight, 45deg...
function stairs(a: Pt, b: Pt, n: number): Pt[] {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const sx = Math.sign(dx);
  const sy = Math.sign(dy);
  const lo = Math.min(Math.abs(dx), Math.abs(dy));
  const hi = Math.max(Math.abs(dx), Math.abs(dy));
  const diag = lo / n; // 45deg part of each step
  const flat = (hi - lo) / n; // straight part of each step
  const out: Pt[] = [];
  let [x, y] = a;
  for (let i = 0; i < n; i++) {
    if (Math.abs(dx) >= Math.abs(dy)) x += sx * flat;
    else y += sy * flat;
    out.push([x, y]);
    x += sx * diag;
    y += sy * diag;
    out.push([x, y]);
  }
  out[out.length - 1] = b;
  return out;
}

// Where segment p-q hits segment a-b (as a 0..1 position along p-q), if it does.
function segHit(p: Pt, q: Pt, a: Pt, b: Pt): number | null {
  const rx = q[0] - p[0];
  const ry = q[1] - p[1];
  const sx = b[0] - a[0];
  const sy = b[1] - a[1];
  const den = rx * sy - ry * sx;
  if (Math.abs(den) < 1e-9) return null;
  const t = ((a[0] - p[0]) * sy - (a[1] - p[1]) * sx) / den;
  const u = ((a[0] - p[0]) * ry - (a[1] - p[1]) * rx) / den;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? t : null;
}

// Stop a circuit `gap` px before it would run into one that's already drawn.
function stopBeforeHit(pts: Pt[], taken: [Pt, Pt][], gap: number): Pt[] {
  let walked = 0;
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i - 1];
    const q = pts[i];
    const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
    let first: number | null = null;
    for (const [a, b] of taken) {
      const t = segHit(p, q, a, b);
      if (t !== null && (first === null || t < first)) first = t;
    }
    if (first !== null) return cutAt(pts, Math.max(0, (walked + first * len - gap) / polyLen(pts)));
    walked += len;
  }
  return pts;
}

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

type Box = { l: number; t: number; r: number; b: number };

// Screen size + the boxes of everything marked data-circuit-avoid (logo, words,
// the Coming Soon pill, buttons, the music player), in screen px. Re-measures on
// resize, when the player changes size, and after the intro animations settle.
function useAvoidBoxes(on: boolean) {
  const [state, setState] = useState<{ w: number; h: number; boxes: Box[] }>(() => ({
    w: window.innerWidth,
    h: window.innerHeight,
    boxes: [],
  }));
  useEffect(() => {
    if (!on) return;
    let raf = 0;
    const measure = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const boxes: Box[] = [];
        document.querySelectorAll<HTMLElement>("[data-circuit-avoid]").forEach((el) => {
          const r = el.getBoundingClientRect();
          if (r.width && r.height) boxes.push({ l: r.left, t: r.top, r: r.right, b: r.bottom });
        });
        setState({ w: window.innerWidth, h: window.innerHeight, boxes });
      });
    };
    const timers: number[] = [];
    const measureSoon = () => {
      measure();
      timers.push(window.setTimeout(measure, 350)); // after the 0.2s scale transition
    };
    measure();
    [400, 1600, 2600].forEach((ms) => timers.push(window.setTimeout(measure, ms)));
    const ro = new ResizeObserver(measureSoon);
    document.querySelectorAll("[data-circuit-avoid]").forEach((el) => ro.observe(el));
    window.addEventListener("resize", measureSoon);
    window.addEventListener("orientationchange", measureSoon);
    window.addEventListener("rebel-player-size", measureSoon);
    return () => {
      cancelAnimationFrame(raf);
      timers.forEach((t) => window.clearTimeout(t));
      ro.disconnect();
      window.removeEventListener("resize", measureSoon);
      window.removeEventListener("orientationchange", measureSoon);
      window.removeEventListener("rebel-player-size", measureSoon);
    };
  }, [on]);
  return state;
}

// Where segment p-q first enters box b (0..1 along p-q), or null if it never does.
function enterBox(p: Pt, q: Pt, b: Box): number | null {
  let t0 = 0;
  let t1 = 1;
  const dx = q[0] - p[0];
  const dy = q[1] - p[1];
  const edges: [number, number][] = [
    [-dx, p[0] - b.l],
    [dx, b.r - p[0]],
    [-dy, p[1] - b.t],
    [dy, b.b - p[1]],
  ];
  for (const [pp, qq] of edges) {
    if (pp === 0) {
      if (qq < 0) return null;
    } else {
      const r = qq / pp;
      if (pp < 0) t0 = Math.max(t0, r);
      else t1 = Math.min(t1, r);
    }
  }
  return t0 <= t1 ? t0 : null;
}

// Stop a circuit `gap` px before it would touch any of the boxes.
function stopBeforeBoxes(pts: Pt[], boxes: Box[], gap: number): Pt[] {
  let walked = 0;
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i - 1];
    const q = pts[i];
    const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
    let first: number | null = null;
    for (const b of boxes) {
      const t = enterBox(p, q, b);
      if (t !== null && (first === null || t < first)) first = t;
    }
    if (first !== null) return cutAt(pts, Math.max(0, (walked + first * len - gap) / polyLen(pts)));
    walked += len;
  }
  return pts;
}

const toPath = (pts: Pt[]) => pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");

export default function CircuitWeb({ allCorners }: { allCorners?: boolean }) {
  // Original web size on the main site. On the intro (allCorners) the webs are
  // sized to the screen instead, so neighbours meet exactly in the middle.
  const webSize = allCorners ? "" : "w-56 sm:w-80 lg:w-[26rem]";
  // Intro: circuits out of the web tips, in real screen px.
  const { w, h, boxes } = useAvoidBoxes(!!allCorners);
  const webPx = Math.min(w / 2, h / 2); // the corner webs are this size (CornerWeb "fit")
  // On a wide screen the top and bottom webs share tip 7 on the center line, so
  // the bottom copies skip it (otherwise the center circuit is drawn twice).
  const sharedCenter = Math.abs(webPx - h / 2) < 1;
  // Each circuit grows straight out of its tip (continuing the spoke's own
  // direction for TIP_EXT px), then stair-steps toward the screen center
  // (straight, 45deg, straight, 45deg...), ending at a staggered distance so
  // the ends spread out over the empty space. Built once for the top-left web;
  // the other corners are mirror copies, so it stays even.
  const cx = w / 2;
  const cy = h / 2;
  const runs: { tip: number; pts: Pt[] }[] = [];
  if (allCorners) {
    const taken: [Pt, Pt][] = []; // segments already drawn (to avoid crossings)
    // Components to stay clear of, plus their mirror images: the circuits are
    // mirrored into all four corners, so this keeps every corner identical.
    const mirrored = (pad: number): Box[] => {
      const out: Box[] = [];
      for (const b of boxes) {
        const g = { l: b.l - pad, t: b.t - pad, r: b.r + pad, b: b.b + pad };
        out.push(
          g,
          { l: w - g.r, r: w - g.l, t: g.t, b: g.b },
          { l: g.l, r: g.r, t: h - g.b, b: h - g.t },
          { l: w - g.r, r: w - g.l, t: h - g.b, b: h - g.t },
        );
      }
      return out;
    };
    const avoid = mirrored(AVOID_PAD);
    const avoidTight = mirrored(4);
    // center circuit first so it always stays whole, then tips 1..6
    const rank = (t: number) => (t === 7 ? -2 : t === 0 ? -1 : t); // center, edge, then the rest
    const order = [...TIP_CIRCUITS].sort((a, b) => rank(a.tip) - rank(b.tip));
    for (const c of order) {
      if (!UNIT_TIPS[c.tip]) continue;
      const [ux, uy] = UNIT_TIPS[c.tip]; // tip position for a size-1 web = spoke direction
      const p: Pt = [ux * webPx, uy * webPx];
      // straight out of the tip, but never past the center lines (tip 7 lies
      // on the screen edge pointing along it, so it turns at the tip)
      let ext = c.tip === 7 ? 0 : TIP_EXT;
      if (uy > 0) ext = Math.min(ext, (cy - 14 - p[1]) / uy);
      if (ux > 0) ext = Math.min(ext, (cx - 14 - p[0]) / ux);
      ext = Math.max(0, ext);
      const turn: Pt = [p[0] + ux * ext, p[1] + uy * ext];
      let end: Pt;
      if (c.tip === 0) {
        // tip 0 sits on the top edge: run along under the ticker to top center
        // (its bottom-corner copies run to bottom center)
        if (cx - CENTER_GAP - turn[0] < 40) continue; // web already reaches the center
        end = [cx - CENTER_GAP, EDGE_Y];
      } else {
        // the center circuit runs all the way to the middle, so the left and
        // right ones meet and join into one line across the screen
        const share = c.tip === 7 ? 1 : SPREAD[(c.tip - 1) % SPREAD.length];
        // Aim height: tip 1 (highest) aims near the top, lower tips aim
        // progressively lower, tip 7 aims at the center line. The bottom copies
        // mirror this, so they go lower by the same amount (stays even).
        const ty = c.tip === 7 ? cy : TOP_AIM + (cy - TOP_AIM) * ((c.tip - 1) / 6);
        // every circuit reaches its full aim height (so the top one goes right
        // up under the ticker); `share` only sets how far across it runs
        end = c.tip === 7 ? [cx, cy] : [turn[0] + (cx - turn[0]) * share, ty];
      }
      let pts = cutAt([p, turn, ...stairs(turn, end, STEPS)], c.reach);
      // the center circuit threads the gap between the pill and the paragraph,
      // so it uses a tighter clearance to make it across as one line
      pts = stopBeforeBoxes(pts, c.tip === 7 ? avoidTight : avoid, 0);
      pts = stopBeforeHit(pts, taken, 10);
      if (polyLen(pts) < 60) continue; // too short to draw (avoids stubs by the center line)
      for (let i = 1; i < pts.length; i++) taken.push([pts[i - 1], pts[i]]);
      runs.push({ tip: c.tip, pts });
    }
  }
  const mirrors: (string | undefined)[] = [
    undefined, // top-left
    `translate(${w} 0) scale(-1 1)`, // top-right
    `translate(0 ${h}) scale(1 -1)`, // bottom-left
    `translate(${w} ${h}) scale(-1 -1)`, // bottom-right
  ];
  const sets: { t?: string; traces: string[]; pads: (Pt | null)[] }[] = allCorners
    ? mirrors.map((t, mi) => {
        // mirrors 2 and 3 are the bottom corners: on a wide screen they share
        // the center circuit with the top ones, so they skip it (drawn once)
        const mine = runs.filter((r) => !(mi >= 2 && sharedCenter && r.tip === 7));
        return {
          t,
          traces: mine.map((r) => toPath(r.pts)),
          // the center circuit joins its mirror in the middle into one line, so
          // it has no end circle (only the circle at the web tip it starts from)
          pads: mine.map((r) => (r.tip === 7 ? null : r.pts[r.pts.length - 1])),
        };
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
              {set.pads.map((pt, i) =>
                pt ? <circle key={i} cx={pt[0]} cy={pt[1]} r="4" className="cw-pad" style={timing(i, si)} /> : null,
              )}
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
