import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { isSideways, TOUCH_MQ } from "./Intro";

/**
 * Media Player — one self-contained, draggable player card shown on every page
 * (mounted once in Layout; never unmounts so audio survives navigation).
 *
 * The YouTube iframe and the controls live together in ONE card: a small video
 * window on top (shown when Video is toggled on) with the player controls
 * attached right below. The iframe is created ONCE and never re-parented.
 *
 * Playback: starts MUTED automatically (browsers allow muted autoplay), then
 * unmutes on the visitor's first interaction anywhere. The intro and any page
 * can drive it via window events.
 */
const PLAYLIST_ID = "PLc1TGI0jv1YA";

// One-day special opening songs, keyed by the visitor's local date (YYYY-MM-DD).
// On a special day that song opens the Media Player (Thriller repeats all day). On
// any other day there is NO fixed intro — the Media Player starts straight from the
// playlist. Old entries stay harmlessly (they only fire on their own day).
const SPECIAL_INTROS: Record<string, string> = {
  "2026-10-31": "sOnqjkJTMaA", // Halloween: Michael Jackson - Thriller
};

function todayKey() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

// The opening song for this visit, IF today is a special day (otherwise empty,
// meaning the Media Player starts with the playlist instead of a single intro song).
const INTRO_VIDEO_ID = SPECIAL_INTROS[todayKey()] || "";
// On a special day, that song plays on repeat all day (no playlist, no mix).
const REPEAT_ALL_DAY = !!SPECIAL_INTROS[todayKey()];
// Songs that seed the endless radio once the playlist ends (YouTube video IDs,
// the part after "watch?v="). Mixes rotate through these so the radio covers
// all these artists. Leave empty to follow whatever song just played.
const MIX_SEEDS: string[] = [];
// Songs that must never play. Any song whose title contains one of these words
// is skipped instantly (playlist, shuffle, and mixes). Lowercase.
const BLOCKED_TITLES: string[] = ["baewatch"];

declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

function loadYT(): Promise<any> {
  return new Promise((resolve, reject) => {
    if (window.YT && window.YT.Player) return resolve(window.YT);
    if (!document.getElementById("yt-iframe-api")) {
      const tag = document.createElement("script");
      tag.id = "yt-iframe-api";
      tag.src = "https://www.youtube.com/iframe_api";
      document.body.appendChild(tag);
    }
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve(window.YT);
    };
    setTimeout(() => (window.YT?.Player ? resolve(window.YT) : reject(new Error("YT load failed"))), 8000);
  });
}

// Original video widths for SM / MD / LG (px).
const DIMS_ALL = { sm: 240, md: 340, lg: 460 } as const;
// Smallest height the intro's logo + title + pill can shrink to (about half
// their size) before a taller player would cover them.
const INTRO_MIN_H = 165;

