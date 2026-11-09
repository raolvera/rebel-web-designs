import { useEffect, useRef, useState } from "react";

/**
 * Star Wars edit cards on the intro, floating OVER the webs and circuits
 * (dark glass, so the background still shows through).
 *
 *   Left  = the saga: Anakin, then the fall.
 *   Right = Darth Vader edits.
 *
 * Each card is a slow carousel with a Skip button. Posts + view counts come
 * from /x-posts.json, which the deploy builds from X (scripts/x-lookup.mjs,
 * using the posts listed in scripts/x-picks.json). Until real posts exist the
 * cards stay hidden on the live site; add ?saga=preview to the URL to see them
 * with placeholders.
 */

type Stage = "anakin" | "fall" | "vader";

export type XPost = {
  id: string;
  url: string;
  text: string;
  author: string;
  username: string;
  views: number;
  image?: string;
  images?: string[]; // every photo in the post
  isVideo?: boolean;
};

type Slide = { stage: Stage; post?: XPost; quote: string };

const STAGES: Record<Stage, { label: string; glow: string; edge: string; core: string }> = {
  anakin: { label: "Anakin Skywalker", glow: "rgba(56,139,253,0.45)", edge: "#3b82f6", core: "#bfdbfe" },
  fall: { label: "The Fall", glow: "rgba(147,51,234,0.45)", edge: "#9333ea", core: "#e9d5ff" },
  vader: { label: "Darth Vader", glow: "rgba(225,29,42,0.5)", edge: "#e11d2a", core: "#fecaca" },
};

// Short, well-known lines for each stage.
const QUOTES: Record<Stage, string[]> = {
  anakin: ["This is where the fun begins.", "I'm not afraid.", "I'll be the most powerful Jedi ever."],
  fall: [
    "You underestimate my power.",
    "From my point of view, the Jedi are evil.",
    "If you're not with me, then you're my enemy.",
  ],
  vader: [
    "I find your lack of faith disturbing.",
    "No, I am your father.",
    "Don't make me destroy you.",
    "The circle is now complete.",
  ],
};

// A quote that fits the post when its caption hints at a scene.
const MOOD: { re: RegExp; quote: string }[] = [
  { re: /mustafar|high ground/i, quote: "You underestimate my power." },
  { re: /father|luke/i, quote: "No, I am your father." },
  { re: /hallway|rogue one/i, quote: "Don't make me destroy you." },
  { re: /obi[- ]?wan/i, quote: "The circle is now complete." },
  { re: /podrac|tatooine|little ani/i, quote: "I'm not afraid." },
];

function pickQuote(stage: Stage, i: number, post?: XPost) {
  const mood = post && MOOD.find((m) => m.re.test(post.text));
  // only use a mood line if it belongs to this stage
  if (mood && QUOTES[stage].includes(mood.quote)) return mood.quote;
  return QUOTES[stage][i % QUOTES[stage].length];
}

function formatViews(n: number) {
  if (n >= 1e6) return `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(n >= 1e4 ? 0 : 1)}K`;
  return String(n);
}

type Data = { posts: Partial<Record<Stage, XPost[]>> };

// Loaded once and shared (the cards render in two places: beside the title on
// wide screens, stacked under it on phones).
let postsPromise: Promise<Data | null> | null = null;
function loadPosts() {
  postsPromise ??= fetch(`${import.meta.env.BASE_URL}x-posts.json`, { cache: "no-cache" })
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => (d && d.posts ? (d as Data) : null))
    .catch(() => null);
  return postsPromise;
}

function useXPosts() {
  const [data, setData] = useState<Data | null>(null);
  useEffect(() => {
    let alive = true;
    loadPosts().then((d) => alive && d && setData(d));
    return () => {
      alive = false;
    };
  }, []);
  return data;
}

// A post with several photos becomes one slide per photo (same credit, views
// and link on each).
function eachPhoto(list: XPost[] = []): XPost[] {
  return list.flatMap((p) => (p.images && p.images.length > 1 ? p.images.map((image) => ({ ...p, image })) : [p]));
}

// Left card: Anakin and the fall alternate while both last, then the rest
// play once each, so no photo repeats within a loop (Vader is on the right).
function sagaSlides(d: Data | null): Slide[] {
  const anakin = eachPhoto(d?.posts.anakin);
  const fall = eachPhoto(d?.posts.fall);
  if (!anakin.length && !fall.length) {
    return [
      { stage: "anakin", quote: pickQuote("anakin", 0) },
      { stage: "fall", quote: pickQuote("fall", 0) },
    ];
  }
  const out: Slide[] = [];
  for (let r = 0; r < Math.max(anakin.length, fall.length); r++) {
    const a = anakin[r];
    const f = fall[r];
    if (a) out.push({ stage: "anakin", post: a, quote: pickQuote("anakin", r, a) });
    if (f) out.push({ stage: "fall", post: f, quote: pickQuote("fall", r, f) });
  }
  return out;
}

