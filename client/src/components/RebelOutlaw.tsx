import { useEffect, useRef, useState } from "react";

/**
 * Rebel Outlaw — a Wild West draw-shooter.
 * You're a rebel outlaw for good: gun down the outlaw cowboys, take their
 * bankroll, and give to the poor. Don't shoot the innocent townsfolk.
 * Fill the "Given to the poor" meter to trigger REBEL JUSTICE (rapid gold mode).
 *
 * Click / tap a target to shoot. Pure canvas, no external engine.
 */

type GameState = "ready" | "running" | "over";
type Kind = "outlaw" | "townsfolk";

interface Target {
  id: number;
  x: number;
  y: number;
  kind: Kind;
  t: number; // 0..1 pop progress
  up: boolean; // rising or sinking
  life: number; // ms visible
  fired: boolean; // outlaw has drawn
  dead?: boolean;
  name: string;
  bounty: number; // $ bounty for outlaws
  hatColor: string;
  shirtColor: string;
}

const HS_KEY = "rebelOutlawHighScore";

// Outlaw nicknames stitched into real API names → "Jesse 'Mad Dog' Carter"
const OUTLAW_NICKS = [
  "Mad Dog", "Snake Eyes", "Dead-Eye", "Black Jack", "Rattler",
  "Quickdraw", "Scar", "Ghost", "Coyote", "Iron", "Doc", "Six-Shooter",
];
const FALLBACK_NAMES = [
  'Jesse "Mad Dog" Carter', 'Cole "Dead-Eye" Barker', 'Wyatt "Snake Eyes" Lang',
  'Levi "Black Jack" Doyle', 'Hank "Rattler" Mercer', 'Silas "Ghost" Pruitt',
];
const HAT_COLORS = ["#111113", "#1c1a17", "#2a1a0a", "#3a2412"];
const SHIRT_COLORS = ["#4a2f1a", "#3a2a2f", "#2a2a38", "#402018"];

