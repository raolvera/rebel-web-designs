import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CARD_IMG_SIZES, twImg, twSrcSet } from "../twImg";

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

type Stage = "anakin" | "platinum" | "love" | "jedi" | "r2" | "chewie" | "fall" | "vader" | "maul" | "sidious";

export type XPost = {
  id: string;
  url: string;
  text: string;
  author: string;
  username: string;
  views: number;
  likes?: number;
  image?: string;
  images?: string[]; // every photo in the post
  isVideo?: boolean;
  photoNo?: number; // which photo of the post this slide shows (1 = first)
};

type Slide = { stage: Stage; post?: XPost; quote: string };

const STAGES: Record<Stage, { label: string; glow: string; edge: string; core: string }> = {
  anakin: { label: "Anakin Skywalker", glow: "rgba(56,139,253,0.45)", edge: "#3b82f6", core: "#bfdbfe" },
  // Rebel Web Designs' own chrome Anakin (platinum / Mandalorian steel): silver name
  platinum: { label: "Anakin Skywalker", glow: "rgba(226,232,240,0.45)", edge: "#e2e8f0", core: "#f8fafc" },
  // Anakin + Padmé photos (still the good side, so the same blue)
  love: { label: "Anakin & Padmé", glow: "rgba(56,139,253,0.45)", edge: "#3b82f6", core: "#bfdbfe" },
  // other characters on The Chosen One card (Jedi get a green name, like a green lightsaber)
  jedi: { label: "Qui-Gon Jinn", glow: "rgba(34,197,94,0.45)", edge: "#22c55e", core: "#bbf7d0" },
  r2: { label: "R2-D2", glow: "rgba(56,139,253,0.45)", edge: "#60a5fa", core: "#dbeafe" },
  chewie: { label: "Chewbacca", glow: "rgba(217,119,6,0.45)", edge: "#d97706", core: "#fde68a" },
  fall: { label: "The Fall", glow: "rgba(147,51,234,0.45)", edge: "#9333ea", core: "#e9d5ff" },
  vader: { label: "Darth Vader", glow: "rgba(225,29,42,0.5)", edge: "#e11d2a", core: "#fecaca" },
  maul: { label: "Darth Maul", glow: "rgba(220,38,38,0.55)", edge: "#dc2626", core: "#fee2e2" },
  sidious: { label: "Darth Sidious", glow: "rgba(245,158,11,0.45)", edge: "#f59e0b", core: "#fef3c7" },
};

// Posts on the Vader card that show a different Sith (labeled + quoted as them).
const CHARACTER: Record<string, Stage> = {
  "2119038405560422663": "maul", // @24Kenva "DARTH MAUL"
  "2119571666393293174": "sidious", // @TheStarWarsOG Sith eye, Darth Sidious
  // Anakin & Padmé posts on The Chosen One card (@dailyanidala)
  "2099699269884084411": "love",
  "2103325805015339319": "love",
  "2103682181503898021": "love",
  "2117575555289698590": "love",
  "2119596459805007916": "love",
  "2117445477264498971": "love", // @anakinOnSol
  "2118814725740077100": "jedi", // @Isaac556x45 Qui-Gon
  "2120123325280309704": "platinum", // @Rebel_520's own chrome Anakin
  "2118823624865964305": "r2", // @agustin02565697 R2-D2
  "2118458856057737351": "chewie", // @agustin02565697 Chewbacca
};

