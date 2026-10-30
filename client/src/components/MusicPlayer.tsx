import { useEffect, useRef, useState } from "react";
import { isSideways } from "./Intro";

/**
 * Rebel Radio — one self-contained, draggable player card shown on every page
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
const PLAYLIST_ID = "PLDIoUOhQQPlXFSnCfj8HuVhOUSC0QwxYD";
const INTRO_VIDEO_ID = "YNwmYliuUfE";

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

export default function MusicPlayer() {
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const readyRef = useRef(false);
  const unlockedRef = useRef(false);
  const wantPlayRef = useRef(false);
  const shuffleRef = useRef(false); // read inside YouTube callbacks
  const shuffleAppliedRef = useRef(false); // has YouTube's shuffle been set on this playlist?
  const [shuffleOn, setShuffleOn] = useState(false);
  const modeRef = useRef<"intro" | "rebel" | "mix">("intro"); // what's queued now
  const skipIntroRef = useRef(false); // skip the intro song if it's also in the playlist
  const shuffleOnceRef = useRef(false); // shuffle the next playlist load once
  const errorCountRef = useRef(0); // songs in a row that couldn't play
  const advanceTimerRef = useRef<number | null>(null);
  const mixWatchRef = useRef<number | null>(null);

  const [playing, setPlaying] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const [videoSize, setVideoSize] = useState<"sm" | "md" | "lg">("sm"); // user-resizable
  // Read the intro flag synchronously so there's no race with the intro's event.
  const [introMode, setIntroMode] = useState<boolean>(() => !!(window as any).__rebelIntro);
  const [title, setTitle] = useState("Rebel Radio");
  const [volume, setVol] = useState(15); // soft default so it doesn't blast visitors
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

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
    const p = playerRef.current;
    if (!readyRef.current || !p) return;
    p.unMute?.();
    p.setVolume?.(volume);
    p.playVideo?.();
  }

  function pausePlay() {
    wantPlayRef.current = false;
    playerRef.current?.pauseVideo?.();
  }

  // ---------------- Playback queue ----------------
  // "intro" = the single intro song, "rebel" = the Rebel Radio playlist,
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

  function isLastInList() {
    const p = playerRef.current;
    if (!hasPlaylist()) return false;
    const list = p.getPlaylist();
    const idx = p.getPlaylistIndex?.() ?? 0;
    return idx >= list.length - 1;
  }

  function clearTimers() {
    if (advanceTimerRef.current) window.clearTimeout(advanceTimerRef.current);
    if (mixWatchRef.current) window.clearTimeout(mixWatchRef.current);
    advanceTimerRef.current = null;
    mixWatchRef.current = null;
  }

  // Load the Rebel Radio playlist. Loading resets YouTube's shuffle order, so
  // shuffle is re-applied once it's ready (see onStateChange).
  function loadRebel(skipIntro = false) {
    clearTimers();
    modeRef.current = "rebel";
    skipIntroRef.current = skipIntro;
    shuffleAppliedRef.current = false;
    playerRef.current?.loadPlaylist?.({ list: PLAYLIST_ID, listType: "playlist", index: 0 });
    if (unlockedRef.current) playerRef.current?.unMute?.();
  }

  // Endless radio: a YouTube Mix of songs like the one that just played.
  function startMix(seedId?: string) {
    const seed = seedId || currentId() || INTRO_VIDEO_ID;
    clearTimers();
    modeRef.current = "mix";
    skipIntroRef.current = false;
    shuffleAppliedRef.current = false;
    playerRef.current?.loadPlaylist?.({ list: `RD${seed}`, listType: "playlist", index: 0 });
    if (unlockedRef.current) playerRef.current?.unMute?.();
    // Some mixes aren't allowed in embeds. If it doesn't start, keep the music
    // going with the Rebel Radio playlist on shuffle instead.
    mixWatchRef.current = window.setTimeout(() => {
      const state = playerRef.current?.getPlayerState?.();
      if (modeRef.current === "mix" && (!hasPlaylist() || state === -1 || state === 0 || state === 5)) {
        fallbackToRebel();
      }
    }, 8000);
  }

  function fallbackToRebel() {
    shuffleOnceRef.current = true; // replay it in a fresh order
    loadRebel(false);
  }

  // A song finished (or was skipped past the end).
  function onSongEnded() {
    const p = playerRef.current;
    if (!p) return;
    if (modeRef.current === "intro" || !hasPlaylist()) {
      loadRebel(true); // intro song done: start the playlist
      return;
    }
    if (isLastInList()) {
      startMix(currentId()); // playlist done: keep playing similar music
      return;
    }
    // YouTube moves to the next song by itself. Only nudge it if it stalls,
    // so a song is never skipped twice.
    if (advanceTimerRef.current) window.clearTimeout(advanceTimerRef.current);
    advanceTimerRef.current = window.setTimeout(() => {
      if (p.getPlayerState?.() === 0) p.nextVideo?.();
    }, 1500);
  }

  // A song can't play in the embed: skip just that song, never restart the list.
  function onSongError() {
    errorCountRef.current += 1;
    if (errorCountRef.current > 6) {
      // too many in a row: stop trying so it can't loop forever
      if (modeRef.current === "mix") fallbackToRebel();
      return;
    }
    if (modeRef.current === "intro") return loadRebel(true);
    if (modeRef.current === "mix" && !hasPlaylist()) return fallbackToRebel();
    if (isLastInList()) return onSongEnded();
    playerRef.current?.nextVideo?.();
  }

  function next() {
    const p = playerRef.current;
    if (!p || !readyRef.current) return;
    wantPlayRef.current = true;
    unlockedRef.current = true;
    p.unMute?.();
    if (modeRef.current === "intro" || !hasPlaylist()) loadRebel(true);
    else if (isLastInList()) startMix(currentId());
    else p.nextVideo?.();
  }

  function toggleShuffle() {
    const on = !shuffleRef.current;
    shuffleRef.current = on;
    setShuffleOn(on);
    // If the playlist is already loaded, shuffle it right away. Otherwise it's
    // applied as soon as the playlist loads (see onStateChange).
    if (readyRef.current && hasPlaylist()) {
      playerRef.current.setShuffle?.(on);
      shuffleAppliedRef.current = on;
    }
  }

  function prev() {
    const p = playerRef.current;
    if (!p || !readyRef.current) return;
    if (unlockedRef.current) p.unMute?.();
    // If we're more than ~3s into the track, restart it; otherwise go back a track.
    const t = typeof p.getCurrentTime === "function" ? p.getCurrentTime() : 0;
    if (t > 3) {
      p.seekTo?.(0, true);
    } else if (typeof p.getPlaylist === "function" && p.getPlaylist()) {
      p.previousVideo?.();
    } else {
      p.seekTo?.(0, true);
    }
  }

  function setVolume(v: number) {
    setVol(v);
    playerRef.current?.setVolume?.(v);
  }

  useEffect(() => {
    let cancelled = false;
    loadYT()
      .then((YT) => {
        if (cancelled || !hostRef.current || playerRef.current) return;
        playerRef.current = new YT.Player(hostRef.current, {
          width: "100%",
          height: "100%",
          videoId: INTRO_VIDEO_ID,
          playerVars: { autoplay: 0, controls: 1, modestbranding: 1, rel: 0, playsinline: 1 },
          events: {
            onReady: () => {
              readyRef.current = true;
              // Do NOT auto-start — the user presses Play.
            },
            onStateChange: (e: any) => {
              setPlaying(e.data === 1);
              try {
                const d = playerRef.current?.getVideoData?.();
                if (d?.title) setTitle(d.title);
              } catch { /* ignore */ }
              const p = playerRef.current;
              try {
                // A song is playing: the queue is healthy again.
                if (e.data === 1) {
                  errorCountRef.current = 0;
                  if (mixWatchRef.current) window.clearTimeout(mixWatchRef.current);
                  mixWatchRef.current = null;
                }
                // Shuffle (yours, or a one-time reshuffle) once the playlist exists.
                if ((shuffleRef.current || shuffleOnceRef.current) && !shuffleAppliedRef.current && hasPlaylist()) {
                  p.setShuffle?.(true);
                  shuffleAppliedRef.current = true;
                  shuffleOnceRef.current = false;
                }
                // The intro song may also be in the playlist: don't play it twice.
                if (skipIntroRef.current && hasPlaylist() && currentId()) {
                  skipIntroRef.current = false;
                  if (currentId() === INTRO_VIDEO_ID && !isLastInList()) p.nextVideo?.();
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
      .catch(() => { /* API blocked */ });

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
      cancelled = true;
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
    if (introMode) return; // no dragging during the intro
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
  const DIMS = { sm: 240, md: 340, lg: 460 } as const;
  const vw = vp.w;
  // Width capped to the viewport, and also to the screen HEIGHT so the whole
  // card (controls ~150px + video) fits on short screens like sideways phones.
  const maxByHeight = Math.max(160, (vp.h - 170) / 0.62);
  const vidW = Math.min(DIMS[videoSize], vw - 32, maxByHeight);
  // Balanced height — fuller than 16:9 but not a tall strip. ~0.62x width.
  const vidH = Math.round(vidW * 0.62);

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

  const cardStyle: React.CSSProperties = introMode
    ? isSideways(vp.w, vp.h)
      ? { right: 8, bottom: 8, zIndex: 130 } // sideways phone: corner, beside the text
      : { left: "50%", bottom: 8, transform: "translateX(-50%)", zIndex: 130 } // centered, low
    : pos
    ? { left: pos.x, top: pos.y, zIndex: 50 }
    : { left: 24, top: defaultTop, zIndex: 50 };

  return (
    <div ref={cardRef} className="fixed" style={cardStyle}>
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
              introMode ? "cursor-default" : "cursor-grab active:cursor-grabbing"
            }`}
          >
            <span className="flex items-center gap-2 font-display text-xs font-semibold uppercase tracking-wider text-silver">
              {activeLight}
              Rebel Radio
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
            className="rwd-yt-host"
            style={{
              height: showVideo ? vidH : 0,
              width: "100%",
              transition: "height 0.2s ease",
              overflow: "hidden",
              background: "#000",
            }}
          >
            <div ref={hostRef} />
          </div>

          {/* Title */}
          <div className="truncate px-3 pt-2 text-[11px] text-ash" title={title}>
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
              className="ml-1 h-1.5 w-full min-w-0 flex-1 cursor-pointer appearance-none rounded-full bg-ink accent-blood"
            />
          </div>

          {/* Audio / Video toggle + size controls */}
          <div className="flex items-center justify-between border-t border-white/10 px-3 py-2 text-[11px]">
            <span className="font-semibold uppercase tracking-wider text-ash">
              {showVideo ? "Video" : "Audio only"}
            </span>
            <div className="flex items-center gap-2">
              {showVideo && (
                <div className="flex items-center gap-1" aria-label="Video size">
                  {(["sm", "md", "lg"] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setVideoSize(s)}
                      aria-label={`Size ${s}`}
                      className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase transition ${
                        videoSize === s
                          ? "bg-blood text-white"
                          : "border border-silver/30 text-ash hover:text-silver"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
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
