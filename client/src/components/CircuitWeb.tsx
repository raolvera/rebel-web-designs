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

// Every red beam travels at this speed (screen px per second), so long and
// short circuits, web spokes and web rings all move the same.
const BEAM_SPEED = 60;
const MIN_BEAM_SECS = 2.5; // shortest cycle, so short lines don't flicker
const beamSecs = (px: number) => `${Math.max(MIN_BEAM_SECS, px / BEAM_SPEED).toFixed(2)}s`;

function CornerWeb({ className, flip, glowId, fit, lit, unitPx = 1 }: { className: string; flip: string; glowId: string; fit?: boolean; lit?: boolean; unitPx?: number }) {
  const S = 400;
  const { spokeDs, ringDs, tips } = webPaths(S, 8, 7);
  // same beam speed as the circuits: spokes are S long, rings ~a quarter circle
  const spokeSecs = beamSecs(S * unitPx);
  const ringSecs = (k: number) => beamSecs(((S / 7.6) * k * Math.PI) / 2 * 1.03 * unitPx);
  // Beams on every spoke, and on alternating rings so it isn't too busy.
  const beamRings = ringDs.filter((_, i) => i % 2 === 1);
  return (
    <svg
      viewBox={`0 0 ${S} ${S}`}
      data-circuit-web={fit ? "" : undefined}
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
            style={{ animationDelay: `${(i * 0.9) % 6}s`, animationDuration: spokeSecs }}
          />
        ))}
        {beamRings.map((d, i) => (
          <path
            key={`br${i}`}
            d={d}
            pathLength={100}
            className="cw-pulse"
            style={{ animationDelay: `${1.5 + i * 1.7}s`, animationDuration: ringSecs(2 * i + 2) }}
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
            style={{ animationDelay: `${(i * 0.9) % 6}s`, animationDuration: spokeSecs }}
          />
        ))}
    </svg>
  );
}

// Length of a simple path made of M / L / H / V commands (absolute).
function pathLen(d: string): number {
  const parts = d.match(/[MLHV]|-?\d+(?:\.\d+)?/g) || [];
  let x = 0;
  let y = 0;
  let n = 0;
  let cmd = "M";
  for (let i = 0; i < parts.length; ) {
    if (/[MLHV]/.test(parts[i])) cmd = parts[i++];
    if (cmd === "M") {
      x = +parts[i++];
      y = +parts[i++];
      cmd = "L";
    } else if (cmd === "L") {
      const nx = +parts[i++];
      const ny = +parts[i++];
      n += Math.hypot(nx - x, ny - y);
      x = nx;
      y = ny;
    } else if (cmd === "H") {
      const nx = +parts[i++];
      n += Math.abs(nx - x);
      x = nx;
    } else {
      const ny = +parts[i++];
      n += Math.abs(ny - y);
      y = ny;
    }
  }
  return n;
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
  { tip: 5, reach: 1 }, // joins the center circuit (see MERGE_AT)
  { tip: 6, reach: 1 }, // joins the center circuit (see MERGE_AT)
  { tip: 7, reach: 1 }, // center circuit
];
const TIP_EXT = 40; // px each circuit continues straight out of its tip before turning
// How far toward the center each circuit travels (tips 1..6). Staggered so the
// ends spread out instead of lining up. 1 = all the way, 0.5 = half way.
const SPREAD = [0.72, 0.95, 0.8, 1, 0.86, 0.97];
const STEPS = 2; // left/right stair steps per circuit (each step adds 2 bends)
const AVOID_PAD = 16; // px kept clear around the logo, words, pill and player
// Tips that connect straight down onto the center circuit (the two nearest it).
const MERGE_AT: Record<number, number> = { 6: 1, 5: 1 };
// px each circuit stops short of its full length (in order), so the end
// circles are offset from each other instead of lining up. 0 = full length.
const END_STAGGER = [0, 30, 8, 42, 16, 24];
const PILL_GAP = 20; // px between the center circuit's end circle and the Coming Soon pill
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