// A quote picked for a post's scene (used unless another card already has it).
// "id" = every photo in the post, "id#2" = just its 2nd photo.
const SCENE: Record<string, string> = {
  // @Aestheticsvault "The chosen one"
  "2119424917686960296#1": "I sense Count Dooku.",
  "2119424917686960296#2": "You said the biggest problem in the universe is no one helps each other.",
  "2119424917686960296#3": "My powers have doubled since the last time we met, Count.",
  // @Aestheticsvault "Anakin wallpapers"
  "2119273174856593557#1": "I'm a Jedi. I know I'm better than this.",
  "2119273174856593557#2": "I understand wanting to walk away from the Order.",
  "2119273174856593557#3": "Not to worry, we are still flying half a ship.",
  "2119273174856593557#4": "He must stand trial.",
  "1879634666791002190": "Jedi business. Go back to your drinks.", // @StarWars 4K
  "808426449627660293": "I will come back and free you, Mom. I promise.", // @iamlorengray
  "2118807720551919915": "Impossible is a word to be found only in the dictionary of fools.", // @anakinOnSol painting, Anakin as Napoleon (Napoleon's line)
  // @Aestheticsvault "More Anakin wallpapers"
  "2119736972608467142#1": "You're asking me to do something against the Jedi Code.",
  "2119736972608467142#2": "I'll try spinning. That's a good trick!",
  "2119736972608467142#3": "I need him.",
  "2119736972608467142#4": "Chancellor Palpatine is a Sith Lord.",
  "2119497452617359833": "Thank you, my Master.", // @The__Comedian__ "Long Live the Empire" (the fall)
  "2117130187309768821": "I will even learn to stop people from dying.", // @SlytherinQueenl "We'll Have Our Home Again"
  "2116610703776002104": "I'm here, Mom. You're safe.", // @dogeofficialceo, the Tusken camp
  "2118238059657560512": "We need a system where the politicians sit down and discuss the problem.", // @anakinOnSol town hall painting
  "2118814725740077100": "The ability to speak does not make you intelligent.", // Qui-Gon (the line on the photo)
  "2118823624865964305": "Whoooaaaaaahhhhh!", // R2-D2's scream
  "2120123325280309704": "He is the Chosen One. He will bring balance.", // @Rebel_520 chrome Anakin
  "2118458856057737351": "Chewie, we're home.", // Chewbacca
  "2118743072930676755#1": "Do what must be done, Lord Vader. Do not hesitate. Show no mercy.", // "Never Forget", Order 66
  "2118743072930676755#2": "You were the Chosen One!", // "What They Took From You", Mustafar
  "2117398386571919403": "The dark side of the Force is a pathway to many abilities some consider to be unnatural.", // "Tolerance is not a Sith virtue"
  // Darth Vader card: the first photo
  "2114866265894326344": "I find your lack of faith disturbing.", // @XDarthThunderX "Lord Vader is iconic"
  "2099699269884084411": "From the moment I met you, not a day has gone by when I haven't thought of you.", // the wedding
  "2103325805015339319": "Hold me, like you did by the lake on Naboo.", // the lake on Naboo
  "2103682181503898021": "I'm haunted by the kiss that you should never have given me.", // by the fireplace
  "2117575555289698590": "I truly, deeply love you.", // chained in the Geonosis arena
  "2119596459805007916": "You're so beautiful.", // the Naboo retreat
  "2117445477264498971": "My heart is beating, hoping that kiss will not become a scar.", // the lake balcony on Naboo
};

