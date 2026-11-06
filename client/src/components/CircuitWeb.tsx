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
// all). 1 = upper tip (a circuit drops out of it), 7 = the tip on the screen
// edge where the two webs on that side meet (the center-line circuit).
const LIT_TIPS = [1, 7];
// Spoke angle (deg) of tip 1, so circuits can start exactly at that tip.
const TIP1_ANGLE = (90 / 7) * 1 + 2.5;

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

// Locked intro: the circuit sits on the SAME 48px grid as the background grid
// lines, with (0,0) at the screen center. It comes out of the web tips: the two
// corner webs on each side meet at the middle of the screen edge, and the
// center-line circuit starts exactly there (no long line across the webs) and
// ends in a solder pad 11 grid squares from center (-11 left, +11 right), well
// clear of the large music player. Mirrored/flipped so left = right and the
// top and bottom halves form a small "<>" shape.
const GRID_U = 48;
const GRID_MIRRORS = [undefined, "scale(-1 1)", "scale(1 -1)", "scale(-1 -1)"];

export default function CircuitWeb({ allCorners }: { allCorners?: boolean }) {
  // Original web size on the main site. On the intro (allCorners) the webs are
  // sized to the screen instead, so neighbours meet exactly in the middle.
  const webSize = allCorners ? "" : "w-56 sm:w-80 lg:w-[26rem]";
  // Screen size, so the grid-based circuits stay 1:1 with the CSS grid lines.
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
  // Intro circuits, in screen px with the origin at the screen center. They are
  // drawn for the top-left quarter and mirrored/flipped into the other three,
  // so every side is identical. Each one starts exactly at a web tip.
  const U = GRID_U;
  const W = vp.w / 2;
  const H = vp.h / 2;
  const S = Math.min(W, H); // the corner webs are S x S (see CornerWeb "fit")

  // 1) Tip 7 (on the screen edge, where the two webs on that side meet): the
  //    center-line circuit. Runs in, jogs over one grid square, ends at -11.
  const edge = -W;
  const y0 = S - H; // = 0 (the center line) on a landscape screen
  const bend = Math.max(edge, -14 * U);
  const lens = `M${edge} ${y0} H${bend} L${bend + U} ${y0 - U} H${-12 * U} L${-11 * U} ${y0}`;
  const lensPad: Pt = [-11 * U, y0];

  // 2) Tip 1 (upper tip): a short circuit that drops out of it and jogs AWAY
  //    from center. Only drawn when the screen is wide enough that it stays
  //    clear of the widest (large) music player, top and bottom alike, so the
  //    four corners always match.
  const a1 = (TIP1_ANGLE * Math.PI) / 180;
  const tx = -W + S * Math.cos(a1);
  const ty = -H + S * Math.sin(a1);
  const PLAYER_HALF = 230 + 36; // widest player half-width + breathing room
  const showDrop = W - S * Math.cos(a1) >= PLAYER_HALF;
  const drop = `M${tx} ${ty} V${ty + U} L${tx - U} ${ty + 2 * U} V${ty + 3 * U}`;
  const dropPad: Pt = [tx - U, ty + 3 * U];

  // 3) Fillers: rows every 2 grid squares that come out of the web's outer ring
  //    (or the screen edge where the web doesn't reach) and run toward center,
  //    stopping on a grid mark just outside the widest player. This fills the
  //    empty space beside the webs; on bigger screens there is room for more.
  //    Odd rows get a 45-degree jog away from center. A row is skipped if it is
  //    too short or would run into the drop circuit above.
  const stopX = -Math.ceil(PLAYER_HALF / U) * U; // grid mark just outside the player
  const ringR = 0.9 * S; // the web's outer silk ring
  const dropBox = showDrop ? { x0: tx - U - 16, x1: tx + 16, y0: ty - 16, y1: ty + 3 * U + 16 } : null;
  const fillTraces: string[] = [];
  const fillPads: Pt[] = [];
  if (allCorners) {
    for (let k = 1; ; k++) {
      const y = -2 * U * k;
      if (-y > H - 56) break; // stay clear of the top ticker bar
      const dy = y + H; // distance below the top edge
      const x0 = dy >= ringR ? -W : -W + Math.sqrt(ringR * ringR - dy * dy);
      // odd rows jog up (away from center) if the jog stays outside the web
      let j = k % 2 === 1 ? -U : 0;
      if (j !== 0) {
        const jx = stopX - U + W; // distance from the left edge
        const jy = y + j + H; // distance from the top edge
        if (Math.hypot(jx, jy) < S * 1.02) j = 0;
      }
      if (stopX - x0 < 2 * U) continue; // too short to be worth drawing
      const yTop = Math.min(y, y + j) - 8;
      const yBot = Math.max(y, y + j) + 8;
      if (dropBox && x0 < dropBox.x1 && stopX > dropBox.x0 && yTop < dropBox.y1 && yBot > dropBox.y0) continue;
      if (j !== 0 && stopX - x0 >= 4 * U) {
        fillTraces.push(`M${x0} ${y} H${stopX - 2 * U} L${stopX - U} ${y + j} H${stopX}`);
        fillPads.push([stopX, y + j]);
      } else {
        fillTraces.push(`M${x0} ${y} H${stopX}`);
        fillPads.push([stopX, y]);
      }
    }
  }

  const sets: { t?: string; traces: string[]; pads: Pt[] }[] = allCorners
    ? GRID_MIRRORS.map((t) => ({
        t,
        traces: [lens, ...(showDrop ? [drop] : []), ...fillTraces],
        pads: [lensPad, ...(showDrop ? [dropPad] : []), ...fillPads],
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
        viewBox={allCorners ? `${-vp.w / 2} ${-vp.h / 2} ${vp.w} ${vp.h}` : "0 0 1440 900"}
        preserveAspectRatio={allCorners ? "xMidYMid meet" : "xMidYMid slice"}
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