// `player` marks the music player: circuits always keep the full gap from it.
type Box = { l: number; t: number; r: number; b: number; player?: boolean };

// Screen size + the boxes of everything marked data-circuit-avoid (logo, words,
// the Coming Soon pill, buttons, the music player), in screen px. Re-measures on
// resize, when the player changes size, and after the intro animations settle.
function useAvoidBoxes(on: boolean) {
  const [state, setState] = useState<{ w: number; h: number; webPx: number; boxes: Box[]; pill: Box | null }>(() => ({
    w: window.innerWidth,
    h: window.innerHeight,
    webPx: 0,
    boxes: [],
    pill: null,
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
          if (r.width && r.height)
            boxes.push({ l: r.left, t: r.top, r: r.right, b: r.bottom, player: el.dataset.circuitAvoid === "player" });
        });
        // the Coming Soon pill: the center circuit ends just before it
        const pe = document.querySelector<HTMLElement>("[data-circuit-pill]");
        const pr = pe?.getBoundingClientRect();
        const pill = pr && pr.width ? { l: pr.left, t: pr.top, r: pr.right, b: pr.bottom } : null;
        // Measure the REAL drawing area and web size. The webs are sized in CSS
        // (50vw/50vh), which can differ from window.innerWidth/innerHeight
        // (phone address bars, scrollbars); using the measured sizes keeps
        // every circuit starting exactly on its web tip.
        const root = document.querySelector<HTMLElement>("[data-circuit-root]")?.getBoundingClientRect();
        const web = document.querySelector<SVGElement>("[data-circuit-web]")?.getBoundingClientRect();
        setState({
          w: root?.width || window.innerWidth,
          h: root?.height || window.innerHeight,
          webPx: web?.width || 0,
          boxes,
          pill,
        });
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
    document.querySelectorAll("[data-circuit-avoid], [data-circuit-root], [data-circuit-web]").forEach((el) => ro.observe(el));
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
  const { w, h, boxes, pill, webPx: measuredWeb } = useAvoidBoxes(!!allCorners);
  // the corner webs' real on-screen size (falls back to the CSS formula)
  const webPx = measuredWeb || Math.min(w / 2, h / 2);
  // On a wide screen the top and bottom webs share tip 7 on the center line, so
  // the bottom copies skip it (otherwise the center circuit is drawn twice).
  const sharedCenter = Math.abs(webPx - h / 2) < 2;
  // Each circuit grows straight out of its tip (continuing the spoke's own
  // direction for TIP_EXT px), then stair-steps toward the screen center
  // (straight, 45deg, straight, 45deg...), ending at a staggered distance so
  // the ends spread out over the empty space. Built once for the top-left web;
  // the other corners are mirror copies, so it stays even.
  const cx = w / 2;
  const cy = h / 2;
  const runs: { tip: number; pts: Pt[]; merge?: boolean }[] = [];
  if (allCorners) {
    const taken: [Pt, Pt][] = []; // segments already drawn (to avoid crossings)
    let staggerIdx = 0; // which END_STAGGER offset the next circuit gets
    // Components to stay clear of, plus their mirror images: the circuits are
    // mirrored into all four corners, so this keeps every corner identical.
    const mirrored = (pad: number): Box[] => {
      const out: Box[] = [];
      for (const b of boxes) {
        // the music player always gets the full gap (it grows at md/lg and
        // must never be touched, even by the tighter center circuit)
        const p = b.player ? Math.max(pad, AVOID_PAD) : pad;
        const g = { l: b.l - p, t: b.t - p, r: b.r + p, b: b.b + p };
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
      // The two tips nearest the center line join INTO the center circuit with
      // one straight line each.
      const join = MERGE_AT[c.tip];
      if (join !== undefined && sharedCenter) {
        // straight down a little, then one 45deg bend in toward the screen
        // center that lands on the center line; with the bottom web's mirror
        // copy each pair forms a small arrow pointing in
        const dy = cy - p[1];
        if (dy > 2) {
          // the tip nearest the line is one clean 45deg line; the other one
          // drops straight a little first, then 45deg
          const drop = c.tip === 6 ? 0 : dy * 0.4;
          const pts: Pt[] = [p, [p[0], p[1] + drop], [p[0] + (dy - drop), cy]];
          for (let i = 1; i < pts.length; i++) taken.push([pts[i - 1], pts[i]]);
          runs.push({ tip: c.tip, pts, merge: true });
        }
        continue;
      }
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
        // the center circuit ends just before the Coming Soon pill (its mirror
        // ends just after it on the right)
        const pillStop = pill ? Math.min(cx, pill.l - PILL_GAP) : cx;
        end = c.tip === 7 ? [pillStop, cy] : [turn[0] + (cx - turn[0]) * share, ty];
      }
      let pts = cutAt([p, turn, ...stairs(turn, end, STEPS)], c.reach);
      // the center circuit threads the gap between the pill and the paragraph,
      // so it uses a tighter clearance to make it across as one line
      pts = stopBeforeBoxes(pts, c.tip === 7 ? avoidTight : avoid, 0);
      pts = stopBeforeHit(pts, taken, 10);
      // Stagger the end points so the end circles don't line up in a row:
      // every other circuit stops a bit short, by varied amounts. Works on
      // short circuits too (e.g. phones, or a big player cutting them off).
      if (c.tip !== 7) {
        const len = polyLen(pts);
        // never take more than ~45% off, so short circuits still show but
        // are offset too
        const pull = Math.min(END_STAGGER[staggerIdx++ % END_STAGGER.length], len * 0.45);
        if (pull > 2 && len - pull >= 14) pts = cutAt(pts, (len - pull) / len);
      }
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
  // Main site: the 1440x900 traces are scaled to cover the screen ("slice").
  const sliceScale = Math.max(window.innerWidth / 1440, window.innerHeight / 900);
  // the center circuit's beam, which the small joining beams sync to
  const centerRun = runs.find((r) => r.tip === 7);
  const centerLen = centerRun ? polyLen(centerRun.pts) : 0;
  const centerStartX = centerRun ? centerRun.pts[0][0] : 0;
  const centerSecs = Math.max(MIN_BEAM_SECS, centerLen / BEAM_SPEED);
  type Sync = { pl: number; dur: number; delay: number } | null;
  const sets: { t?: string; traces: string[]; lens: number[]; pads: (Pt | null)[]; sync?: Sync[] }[] = allCorners
    ? mirrors.map((t, mi) => {
        // mirrors 2 and 3 are the bottom corners: on a wide screen they share
        // the center circuit with the top ones, so they skip it (drawn once)
        const mine = runs.filter((r) => !(mi >= 2 && sharedCenter && r.tip === 7));
        // Sync the small joining beams to the center beam: each one fires so it
        // reaches the center line at the exact moment the center beam passes
        // that point. Both run at the same speed and share the center beam's
        // cycle (the small line's dash finishes early, then waits), so it lines
        // up every time, on both sides.
        const side = mi % 2; // 0 = left webs, 1 = right webs
        const dc = (side * 1.37) % 7; // the center beam's own delay (index 0 in its set)
        const sync = mine.map((r) => {
          if (!r.merge || !centerLen) return null;
          const lm = polyLen(r.pts);
          const joinX = r.pts[r.pts.length - 1][0] - centerStartX; // distance along the center line
          return {
            pl: (100 * lm) / centerLen, // dash keeps the same px size + speed
            dur: centerSecs,
            delay: dc + joinX / BEAM_SPEED - lm / BEAM_SPEED,
          };
        });
        return {
          t,
          traces: mine.map((r) => toPath(r.pts)),
          lens: mine.map((r) => polyLen(r.pts)),
          sync,
          // the center circuit joins its mirror in the middle into one line, so
          // it has no end circle (only the circle at the web tip it starts from)
          // circuits that join the center line have no end circle either
          pads: mine.map((r) => (r.merge ? null : r.pts[r.pts.length - 1])),
        };
      })
    : [{ traces: TRACES, lens: TRACES.map(pathLen), pads: PADS }];
  // Beam timing; the end pad uses the same timing so it turns red right as the
  // beam reaches it.
  // Every beam moves at the same speed: duration = path length / speed.
  // (the center circuit is index 0 in sets 0 and 1, so its delay is
  // (si * 1.37) % 7 - the small joining beams rely on that)
  const timing = (i: number, si: number, len: number): React.CSSProperties => ({
    animationDelay: `${(((i * 0.83 + si * 1.37) % 7)).toFixed(2)}s`,
    animationDuration: allCorners && i === 0 && si < 2 && centerRun
      ? `${centerSecs.toFixed(3)}s`
      : beamSecs(len * (allCorners ? 1 : sliceScale)),
  });
  // px per web viewBox unit (webs are 400 units): intro webs are webPx wide;
  // main-site webs are roughly 400px (w-56 / sm:w-80 / lg:w-[26rem])
  const unitPx = allCorners ? webPx / 400 : 1;
  // Unique per instance, since this can be on screen twice (site + intro).
  const glowId = `cwGlow-${useId().replace(/:/g, "")}`;

  return (
    <div aria-hidden="true" data-circuit-root={allCorners ? "" : undefined} className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
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
        // Redraw ALL circuit beams together whenever the layout changes, so
        // every beam's animation starts at the same moment. (CSS animations
        // count from when each line first appears; lines added later would
        // run out of step and the joining beams wouldn't meet the center beam.)
        key={allCorners ? `${w}|${h}|${webPx}|${centerLen.toFixed(1)}|${runs.length}` : "site"}
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
                  pathLength={set.sync?.[i]?.pl ?? 100}
                  className={set.sync?.[i] ? "cw-pulse cw-pulse-sync" : "cw-pulse"}
                  style={(() => {
                    const s = set.sync?.[i];
                    return s
                      ? { animationDelay: `${s.delay.toFixed(3)}s`, animationDuration: `${s.dur.toFixed(3)}s` }
                      : timing(i, si, set.lens[i]);
                  })()}
                />
              ))}
            </g>

            {/* solder pad at every trace end: turns red when the beam hits it */}
            <g>
              {set.pads.map((pt, i) =>
                pt ? <circle key={i} cx={pt[0]} cy={pt[1]} r="4" className="cw-pad" style={timing(i, si, set.lens[i])} /> : null,
              )}
            </g>
          </g>
        ))}
      </svg>

      {/* Circuit spiderwebs in opposite corners (all four on the locked intro) */}
      <CornerWeb glowId={glowId} unitPx={unitPx} fit={allCorners} lit={allCorners} className={`absolute left-0 top-0 ${webSize} ${allCorners ? "opacity-50" : "opacity-60"}`} flip="none" />
      <CornerWeb glowId={glowId} unitPx={unitPx} fit={allCorners} lit={allCorners} className={`absolute bottom-0 right-0 ${webSize} opacity-50`} flip="rotate(180deg)" />
      {allCorners && (
        <>
          <CornerWeb glowId={glowId} unitPx={unitPx} fit lit className={`absolute right-0 top-0 ${webSize} opacity-50`} flip="scaleX(-1)" />
          <CornerWeb glowId={glowId} unitPx={unitPx} fit lit className={`absolute bottom-0 left-0 ${webSize} opacity-50`} flip="scaleY(-1)" />
        </>
      )}

      {/* soft vignette so everything fades into the black */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,#0a0a0b_100%)]" />
    </div>
  );
}