// Real lines from the films / shows, so every card gets its own quote.
const QUOTES: Record<Stage, string[]> = {
  // Anakin while he's still good (The Phantom Menace, Attack of the Clones, early Revenge of the Sith)
  anakin: [
    "This is where the fun begins.",
    "Someday I will be the most powerful Jedi ever.",
    "Are you an angel?",
    "I'm not afraid.",
    "I'll try spinning. That's a good trick!",
    "I will come back and free you, Mom. I promise.",
    "You said the biggest problem in the universe is no one helps each other.",
    "I sense Count Dooku.",
    "My powers have doubled since the last time we met, Count.",
    "Jedi business. Go back to your drinks.",
    "Impossible is a word to be found only in the dictionary of fools.", // Napoleon, for the Napoleon painting
    "Not to worry, we are still flying half a ship.",
    // still a Jedi, but torn (Attack of the Clones, The Clone Wars, Revenge of the Sith)
    "I'm a Jedi. I know I'm better than this.",
    "I understand wanting to walk away from the Order.",
    "You're asking me to do something against the Jedi Code.",
    "Chancellor Palpatine is a Sith Lord.",
    "He must stand trial.",
    "I need him.",
    "I'm here, Mom. You're safe.",
    "We need a system where the politicians sit down and discuss the problem.",
  ],
  // the chrome Anakin: Qui-Gon on who Anakin is (The Phantom Menace)
  platinum: ["He is the Chosen One. He will bring balance.", "The Force is unusually strong with him."],
  // Qui-Gon Jinn (The Phantom Menace)
  jedi: [
    "The ability to speak does not make you intelligent.",
    "He is the Chosen One. He will bring balance. Train him.",
    "Your focus determines your reality.",
    "There's always a bigger fish.",
  ],
  // R2-D2 talks in beeps
  r2: ["Whoooaaaaaahhhhh!", "Beep boop beep bweeeep!"],
  // Chewbacca only roars, so: Han to Chewie (The Force Awakens, The Empire Strikes Back)
  chewie: ["Chewie, we're home.", "Laugh it up, fuzzball."],
  // Anakin and Padmé, said to each other (Attack of the Clones, Revenge of the Sith)
  love: [
    "From the moment I met you, not a day has gone by when I haven't thought of you.",
    "Hold me, like you did by the lake on Naboo.",
    "I'm haunted by the kiss that you should never have given me.",
    "I truly, deeply love you.",
    "You're so beautiful.",
    "No, it's because I'm so in love with you.",
    "My heart is beating, hoping that kiss will not become a scar.",
    "Ani? My goodness, you've grown.",
    "You'll always be that little boy I knew on Tatooine.",
  ],
  // turning to the dark side (Attack of the Clones, Revenge of the Sith)
  fall: [
    "You underestimate my power.",
    "You will try.",
    "If you're not with me, then you're my enemy.",
    "Is it possible to learn this power?",
    "I'm becoming more powerful than any Jedi has ever dreamed of.",
    "The Jedi turned against me. Don't you turn against me.",
    "From my point of view, the Jedi are evil!",
    "You will not take her from me!",
    "This is outrageous! It's unfair!",
    "I'm more powerful than the Chancellor. I can overthrow him.",
    "Just help me save Padmé's life. I can't live without her.",
    "I will do whatever you ask.",
    "I pledge myself to your teachings.",
    "What have I done?",
    "Love won't save you, Padmé. Only my new powers can do that.",
    "Together, you and I can rule the galaxy.",
    "You turned her against me!",
    "Don't lecture me, Obi-Wan.",
    "I see through the lies of the Jedi.",
    "I do not fear the dark side as you do.",
    "I will even learn to stop people from dying.",
    "Don't make me destroy you.",
    "I won't let this one become real.",
    "Thank you, my Master.",
    "I have brought peace, freedom, justice, and security to my new Empire.",
    // said TO Anakin as he turns (Revenge of the Sith)
    "Do what must be done, Lord Vader. Do not hesitate. Show no mercy.",
    "You were the Chosen One!",
    "The dark side of the Force is a pathway to many abilities some consider to be unnatural.",
  ],
  vader: [
    // A New Hope
    "Leave them to me. I will deal with them myself.",
    "The Force is strong with this one.",
    "I have you now.",
    "Be careful not to choke on your aspirations, Director.",
    "When I left you, I was but the learner. Now I am the master.",
    "Your powers are weak, old man.",
    "I've been waiting for you, Obi-Wan. We meet again, at last.",
    "Don't be too proud of this technological terror you've constructed.",
    "The ability to destroy a planet is insignificant next to the power of the Force.",
    "This will be a day long remembered.",
    "I find your lack of faith disturbing.",
    "I sense something. A presence I've not felt since...",
    "Escape is not his plan. I must face him alone.",
    "He is here.",
    "You should not have come back.",
    "Commander, tear this ship apart until you've found those plans.",
    "Obi-Wan has taught you well.",
    "Stay in attack formation!",
    "I'll take them myself. Cover me.",
    "Don't act so surprised, Your Highness.",
    "Don't play games with me, Your Highness.",
    // The Empire Strikes Back
    "No, I am your father.",
    "There is no escape. Don't make me destroy you.",
    "Impressive. Most impressive.",
    "The circle is now complete.",
    "You have failed me for the last time, Admiral.",
    "Apology accepted, Captain Needa.",
    "I am altering the deal. Pray I don't alter it any further.",
    "If you only knew the power of the dark side.",
    "Join me, and together we can rule the galaxy as father and son.",
    "Search your feelings. You know it to be true.",
    "All too easy.",
    "You are beaten. It is useless to resist.",
    "Asteroids do not concern me, Admiral. I want that ship, not excuses.",
    "No disintegrations.",
    "We would be honored if you would join us.",
    "Perhaps you think you're being treated unfairly?",
    "The Force is with you, young Skywalker. But you are not a Jedi yet.",
    "Luke, you can destroy the Emperor. He has foreseen this.",
    "It is your destiny.",
    "Don't let yourself be destroyed as Obi-Wan did.",
    "You have learned much, young one.",
    "You are in command now, Admiral Piett.",
    "Bring my shuttle.",
    "Calrissian, take the princess and the Wookiee to my ship.",
    // Return of the Jedi
    "The Emperor is not as forgiving as I am.",
    "You may dispense with the pleasantries, Commander.",
    "The Emperor does not share your optimistic appraisal of the situation.",
    "I hope so, Commander, for your sake.",
    "Indeed you are powerful, as the Emperor has foreseen.",
    "Obi-Wan once thought as you do.",
    "You don't know the power of the dark side. I must obey my master.",
    "It is too late for me, son.",
    "Your thoughts betray you. Your feelings for them are strong.",
    "If you will not turn to the dark side, then perhaps she will.",
    "You cannot hide forever, Luke.",
    "So, you have a twin sister.",
    "There is no conflict.",
    "The Emperor will show you the true nature of the Force.",
    "Luke, help me take this mask off.",
    "Just for once, let me look on you with my own eyes.",
    "You were right about me. Tell your sister you were right.",
    // Revenge of the Sith, Rogue One
    "Where is Padmé? Is she safe? Is she all right?",
  ],
  // The Phantom Menace, The Clone Wars, Rebels
  maul: [
    "At last we will reveal ourselves to the Jedi.",
    "At last we will have revenge.",
    "Once more the Sith will rule the galaxy, and we shall have peace.",
    "Tell me, is he the Chosen One?",
  ],
  // Revenge of the Sith, Return of the Jedi
  sidious: [
    "Unlimited power!",
    "Execute Order Sixty-Six.",
    "Everything that has transpired has done so according to my design.",
    "Now, young Skywalker, you will die.",
  ],
};