// Right card: Darth Vader edits.
function vaderSlides(d: Data | null): Slide[] {
  const list = eachPhoto(d?.posts.vader);
  if (!list.length) return [0, 1, 2].map((i) => ({ stage: "vader", quote: QUOTES.vader[i] }));
  return list.map((post, i) => ({ stage: "vader", post, quote: pickQuote("vader", i, post) }));
}

const SLIDE_MS = 9000; // time on each card
const MOVE_MS = 1400; // slow slide between cards
// Distance of the side cards from the screen edge (desktop/laptop only).
const SIDE_INSET = "clamp(25px, calc(25px + (100vw - 1280px) * 0.27), 95px)";

function Carousel({ title, slides, side, saga }: { title: string; slides: Slide[]; side: "left" | "right" | "stack"; saga?: boolean }) {
  const [idx, setIdx] = useState(0);
  const [moves, setMoves] = useState(0); // counts changes (restarts the saga beam)
  const [paused, setPaused] = useState(false);
  const timer = useRef<number | null>(null);
  const n = slides.length;
  const go = (i: number) => {
    setIdx(i);
    setMoves((m) => m + 1);
  };

  useEffect(() => {
    if (paused || n < 2) return;
    timer.current = window.setTimeout(() => go((idx + 1) % n), SLIDE_MS);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [idx, paused, n]);

  const cur = slides[idx % n];
  const st = STAGES[cur.stage];

  return (
    <section
      aria-roledescription="carousel"
      aria-label={title}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className={
        side === "stack"
          ? "relative w-full max-w-[320px]" // phones: in the page, one under the other
          : "rwd-saga pointer-events-auto fixed top-1/2 z-[110] w-[260px] -translate-y-1/2"
      }
      // desktop/laptop: a tad closer to the center on wider screens, never
      // over the title (24px at 1280 wide, ~64px at 1440, up to 72px)
      style={side === "stack" ? undefined : { [side]: SIDE_INSET }}
    >
      <div
        className="overflow-hidden rounded-xl border border-silver/20 bg-coal/70 backdrop-blur-[3px]"
        style={{ boxShadow: `0 8px 30px rgba(0,0,0,0.6), 0 0 26px ${st.glow}`, transition: `box-shadow ${MOVE_MS}ms ease` }}
      >
        {/* header */}
        <div className="flex items-center justify-between border-b border-white/10 bg-ink/70 px-3 py-2">
          {/* card title color: The Chosen One = blue, Darth Vader = red */}
          <span
            className="font-display text-[11px] font-semibold uppercase tracking-wider"
            style={{ color: saga ? "#3b82f6" : "#e11d2a", textShadow: `0 0 8px ${saga ? "rgba(59,130,246,0.5)" : "rgba(225,29,42,0.5)"}` }}
          >
            {title}
          </span>
          <button
            onClick={() => go((idx + 1) % n)}
            disabled={n < 2}
            aria-label="Skip to the next edit"
            className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-ash transition hover:bg-white/5 hover:text-silver disabled:opacity-40"
          >
            Skip
            <svg viewBox="0 0 24 24" className="h-3 w-3 fill-current" aria-hidden="true">
              <path d="M16 5h2v14h-2zM4 5l11 7-11 7z" />
            </svg>
          </button>
        </div>

        {/* saga progress: Anakin (blue) -> The Fall (purple). On every change a
            beam runs between the circles, shifting color as it goes: blue ->
            purple into the fall, purple -> blue back to Anakin. */}
        {saga && (
          <div className="flex items-center gap-1.5 px-3 pt-2.5" aria-hidden="true">
            <SagaDot on={cur.stage === "anakin"} color={STAGES.anakin.edge} />
            <span className="relative h-px flex-1 bg-white/10">
              {moves > 0 && (
                <span key={moves} className={cur.stage === "fall" ? "rwd-saga-beam rwd-saga-beam-in" : "rwd-saga-beam rwd-saga-beam-out"} />
              )}
            </span>
            <SagaDot on={cur.stage === "fall"} color={STAGES.fall.edge} />
          </div>
        )}

        {/* slides (stacked; the active one slides + fades in slowly) */}
        <div className="relative h-[390px]" aria-live="polite">
          {slides.map((s, i) => {
            const active = i === idx % n;
            const before = (i - (idx % n) + n) % n > n / 2; // already shown -> exits left
            return (
              <div
                key={i}
                aria-hidden={!active}
                className="rwd-saga-slide absolute inset-0 flex flex-col px-3 pb-3 pt-2.5"
                style={{
                  opacity: active ? 1 : 0,
                  transform: active ? "translateX(0)" : `translateX(${before ? -28 : 28}px)`,
                  transition: `opacity ${MOVE_MS}ms ease, transform ${MOVE_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`,
                  pointerEvents: active ? "auto" : "none",
                }}
              >
                <SlideBody slide={s} />
              </div>
            );
          })}
        </div>

        {/* dots, colored by stage (Anakin blue, the fall purple, Vader red);
            smaller when there are lots of photos so they fit on the card */}
        {n > 1 && (
          <div className="flex flex-wrap justify-center pb-2.5" style={{ gap: n > 10 ? 3 : 6 }}>
            {slides.map((s, i) => {
              const on = i === idx % n;
              const c = STAGES[s.stage].edge;
              return (
                <button
                  key={i}
                  onClick={() => go(i)}
                  aria-label={`Show edit ${i + 1} of ${n}`}
                  aria-current={on}
                  className="rounded-full transition-all"
                  style={{
                    height: n > 10 ? 5 : 6,
                    width: on ? (n > 10 ? 11 : 14) : n > 10 ? 5 : 6,
                    background: on ? c : `${c}40`,
                    boxShadow: on ? `0 0 6px ${c}` : "none",
                    transitionDuration: `${MOVE_MS}ms`,
                  }}
                />
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

// A saga circle: lights up in its color (and glows) when its stage is showing.
function SagaDot({ on, color }: { on: boolean; color: string }) {
  return (
    <span
      className="h-2.5 w-2.5 shrink-0 rounded-full"
      style={{
        background: on ? color : "#2a2a2f",
        boxShadow: on ? `0 0 10px ${color}, 0 0 3px ${color}` : "none",
        // lights up as the beam arrives
        transition: `background ${MOVE_MS}ms ease ${on ? MOVE_MS * 0.6 : 0}ms, box-shadow ${MOVE_MS}ms ease ${on ? MOVE_MS * 0.6 : 0}ms`,
      }}
    />
  );
}

function SlideBody({ slide }: { slide: Slide }) {
  const st = STAGES[slide.stage];
  const p = slide.post;
  return (
    <>
      {/* media */}
      <div className="relative h-[250px] overflow-hidden rounded-lg border border-white/10 bg-ink">
        {p?.image ? (
          <>
            {/* the whole photo, never cropped; a soft blurred copy fills the spare space */}
            <img src={p.image} alt="" aria-hidden="true" loading="lazy" referrerPolicy="no-referrer" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-40 blur-md" />
            <img src={p.image} alt={p.username ? `${st.label} art by @${p.username}` : `${st.label} art`} loading="lazy" referrerPolicy="no-referrer" className="relative h-full w-full object-contain" />
          </>
        ) : (
          // placeholder: a glowing lightsaber in the stage's color
          <div className="flex h-full w-full flex-col items-center justify-center gap-3" style={{ background: `radial-gradient(circle at 50% 60%, ${st.glow}, transparent 70%)` }}>
            <span className="block h-1.5 w-32 rounded-full" style={{ background: st.core, boxShadow: `0 0 10px ${st.edge}, 0 0 22px ${st.edge}` }} />
            <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-ash">Edit coming soon</span>
          </div>
        )}
        {p?.isVideo && (
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-ink/70 text-white">
              <svg viewBox="0 0 24 24" className="ml-0.5 h-4 w-4 fill-current" aria-hidden="true">
                <path d="M8 5v14l11-7z" />
              </svg>
            </span>
          </span>
        )}
        {/* every card shows its view count */}
        {p && (
          <span className="absolute right-1.5 top-1.5 flex items-center gap-1 rounded-full bg-ink/80 px-2 py-0.5 text-[10px] font-semibold text-silver">
            <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            {formatViews(p.views)} views
          </span>
        )}
      </div>

      {/* stage + quote */}
      <span className="mt-2.5 text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: st.edge }}>
        {st.label}
      </span>
      <p className="mt-1 font-display text-sm italic leading-snug text-silver">&ldquo;{slide.quote}&rdquo;</p>

      {/* credit */}
      <div className="mt-auto flex items-center justify-between pt-2 text-[11px]">
        {/* the original creator's handle (blank if the artist isn't known) */}
        <span className="truncate text-ash">{p ? (p.username ? `@${p.username}` : "") : "Rebel Web Designs"}</span>
        {p && (
          <a href={p.url} target="_blank" rel="noopener noreferrer" className="shrink-0 font-semibold text-silver underline-offset-2 hover:underline">
            View on X
          </a>
        )}
      </div>
    </>
  );
}

/**
 * Default: the two cards float beside the title (wide screens only).
 * `stacked`: phones / smaller screens - the left card, then the right card,
 * one under the other below the intro text.
 */
export default function SagaCards({ stacked }: { stacked?: boolean }) {
  const data = useXPosts();
  const preview = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("saga") === "preview";
  const hasPosts = !!data && Object.values(data.posts).some((l) => l && l.length);
  if (!hasPosts && !preview) return null; // nothing to show yet on the live site
  // each card only shows once it has real posts (so no "coming soon" boxes live)
  const showLeft = preview || !!(data?.posts.anakin?.length || data?.posts.fall?.length);
  const showRight = preview || !!data?.posts.vader?.length;
  if (stacked) {
    return (
      <div className="rwd-saga-stack relative mt-10 w-full flex-col items-center gap-6 px-4">
        {showLeft && <Carousel title="The Chosen One" slides={sagaSlides(data)} side="stack" saga />}
        {showRight && <Carousel title="Darth Vader" slides={vaderSlides(data)} side="stack" />}
      </div>
    );
  }
  return (
    <>
      {showLeft && <Carousel title="The Chosen One" slides={sagaSlides(data)} side="left" saga />}
      {showRight && <Carousel title="Darth Vader" slides={vaderSlides(data)} side="right" />}
    </>
  );
}
