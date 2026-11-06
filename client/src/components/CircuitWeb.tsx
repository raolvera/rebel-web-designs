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

// ---------------- Locked intro circuits ----------------
// Dense PCB rows that run in from the screen edge and stop JUST before any text
// or component (anything marked data-circuit-avoid: the logo, words, buttons,
// the music player). Built for the top-left quarter in real screen px and
// mirrored/flipped into the other three, so left = right and top = bottom.
type Box = { l: number; t: number; r: number; b: number };

const ROW_GAP = 28; // space between rows
const NOTCH = 12; // 45deg notch height (always bends AWAY from center)
const MARGIN = 14; // gap kept before a component or word
const TICKER = 40; // top/bottom ticker ribbons

function buildRows(w: number, h: number, boxes: Box[]): Pt[][] {
  // Use the obstacles AND their mirror images, so a row stops at the same spot
  // in all four corners (keeps everything even).
  const all: Box[] = [];
  for (const b of boxes) {
    all.push(
      b,
      { l: w - b.r, r: w - b.l, t: b.t, b: b.b },
      { l: b.l, r: b.r, t: h - b.b, b: h - b.t },
      { l: w - b.r, r: w - b.l, t: h - b.b, b: h - b.t },
    );
  }
  const rows: Pt[][] = [];
  const first = TICKER + 18 + NOTCH;
  const last = h / 2 - 16; // never reaches the center line (no "<>" diamond)
  let k = 0;
  for (let y = first; y <= last; y += ROW_GAP, k++) {
    // run right until the first thing in this row's lane
    let stop = w / 2 - 16;
    for (const b of all) {
      if (b.b < y - NOTCH - MARGIN || b.t > y + MARGIN) continue;
      stop = Math.min(stop, b.l - MARGIN);
    }
    if (stop < 70) continue; // blocked right at the edge: skip the row
    // staggered notch so it reads like a real board, not a grid
    const a = stop * [0.22, 0.38, 0.3, 0.46, 0.26, 0.41][k % 6];
    const len = stop * [0.17, 0.25, 0.13, 0.21][k % 4];
    const pts: Pt[] = [[0, y]];
    if (a > 24 && a + len + NOTCH + 30 < stop) {
      pts.push([a, y], [a + NOTCH, y - NOTCH], [a + len, y - NOTCH], [a + len + NOTCH, y]);
    }
    pts.push([stop, y]);
    rows.push(pts);
  }
  return rows;
}

// Measure everything marked data-circuit-avoid (viewport px). Re-measures on
// resize, when the player changes size, and after the intro's entrance
// animations settle.
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
    // The intro content scales with a 0.2s transition, so measure again after it.
    const measureSoon = () => {
      measure();
      timers.push(window.setTimeout(measure, 350));
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

const toPath = (pts: Pt[]) => pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");

export default function CircuitWeb({ allCorners }: { allCorners?: boolean }) {
  // Original web size on the main site. On the intro (allCorners) the webs are
  // sized to the screen instead, so neighbours meet exactly in the middle.
  const webSize = allCorners ? "" : "w-56 sm:w-80 lg:w-[26rem]";
  // Intro: dense rows in real screen px that stop just before text/components.
  const { w, h, boxes } = useAvoidBoxes(!!allCorners);
  const rows = allCorners ? buildRows(w, h, boxes) : [];
  const mirrors: (string | undefined)[] = [
    undefined, // top-left
    `translate(${w} 0) scale(-1 1)`, // top-right
    `translate(0 ${h}) scale(1 -1)`, // bottom-left
    `translate(${w} ${h}) scale(-1 -1)`, // bottom-right
  ];
  const sets: { t?: string; traces: string[]; pads: Pt[] }[] = allCorners
    ? mirrors.map((t) => ({ t, traces: rows.map(toPath), pads: rows.map((p) => p[p.length - 1]) }))
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