// A quote that fits the post when its caption hints at a scene.
const MOOD: { re: RegExp; quote: string }[] = [
  { re: /mustafar|high ground/i, quote: "You underestimate my power." },
  { re: /father|luke/i, quote: "No, I am your father." },
  { re: /obi[- ]?wan/i, quote: "The circle is now complete." },
  { re: /\(1977\)|new hope/i, quote: "Leave them to me. I will deal with them myself." },
  { re: /empire strikes back|\(1980\)/i, quote: "Impressive. Most impressive." },
  { re: /podrac|tatooine|little ani/i, quote: "I'm not afraid." },
];

// The stage a post really shows (Maul / Sidious posts on the Vader card).
function stageOf(post: XPost | undefined, fallback: Stage): Stage {
  return (post && CHARACTER[post.id]) || fallback;
}

/**
 * Gives every slide on a card its own quote: a line that fits the caption if
 * there is one, otherwise the next unused line for that character. Lines only
 * repeat if a card ever has more photos than that character has quotes.
 */
function withQuotes(list: { stage: Stage; post?: XPost }[]): Slide[] {
  const used: Partial<Record<Stage, Set<string>>> = {};
  const next: Partial<Record<Stage, number>> = {};
  return list.map(({ stage, post }) => {
    const pool = QUOTES[stage];
    const seen = (used[stage] ??= new Set());
    if (seen.size >= pool.length) seen.clear(); // all used: start over
    // a quote for this exact photo ("id#2" = 2nd photo), else for the whole post
    const scene = post && (SCENE[`${post.id}#${post.photoNo ?? 1}`] ?? SCENE[post.id]);
    const mood = post && MOOD.find((m) => m.re.test(post.text) && pool.includes(m.quote) && !seen.has(m.quote));
    let quote = scene && pool.includes(scene) && !seen.has(scene) ? scene : mood?.quote;
    if (!quote) {
      let i = next[stage] ?? 0;
      while (seen.has(pool[i % pool.length])) i++;
      quote = pool[i % pool.length];
      next[stage] = i + 1;
    }
    seen.add(quote);
    return { stage, post, quote };
  });
}

