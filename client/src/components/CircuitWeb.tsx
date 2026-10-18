/**
 * Decorative site background: goth spiderwebs in the corners + chrome circuit
 * traces with crimson data pulses running along them. Purely visual
 * (aria-hidden, no pointer events) and sits BEHIND all page content.
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

  const spokeD = angles
    .map((a) => {
      const [x, y] = at(a, size);
      return `M0 0 L${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");

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
  return { spokeD, ringDs };
}

function CornerWeb({ className, flip }: { className: string; flip: string }) {
  const S = 400;
  const { spokeD, ringDs } = webPaths(S, 8, 7);
  return (
    <svg viewBox={`0 0 ${S} ${S}`} className={className} style={{ transform: flip }}>
      <g fill="none" stroke="#c9ccd1" strokeLinecap="round">
        <path d={spokeD} strokeWidth="1.1" opacity="0.5" />
        {ringDs.map((d, i) => (
          <path key={i} d={d} strokeWidth="0.8" opacity={0.45 - i * 0.03} />
        ))}
      </g>
      {/* a single dewdrop catching crimson light */}
      <circle cx={S * 0.42} cy={S * 0.3} r="2.2" fill="#e11d2a" className="cw-dew" />
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

export default function CircuitWeb() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* Circuit layer */}
      <svg
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 h-full w-full"
      >
        <defs>
          <filter id="cwGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.5" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* static chrome traces */}
        <g fill="none" stroke="#c9ccd1" strokeWidth="1.2" strokeLinejoin="round" opacity="0.13">
          {TRACES.map((d, i) => (
            <path key={i} d={d} />
          ))}
        </g>

        {/* solder pads */}
        <g fill="#0a0a0b" stroke="#c9ccd1" strokeWidth="1.2" opacity="0.28">
          {PADS.map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="4" />
          ))}
        </g>

        {/* crimson data pulses travelling along the traces */}
        <g fill="none" stroke="#e11d2a" strokeWidth="2" strokeLinecap="round" filter="url(#cwGlow)">
          {TRACES.map((d, i) => (
            <path
              key={i}
              d={d}
              pathLength={100}
              className="cw-pulse"
              style={{ animationDelay: `${(i * 1.3) % 7}s`, animationDuration: `${6 + (i % 3) * 1.5}s` }}
            />
          ))}
        </g>
      </svg>

      {/* Spiderwebs in opposite corners */}
      <CornerWeb className="absolute left-0 top-0 w-56 opacity-60 sm:w-80 lg:w-[26rem]" flip="none" />
      <CornerWeb className="absolute bottom-0 right-0 w-56 opacity-50 sm:w-80 lg:w-[26rem]" flip="rotate(180deg)" />

      {/* soft vignette so everything fades into the black */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,#0a0a0b_100%)]" />
    </div>
  );
}
