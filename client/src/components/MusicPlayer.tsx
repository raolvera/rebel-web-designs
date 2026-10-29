import { useEffect, useRef, useState } from "react";

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

  const [playing, setPlaying] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const [videoSize, setVideoSize] = useState<"sm" | "md" | "lg">("sm"); // user-resizable
  const [collapsed, setCollapsed] = useState(false);
  // Read the intro flag synchronously so there's no race with the intro's event.
  const [introMode, setIntroMode] = useState<boolean>(() => !!(window as any).__rebelIntro);
  const [title, setTitle] = useState("Rebel Radio");
  const [volume, setVol] = useState(15); // soft default so it doesn't blast visitors
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // Report the card's real height (it changes with SM/MD/LG, video on/off,
  // minimize) so the intro can keep its text clear of the player.
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const report = () => {
      const h = el.offsetHeight;
      (window as any).__rebelPlayerH = h;
      window.dispatchEvent(new CustomEvent("rebel-player-size", { detail: h }));
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

  // Load (or reload) the Rebel Radio playlist. Loading resets YouTube's
  // shuffle order, so mark shuffle as "not applied" to re-apply it once ready.
  function loadList(index?: number) {
    shuffleAppliedRef.current = false;
    playerRef.current?.loadPlaylist?.({
      list: PLAYLIST_ID,
      listType: "playlist",
      ...(index !== undefined ? { index } : {}),
    });
  }

  function hasPlaylist() {
    const p = playerRef.current;
    return !!(p && typeof p.getPlaylist === "function" && p.getPlaylist());
  }

  function next() {
    const p = playerRef.current;
    if (!p || !readyRef.current) return;
    if (unlockedRef.current) p.unMute?.();
    if (hasPlaylist()) p.nextVideo?.();
    else loadList(1);
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
              // Shuffle was turned on before the playlist existed: apply it now.
              try {
                if (shuffleRef.current && !shuffleAppliedRef.current && hasPlaylist()) {
                  playerRef.current.setShuffle?.(true);
                  shuffleAppliedRef.current = true;
                }
              } catch { /* ignore */ }
              if (e.data === 0) {
                try {
                  loadList();
                } catch { /* ignore */ }
              }
            },
            onError: () => {
              // If the single video can't embed, fall back to the playlist.
              try {
                loadList();
                if (unlockedRef.current) playerRef.current?.unMute?.();
                playerRef.current?.playVideo?.();
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
      if (on) setCollapsed(false); // make sure the card is visible during the intro
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
  const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
  // Width capped to the viewport; height ALWAYS follows true 16:9 so it never
  // looks squished. (Width is what we constrain to keep it on screen.)
  const vidW = Math.min(DIMS[videoSize], vw - 32);
  // Balanced height — fuller than 16:9 but not a tall strip. ~0.62x width.
  const vidH = Math.round(vidW * 0.62);

  // Rough height of the whole card so we can anchor it by its TOP and keep it
  // low on screen. Growing the video then expands the card DOWNWARD instead of
  // climbing up over page content. ~150px of chrome (header/title/controls/footer)
  // plus the video window when it's showing.
  const chromeH = 150;
  const estCardH = chromeH + (showVideo ? vidH : 0);
  const vhNow = typeof window !== "undefined" ? window.innerHeight : 800;
  // Keep the card bottom ~24px above the viewport bottom; clamp the top so the
  // card never runs off the top edge on big (lg) video sizes.
  const defaultTop = Math.max(16, vhNow - estCardH - 24);

  const cardStyle: React.CSSProperties = introMode
    ? { left: "50%", bottom: 8, transform: "translateX(-50%)", zIndex: 130 } // centered, low
    : pos
    ? { left: pos.x, top: pos.y, zIndex: 50 }
    : { left: 24, top: defaultTop, zIndex: 50 };

  return (
    <div ref={cardRef} className="fixed" style={cardStyle}>
      {collapsed ? (
        <button
          onClick={() => setCollapsed(false)}
          aria-label="Open Rebel Radio"
          className="flex items-center gap-2 rounded-full border border-silver/30 bg-steel/90 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-silver shadow-card backdrop-blur transition hover:border-blood/60 hover:shadow-glow"
        >
          {activeLight}
          Rebel Radio
        </button>
      ) : (
        <div
          className="overflow-hidden rounded-xl border border-silver/20 bg-coal/95 shadow-card backdrop-blur"
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
            <button onClick={() => setCollapsed(true)} aria-label="Minimize" className="text-ash transition hover:text-silver">
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
              ⏮
            </button>
            <button
              onClick={() => (playing ? pausePlay() : startPlay())}
              aria-label={playing ? "Pause" : "Play"}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-plate to-silver text-base leading-none text-ink transition hover:from-white hover:to-plate"
            >
              {playing ? "⏸" : "▶"}
            </button>
            <button
              onClick={next}
              aria-label="Next track"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-silver/30 text-silver transition hover:border-blood/60"
            >
              ⏭
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
      )}
    </div>
  );
}