function formatViews(n: number) {
  if (n >= 1e6) return `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(n >= 1e4 ? 0 : 1)}K`;
  return String(n);
}

type Data = { posts: Partial<Record<Stage, XPost[]>> };

// Shared by both card layouts (beside the title on wide screens, stacked under
// it on phones). The site refreshes x-posts.json every 30 minutes, so while
// the page is open we re-check it every few minutes and the view counts climb
// to the new numbers without a reload.
const REFRESH_MS = 3 * 60 * 1000;
let shared: Data | null = null;
let lastFetch = 0;
let polling = false;
const listeners = new Set<(d: Data) => void>();

async function refreshPosts() {
  lastFetch = Date.now();
  try {
    const r = await fetch(`${import.meta.env.BASE_URL}x-posts.json?t=${lastFetch}`, { cache: "no-store" });
    if (!r.ok) return;
    const d = await r.json();
    if (!d || !d.posts) return;
    shared = d as Data;
    listeners.forEach((l) => l(shared!));
  } catch {
    // offline or blocked: keep showing what we have
  }
}

function startPolling() {
  if (polling) return;
  polling = true;
  refreshPosts();
  window.setInterval(() => {
    if (!document.hidden) refreshPosts();
  }, REFRESH_MS);
  // coming back to the tab: catch up if it's been a while
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && Date.now() - lastFetch > 60_000) refreshPosts();
  });
}

function useXPosts() {
  const [data, setData] = useState<Data | null>(shared);
  useEffect(() => {
    listeners.add(setData);
    startPolling();
    if (shared) setData(shared);
    return () => {
      listeners.delete(setData);
    };
  }, []);
  return data;
}

// The view count: when a newer count comes in, it climbs up to it.
function ViewCount({ n }: { n: number }) {
  const [shown, setShown] = useState(n);
  const from = useRef(n);
  useEffect(() => {
    const start = from.current;
    if (start === n) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce || n < start) {
      from.current = n;
      setShown(n);
      return;
    }
    const t0 = performance.now();
    const DUR = 1800;
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / DUR);
      const v = Math.round(start + (n - start) * (1 - Math.pow(1 - k, 3)));
      from.current = v;
      setShown(v);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [n]);
  return <>{formatViews(shown)}</>;
}

// A post with several photos becomes one slide per photo (same credit, views
// and link on each).
function eachPhoto(list: XPost[] = []): XPost[] {
  return list.flatMap((p) =>
    p.images && p.images.length > 1 ? p.images.map((image, i) => ({ ...p, image, photoNo: i + 1 })) : [{ ...p, photoNo: 1 }],
  );
}

// Left card: Anakin and the fall alternate while both last, then the rest
// play once each, so no photo repeats within a loop (Vader is on the right).
function sagaSlides(d: Data | null): Slide[] {
  const anakin = eachPhoto(d?.posts.anakin);
  const fall = eachPhoto(d?.posts.fall);
  if (!anakin.length && !fall.length) return withQuotes([{ stage: "anakin" }, { stage: "fall" }]);
  const out: { stage: Stage; post?: XPost }[] = [];
  for (let r = 0; r < Math.max(anakin.length, fall.length); r++) {
    if (anakin[r]) out.push({ stage: stageOf(anakin[r], "anakin"), post: anakin[r] });
    if (fall[r]) out.push({ stage: "fall", post: fall[r] });
  }
  return withQuotes(out);
}

// Right card: Darth Vader edits (plus a couple of other Sith, labeled as them).
function vaderSlides(d: Data | null): Slide[] {
  const list = eachPhoto(d?.posts.vader);
  if (!list.length) return withQuotes([0, 1, 2].map(() => ({ stage: "vader" as Stage })));
  return withQuotes(list.map((post) => ({ stage: stageOf(post, "vader"), post })));
}

/**
 * Do the cards fit beside the title, and how big? Measured from the real
 * screen: the space left and right of the "REBEL WEB DESIGNS" title, and the
 * height between the top and bottom tickers. On laptops the cards shrink a
 * little to fit there; only when even a shrunk card won't fit (phones,
 * narrow windows) do they stack under the intro text instead.
 */