export default function RebelOutlaw() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<GameState>("ready");
  const [loot, setLoot] = useState(0);
  const [given, setGiven] = useState(0);
  const [health, setHealth] = useState(3);
  const [highScore, setHighScore] = useState(0);
  const [justice, setJustice] = useState(false);

  const [bountyList, setBountyList] = useState<string[]>([]);

  const stateRef = useRef<GameState>("ready");
  const rafRef = useRef<number>(0);
  const namePoolRef = useRef<string[]>([]);
  const bountyRef = useRef<string[]>([]);

  useEffect(() => {
    setHighScore(Number(localStorage.getItem(HS_KEY) || 0));
  }, []);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Pull real names to brand each outlaw as a WANTED man (randomuser.me, free).
  async function fillNamePool() {
    try {
      const res = await fetch("https://randomuser.me/api/?results=30&inc=name&nat=us");
      const data = await res.json();
      const names: string[] = (data.results || []).map(
        (r: any) => `${r.name.first} "${OUTLAW_NICKS[Math.floor(Math.random() * OUTLAW_NICKS.length)]}" ${r.name.last}`
      );
      if (names.length) namePoolRef.current = names;
    } catch {
      namePoolRef.current = FALLBACK_NAMES;
    }
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const W = 900;
    const H = 420;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    // --- Web Audio sound engine (synthesized, no files) ---
    let audio: AudioContext | null = null;
    function ac() {
      if (!audio) {
        const AC = window.AudioContext || (window as any).webkitAudioContext;
        if (AC) audio = new AC();
      }
      if (audio && audio.state === "suspended") audio.resume();
      return audio;
    }
    // Gunshot: sharp noise burst + low thump.
    function sfxShot() {
      const a = ac();
      if (!a) return;
      const now = a.currentTime;
      // noise crack
      const len = Math.floor(a.sampleRate * 0.18);
      const buf = a.createBuffer(1, len, a.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.5);
      const src = a.createBufferSource();
      src.buffer = buf;
      const ng = a.createGain();
      ng.gain.setValueAtTime(0.5, now);
      src.connect(ng).connect(a.destination);
      src.start(now);
      // low thump
      const osc = a.createOscillator();
      const og = a.createGain();
      osc.type = "square";
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.exponentialRampToValueAtTime(50, now + 0.12);
      og.gain.setValueAtTime(0.4, now);
      og.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
      osc.connect(og).connect(a.destination);
      osc.start(now);
      osc.stop(now + 0.18);
    }
    // Hit / "argh": a short descending tone — someone's been shot.
    function sfxHit(enemy: boolean) {
      const a = ac();
      if (!a) return;
      const now = a.currentTime;
      const osc = a.createOscillator();
      const g = a.createGain();
      osc.type = enemy ? "sawtooth" : "triangle";
      osc.frequency.setValueAtTime(enemy ? 420 : 300, now);
      osc.frequency.exponentialRampToValueAtTime(enemy ? 90 : 70, now + 0.32);
      g.gain.setValueAtTime(0.35, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.34);
      osc.connect(g).connect(a.destination);
      osc.start(now);
      osc.stop(now + 0.35);
    }
    // Coin / loot chime.
    function sfxCoin() {
      const a = ac();
      if (!a) return;
      const now = a.currentTime;
      [880, 1320].forEach((f, i) => {
        const osc = a.createOscillator();
        const g = a.createGain();
        osc.type = "square";
        osc.frequency.value = f;
        g.gain.setValueAtTime(0.12, now + i * 0.06);
        g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.06 + 0.12);
        osc.connect(g).connect(a.destination);
        osc.start(now + i * 0.06);
        osc.stop(now + i * 0.06 + 0.13);
      });
    }

    // Spots targets pop from (behind barrels / windows)
    const spots = [
      { x: 150, y: 250 }, { x: 320, y: 300 }, { x: 470, y: 240 },
      { x: 620, y: 300 }, { x: 760, y: 250 }, { x: 240, y: 180 },
      { x: 560, y: 180 }, { x: 680, y: 190 },
    ];

    let targets: Target[] = [];
    let particles: { x: number; y: number; vx: number; vy: number; life: number; color: string }[] = [];
    let floats: { x: number; y: number; text: string; color: string; life: number }[] = [];
    let nextId = 1;

    let localLoot = 0;
    let localGiven = 0;
    let localHealth = 3;
    let meter = 0; // 0..100 -> REBEL JUSTICE
    let justiceMs = 0;
    let spawnTimer = 0;
    let gameTime = 0;
    let shake = 0;
    let mouse = { x: W / 2, y: H / 2 };

    function reset() {
      targets = [];
      particles = [];
      floats = [];
      localLoot = 0;
      localGiven = 0;
      localHealth = 3;
      meter = 0;
      justiceMs = 0;
      spawnTimer = 0;
      gameTime = 0;
      shake = 0;
      bountyRef.current = [];
      setLoot(0);
      setGiven(0);
      setHealth(3);
      setJustice(false);
      setBountyList([]);
    }

    function spawn() {
      const spot = spots[Math.floor(Math.random() * spots.length)];
      // occupied? skip
      if (targets.some((t) => t.x === spot.x && t.y === spot.y && !t.dead)) return;
      const kind: Kind = Math.random() < 0.72 ? "outlaw" : "townsfolk";
      const life = Math.max(1700 - gameTime / 20, 850);
      const pool = namePoolRef.current;
      const name = pool.length
        ? pool[Math.floor(Math.random() * pool.length)]
        : 'Outlaw "Nameless" Doe';
      targets.push({
        id: nextId++, x: spot.x, y: spot.y, kind, t: 0, up: true,
        life, fired: false,
        name,
        bounty: 50 + Math.floor(Math.random() * 20) * 25,
        hatColor: HAT_COLORS[Math.floor(Math.random() * HAT_COLORS.length)],
        shirtColor: SHIRT_COLORS[Math.floor(Math.random() * SHIRT_COLORS.length)],
      });
    }

    function burst(x: number, y: number, color: string, n = 14) {
      for (let i = 0; i < n; i++) {
        particles.push({
          x, y, vx: (Math.random() - 0.5) * 8, vy: (Math.random() - 0.5) * 8,
          life: 1, color,
        });
      }
    }

    function float(x: number, y: number, text: string, color: string) {
      floats.push({ x, y, text, color, life: 1 });
    }

    function damage() {
      localHealth -= 1;
      shake = 16;
      setHealth(localHealth);
      sfxHit(false); // you've been shot
      burst(W / 2, H - 40, "#e11331", 20);
      if (localHealth <= 0) endGame();
    }

    function endGame() {
      setState("over");
      const sc = localLoot + localGiven * 2;
      const best = Math.max(sc, Number(localStorage.getItem(HS_KEY) || 0));
      localStorage.setItem(HS_KEY, String(best));
      setHighScore(best);
      setBountyList([...bountyRef.current]);
    }

    function tryUnleashJustice() {
      if (meter >= 100 && justiceMs <= 0) {
        justiceMs = 5000;
        meter = 0;
        setJustice(true);
        shake = 10;
      }
    }

    function shootAt(mx: number, my: number) {
      // muzzle flash + report
      sfxShot();
      burst(mx, my, justiceMs > 0 ? "#ffd23b" : "#e9ebee", 8);
      let hit = false;
      // Check targets front-to-back (lower on screen = nearer = priority)
      const ordered = [...targets].sort((a, b) => b.y - a.y);
      for (const tg of ordered) {
        if (tg.dead || tg.t < 0.3) continue;
        const topY = targetTopY(tg);
        // Full body hit box: head (above topY) down through the torso.
        const left = tg.x - 24;
        const right = tg.x + 24;
        const top = topY - 26; // include hat + head
        const bottom = topY + 62; // torso
        if (mx >= left && mx <= right && my >= top && my <= bottom) {
          hit = true;
          if (tg.kind === "outlaw") {
            tg.dead = true;
            const cash = tg.bounty;
            localLoot += cash;
            const toPoor = Math.floor(cash * 0.4);
            localGiven += toPoor;
            meter = Math.min(100, meter + 12);
            sfxHit(true);
            sfxCoin();
            burst(tg.x, targetTopY(tg), "#ffd23b", 22);
            float(tg.x, targetTopY(tg) - 24, `+$${cash}`, "#ffd23b");
            float(tg.x, targetTopY(tg) - 6, `$${toPoor} to the poor`, "#c9ccd1");
            bountyRef.current.push(tg.name.replace(/ ".*" /, " "));
            setLoot(localLoot);
            setGiven(localGiven);
          } else {
            // shot an innocent — penalty
            tg.dead = true;
            localLoot = Math.max(0, localLoot - 60);
            meter = Math.max(0, meter - 20);
            sfxHit(false);
            burst(tg.x, targetTopY(tg), "#e11331", 18);
            float(tg.x, targetTopY(tg) - 16, "INNOCENT! -$60", "#e11331");
            setLoot(localLoot);
          }
          break;
        }
      }
      if (!hit) shake = Math.max(shake, 2);
    }

    function targetTopY(tg: Target) {
      // target rises up by ~70px when fully popped
      return tg.y - tg.t * 70;
    }

    // --- drawing ---
    function drawScene() {
      // sky gradient (dusty sunset)
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      if (justiceMs > 0) { sky.addColorStop(0, "#2a2208"); sky.addColorStop(1, "#140a04"); }
      else { sky.addColorStop(0, "#241a12"); sky.addColorStop(0.6, "#160f0a"); sky.addColorStop(1, "#0a0a0b"); }
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, H);

      // sun
      ctx.save();
      ctx.globalAlpha = 0.5;
      const sun = ctx.createRadialGradient(W * 0.5, 120, 10, W * 0.5, 120, 160);
      sun.addColorStop(0, justiceMs > 0 ? "#ffd23b" : "#c87a2a");
      sun.addColorStop(1, "transparent");
      ctx.fillStyle = sun;
      ctx.fillRect(0, 0, W, 300);
      ctx.restore();

      // ground / dusty street
      const gnd = ctx.createLinearGradient(0, H - 130, 0, H);
      gnd.addColorStop(0, "#241812");
      gnd.addColorStop(1, "#140d08");
      ctx.fillStyle = gnd;
      ctx.fillRect(0, H - 130, W, 130);
      // boardwalk line
      ctx.strokeStyle = "rgba(0,0,0,0.4)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, H - 118); ctx.lineTo(W, H - 118);
      ctx.stroke();

      // Western storefronts with false fronts, windows, and signs
      const shops = [
        { x: -10, w: 150, c: "#241a12", roof: "#160f0a", sign: "SALOON", lit: true },
        { x: 150, w: 130, c: "#2a1d12", roof: "#1a110a", sign: "BANK", lit: false },
        { x: 290, w: 150, c: "#221812", roof: "#15100b", sign: "HOTEL", lit: true },
        { x: 450, w: 130, c: "#2a1e14", roof: "#19120b", sign: "GEN. STORE", lit: false },
        { x: 590, w: 150, c: "#231911", roof: "#160f09", sign: "JAIL", lit: false },
        { x: 750, w: 170, c: "#281c13", roof: "#18110a", sign: "LIVERY", lit: true },
      ];
      const baseY = H - 118; // top of the street / bottom of buildings
      shops.forEach((s) => {
        const bh = 120 + ((s.x >> 4) % 3) * 12; // varied height
        const topY = baseY - bh;
        // building body
        ctx.fillStyle = s.c;
        ctx.fillRect(s.x, topY, s.w, bh);
        // false front (raised facade)
        ctx.fillStyle = s.roof;
        ctx.fillRect(s.x - 4, topY - 18, s.w + 8, 22);
        // cornice line
        ctx.fillStyle = "rgba(0,0,0,0.3)";
        ctx.fillRect(s.x - 4, topY + 2, s.w + 8, 4);
        // porch awning
        ctx.fillStyle = "#15100a";
        ctx.fillRect(s.x - 2, baseY - 34, s.w + 4, 8);
        // awning posts
        ctx.fillStyle = "#15100a";
        ctx.fillRect(s.x + 6, baseY - 34, 4, 34);
        ctx.fillRect(s.x + s.w - 10, baseY - 34, 4, 34);
        // door
        ctx.fillStyle = "#0d0906";
        ctx.fillRect(s.x + s.w / 2 - 12, baseY - 30, 24, 30);
        // windows (lit = warm glow)
        for (let wi = 0; wi < 2; wi++) {
          const wx = s.x + 16 + wi * (s.w - 46);
          ctx.fillStyle = s.lit ? "rgba(255,190,80,0.5)" : "rgba(120,140,170,0.15)";
          ctx.fillRect(wx, topY + 24, 26, 30);
          ctx.strokeStyle = "rgba(0,0,0,0.5)";
          ctx.lineWidth = 2;
          ctx.strokeRect(wx, topY + 24, 26, 30);
          ctx.beginPath();
          ctx.moveTo(wx + 13, topY + 24); ctx.lineTo(wx + 13, topY + 54);
          ctx.moveTo(wx, topY + 39); ctx.lineTo(wx + 26, topY + 39);
          ctx.stroke();
        }
        // sign board
        ctx.fillStyle = "#e9dcc0";
        const sw = s.w - 24;
        ctx.fillRect(s.x + 12, topY - 15, sw, 15);
        ctx.fillStyle = "#3a2412";
        ctx.font = "700 11px 'Space Grotesk', sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(s.sign, s.x + s.w / 2, topY - 4);
        ctx.textAlign = "left";
      });

      // barrels at each spot
      spots.forEach((s) => {
        ctx.fillStyle = "#3a2817";
        ctx.fillRect(s.x - 26, s.y - 6, 52, 46);
        ctx.strokeStyle = "#5a3f22";
        ctx.lineWidth = 3;
        ctx.strokeRect(s.x - 26, s.y + 6, 52, 3);
      });
    }

    function drawCowboy(tg: Target) {
      const topY = targetTopY(tg);
      const outlaw = tg.kind === "outlaw";
      const x = tg.x;

      // WANTED bounty tag floating above outlaws (uses API name)
      if (outlaw && tg.t > 0.85 && !tg.dead) {
        const label = tg.name.replace(/"(.*)"/, "“$1”");
        ctx.save();
        ctx.font = "700 10px 'Space Grotesk', sans-serif";
        ctx.textAlign = "center";
        const tw = Math.max(ctx.measureText(label).width + 16, 90);
        const ty = topY - 46;
        // parchment tag
        ctx.fillStyle = "#e9dcc0";
        ctx.fillRect(x - tw / 2, ty - 14, tw, 26);
        ctx.strokeStyle = "#8a5a2a";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x - tw / 2, ty - 14, tw, 26);
        ctx.fillStyle = "#7a0f1c";
        ctx.fillText("WANTED", x, ty - 3);
        ctx.fillStyle = "#1a120b";
        ctx.font = "600 9px 'Space Grotesk', sans-serif";
        ctx.fillText(`${label}  $${tg.bounty}`, x, ty + 8);
        ctx.restore();
      }

      ctx.save();
      // clip so they "rise from behind the barrel"
      ctx.beginPath();
      ctx.rect(x - 44, 0, 88, tg.y - 2);
      ctx.clip();

      const skin = "#caa06e";

      // long coat / poncho
      ctx.fillStyle = outlaw ? "#1b1b1f" : "#5a4a2e";
      ctx.beginPath();
      ctx.moveTo(x - 20, topY + 6);
      ctx.lineTo(x + 20, topY + 6);
      ctx.lineTo(x + 24, topY + 64);
      ctx.lineTo(x - 24, topY + 64);
      ctx.closePath();
      ctx.fill();

      // shirt
      ctx.fillStyle = tg.shirtColor;
      ctx.fillRect(x - 12, topY + 6, 24, 30);

      // vest / gunbelt detail for outlaws
      if (outlaw) {
        ctx.strokeStyle = "#5a3f22";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(x - 14, topY + 36);
        ctx.lineTo(x + 14, topY + 40);
        ctx.stroke();
        // holster buckle
        ctx.fillStyle = "#c9951a";
        ctx.fillRect(x - 3, topY + 36, 6, 5);
      }

      // neck + head
      ctx.fillStyle = skin;
      ctx.fillRect(x - 4, topY - 2, 8, 8);
      ctx.beginPath();
      ctx.arc(x, topY - 10, 11, 0, Math.PI * 2);
      ctx.fill();

      // cowboy hat (brim + crown)
      ctx.fillStyle = tg.hatColor;
      ctx.beginPath();
      ctx.ellipse(x, topY - 20, 20, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(x - 10, topY - 32, 20, 13);
      // hat band
      ctx.fillStyle = outlaw ? "#7a0f1c" : "#8a5a2a";
      ctx.fillRect(x - 10, topY - 23, 20, 3);

      if (outlaw) {
        // red bandana over face
        ctx.fillStyle = "#c81028";
        ctx.beginPath();
        ctx.moveTo(x - 10, topY - 10);
        ctx.lineTo(x + 10, topY - 10);
        ctx.lineTo(x + 7, topY - 2);
        ctx.lineTo(x - 7, topY - 2);
        ctx.closePath();
        ctx.fill();
        // menacing eyes above bandana
        ctx.fillStyle = "#1a1a1c";
        ctx.fillRect(x - 6, topY - 13, 3, 2);
        ctx.fillRect(x + 3, topY - 13, 3, 2);

        // gun arm raised toward player (bobs as they ready to fire)
        const ready = tg.life < 650 ? 1 : 0;
        ctx.strokeStyle = skin;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(x + 8, topY + 14);
        ctx.lineTo(x + 24, topY + 10 - ready * 4);
        ctx.stroke();
        // revolver
        ctx.fillStyle = "#2a2a2f";
        ctx.fillRect(x + 22, topY + 6 - ready * 4, 12, 5);
        ctx.fillRect(x + 22, topY + 10 - ready * 4, 4, 6);
        if (tg.fired) {
          ctx.save();
          ctx.shadowBlur = 14; ctx.shadowColor = "#ffd23b";
          ctx.fillStyle = "#ffd23b";
          ctx.beginPath();
          ctx.arc(x + 36, topY + 8 - ready * 4, 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      } else {
        // townsfolk: hands up, friendly — eyes + smile
        ctx.fillStyle = "#1a1a1c";
        ctx.fillRect(x - 5, topY - 12, 2, 2);
        ctx.fillRect(x + 3, topY - 12, 2, 2);
        ctx.strokeStyle = skin;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(x - 12, topY + 14); ctx.lineTo(x - 22, topY - 6);
        ctx.moveTo(x + 12, topY + 14); ctx.lineTo(x + 22, topY - 6);
        ctx.stroke();
        // "friendly" green glow ring so players learn not to shoot
        ctx.strokeStyle = "rgba(120,200,120,0.5)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, topY + 18, 30, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }

    let last = performance.now();
    function loop(now: number) {
      const dt = Math.min(now - last, 40);
      last = now;
      rafRef.current = requestAnimationFrame(loop);

      drawScene();

      ctx.save();
      if (shake > 0) {
        ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
        shake *= 0.88;
        if (shake < 0.5) shake = 0;
      }

      const playing = stateRef.current === "running";
      if (playing) {
        gameTime += dt;
        if (justiceMs > 0) {
          justiceMs -= dt;
          if (justiceMs <= 0) setJustice(false);
        }

        spawnTimer -= dt;
        const rate = Math.max(900 - gameTime / 30, 420);
        if (spawnTimer <= 0) { spawn(); spawnTimer = rate; }

        for (const tg of targets) {
          if (tg.dead) { tg.t -= dt / 160; continue; }
          // pop up then stay then sink
          if (tg.up) {
            tg.t = Math.min(1, tg.t + dt / 180);
            if (tg.t >= 1) tg.life -= dt;
            if (tg.life <= 0) tg.up = false;
          } else {
            tg.t -= dt / 220;
          }
          // outlaw draws and fires if left up too long
          if (tg.kind === "outlaw" && tg.t >= 1 && !tg.fired && tg.life < 500) {
            tg.fired = true;
            sfxShot(); // the outlaw fires at you
            burst(tg.x, targetTopY(tg) - 8, "#ffd23b", 6);
            if (justiceMs <= 0) damage();
          }
        }
        targets = targets.filter((t) => t.t > -0.1);

        meter = Math.max(0, meter - dt * 0.004); // slowly decays
      }

      // draw targets (sorted so lower ones draw in front)
      [...targets].sort((a, b) => a.y - b.y).forEach((tg) => {
        if (tg.t > 0.05) drawCowboy(tg);
      });

      // particles
      particles.forEach((p) => {
        p.x += p.vx; p.y += p.vy; p.vy += 0.25; p.life -= 0.03;
        ctx.globalAlpha = Math.max(p.life, 0);
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, 3, 3);
        ctx.globalAlpha = 1;
      });
      particles = particles.filter((p) => p.life > 0);

      // floats
      floats.forEach((f) => {
        f.y -= 0.5; f.life -= 0.012;
        ctx.globalAlpha = Math.max(f.life, 0);
        ctx.fillStyle = f.color;
        ctx.font = "700 14px 'Space Grotesk', sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(f.text, f.x, f.y);
        ctx.globalAlpha = 1;
        ctx.textAlign = "left";
      });
      floats = floats.filter((f) => f.life > 0);

      ctx.restore();

      // crosshair
      ctx.strokeStyle = justiceMs > 0 ? "#ffd23b" : "#e9ebee";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(mouse.x, mouse.y, 14, 0, Math.PI * 2);
      ctx.moveTo(mouse.x - 20, mouse.y); ctx.lineTo(mouse.x - 6, mouse.y);
      ctx.moveTo(mouse.x + 6, mouse.y); ctx.lineTo(mouse.x + 20, mouse.y);
      ctx.moveTo(mouse.x, mouse.y - 20); ctx.lineTo(mouse.x, mouse.y - 6);
      ctx.moveTo(mouse.x, mouse.y + 6); ctx.lineTo(mouse.x, mouse.y + 20);
      ctx.stroke();

      // HUD meter
      const barW = 240;
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.fillRect(W - barW - 20, 18, barW, 12);
      ctx.fillStyle = meter >= 100 ? "#ffd23b" : "#c9ccd1";
      ctx.fillRect(W - barW - 20, 18, (barW * meter) / 100, 12);
      ctx.fillStyle = meter >= 100 ? "#ffd23b" : "#8a8d93";
      ctx.font = "600 11px 'Space Grotesk', sans-serif";
      ctx.fillText(
        justiceMs > 0 ? "REBEL JUSTICE!" : meter >= 100 ? "SPACE: REBEL JUSTICE" : "GIVE TO THE POOR",
        W - barW - 20, 46
      );
    }

    rafRef.current = requestAnimationFrame(loop);

    function toCanvas(e: PointerEvent) {
      const rect = (e.currentTarget as HTMLCanvasElement).getBoundingClientRect();
      return {
        x: ((e.clientX - rect.left) / rect.width) * W,
        y: ((e.clientY - rect.top) / rect.height) * H,
      };
    }
    function onMove(e: PointerEvent) {
      const p = toCanvas(e);
      mouse = p;
    }
    function onDown(e: PointerEvent) {
      if (stateRef.current !== "running") return;
      const p = toCanvas(e);
      mouse = p;
      shootAt(p.x, p.y);
    }
    function onKey(e: KeyboardEvent) {
      if (e.code === "Space" && stateRef.current === "running") {
        e.preventDefault();
        tryUnleashJustice();
      }
    }
    function onStart() {
      reset();
      fillNamePool();
      setState("running");
    }

    fillNamePool(); // warm the pool on mount

    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    canvas.addEventListener("rebel-outlaw-start" as any, onStart as any);

    return () => {
      cancelAnimationFrame(rafRef.current);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
      canvas.removeEventListener("rebel-outlaw-start" as any, onStart as any);
    };
  }, []);

  function start() {
    canvasRef.current?.dispatchEvent(new Event("rebel-outlaw-start"));
  }

  return (
    <div className="mx-auto max-w-4xl px-5">
      <div className="relative overflow-hidden rounded-xl border border-white/10 bg-ink shadow-card">
        <canvas
          ref={canvasRef}
          style={{ width: "100%", height: "auto", display: "block", cursor: "none" }}
          className="touch-none"
        />

        {state !== "running" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-ink/85 text-center backdrop-blur-sm">
            {state === "ready" ? (
              <>
                <h3 className="font-display text-3xl font-bold text-chrome">REBEL OUTLAW</h3>
                <p className="mt-2 max-w-md px-6 text-sm text-ash">
                  A rebel for good. Gun down the outlaw cowboys, take their bankroll, and
                  give to the poor. <span className="text-ember">Never shoot the innocent.</span>{" "}
                  Fill the meter and press Space for <span style={{ color: "#ffd23b" }}>REBEL JUSTICE</span>.
                </p>
              </>
            ) : (
              <>
                <h3 className="font-display text-3xl font-bold text-ignite">YOU'VE BEEN OUTDRAWN</h3>
                <p className="mt-2 text-sm text-ash">
                  Loot <span className="text-silver">${loot}</span> · Given to the poor{" "}
                  <span style={{ color: "#ffd23b" }}>${given}</span> · Best{" "}
                  <span className="text-silver">{highScore}</span>
                </p>
                {bountyList.length > 0 && (
                  <p className="mt-3 max-w-md px-6 text-xs text-ash">
                    Outlaws brought to justice:{" "}
                    <span className="text-silver">{bountyList.join(", ")}</span>
                  </p>
                )}
              </>
            )}
            <button
              onClick={start}
              className="btn-silver sheen mt-6 rounded-sm px-8 py-3 font-display font-semibold"
            >
              {state === "ready" ? "Draw!" : "Ride again"}
            </button>
            <p className="mt-4 max-w-md px-6 text-xs text-ash">
              Click / tap outlaws to shoot (bandana + drawn pistol). Spare the townsfolk
              with their hands up. Space = Rebel Justice when the meter's full.
            </p>
          </div>
        )}

        {state === "running" && (
          <div className="pointer-events-none absolute left-5 top-4 font-display text-sm font-semibold text-silver">
            <span>${loot}</span>
            <span className="ml-4" style={{ color: "#ffd23b" }}>poor ${given}</span>
            <span className="ml-4 text-ember">
              {"♥".repeat(Math.max(health, 0))}
              <span className="text-ash">{"♡".repeat(Math.max(3 - health, 0))}</span>
            </span>
            {justice && <span className="ml-4" style={{ color: "#ffd23b" }}>JUSTICE</span>}
          </div>
        )}
      </div>
    </div>
  );
}
