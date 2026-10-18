import { useEffect, useRef, useState } from "react";

/**
 * Rebel Runner — a canvas arcade game.
 * The Rebel is a silver KNIGHT. God gave him the Rebel power to defeat the beast.
 * Dodge the beast's corruption, rescue the villagers who can't save themselves
 * (each is a real named person pulled from the randomuser.me API), fill the
 * Rebel Power meter, then UNLEASH to ignite the sword, go invincible, and
 * strike down the beast.
 *
 * API: randomuser.me — one batched call per run names the rescued villagers.
 * Controls: Space / Up / tap to jump. Space to unleash when the meter is full.
 */

type GameState = "ready" | "running" | "over";

interface Entity {
  x: number;
  y: number;
  w: number;
  h: number;
  type: "hazard" | "soul" | "beast";
  passed?: boolean;
  hit?: boolean;
  name?: string;
}

interface FloatLabel {
  x: number;
  y: number;
  text: string;
  life: number;
}

const HS_KEY = "rebelRunnerHighScore";

export default function RebelRunner() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<GameState>("ready");
  const [score, setScore] = useState(0);
  const [saved, setSaved] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [unleashed, setUnleashed] = useState(false);
  const [savedNames, setSavedNames] = useState<string[]>([]);

  const stateRef = useRef<GameState>("ready");
  const rafRef = useRef<number>(0);
  // Pool of names fetched from the API, consumed as villagers are rescued.
  const namePoolRef = useRef<string[]>([]);
  const savedNamesRef = useRef<string[]>([]);

  useEffect(() => {
    setHighScore(Number(localStorage.getItem(HS_KEY) || 0));
  }, []);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Prefetch a batch of real names from randomuser.me (free, no key).
  async function fillNamePool() {
    try {
      const res = await fetch("https://randomuser.me/api/?results=25&inc=name&nat=us,gb,ca,au");
      const data = await res.json();
      const names: string[] = (data.results || []).map(
        (r: any) => `${r.name.first}`
      );
      if (names.length) namePoolRef.current = names;
    } catch {
      // Offline/blocked fallback — still playable, generic names.
      namePoolRef.current = [
        "Marcus", "Lena", "Theo", "Ava", "Darius", "Noor", "Eli", "Maya",
        "Cole", "Ivy", "Rhys", "Sana", "Gabriel", "Nadia", "Luca",
      ];
    }
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    const W = 900;
    const H = 360;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    const groundY = H - 54;

    const player = {
      x: 120,
      y: groundY,
      vy: 0,
      w: 30,
      h: 42,
      onGround: true,
      jumpHeld: false, // for variable jump height
      swingMs: 0, // sword swing animation timer (ms remaining)
      trail: [] as { x: number; y: number }[],
    };

    let entities: Entity[] = [];
    let particles: { x: number; y: number; vx: number; vy: number; life: number; color: string }[] = [];
    let labels: FloatLabel[] = [];
    let stars: { x: number; y: number; z: number }[] = [];
    for (let i = 0; i < 60; i++) {
      stars.push({ x: Math.random() * W, y: Math.random() * H, z: Math.random() * 2 + 0.3 });
    }

    let localScore = 0;
    let localSaved = 0;
    let speed = 5;
    let spawnTimer = 0;
    let beastTimer = 0;
    let meter = 0;
    let unleashMs = 0;
    let shake = 0;
    let gameTime = 0;
    let legRun = 0; // for simple running animation

    const GRAVITY = 0.9;
    const JUMP_V = -16; // full (high) jump velocity
    const SWING_MS = 260; // sword swing duration
    const SWING_RANGE = 58; // how far ahead the swing hits

    function reset() {
      player.y = groundY;
      player.vy = 0;
      player.onGround = true;
      player.trail = [];
      entities = [];
      particles = [];
      labels = [];
      localScore = 0;
      localSaved = 0;
      speed = 5;
      spawnTimer = 0;
      beastTimer = 0;
      meter = 0;
      unleashMs = 0;
      shake = 0;
      gameTime = 0;
      savedNamesRef.current = [];
      setScore(0);
      setSaved(0);
      setSavedNames([]);
      setUnleashed(false);
    }

    function jump() {
      if (player.onGround) {
        player.vy = JUMP_V;
        player.onGround = false;
        player.jumpHeld = true;
      }
    }

    function endJumpHold() {
      // Releasing early cuts the rise short → low jump. Holding → high jump.
      player.jumpHeld = false;
      if (player.vy < -7) player.vy = -7;
    }

    function swing() {
      if (player.swingMs > 0) return;
      player.swingMs = SWING_MS;
      // Hit any demon within range in front of the knight.
      for (const e of entities) {
        if (e.type === "hazard" && !e.hit) {
          const dx = e.x - player.x;
          if (dx > -10 && dx < SWING_RANGE) {
            e.hit = true;
            localScore += 25;
            meter = Math.min(100, meter + 8);
            burst(e.x + e.w / 2, e.y - e.h / 2, "#ff3b3f", 16);
            labels.push({ x: e.x, y: e.y - e.h - 6, text: "SLASH!", life: 0.9 });
            shake = 5;
          }
        }
      }
    }

    function nextName() {
      const pool = namePoolRef.current;
      if (pool.length) return pool[Math.floor(Math.random() * pool.length)];
      return "a soul";
    }

    function tryUnleash() {
      if (meter >= 100 && unleashMs <= 0) {
        unleashMs = 4200;
        meter = 0;
        shake = 14;
        setUnleashed(true);
        // gold flare burst
        for (let i = 0; i < 48; i++) {
          particles.push({
            x: player.x, y: player.y - player.h / 2,
            vx: (Math.random() - 0.5) * 12, vy: (Math.random() - 0.5) * 12,
            life: 1, color: Math.random() < 0.5 ? "#ffd23b" : "#fff2b0",
          });
        }
      }
    }

    function spawn() {
      const roll = Math.random();
      if (roll < 0.55) {
        const tall = Math.random() < 0.4;
        entities.push({ x: W + 20, y: groundY, w: 24 + Math.random() * 14, h: tall ? 58 : 32, type: "hazard" });
      } else {
        entities.push({
          x: W + 20, y: groundY - 58 - Math.random() * 80, w: 20, h: 28, type: "soul",
          name: nextName(),
        });
      }
    }

    function spawnBeast() {
      entities.push({ x: W + 40, y: groundY, w: 54, h: 128, type: "beast" });
    }

    function burst(x: number, y: number, color: string, n = 14) {
      for (let i = 0; i < n; i++) {
        particles.push({
          x, y, vx: (Math.random() - 0.5) * 8, vy: (Math.random() - 0.5) * 8,
          life: 1, color,
        });
      }
    }

    function overlap(a: { x: number; y: number; w: number; h: number }, b: Entity) {
      return a.x < b.x + b.w && a.x + a.w > b.x && a.y - a.h < b.y && a.y > b.y - b.h;
    }

    function endGame() {
      setState("over");
      const best = Math.max(localScore, Number(localStorage.getItem(HS_KEY) || 0));
      localStorage.setItem(HS_KEY, String(best));
      setHighScore(best);
      setSavedNames([...savedNamesRef.current]);
    }

    // --- drawing helpers ---
    function drawKnight(px: number, py: number, rage: boolean) {
      const bob = player.onGround ? Math.sin(legRun) * 1.5 : 0;
      const topY = py - player.h + bob;
      const t = Date.now() / 150;
      ctx.save();

      // big golden halo of divine light when unleashed (invincible)
      if (rage) {
        const halo = ctx.createRadialGradient(px, topY + 10, 2, px, topY + 10, 40);
        halo.addColorStop(0, "rgba(255,223,100,0.6)");
        halo.addColorStop(0.5, "rgba(255,210,59,0.3)");
        halo.addColorStop(1, "rgba(255,210,59,0)");
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(px, topY + 10, 40, 0, Math.PI * 2);
        ctx.fill();
      }

      // flowing cape behind
      ctx.fillStyle = rage ? "rgba(255,210,59,0.9)" : "rgba(138,141,147,0.7)";
      ctx.beginPath();
      ctx.moveTo(px - 7, topY + 12);
      ctx.quadraticCurveTo(px - 20 - Math.sin(t) * 3, topY + 24, px - 12, py);
      ctx.lineTo(px - 2, py);
      ctx.lineTo(px - 2, topY + 14);
      ctx.closePath();
      ctx.fill();

      if (rage) { ctx.shadowBlur = 24; ctx.shadowColor = "#ffd23b"; }

      // body (armor) — glows gold when unleashed
      const g = ctx.createLinearGradient(px, topY, px, py);
      if (rage) { g.addColorStop(0, "#fff2b0"); g.addColorStop(1, "#e0a81f"); }
      else { g.addColorStop(0, "#ffffff"); g.addColorStop(1, "#9ea2a8"); }
      ctx.fillStyle = g;
      // torso with shoulder pauldrons
      ctx.fillRect(px - 10, topY + 12, 20, 21);
      ctx.fillRect(px - 13, topY + 12, 5, 7); // left pauldron
      ctx.fillRect(px + 8, topY + 12, 5, 7);  // right pauldron
      // belt
      ctx.fillStyle = rage ? "#8a5a0f" : "#2a2a2f";
      ctx.fillRect(px - 10, topY + 28, 20, 3);

      // helmet with plume
      ctx.fillStyle = rage ? "#fff2b0" : "#e9ebee";
      ctx.beginPath();
      ctx.arc(px, topY + 7, 8, 0, Math.PI * 2);
      ctx.fill();
      // plume crest
      ctx.strokeStyle = rage ? "#ffdf3b" : "#c81028";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(px, topY - 2);
      ctx.quadraticCurveTo(px + 6, topY - 8, px + 10, topY - 2);
      ctx.stroke();
      // visor slit
      ctx.fillStyle = rage ? "#ffdf3b" : "#2a2a2f";
      ctx.fillRect(px - 6, topY + 5, 12, 3);

      // legs (animated)
      ctx.strokeStyle = rage ? "#e0a81f" : "#c9ccd1";
      ctx.lineWidth = 4;
      const swing = player.onGround ? Math.sin(legRun) * 6 : 4;
      ctx.beginPath();
      ctx.moveTo(px - 3, py - 10); ctx.lineTo(px - 3 - swing, py);
      ctx.moveTo(px + 3, py - 10); ctx.lineTo(px + 3 + swing, py);
      ctx.stroke();

      // shield on left arm
      ctx.fillStyle = rage ? "#ffd23b" : "#aeb2b8";
      ctx.beginPath();
      ctx.moveTo(px - 12, topY + 16);
      ctx.lineTo(px - 4, topY + 16);
      ctx.lineTo(px - 4, topY + 26);
      ctx.lineTo(px - 8, topY + 30);
      ctx.lineTo(px - 12, topY + 26);
      ctx.closePath();
      ctx.fill();

      // sword (ignites when unleashed, swings when attacking)
      ctx.save();
      const swingP = player.swingMs > 0 ? player.swingMs / SWING_MS : 0; // 1→0
      // rotate the sword down-and-forward through the swing arc
      const pivotX = px + 9;
      const pivotY = topY + 18;
      ctx.translate(pivotX, pivotY);
      // rest angle ~ -50°, swing sweeps toward +30°
      const ang = (-50 + (1 - swingP) * 80) * (Math.PI / 180);
      ctx.rotate(ang);
      if (rage || swingP > 0) { ctx.shadowBlur = 18; ctx.shadowColor = rage ? "#ffd23b" : "#e9ebee"; }
      ctx.strokeStyle = rage ? "#ffe77a" : "#e9ebee";
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(26, 0); // blade along local x
      ctx.stroke();
      // crossguard
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-2, -5); ctx.lineTo(-2, 5);
      ctx.stroke();
      // swing arc trail
      if (swingP > 0) {
        ctx.strokeStyle = rage ? "rgba(255,210,59,0.55)" : "rgba(233,235,238,0.45)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, 26, -0.6, 0.6);
        ctx.stroke();
      }
      ctx.restore();
      ctx.restore();
    }

    function drawDemon(e: Entity) {
      // A crouching demon imp with horns, glowing eyes, and a flame flicker.
      const topY = e.y - e.h;
      const cx = e.x + e.w / 2;
      const t = Date.now() / 120;
      ctx.save();
      ctx.shadowBlur = 14;
      ctx.shadowColor = "#e11331";

      // dark body
      const g = ctx.createLinearGradient(e.x, topY, e.x, e.y);
      g.addColorStop(0, "#9a1222");
      g.addColorStop(1, "#1a0407");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(e.x, e.y);
      ctx.quadraticCurveTo(e.x, topY + e.h * 0.35, cx, topY + e.h * 0.2);
      ctx.quadraticCurveTo(e.x + e.w, topY + e.h * 0.35, e.x + e.w, e.y);
      ctx.closePath();
      ctx.fill();

      // horns
      ctx.strokeStyle = "#e11331";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(cx - e.w * 0.28, topY + e.h * 0.22);
      ctx.lineTo(cx - e.w * 0.4, topY + e.h * 0.02);
      ctx.moveTo(cx + e.w * 0.28, topY + e.h * 0.22);
      ctx.lineTo(cx + e.w * 0.4, topY + e.h * 0.02);
      ctx.stroke();

      // glowing eyes
      ctx.fillStyle = "#ffdf3b";
      ctx.shadowColor = "#ffdf3b";
      ctx.shadowBlur = 10;
      ctx.fillRect(cx - 7, topY + e.h * 0.32, 4, 4);
      ctx.fillRect(cx + 3, topY + e.h * 0.32, 4, 4);

      // flame flicker on top
      ctx.shadowBlur = 0;
      ctx.fillStyle = `rgba(255,${80 + Math.floor(Math.sin(t) * 40)},40,0.8)`;
      ctx.beginPath();
      ctx.moveTo(cx - 4, topY + e.h * 0.1);
      ctx.lineTo(cx, topY - 6 - Math.abs(Math.sin(t)) * 4);
      ctx.lineTo(cx + 4, topY + e.h * 0.1);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    function drawVillager(e: Entity) {
      // A glowing spirit orb (the soul to rescue).
      const t = Date.now() / 300;
      const cx = e.x + e.w / 2;
      const cy = e.y - e.h / 2 + Math.sin(t) * 3;
      const pulse = 1 + Math.sin(t * 1.6) * 0.12;
      const r = 8 * pulse;
      ctx.save();

      // outer gold aura
      const aura = ctx.createRadialGradient(cx, cy, 1, cx, cy, r * 2.6);
      aura.addColorStop(0, "rgba(255,210,70,0.6)");
      aura.addColorStop(1, "rgba(255,210,70,0)");
      ctx.fillStyle = aura;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 2.6, 0, Math.PI * 2);
      ctx.fill();

      // orbiting gold sparkles
      for (let i = 0; i < 3; i++) {
        const a = t * 2 + (i * Math.PI * 2) / 3;
        ctx.fillStyle = "rgba(255,223,120,0.95)";
        ctx.fillRect(cx + Math.cos(a) * r * 1.7 - 1, cy + Math.sin(a) * r * 1.7 - 1, 2, 2);
      }

      // bright gold core
      ctx.shadowBlur = 18;
      ctx.shadowColor = "#ffd23b";
      const core = ctx.createRadialGradient(cx - 2, cy - 2, 0, cx, cy, r);
      core.addColorStop(0, "#fff6d6");
      core.addColorStop(0.6, "#ffd23b");
      core.addColorStop(1, "#c9951a");
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    function drawBeast(e: Entity) {
      const topY = e.y - e.h;
      const cx = e.x + e.w / 2;
      const t = Date.now() / 160;
      ctx.save();
      ctx.shadowBlur = 28;
      ctx.shadowColor = "#e11331";

      const grad = ctx.createLinearGradient(e.x, topY, e.x, e.y);
      grad.addColorStop(0, "#ff2a3d");
      grad.addColorStop(0.5, "#8a0f1e");
      grad.addColorStop(1, "#1a040a");
      ctx.fillStyle = grad;

      // hulking jagged body
      ctx.beginPath();
      ctx.moveTo(e.x, e.y);
      ctx.lineTo(e.x, topY + 44);
      ctx.lineTo(e.x + 10, topY + 30);
      ctx.lineTo(e.x + e.w / 2, topY + 8);
      ctx.lineTo(e.x + e.w - 10, topY + 30);
      ctx.lineTo(e.x + e.w, topY + 44);
      ctx.lineTo(e.x + e.w, e.y);
      ctx.closePath();
      ctx.fill();

      // spiked back
      ctx.fillStyle = "#1a040a";
      for (let i = 0; i < 4; i++) {
        const sx = e.x + 8 + i * ((e.w - 16) / 3);
        ctx.beginPath();
        ctx.moveTo(sx, topY + 30);
        ctx.lineTo(sx + 5, topY + 6 - i);
        ctx.lineTo(sx + 10, topY + 30);
        ctx.fill();
      }

      // two curved horns
      ctx.strokeStyle = "#e9ebee";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(cx - 14, topY + 16);
      ctx.quadraticCurveTo(cx - 30, topY - 6, cx - 18, topY - 20);
      ctx.moveTo(cx + 14, topY + 16);
      ctx.quadraticCurveTo(cx + 30, topY - 6, cx + 18, topY - 20);
      ctx.stroke();

      // four glowing eyes
      ctx.shadowColor = "#ffdf3b";
      ctx.shadowBlur = 14;
      ctx.fillStyle = "#ffdf3b";
      ctx.fillRect(cx - 16, topY + 26, 7, 7);
      ctx.fillRect(cx + 9, topY + 26, 7, 7);
      ctx.fillRect(cx - 9, topY + 38, 5, 5);
      ctx.fillRect(cx + 4, topY + 38, 5, 5);

      // jagged maw
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#0a0a0b";
      ctx.fillRect(cx - 16, topY + 50, 32, 10 + Math.abs(Math.sin(t)) * 4);
      ctx.fillStyle = "#e9ebee";
      for (let i = 0; i < 6; i++) {
        const tx = cx - 16 + i * 6;
        ctx.beginPath();
        ctx.moveTo(tx, topY + 50);
        ctx.lineTo(tx + 3, topY + 58);
        ctx.lineTo(tx + 6, topY + 50);
        ctx.fill();
      }

      // claws
      ctx.fillStyle = "#e9ebee";
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(e.x + 6 + i * 12, e.y);
        ctx.lineTo(e.x + 11 + i * 12, e.y - 10);
        ctx.lineTo(e.x + 16 + i * 12, e.y);
        ctx.fill();
      }
      ctx.restore();
    }

    let last = performance.now();
    function loop(now: number) {
      const dt = Math.min(now - last, 40);
      last = now;
      rafRef.current = requestAnimationFrame(loop);

      ctx.clearRect(0, 0, W, H);
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      if (unleashMs > 0) { bg.addColorStop(0, "#1c1606"); bg.addColorStop(1, "#0a0a0b"); }
      else { bg.addColorStop(0, "#0e0e11"); bg.addColorStop(1, "#0a0a0b"); }
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      ctx.save();
      if (shake > 0) {
        ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
        shake *= 0.9;
        if (shake < 0.5) shake = 0;
      }

      for (const s of stars) {
        s.x -= speed * s.z * 0.25;
        if (s.x < 0) s.x = W;
        ctx.fillStyle = unleashMs > 0 ? "rgba(255,210,59,0.55)" : "rgba(201,204,209,0.35)";
        ctx.fillRect(s.x, s.y, s.z, s.z);
      }

      ctx.strokeStyle = unleashMs > 0 ? "rgba(255,210,59,0.6)" : "rgba(201,204,209,0.3)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, groundY + 2);
      ctx.lineTo(W, groundY + 2);
      ctx.stroke();

      const playing = stateRef.current === "running";

      if (playing) {
        gameTime += dt;
        speed = 5 + gameTime / 4000;
        legRun += dt * 0.02 * (speed / 5);

        // variable jump: extra gravity while rising if the button isn't held
        const g = !player.jumpHeld && player.vy < 0 ? GRAVITY * 2.2 : GRAVITY;
        player.vy += g;
        player.y += player.vy;
        if (player.y >= groundY) { player.y = groundY; player.vy = 0; player.onGround = true; }
        if (player.swingMs > 0) player.swingMs -= dt;

        player.trail.unshift({ x: player.x, y: player.y - player.h / 2 });
        if (player.trail.length > 12) player.trail.pop();

        if (unleashMs > 0) {
          unleashMs -= dt;
          // continuous gold flares streaming off the knight
          if (Math.random() < 0.8) {
            particles.push({
              x: player.x + (Math.random() - 0.5) * 20,
              y: player.y - player.h / 2 + (Math.random() - 0.5) * 24,
              vx: -speed - Math.random() * 3,
              vy: (Math.random() - 0.5) * 3,
              life: 1,
              color: Math.random() < 0.5 ? "#ffd23b" : "#fff2b0",
            });
          }
          if (unleashMs <= 0) setUnleashed(false);
        }

        spawnTimer -= dt;
        if (spawnTimer <= 0) {
          spawn();
          spawnTimer = 700 + Math.random() * 600 - Math.min(gameTime / 50, 400);
        }
        beastTimer += dt;
        if (beastTimer > 14000) { spawnBeast(); beastTimer = 0; }

        for (const e of entities) {
          e.x -= speed;
          if (!e.hit && overlap(player, e)) {
            if (e.type === "soul") {
              e.hit = true;
              localSaved += 1;
              localScore += 50;
              meter = Math.min(100, meter + 18);
              burst(e.x, e.y - e.h / 2, "#c9ccd1", 10);
              if (e.name) {
                labels.push({ x: e.x, y: e.y - e.h, text: `Saved ${e.name}!`, life: 1 });
                savedNamesRef.current.push(e.name);
              }
              setSaved(localSaved);
            } else {
              if (unleashMs > 0) {
                e.hit = true;
                localScore += e.type === "beast" ? 500 : 30;
                shake = e.type === "beast" ? 18 : 8;
                burst(e.x, e.y - e.h / 2, "#ffd23b", e.type === "beast" ? 40 : 18);
                if (e.type === "beast") labels.push({ x: e.x, y: e.y - e.h, text: "BEAST SLAIN", life: 1.2 });
              } else {
                burst(player.x, player.y - player.h / 2, "#e11331", 26);
                shake = 16;
                endGame();
              }
            }
          }
          if (!e.passed && e.x + e.w < player.x) {
            e.passed = true;
            if (e.type === "hazard") { localScore += 10; meter = Math.min(100, meter + 6); }
          }
        }
        entities = entities.filter((e) => e.x + e.w > -40 && !e.hit);

        localScore += dt * 0.01;
        setScore(Math.floor(localScore));
      }

      // draw entities
      for (const e of entities) {
        if (e.type === "hazard") {
          drawDemon(e);
        } else if (e.type === "soul") {
          drawVillager(e);
        } else if (e.type === "beast") {
          drawBeast(e);
        }
      }

      // player trail
      player.trail.forEach((p, i) => {
        const a = (1 - i / player.trail.length) * 0.45;
        ctx.fillStyle = unleashMs > 0 ? `rgba(255,210,59,${a})` : `rgba(201,204,209,${a})`;
        ctx.fillRect(p.x - 3, p.y - 3, 6, 6);
      });

      // knight
      drawKnight(player.x, player.y, unleashMs > 0);

      // particles
      particles.forEach((p) => {
        p.x += p.vx; p.y += p.vy; p.vy += 0.2; p.life -= 0.03;
        ctx.globalAlpha = Math.max(p.life, 0);
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, 3, 3);
        ctx.globalAlpha = 1;
      });
      particles = particles.filter((p) => p.life > 0);

      // floating labels
      labels.forEach((l) => {
        l.y -= 0.6; l.life -= 0.012;
        ctx.globalAlpha = Math.max(l.life, 0);
        ctx.fillStyle = l.text.includes("BEAST") ? "#ff3b3f" : "#e9ebee";
        ctx.font = "700 13px 'Space Grotesk', sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(l.text, l.x, l.y);
        ctx.globalAlpha = 1;
        ctx.textAlign = "left";
      });
      labels = labels.filter((l) => l.life > 0);

      ctx.restore();

      // HUD meter
      const barW = 220;
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.fillRect(W - barW - 20, 18, barW, 12);
      ctx.fillStyle = meter >= 100 ? "#ffd23b" : "#c9ccd1";
      ctx.fillRect(W - barW - 20, 18, (barW * meter) / 100, 12);
      ctx.fillStyle = meter >= 100 ? "#ffd23b" : "#8a8d93";
      ctx.font = "600 11px 'Space Grotesk', sans-serif";
      ctx.fillText(meter >= 100 ? "REBEL POWER READY: SPACE TO UNLEASH" : "REBEL POWER", W - barW - 20, 46);
    }

    rafRef.current = requestAnimationFrame(loop);

    function onKey(e: KeyboardEvent) {
      if (stateRef.current !== "running") return;
      if (e.code === "Space") {
        e.preventDefault();
        // Space unleashes the special when ready, otherwise it jumps.
        if (meter >= 100 && unleashMs <= 0) tryUnleash();
        else jump();
      } else if (e.code === "ArrowUp" || e.code === "KeyW") {
        e.preventDefault();
        jump(); // tap = low, hold = high (handled by keyup)
      } else if (e.code === "KeyF" || e.code === "KeyX" || e.code === "KeyJ") {
        e.preventDefault();
        swing();
      } else if (e.code === "ShiftLeft" || e.code === "ShiftRight" || e.code === "Enter") {
        e.preventDefault();
        tryUnleash();
      }
    }
    function onKeyUp(e: KeyboardEvent) {
      if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") {
        endJumpHold();
      }
    }
    // Pointer: left side of canvas = jump, right side = swing (mobile-friendly)
    function onPointer(e: PointerEvent) {
      if (stateRef.current !== "running") return;
      const rect = (e.currentTarget as HTMLCanvasElement).getBoundingClientRect();
      const relX = (e.clientX - rect.left) / rect.width;
      if (relX > 0.6) swing();
      else jump();
    }
    function onPointerUp() {
      endJumpHold();
    }
    function onStart() {
      reset();
      fillNamePool(); // refresh names for this run (API)
      setState("running");
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKeyUp);
    canvas.addEventListener("pointerdown", onPointer);
    window.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("rebel-start" as any, onStart as any);

    // warm the name pool on mount
    fillNamePool();

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKeyUp);
      canvas.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("rebel-start" as any, onStart as any);
    };
  }, []);

  function start() {
    canvasRef.current?.dispatchEvent(new Event("rebel-start"));
  }

  return (
    <div className="mx-auto max-w-4xl px-5">
      <div className="relative overflow-hidden rounded-xl border border-white/10 bg-ink shadow-card">
        <canvas
          ref={canvasRef}
          style={{ width: "100%", height: "auto", display: "block" }}
          className="touch-none"
        />

        {state !== "running" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-ink/85 text-center backdrop-blur-sm">
            {state === "ready" ? (
              <>
                <h3 className="font-display text-3xl font-bold text-chrome">REBEL RUNNER</h3>
                <p className="mt-2 max-w-md px-6 text-sm text-ash">
                  The beast came for the helpless. But God gave the Rebel knight the
                  power to stand. Dodge the corruption, rescue the villagers who can't
                  save themselves, and when the Rebel Power fills,{" "}
                  <span className="text-ember">UNLEASH</span> to ignite your sword, go
                  invincible, and strike down the beast.
                </p>
              </>
            ) : (
              <>
                <h3 className="font-display text-3xl font-bold text-ignite">THE BEAST GOT YOU</h3>
                <p className="mt-2 text-sm text-ash">
                  Score <span className="text-silver">{score}</span> · Villagers saved{" "}
                  <span className="text-silver">{saved}</span> · Best{" "}
                  <span className="text-silver">{highScore}</span>
                </p>
                {savedNames.length > 0 && (
                  <p className="mt-3 max-w-md px-6 text-xs text-ash">
                    You saved: <span className="text-silver">{savedNames.join(", ")}</span>
                  </p>
                )}
              </>
            )}
            <button
              onClick={start}
              className="btn-silver sheen mt-6 rounded-sm px-8 py-3 font-display font-semibold"
            >
              {state === "ready" ? "Start the run" : "Run again"}
            </button>
            <p className="mt-4 max-w-md px-6 text-xs text-ash">
              Space / Up to jump (tap = low, hold = high). When the Rebel Power is full,
              press Space to UNLEASH. F / X to swing your sword and slay demons. On
              mobile, tap the left side to jump, right side to swing.
            </p>
          </div>
        )}

        {state === "running" && (
          <div className="pointer-events-none absolute left-5 top-4 font-display text-sm font-semibold text-silver">
            <span style={unleashed ? { color: "#ffd23b" } : undefined}>
              {unleashed ? "UNLEASHED" : "SCORE"} {score}
            </span>
            <span className="ml-4 text-ash">saved {saved}</span>
          </div>
        )}
      </div>
    </div>
  );
}