const CARD_W = 260; // card width at full size (px)
const TICKER_SPACE = 40 + 12; // each ticker + a little air above/below the card
const TITLE_GAP = 20; // px kept between a card and the title
const MIN_SCALE = 0.72; // smaller than this and the cards stack instead

type SideFit = { fits: boolean; scale: number; inset: number };
let fit: SideFit = { fits: false, scale: 1, inset: 25 };
let fitWatching = false;
const fitListeners = new Set<(f: SideFit) => void>();

function measureFit() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  // distance from the screen edge (same as before on 1280px+, a bit less below)
  const inset = Math.min(95, Math.max(16, 25 + (vw - 1280) * 0.27));
  // the widest thing in the middle column is the title. Its real (unscaled)
  // width: the intro shrinks the title to fit around the music player, and
  // measuring the shrunk size would make the cards and player keep moving
  // each other around.
  const titleEl = document.querySelector<HTMLElement>("h1[data-circuit-avoid]");
  const titleW = titleEl?.offsetWidth || Math.min(vw * 0.5, 720);
  const card = document.querySelector<HTMLElement>(".rwd-saga");
  const cardH = card?.offsetHeight || 500; // unscaled height
  const free = (vw - titleW) / 2 - TITLE_GAP - inset;
  const scale = Math.min(1, free / CARD_W, (vh - 2 * TICKER_SPACE) / cardH);
  const next = { fits: vw >= 900 && scale >= MIN_SCALE, scale: Math.min(1, Math.max(MIN_SCALE, scale)), inset };
  if (next.fits !== fit.fits || Math.abs(next.scale - fit.scale) > 0.005 || Math.abs(next.inset - fit.inset) > 0.5) {
    fit = next;
    fitListeners.forEach((l) => l(fit));
    // tell the music player how far in from each edge the cards reach, so a
    // wider laptop player stays between them (0 = cards aren't at the sides)
    const edge = fit.fits ? Math.ceil(fit.inset + CARD_W * fit.scale) : 0;
    (window as any).__rebelCardsEdge = edge;
    window.dispatchEvent(new CustomEvent("rebel-cards-fit", { detail: { edge } }));
  }
}

function watchFit() {
  if (fitWatching) return;
  fitWatching = true;
  let raf = 0;
  const soon = () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(measureFit);
  };
  measureFit();
  window.addEventListener("resize", soon);
  window.addEventListener("orientationchange", soon);
  window.addEventListener("rebel-player-size", () => window.setTimeout(soon, 350)); // title size follows the player
  // the intro animates in and the fonts load, so check again as it settles
  [300, 1000, 2000, 3200].forEach((ms) => window.setTimeout(soon, ms));
  const h1 = document.querySelector("h1[data-circuit-avoid]");
  if (h1) new ResizeObserver(soon).observe(h1);
}

function useSideFit() {
  const [f, setF] = useState<SideFit>(fit);
  useEffect(() => {
    fitListeners.add(setF);
    watchFit();
    setF(fit);
    return () => {
      fitListeners.delete(setF);
    };
  }, []);
  return f;
}

const SLIDE_MS = 9000; // time on each card
const MOVE_MS = 1400; // slow slide between cards
// Distance of the side cards from the screen edge (desktop/laptop only).
const SIDE_INSET = "clamp(25px, calc(25px + (100vw - 1280px) * 0.27), 95px)";

function Carousel({ title, slides, side, saga, fitTo }: { title: string; slides: Slide[]; side: "left" | "right" | "stack"; saga?: boolean; fitTo?: SideFit }) {
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
          : "rwd-saga pointer-events-auto fixed top-1/2 z-[110] w-[260px]"
      }
      // desktop/laptop: beside the title, a tad closer to the center on wider
      // screens; on smaller laptops scaled down (from its outer edge) to fit
      style={
        side === "stack"
          ? undefined
          : {
              [side]: fitTo ? `${fitTo.inset}px` : SIDE_INSET,
              transform: `translateY(-50%) scale(${fitTo?.scale ?? 1})`,
              transformOrigin: side === "left" ? "left center" : "right center",
            }
      }
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
            <SagaDot on={cur.stage !== "fall"} color={STAGES.anakin.edge} />
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
            // only the showing photo and its neighbors load (the next one has
            // the whole 9s slide to arrive); the rest wait their turn
            const ahead = (i - (idx % n) + n) % n;
            const near = ahead <= 1 || ahead === n - 1;
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
                <SlideBody slide={s} active={active} load={near} />
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

