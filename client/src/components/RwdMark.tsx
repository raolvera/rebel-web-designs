/**
 * Rebel Web Designs logo mark — a real, self-contained SVG.
 * A "www" globe with large "RWD" letters on top, lightly animated:
 * the meridian lines sweep like a turning globe and the letters pulse a shine.
 * Static master copy lives at /public/rwd-logo-original.svg.
 *
 * Native artboard: 120 x 120 (1:1 square). Pass `size` (px) to scale.
 */
export default function RwdMark({ size = 72 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 120 120"
      width={size}
      height={size}
      role="img"
      aria-label="Rebel Web Designs"
      className="rwd-mark flex-shrink-0"
    >
      <defs>
        <linearGradient id="rwdSilverGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.5" stopColor="#c9ccd1" />
          <stop offset="1" stopColor="#8a8d93" />
        </linearGradient>
        <clipPath id="rwdGlobeClip">
          <circle cx="60" cy="60" r="50" />
        </clipPath>
      </defs>

      {/* dark disc backing so letters stay readable over the globe lines */}
      <circle cx="60" cy="60" r="56" fill="#0a0a0b" />

      {/* globe lines, clipped to the sphere */}
      <g
        clipPath="url(#rwdGlobeClip)"
        fill="none"
        stroke="#c9ccd1"
        strokeWidth="3.8"
        strokeLinecap="round"
      >
        {/* fixed silhouette + equator */}
        <circle cx="60" cy="60" r="50" />
        <line x1="10" y1="60" x2="110" y2="60" />
        {/* animated meridian — squishes side to side like a turning globe */}
        <ellipse className="rwd-meridian" cx="60" cy="60" rx="21" ry="50" />
        {/* latitude arches — sweep in sync with the globe */}
        <path className="rwd-arch" d="M18 36c26 14 58 14 84 0" />
        <path className="rwd-arch" d="M18 84c26-14 58-14 84 0" />
      </g>

      {/* RWD letters — large, bright, with a dark outline; pulses a shine */}
      <text
        className="rwd-letters"
        x="60"
        y="61"
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily="'Space Grotesk', system-ui, sans-serif"
        fontSize="44"
        fontWeight="700"
        letterSpacing="-1"
        fill="url(#rwdSilverGrad)"
        style={{
          paintOrder: "stroke",
          stroke: "#0a0a0b",
          strokeWidth: "6px",
        }}
      >
        RWD
      </text>
    </svg>
  );
}