export default function MusicPlayer() {
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const readyRef = useRef(false);
  const ytInitRef = useRef(false); // YouTube loading/loaded (see ensurePlayer)
  const unlockedRef = useRef(false);
  const wantPlayRef = useRef(false);
  const shuffleRef = useRef(false); // read inside YouTube callbacks
  const [shuffleOn, setShuffleOn] = useState(false);
  const modeRef = useRef<"intro" | "rebel" | "mix">(INTRO_VIDEO_ID ? "intro" : "rebel"); // what's queued now
  const skipIntroRef = useRef(false); // skip the intro song if it's also in the playlist
  const reshuffleRef = useRef(false); // play the current list shuffled once (fallback replay)
  const playedRef = useRef<Set<number>>(new Set()); // songs played in the current list
  const historyRef = useRef<number[]>([]); // play order, for the Back button
  const justLoadedRef = useRef(false); // a new list just loaded
  const mixSeedRef = useRef(0); // which MIX_SEEDS song seeds the next mix
  const blockedIdsRef = useRef<Set<string>>(new Set()); // blocked songs found so far
  const lastGoodIdRef = useRef<string>(INTRO_VIDEO_ID); // last song that really played
  const errorCountRef = useRef(0); // songs in a row that couldn't play
  const specialFailedRef = useRef(false); // the day's special song couldn't play
  const advanceTimerRef = useRef<number | null>(null);
  const mixWatchRef = useRef<number | null>(null);
  const mixDisabledRef = useRef(false); // mixes can't embed here (e.g. mobile) — loop the playlist instead

  const [playing, setPlaying] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  // Phones AND tablets (any touch-only screen): the player is locked in place
  // at the bottom center (no dragging). The Audio / Video switch still works.
  const PHONE_MQ = TOUCH_MQ;
  const [isPhone, setIsPhone] = useState(() => window.matchMedia(PHONE_MQ).matches);
  useEffect(() => {
    const mq = window.matchMedia(PHONE_MQ);
    const on = () => setIsPhone(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  const [chosenSize, setVideoSize] = useState<"sm" | "md" | "lg">("sm"); // user-resizable (see videoSize)
  // Read the intro flag synchronously so there's no race with the intro's event.
  const [introMode, setIntroMode] = useState<boolean>(() => !!(window as any).__rebelIntro);
  const [title, setTitle] = useState("Media Player");
  const [volume, setVol] = useState(15); // soft default so it doesn't blast visitors
  const volRef = useRef(15); // same value, readable inside YouTube callbacks
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // Full screen video. The whole video window goes full screen (not just
  // YouTube's frame) so the click-to-pause layer still works; Esc or the
  // button exits. Hidden where the browser can't do it (e.g. iPhone Safari).
  const videoWrapRef = useRef<HTMLDivElement>(null);
  const doc = document as Document & { webkitFullscreenEnabled?: boolean; webkitFullscreenElement?: Element; webkitExitFullscreen?: () => void };
  const canFullscreen = !!(doc.fullscreenEnabled || doc.webkitFullscreenEnabled);
  const [isFullscreen, setIsFullscreen] = useState(false);
  useEffect(() => {
    const on = () => setIsFullscreen(!!(doc.fullscreenElement || doc.webkitFullscreenElement) && (doc.fullscreenElement || doc.webkitFullscreenElement) === videoWrapRef.current);
    document.addEventListener("fullscreenchange", on);
    document.addEventListener("webkitfullscreenchange", on);
    return () => {
      document.removeEventListener("fullscreenchange", on);
      document.removeEventListener("webkitfullscreenchange", on);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  function toggleFullscreen() {
    const el = videoWrapRef.current as (HTMLDivElement & { webkitRequestFullscreen?: () => void }) | null;
    if (!el) return;
    if (doc.fullscreenElement || doc.webkitFullscreenElement) {
      if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
      else doc.webkitExitFullscreen?.();
    } else if (el.requestFullscreen) {
      el.requestFullscreen().catch(() => {});
    } else {
      el.webkitRequestFullscreen?.();
    }
  }

  // Track the screen size so the player re-fits when a phone is rotated.
  const [vp, setVp] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }));
  useEffect(() => {
    const on = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", on);
    window.addEventListener("orientationchange", on);
    return () => {
      window.removeEventListener("resize", on);
      window.removeEventListener("orientationchange", on);
    };
  }, []);

  // How far in from each screen edge the intro's side cards reach (0 when
  // they aren't at the sides), so the player stays in the center between them.
  const [cardsEdge, setCardsEdge] = useState<number>(() => (window as any).__rebelCardsEdge || 0);
  useEffect(() => {
    const on = (e: Event) => setCardsEdge((e as CustomEvent<{ edge: number }>).detail?.edge || 0);
    window.addEventListener("rebel-cards-fit", on);
    return () => window.removeEventListener("rebel-cards-fit", on);
  }, []);

  /* Where the player goes on the intro (the main site never needs this; the
   * player floats in a corner there). Based on the real space, not the device:
   *  1. ORIGINAL size, centered at the bottom between the side cards, when it
   *     fits without covering the logo + title (the intro can only shrink them
   *     to half size) or the cards. Desktops always get this.
   *  2. Otherwise MD/LG get WIDER instead of taller (laptops), when that fits.
   *  3. Otherwise the page stacks: the cards drop under the title and the
   *     player goes at the very end of the page, below the cards (and always on
   *     phones/tablets smaller than 1024px held upright). */
  const smallTouch = isPhone && vp.w < 1024; // phones + tablets under 1024px
  const capW = (w: number) => Math.min(w, vp.w - 32, Math.max(160, (vp.h - 170) / 0.62));
  const smVidH0 = Math.round(capW(DIMS_ALL.sm) * 0.62);
  const cardH = (size: "sm" | "md" | "lg", vidH: number) => 150 + (size === "lg" ? 12 : size === "md" ? 6 : 0) + vidH; // controls + video
  // room left for the logo + title above a player pinned at the bottom
  const roomAbove = (h: number) => vp.h - vp.h * 0.03 - 40 - (h + 28) - 40;
  const centerRoom = vp.w - 2 * cardsEdge - 32; // between the side cards
  const fitsAt = (size: "sm" | "md" | "lg") =>
    roomAbove(cardH(size, Math.round(capW(DIMS_ALL[size]) * 0.62))) >= INTRO_MIN_H && capW(DIMS_ALL[size]) <= centerRoom;
  // Laptops: when LG's original size won't fit, LG is simply the same size as
  // MD there (desktops with the room keep the original LG).
  const videoSize = chosenSize === "lg" && introMode && !smallTouch && !fitsAt("lg") ? "md" : chosenSize;
  const fitsOriginal = fitsAt(videoSize);
  const fitsWide = videoSize !== "sm" && roomAbove(cardH("sm", smVidH0)) >= INTRO_MIN_H;
  const isLaptop = introMode && !smallTouch && !fitsOriginal && fitsWide;
  const inFlow =
    introMode &&
    !isSideways(vp.w, vp.h) &&
    (smallTouch ? vp.h > vp.w : !fitsOriginal && !fitsWide && showVideo);
  // tell the intro + cards (they stack when the player goes to the end)
  useEffect(() => {
    (window as any).__rebelPlayerFlow = inFlow;
    window.dispatchEvent(new CustomEvent("rebel-player-flow", { detail: inFlow }));
  }, [inFlow]);
  const sizeOptions = ["sm", "md", "lg"] as const;
  // When the player goes at the end of the page (inFlow, above): it isn't
  // pinned over the page; it sits in its spot there ([data-player-slot]) and
  // moves with the page as it scrolls, so visitors scroll down to it. It's
  // kept in place this way (not moved in the page) so the music never restarts.
  useLayoutEffect(() => {
    const el = cardRef.current;
    if (!inFlow || !el) return;
    let raf = 0;
    const sync = () => {
      const slot = document.querySelector<HTMLElement>("[data-player-slot]");
      if (!slot) return;
      el.style.top = `${slot.getBoundingClientRect().top}px`;
      el.style.visibility = "visible";
    };
    const soon = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(sync);
    };
    el.style.visibility = "hidden"; // until it's lined up
    sync();
    // the page scrolls inside the intro, so listen in the capture phase
    window.addEventListener("scroll", sync, { capture: true, passive: true });
    window.addEventListener("resize", soon);
    // content above can change height (cards and photos load in)
    const iv = window.setInterval(sync, 400);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", sync, { capture: true } as EventListenerOptions);
      window.removeEventListener("resize", soon);
      window.clearInterval(iv);
      el.style.top = "";
      el.style.visibility = "";
    };
  }, [inFlow]);

  // Report the card's real height (it changes with SM/MD/LG, video on/off,
  // minimize) so the intro can keep its text clear of the player.
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const report = () => {
      const h = el.offsetHeight;
      const w = el.offsetWidth;
      (window as any).__rebelPlayerH = h;
      (window as any).__rebelPlayerW = w;
      window.dispatchEvent(new CustomEvent("rebel-player-size", { detail: { w, h } }));
    };
    report();
    const ro = new ResizeObserver(report);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  function startPlay() {
    // Pressing Play is a user gesture → play with SOUND.
    wantPlayRef.current = true;
    unlockedRef.current = true;
    ensurePlayer(); // first Play: load YouTube (it starts when ready)
    const p = playerRef.current;
    if (!readyRef.current || !p) return;
    p.unMute?.();
    p.setVolume?.(volRef.current);
    p.playVideo?.();
  }

  function pausePlay() {
    wantPlayRef.current = false;
    playerRef.current?.pauseVideo?.();
  }

  // ---------------- Playback queue ----------------
  // "intro" = the single intro song, "rebel" = the Media Player playlist,
  // "mix"   = endless YouTube radio of similar songs once the playlist is done.
  function hasPlaylist() {
    const p = playerRef.current;
    const list = p && typeof p.getPlaylist === "function" ? p.getPlaylist() : null;
    return !!(list && list.length);
  }

  function currentId(): string | undefined {
    try {
      return playerRef.current?.getVideoData?.()?.video_id;
    } catch {
      return undefined;
    }
  }

  function listIds(): string[] {
    const p = playerRef.current;
    const list = p && typeof p.getPlaylist === "function" ? p.getPlaylist() : null;
    return Array.isArray(list) ? list : [];
  }

  function curIndex(): number {
    return playerRef.current?.getPlaylistIndex?.() ?? 0;
  }

  // Our own shuffle: YouTube's built-in one is unreliable in embeds (it often
  // keeps the original order or repeats songs). Shuffle is on when you turned
  // it on, or once after a fallback replay.
  function shuffleActive() {
    return shuffleRef.current || reshuffleRef.current;
  }

  // Songs in this list that haven't played yet (the intro song never repeats).
  function unplayed(): number[] {
    const ids = listIds();
    const cur = curIndex();
    const out: number[] = [];
    ids.forEach((id, i) => {
      if (i === cur || playedRef.current.has(i)) return;
      if (blockedIdsRef.current.has(id)) return; // never pick a blocked song
      if (id === INTRO_VIDEO_ID && modeRef.current === "rebel") return;
      out.push(i);
    });
    return out;
  }

  function isLastInList() {
    if (!hasPlaylist()) return false;
    if (shuffleActive()) return unplayed().length === 0;
    return curIndex() >= listIds().length - 1;
  }

  function playRandom() {
    const left = unplayed();
    if (!left.length) return false;
    const pick = left[Math.floor(Math.random() * left.length)];
    playerRef.current?.playVideoAt?.(pick);
    return true;
  }

  // Go to the next song in the current order (shuffled or not).
  function advance() {
    if (shuffleActive()) return playRandom();
    playerRef.current?.nextVideo?.();
    return true;
  }

  // Fresh list loaded: forget what played in the old one.
  function resetQueue() {
    playedRef.current = new Set();
    historyRef.current = [];
    justLoadedRef.current = true;
  }

  function clearTimers() {
    if (advanceTimerRef.current) window.clearTimeout(advanceTimerRef.current);
    if (mixWatchRef.current) window.clearTimeout(mixWatchRef.current);
    advanceTimerRef.current = null;
    mixWatchRef.current = null;
  }

  // Load the Media Player playlist (from the top; shuffle picks the first song).
  function loadRebel(skipIntro = false) {
    clearTimers();
    modeRef.current = "rebel";
    skipIntroRef.current = skipIntro;
    resetQueue();
    playerRef.current?.loadPlaylist?.({ list: PLAYLIST_ID, listType: "playlist", index: 0 });
    if (unlockedRef.current) playerRef.current?.unMute?.();
  }

  // Endless radio: a YouTube Mix of similar songs. If you've set seed songs in
  // MIX_SEEDS, mixes rotate through them so the radio covers all those artists;
  // otherwise the mix follows the song that just played.
  function startMix(seedId?: string) {
    let seed = seedId || currentId() || INTRO_VIDEO_ID;
    // never build a mix around a blocked song
    if (blockedIdsRef.current.has(seed)) seed = lastGoodIdRef.current;
    if (MIX_SEEDS.length) {
      seed = MIX_SEEDS[mixSeedRef.current % MIX_SEEDS.length];
      mixSeedRef.current += 1;
    }
    clearTimers();
    modeRef.current = "mix";
    skipIntroRef.current = false;
    reshuffleRef.current = false;
    resetQueue();
    playerRef.current?.loadPlaylist?.({ list: `RD${seed}`, listType: "playlist", index: 0 });
    if (unlockedRef.current) playerRef.current?.unMute?.();
    // Some mixes aren't allowed in embeds. If it doesn't start, keep the music
    // going with the Media Player playlist on shuffle instead.
    mixWatchRef.current = window.setTimeout(() => {
      const state = playerRef.current?.getPlayerState?.();
      if (modeRef.current === "mix" && (!hasPlaylist() || state === -1 || state === 0 || state === 5)) {
        fallbackToRebel();
      }
    }, 8000);
  }

  function fallbackToRebel() {
    // A mix couldn't embed (common on mobile). Don't force-shuffle the replay —
    // respect the user's shuffle toggle — and remember mixes don't work here so
    // we don't keep retrying (and re-shuffling) every time the playlist ends.
    mixDisabledRef.current = true;
    reshuffleRef.current = false;
    loadRebel(false);
  }

  // Special day: start the day's song over from the top.
  function replaySpecial() {
    const p = playerRef.current;
    if (!p) return;
    if (currentId() === INTRO_VIDEO_ID && !hasPlaylist()) {
      p.seekTo?.(0, true);
      p.playVideo?.();
    } else {
      clearTimers();
      modeRef.current = "intro";
      p.loadVideoById?.(INTRO_VIDEO_ID);
    }
    if (unlockedRef.current) p.unMute?.();
  }

  // A song finished (or was skipped past the end).
  function onSongEnded() {
    const p = playerRef.current;
    if (!p) return;
    if (REPEAT_ALL_DAY && !specialFailedRef.current) {
      replaySpecial(); // Halloween: Thriller on repeat
      return;
    }
    if (modeRef.current === "intro" || !hasPlaylist()) {
      loadRebel(true); // intro song done: start the playlist
      return;
    }
    if (isLastInList()) {
      // Playlist done: keep the radio going with a Mix of similar songs. If
      // mixes can't embed here (mobile), just loop the Media Player playlist.
      if (mixDisabledRef.current) loadRebel(false);
      else startMix(currentId());
      return;
    }
    // Shuffle: we choose the next song ourselves.
    if (shuffleActive()) {
      playRandom();
      return;
    }
    // In order: YouTube moves to the next song by itself. Only nudge it if it
    // stalls, so a song is never skipped twice.
    if (advanceTimerRef.current) window.clearTimeout(advanceTimerRef.current);
    advanceTimerRef.current = window.setTimeout(() => {
      if (p.getPlayerState?.() === 0) p.nextVideo?.();
    }, 1500);
  }

  // A song can't play in the embed: skip just that song, never restart the list.
  function onSongError() {
    // The day's special song can't play here: fall back to the normal music.
    if (REPEAT_ALL_DAY && modeRef.current === "intro") specialFailedRef.current = true;
    errorCountRef.current += 1;
    if (errorCountRef.current > 6) {
      // too many in a row: stop trying so it can't loop forever
      if (modeRef.current === "mix") fallbackToRebel();
      return;
    }
    if (modeRef.current === "intro") return loadRebel(true);
    if (modeRef.current === "mix" && !hasPlaylist()) return fallbackToRebel();
    playedRef.current.add(curIndex()); // the broken song counts as done
    if (isLastInList()) return onSongEnded();
    advance();
  }

  function next() {
    const p = playerRef.current;
    if (!p || !readyRef.current) return startPlay(); // not loaded yet: just start the radio
    wantPlayRef.current = true;
    unlockedRef.current = true;
    p.unMute?.();
    if (REPEAT_ALL_DAY && !specialFailedRef.current) return replaySpecial(); // only Thriller today
    if (modeRef.current === "intro" || !hasPlaylist()) loadRebel(true);
    else if (isLastInList()) {
      if (mixDisabledRef.current) loadRebel(false);
      else startMix(currentId());
    } else advance();
  }

  function toggleShuffle() {
    const on = !shuffleRef.current;
    shuffleRef.current = on;
    reshuffleRef.current = false;
    setShuffleOn(on);
    // Nothing else to do: the very next song (skip or song end) follows the new setting.
  }

  function prev() {
    const p = playerRef.current;
    if (!p || !readyRef.current) return ensurePlayer();
    if (unlockedRef.current) p.unMute?.();
    // More than ~3s into the song: restart it. Otherwise go back to the song
    // you actually heard before this one (works with shuffle too).
    const t = typeof p.getCurrentTime === "function" ? p.getCurrentTime() : 0;
    const h = historyRef.current;
    if (t > 3 || !hasPlaylist() || h.length < 2) {
      p.seekTo?.(0, true);
      return;
    }
    h.pop(); // drop the current song
    p.playVideoAt?.(h[h.length - 1]);
  }

  function setVolume(v: number) {
    setVol(v);
    volRef.current = v;
    const p = playerRef.current;
    p?.setVolume?.(v);
    // dragging to 0 mutes; dragging back up unmutes (only after Play was pressed)
    if (v === 0) p?.mute?.();
    else if (unlockedRef.current) p?.unMute?.();
  }

  // YouTube is loaded only once the visitor reaches for the radio (points at
  // or taps the player, presses Play, or turns the video on). YouTube's script
  // sets its cookies, so visitors who never use the radio get none.
  function ensurePlayer() {
    if (ytInitRef.current) return;
    ytInitRef.current = true;
    loadYT()
      .then((YT) => {
        if (!hostRef.current || playerRef.current) return;
        // On a special day load that single intro video; on any other day load
        // the Media Player playlist directly via playerVars (it's cued, since
        // autoplay is 0, so the visitor's first Play starts the radio). Loading
        // the list this way is the documented playlist-embed path and avoids
        // needing an empty/placeholder video before cueing.
        playerRef.current = new YT.Player(hostRef.current, {
          // YouTube's privacy-enhanced mode: no YouTube cookies are stored
          // for visitors until they actually play something.
          host: "https://www.youtube-nocookie.com",
          width: "100%",
          height: "100%",
          ...(INTRO_VIDEO_ID ? { videoId: INTRO_VIDEO_ID } : {}),
          playerVars: {
            autoplay: 0,
            controls: 0, // no YouTube control bar; the player has its own controls
            modestbranding: 1,
            rel: 0,
            iv_load_policy: 3, // no video annotations
            playsinline: 1,
            ...(INTRO_VIDEO_ID ? {} : { list: PLAYLIST_ID, listType: "playlist" }),
          },
          events: {
            onReady: () => {
              readyRef.current = true;
              // No fixed intro today: the playlist is already loaded (cued) via
              // playerVars. Mark a fresh list so shuffle can pick the first song.
              // Do NOT auto-start — the user presses Play.
              if (!INTRO_VIDEO_ID) {
                modeRef.current = "rebel";
                resetQueue();
              }
              // Play was pressed while YouTube was still loading: start now.
              if (wantPlayRef.current) {
                const p = playerRef.current;
                p?.unMute?.();
                p?.setVolume?.(volRef.current);
                p?.playVideo?.();
              }
            },
            onStateChange: (e: any) => {
              setPlaying(e.data === 1);
              try {
                const d = playerRef.current?.getVideoData?.();
                const low = (d?.title || "").toLowerCase();
                // don't even flash a blocked song's name in the player
                if (d?.title && !BLOCKED_TITLES.some((w) => low.includes(w))) setTitle(d.title);
              } catch { /* ignore */ }
              const p = playerRef.current;
              // Blocked song: skip it the moment it loads, before it plays.
              try {
                if (e.data === 1 || e.data === 3 || e.data === -1 || e.data === 5) {
                  const t = (p?.getVideoData?.()?.title || "").toLowerCase();
                  const id = currentId();
                  if (id && (blockedIdsRef.current.has(id) || BLOCKED_TITLES.some((w) => t.includes(w)))) {
                    blockedIdsRef.current.add(id);
                    playedRef.current.add(curIndex());
                    justLoadedRef.current = false;
                    if (modeRef.current === "intro" || !hasPlaylist()) loadRebel(true);
                    else if (isLastInList()) onSongEnded();
                    else advance();
                    return;
                  }
                  if (e.data === 1 && id) lastGoodIdRef.current = id;
                }
              } catch { /* ignore */ }
              try {
                // A song is playing: the queue is healthy again.
                if (e.data === 1) {
                  errorCountRef.current = 0;
                  // keep your volume when a new song starts (YouTube can reset it)
                  if (p.getVolume?.() !== volRef.current) p.setVolume?.(volRef.current);
                  if (mixWatchRef.current) window.clearTimeout(mixWatchRef.current);
                  mixWatchRef.current = null;
                }
                if (hasPlaylist() && currentId()) {
                  // A new list just loaded at its first song.
                  if (justLoadedRef.current) {
                    justLoadedRef.current = false;
                    const first = curIndex();
                    if (shuffleActive()) {
                      // shuffle: start on a random song instead of song 1
                      if (playRandom()) return;
                    } else if (skipIntroRef.current && currentId() === INTRO_VIDEO_ID && first < listIds().length - 1) {
                      // the intro song may also be in the playlist: don't play it twice
                      skipIntroRef.current = false;
                      p.nextVideo?.();
                      return;
                    }
                    skipIntroRef.current = false;
                  }
                  // Remember what actually played (for shuffle and for Back).
                  if (e.data === 1) {
                    const i = curIndex();
                    playedRef.current.add(i);
                    const h = historyRef.current;
                    if (h[h.length - 1] !== i) h.push(i);
                  }
                }
              } catch { /* ignore */ }
              if (e.data === 0) {
                try {
                  onSongEnded();
                } catch { /* ignore */ }
              }
            },
            onError: () => {
              try {
                onSongError();
              } catch { /* ignore */ }
            },
          },
        });
      })
      .catch(() => {
        ytInitRef.current = false; // blocked or offline: try again next time
      });
  }

  // turning the video on loads YouTube too (it shows the video window)
  useEffect(() => {
    if (showVideo) ensurePlayer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showVideo]);

  useEffect(() => {
    const onPlay = () => startPlay();
    const onPause = () => pausePlay();
    const onToggle = () => {
      const p = playerRef.current;
      if (p && p.getPlayerState?.() === 1) pausePlay();
      else startPlay();
    };
    const onVolume = (e: Event) => {
      const v = (e as CustomEvent<number>).detail;
      if (typeof v === "number") setVolume(v);
    };
    const onNext = () => next();
    const onPrev = () => prev();
    const onVideo = (e: Event) => {
      const on = (e as CustomEvent<boolean>).detail;
      setShowVideo((prev) => (typeof on === "boolean" ? on : !prev));
    };
    const onIntro = (e: Event) => {
      const on = (e as CustomEvent<boolean>).detail;
      setIntroMode(!!on);
    };
    window.addEventListener("rebel-intro-mode", onIntro as EventListener);
    window.addEventListener("rebel-play-music", onPlay as EventListener);
    window.addEventListener("rebel-pause-music", onPause as EventListener);
    window.addEventListener("rebel-toggle-music", onToggle as EventListener);
    window.addEventListener("rebel-set-volume", onVolume as EventListener);
    window.addEventListener("rebel-next-track", onNext as EventListener);
    window.addEventListener("rebel-prev-track", onPrev as EventListener);
    window.addEventListener("rebel-toggle-video", onVideo as EventListener);

    return () => {
      clearTimers();
      window.removeEventListener("rebel-play-music", onPlay as EventListener);
      window.removeEventListener("rebel-pause-music", onPause as EventListener);
      window.removeEventListener("rebel-toggle-music", onToggle as EventListener);
      window.removeEventListener("rebel-set-volume", onVolume as EventListener);
      window.removeEventListener("rebel-next-track", onNext as EventListener);
      window.removeEventListener("rebel-prev-track", onPrev as EventListener);
      window.removeEventListener("rebel-toggle-video", onVideo as EventListener);
      window.removeEventListener("rebel-intro-mode", onIntro as EventListener);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- drag (pointer capture so the iframe can't swallow the drop) ---
  function onDragStart(e: React.PointerEvent) {
    if (introMode || isPhone) return; // no dragging during the intro or on phones/tablets
    // Let buttons in the header (minimize, play) get their clicks; only drag
    // when grabbing the bar itself.
    if ((e.target as HTMLElement).closest("button")) return;
    const base = pos ?? { x: 24, y: window.innerHeight - 180 };
    dragRef.current = { dx: e.clientX - base.x, dy: e.clientY - base.y };
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* */ }
  }
  function onDragMove(e: React.PointerEvent) {
    if (introMode || !dragRef.current) return;
    const el = (e.currentTarget as HTMLElement).closest(".fixed") as HTMLElement | null;
    const cardW = el?.offsetWidth ?? 288;
    const cardH = el?.offsetHeight ?? 160;
    const margin = 8;
    const maxX = window.innerWidth - cardW - margin;
    const maxY = window.innerHeight - cardH - margin;
    const nx = Math.min(Math.max(e.clientX - dragRef.current.dx, margin), Math.max(maxX, margin));
    const ny = Math.min(Math.max(e.clientY - dragRef.current.dy, margin), Math.max(maxY, margin));
    setPos({ x: nx, y: ny });
  }
  function onDragEnd(e: React.PointerEvent) {
    dragRef.current = null;
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* */ }
  }

  const activeLight = (
    <span
      title={playing ? "Playing" : "Paused"}
      className={`h-2.5 w-2.5 rounded-full ${playing ? "bg-emerald-400 pulse-dot shadow-[0_0_8px_#34d399]" : "bg-ash"}`}
    />
  );

  // In intro mode the card is fixed, anchored by its TOP (lower-center) so that
  // opening the video grows the card DOWNWARD, away from the logo above it.
  // User-resizable video (16:9). Capped to the viewport so it always fits,
  // and shorter when the window is small so the whole card stays on screen.
  const DIMS = DIMS_ALL;
  const vw = vp.w;
  // Width capped to the viewport, and also to the screen HEIGHT so the whole
  // card (controls ~150px + video) fits on short screens like sideways phones.
  const maxByHeight = Math.max(160, (vp.h - 170) / 0.62);
  const smW = Math.min(DIMS.sm, vw - 32, maxByHeight);
  // Laptops: MD/LG are wider but exactly as tall as SM, and never wider than
  // the gap between the intro's side cards (16px clear of each card).
  const LAPTOP_DIMS = { sm: smW, md: 420, lg: 420 } as const; // LG = MD on laptops
  const laptopRoom = vw - 2 * cardsEdge - 32;
  const vidW = isLaptop
    ? Math.max(smW, Math.min(LAPTOP_DIMS[videoSize], laptopRoom))
    : Math.min(DIMS[videoSize], vw - 32, maxByHeight);
  // Balanced height — fuller than 16:9 but not a tall strip. ~0.62x width.
  // (Laptops keep SM's height at every size.)
  const vidH = Math.round((isLaptop ? smW : vidW) * 0.62);

  // Bigger, readable text whenever the video window is open (scales up with the
  // size; still fits on phones — the card width is capped and the title truncates).
  // On laptops the text stays at the SM size too, so the card doesn't grow taller.
  const textSize = isLaptop ? "sm" : videoSize;
  const titleSize = !showVideo ? "text-[11px]" : textSize === "lg" ? "text-lg" : textSize === "md" ? "text-base" : "text-sm";
  const metaSize = !showVideo ? "text-[11px]" : textSize === "lg" ? "text-sm" : textSize === "md" ? "text-xs" : "text-[11px]";
  const btnSize = !showVideo ? "text-[10px]" : textSize === "lg" ? "text-xs" : textSize === "md" ? "text-[11px]" : "text-[10px]";

  // Rough height of the whole card so we can anchor it by its TOP and keep it
  // low on screen. Growing the video then expands the card DOWNWARD instead of
  // climbing up over page content. ~150px of chrome (header/title/controls/footer)
  // plus the video window when it's showing.
  const chromeH = 150;
  const estCardH = chromeH + (showVideo ? vidH : 0);
  const vhNow = vp.h;
  // Keep the card bottom ~24px above the viewport bottom; clamp the top so the
  // card never runs off the top edge on big (lg) video sizes.
  const defaultTop = Math.max(16, vhNow - estCardH - 24);

  const cardStyle: React.CSSProperties = inFlow
    ? // phones/tablets upright on the intro: at the end of the page, lined up
      // with its spot there (top is set by the scroll sync above); it passes
      // under the bottom ticker as the page scrolls
      { left: "50%", transform: "translateX(-50%)", zIndex: 115 }
    : introMode
    ? isSideways(vp.w, vp.h)
      ? { right: 8, bottom: 48, zIndex: 130 } // sideways phone: above the bottom ticker
      : { left: "50%", bottom: 48, transform: "translateX(-50%)", zIndex: 130 } // centered, above the bottom ticker
    : isPhone
    ? { left: "50%", bottom: 8, transform: "translateX(-50%)", zIndex: 50 } // phones + tablets: locked at the bottom
    : pos
    ? { left: pos.x, top: pos.y, zIndex: 50 }
    : { left: 24, top: defaultTop, zIndex: 50 };

  return (
    <div
      ref={cardRef}
      data-circuit-avoid="player"
      className="fixed"
      style={cardStyle}
      // reaching for the radio starts loading YouTube, so Play is quick
      onPointerEnter={ensurePlayer}
      onPointerDown={ensurePlayer}
      onFocus={ensurePlayer}
    >
        {/* The card is ALWAYS mounted, so the music never stops. Its smallest
            size is the standard audio-only player; minimize just closes the video. */}
        <div
          className="overflow-hidden rounded-xl border border-silver/20 bg-coal shadow-card"
          style={{ width: showVideo ? Math.max(vidW, 288) : 288 /* min 288 so controls never squish */ }}
        >
          {/* Draggable header */}
          <div
            onPointerDown={onDragStart}
            onPointerMove={onDragMove}
            onPointerUp={onDragEnd}
            className={`flex touch-none items-center justify-between border-b border-white/10 bg-ink/80 px-3 py-2 ${
              introMode || isPhone ? "cursor-default" : "cursor-grab active:cursor-grabbing"
            }`}
          >
            <span className="flex items-center gap-2 font-display text-xs font-semibold uppercase tracking-wider text-silver">
              {activeLight}
              Media Player
            </span>
            {/* Minimize = close the video and go back to the standard player.
                It never shrinks smaller than that and never stops the music. */}
            <button
              onClick={() => setShowVideo(false)}
              disabled={!showVideo}
              aria-label="Minimize player"
              title={showVideo ? "Minimize" : "Already minimized"}
              className="flex h-6 w-6 items-center justify-center rounded text-ash transition hover:bg-white/5 hover:text-silver disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-ash"
            >
              —
            </button>
          </div>

          {/* Video window (attached) — collapses to 0 height in audio mode but
              the iframe is NEVER unmounted, so audio keeps playing. */}
          <div
            ref={videoWrapRef}
            className="rwd-yt-host"
            style={{
              height: showVideo ? vidH : 0,
              width: "100%",
              transition: "height 0.2s ease",
              overflow: "hidden",
              background: "#000",
              position: "relative",
            }}
          >
            <div ref={hostRef} />
            {/* Clear layer over the video: YouTube's own buttons/title bar don't
                pop up on hover, and a click plays/pauses (the Media Player's own
                controls below still do everything). */}
            <div
              onClick={() => (playing ? pausePlay() : startPlay())}
              title={playing ? "Pause" : "Play"}
              aria-hidden="true"
              className="absolute inset-0 z-10 cursor-pointer"
            />
            {/* exit button while full screen (touch screens have no Esc key) */}
            {isFullscreen && (
              <button
                onClick={toggleFullscreen}
                aria-label="Exit full screen"
                title="Exit full screen (Esc)"
                className="absolute right-4 top-4 z-20 flex h-11 w-11 items-center justify-center rounded-full border border-silver/30 bg-coal/80 text-silver transition hover:border-blood/60 hover:text-white"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
                </svg>
              </button>
            )}
          </div>

          {/* Title */}
          <div className={`truncate px-3 pt-2 ${titleSize} text-ash`} title={title}>
            {playing ? "♪ " : ""}{title}
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2 px-3 py-3">
            <button
              onClick={prev}
              aria-label="Previous track"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-silver/30 text-silver transition hover:border-blood/60"
            >
              {/* drawn icons, not text symbols: phones turn those into colored emoji */}
              <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
                <path d="M6 5h2v14H6zM20 5v14L9 12z" />
              </svg>
            </button>
            <button
              onClick={() => (playing ? pausePlay() : startPlay())}
              aria-label={playing ? "Pause" : "Play"}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-ember to-blood text-white shadow-[0_0_12px_rgba(225,29,42,0.45)] transition hover:brightness-110"
            >
              {playing ? (
                <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
                  <path d="M7 5h4v14H7zM13 5h4v14h-4z" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" className="ml-0.5 h-4 w-4 fill-current" aria-hidden="true">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>
            <button
              onClick={next}
              aria-label="Next track"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-silver/30 text-silver transition hover:border-blood/60"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
                <path d="M16 5h2v14h-2zM4 5l11 7-11 7z" />
              </svg>
            </button>
            <button
              onClick={toggleShuffle}
              aria-label={shuffleOn ? "Shuffle on" : "Shuffle off"}
              aria-pressed={shuffleOn}
              title={shuffleOn ? "Shuffle on" : "Shuffle off"}
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition ${
                shuffleOn
                  ? "border-blood/70 text-ember shadow-[0_0_10px_rgba(225,29,42,0.45)]"
                  : "border-silver/30 text-silver hover:border-blood/60"
              }`}
            >
              {/* shuffle arrows */}
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M16 3h5v5" />
                <path d="M4 20 21 3" />
                <path d="M21 16v5h-5" />
                <path d="M15 15l6 6" />
                <path d="M4 4l5 5" />
              </svg>
            </button>
            <input
              type="range"
              min={0}
              max={100}
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              aria-label="Volume"
              aria-valuetext={`${volume}%`}
              title={`Volume ${volume}%`}
              className="rwd-range ml-1 w-full min-w-0 flex-1"
              // red fill up to the circle, dark track after it
              style={{ backgroundImage: `linear-gradient(to right, #e11d2a 0%, #ff3b3f ${volume}%, #0a0a0b ${volume}%, #0a0a0b 100%)` }}
            />
          </div>

          {/* Audio / Video toggle + size controls */}
          <div className={`flex items-center justify-between border-t border-white/10 px-3 py-2 ${metaSize}`}>
            <span className="font-semibold uppercase tracking-wider text-ash">
              {showVideo ? "Video" : "Audio only"}
            </span>
            <div className="flex items-center gap-2">
              {showVideo && (
                <div className="flex items-center gap-1" aria-label="Video size">
                  {sizeOptions.map((s) => (
                    <button
                      key={s}
                      onClick={() => setVideoSize(s)}
                      aria-label={`Size ${s}`}
                      aria-pressed={chosenSize === s}
                      className={`rounded px-1.5 py-0.5 ${btnSize} font-bold uppercase transition ${
                        chosenSize === s
                          ? "bg-blood text-white"
                          : "border border-silver/30 text-ash hover:text-silver"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
              {showVideo && canFullscreen && (
                <button
                  onClick={toggleFullscreen}
                  aria-label="Full screen video"
                  title="Full screen"
                  className="flex h-6 w-6 items-center justify-center rounded border border-silver/30 text-ash transition hover:text-silver"
                >
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
                  </svg>
                </button>
              )}
              <button
                role="switch"
                aria-checked={showVideo}
                aria-label="Toggle video"
                onClick={() => setShowVideo((v) => !v)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${showVideo ? "bg-blood" : "bg-ink border border-silver/30"}`}
              >
                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-silver transition-transform ${showVideo ? "translate-x-5" : "translate-x-0.5"}`} />
              </button>
            </div>
          </div>
        </div>
    </div>
  );
}