/* ---------------- Photo pop-out ----------------
 * Desktop/laptop (mouse): hovering a card's photo shows the whole picture big
 * in the middle of the screen. Touch screens (phones/tablets): tapping the
 * photo opens it full screen; tap anywhere (or Esc) to close. Clicking or
 * pressing Enter on it opens the full-screen view on any device. */
type Zoom = { src: string; alt: string; credit: string; mode: "hover" | "open" } | null;
let zoom: Zoom = null;
const zoomListeners = new Set<(z: Zoom) => void>();
function setZoom(z: Zoom) {
  zoom = z;
  zoomListeners.forEach((l) => l(z));
}
const canHover = () => typeof window !== "undefined" && window.matchMedia("(hover: hover) and (pointer: fine)").matches;

function PhotoZoom() {
  const [z, setZ] = useState<Zoom>(zoom);
  const closeRef = useRef<HTMLButtonElement>(null);
  const backTo = useRef<HTMLElement | null>(null);
  useEffect(() => {
    zoomListeners.add(setZ);
    return () => {
      zoomListeners.delete(setZ);
    };
  }, []);
  const open = z?.mode === "open";
  useEffect(() => {
    if (!open) return;
    backTo.current = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setZoom(null);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      backTo.current?.focus?.(); // back to the photo it was opened from
    };
  }, [open]);
  if (!z) return null;

  if (!open) {
    // hover preview: centered, between the side cards, never steals the mouse
    const edge = fit.fits ? fit.inset + CARD_W * fit.scale : 0;
    return createPortal(
      <div className="pointer-events-none fixed inset-0 z-[200] flex items-center justify-center" aria-hidden="true">
        <img
          src={z.src}
          alt=""
          referrerPolicy="no-referrer"
          className="rwd-zoom-in rounded-xl border border-silver/20 object-contain shadow-[0_20px_60px_rgba(0,0,0,0.8)]"
          style={{ maxHeight: "calc(100vh - 120px)", maxWidth: `calc(100vw - ${Math.round(edge * 2 + 48)}px)` }}
        />
      </div>,
      document.body,
    );
  }

  // full-screen view (touch tap, click, or keyboard)
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={z.alt}
      onClick={() => setZoom(null)}
      className="rwd-zoom-fade fixed inset-0 z-[200] flex flex-col items-center justify-center gap-3 bg-black/85 p-4 backdrop-blur-sm"
    >
      <button
        ref={closeRef}
        onClick={() => setZoom(null)}
        aria-label="Close picture"
        className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full border border-silver/30 bg-ink/80 text-xl text-silver transition hover:text-white"
      >
        ×
      </button>
      <img
        src={z.src}
        alt={z.alt}
        referrerPolicy="no-referrer"
        className="rwd-zoom-in max-h-[85vh] max-w-[92vw] rounded-xl object-contain shadow-[0_20px_60px_rgba(0,0,0,0.8)]"
      />
      {z.credit && <span className="text-xs text-ash">{z.credit}</span>}
    </div>,
    document.body,
  );
}

function SlideBody({ slide, active, load }: { slide: Slide; active: boolean; load: boolean }) {
  const st = STAGES[slide.stage];
  const p = slide.post;
  const alt = p ? (p.username ? `${st.label} art by @${p.username}` : `${st.label} art`) : "";
  const zoomInfo = (mode: "hover" | "open"): Zoom =>
    p?.image ? { src: twImg(p.image, "large")!, alt, credit: p.username ? `@${p.username}` : "", mode } : null;
  const canZoom = !!p?.image;
  const src = twImg(p?.image, "small");
  const srcSet = twSrcSet(p?.image); // the browser picks 360px or 680px for the screen
  // the photo on screen loads first (React 18 needs the lowercase attribute)
  const priority = (active ? { fetchpriority: "high" } : {}) as Record<string, string>;
  return (
    <>
      <div className="relative h-[250px]">
      {/* media (hover = big preview on desktop/laptop, tap/click = full screen) */}
      <div
        className={`absolute inset-0 overflow-hidden rounded-lg border border-white/10 bg-ink ${canZoom ? "cursor-zoom-in" : ""}`}
        role={canZoom ? "button" : undefined}
        tabIndex={canZoom && active ? 0 : -1}
        aria-label={canZoom ? `View the full picture: ${alt}` : undefined}
        onMouseEnter={() => canZoom && canHover() && setZoom(zoomInfo("hover"))}
        onMouseLeave={() => zoom?.mode === "hover" && setZoom(null)}
        onClick={() => canZoom && setZoom(zoomInfo("open"))}
        onKeyDown={(e) => {
          if (canZoom && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            setZoom(zoomInfo("open"));
          }
        }}
      >
        {p?.image ? (
          load && (
          <>
            {/* the whole photo, never cropped; a soft blurred copy fills the
                spare space (same file, so it's only downloaded once) */}
            <img src={src} srcSet={srcSet} sizes={CARD_IMG_SIZES} alt="" aria-hidden="true" decoding="async" referrerPolicy="no-referrer" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-40 blur-md" />
            <img src={src} srcSet={srcSet} sizes={CARD_IMG_SIZES} alt={alt} decoding="async" referrerPolicy="no-referrer" {...priority} className="relative h-full w-full object-contain" />
          </>
          )
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
      </div>
        {/* every card shows its view count. Posts from before X counted views
            (late 2022) report 0, so those show their likes instead. It sits
            beside the photo button (not inside it), so the button's name for
            screen readers matches what it does. */}
        {p && (
          <span className="pointer-events-none absolute right-1.5 top-1.5 flex items-center gap-1 rounded-full bg-ink/80 px-2 py-0.5 text-[10px] font-semibold text-silver">
            {p.views > 0 || !p.likes ? (
              <>
                <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                <ViewCount n={p.views} /> views
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M12 21s-7-4.5-9.5-9A5.5 5.5 0 0 1 12 6a5.5 5.5 0 0 1 9.5 6c-2.5 4.5-9.5 9-9.5 9Z" />
                </svg>
                <ViewCount n={p.likes} /> likes
              </>
            )}
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
export default function SagaCards({ stacked = false }: { stacked?: boolean }) {
  const data = useXPosts();
  const sideFit = useSideFit();
  // When the music player goes at the end of the page (its video too big to
  // fit in the center), the cards stack under the title too, above the player.
  const [playerFlow, setPlayerFlow] = useState<boolean>(() => !!(window as any).__rebelPlayerFlow);
  useEffect(() => {
    const on = (e: Event) => setPlayerFlow(!!(e as CustomEvent<boolean>).detail);
    window.addEventListener("rebel-player-flow", on);
    return () => window.removeEventListener("rebel-player-flow", on);
  }, []);
  const beside = sideFit.fits && !playerFlow;
  const preview = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("saga") === "preview";
  const hasPosts = !!data && Object.values(data.posts).some((l) => l && l.length);
  if (!hasPosts && !preview) return null; // nothing to show yet on the live site
  // each card only shows once it has real posts (so no "coming soon" boxes live)
  const showLeft = preview || !!(data?.posts.anakin?.length || data?.posts.fall?.length);
  const showRight = preview || !!data?.posts.vader?.length;
  // only one layout shows: beside the title when there's room, else stacked
  if (stacked === beside) return null;
  if (stacked) {
    return (
      <div className="rwd-saga-stack relative mt-10 w-full flex-col items-center gap-6 px-4">
        {showLeft && <Carousel title="The Chosen One" slides={sagaSlides(data)} side="stack" saga />}
        {showRight && <Carousel title="Darth Vader" slides={vaderSlides(data)} side="stack" />}
        <PhotoZoom />
      </div>
    );
  }
  return (
    <>
      {showLeft && <Carousel title="The Chosen One" slides={sagaSlides(data)} side="left" saga fitTo={sideFit} />}
      {showRight && <Carousel title="Darth Vader" slides={vaderSlides(data)} side="right" fitTo={sideFit} />}
      <PhotoZoom />
    </>
  );
}
