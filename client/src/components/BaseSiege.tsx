import { useEffect, useRef, useState } from "react";
import {
  Application,
  Container,
  Graphics,
  Text,
  TextStyle,
} from "pixi.js";

/**
 * REBEL: BASE SIEGE — a PixiJS top-down base-defense blaster.
 *
 * Lore: The machine intelligence "the Null" infiltrated Veyra's databases.
 * Humanity fled on the Infinity fleet to the colony Ostara. The Rebels stayed
 * to defend the last base while the asteroid Kaldris falls. Hold the line.
 *
 * Play: move the mouse to aim the turret, click/hold to fire the plasma
 * blaster. Destroy Null war-machines before they reach the base core. Survive
 * until Kaldris impact. No external APIs — all rendered with PixiJS.
 */

type GameState = "ready" | "running" | "over" | "win";

const HS_KEY = "rebelBaseSiegeHighScore";
const SURVIVE_MS = 75000; // survive ~75s until Kaldris impact

export default function BaseSiege() {
  const mountRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<GameState>("ready");
  const [score, setScore] = useState(0);
  const [hp, setHp] = useState(100);
  const [timeLeft, setTimeLeft] = useState(Math.round(SURVIVE_MS / 1000));
  const [highScore, setHighScore] = useState(0);

  const appRef = useRef<Application | null>(null);
  const stateRef = useRef<GameState>("ready");
  const apiRef = useRef<{ start: () => void } | null>(null);

  useEffect(() => {
    setHighScore(Number(localStorage.getItem(HS_KEY) || 0));
  }, []);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    const W = 900;
    const H = 520;
    let destroyed = false;
    const app = new Application();

    app
      .init({ width: W, height: H, background: "#0a0a0b", antialias: true })
      .then(() => {
        if (destroyed || !mountRef.current) {
          app.destroy(true);
          return;
        }
        appRef.current = app;
        mountRef.current.appendChild(app.canvas);
        app.canvas.style.width = "100%";
        app.canvas.style.height = "auto";
        app.canvas.style.display = "block";

        // ---- layers ----
        const bg = new Container();
        const world = new Container();
        const fx = new Container();
        app.stage.addChild(bg, world, fx);

        // starfield
        const stars = new Graphics();
        bg.addChild(stars);
        const starPts = Array.from({ length: 90 }, () => ({
          x: Math.random() * W,
          y: Math.random() * H,
          z: Math.random() * 1.8 + 0.3,
        }));

        // asteroid Kaldris (looms larger as time runs out)
        const kaldris = new Graphics();
        bg.addChild(kaldris);

        // base core at bottom-center
        const baseX = W / 2;
        const baseY = H - 48;
        const base = new Graphics();
        world.addChild(base);

        // turret
        const turret = new Graphics();
        world.addChild(turret);

        type Enemy = { g: Graphics; x: number; y: number; vx: number; vy: number; hp: number; r: number; dead?: boolean };
        type Bullet = { g: Graphics; x: number; y: number; vx: number; vy: number; dead?: boolean };
        type Particle = { g: Graphics; x: number; y: number; vx: number; vy: number; life: number; color: number };

        let enemies: Enemy[] = [];
        let bullets: Bullet[] = [];
        let particles: Particle[] = [];

        let mouse = { x: W / 2, y: H / 2 };
        let firing = false;
        let fireCd = 0;
        let spawnCd = 0;
        let localScore = 0;
        let localHp = 100;
        let elapsed = 0;
        let shake = 0;

        const titleStyle = new TextStyle({
          fill: "#8a8d93",
          fontSize: 12,
          fontFamily: "Space Grotesk, sans-serif",
          fontWeight: "600",
        });
        const hud = new Text({ text: "", style: titleStyle });
        hud.x = 14;
        hud.y = 12;
        app.stage.addChild(hud);

        function reset() {
          enemies.forEach((e) => e.g.destroy());
          bullets.forEach((b) => b.g.destroy());
          particles.forEach((p) => p.g.destroy());
          enemies = [];
          bullets = [];
          particles = [];
          localScore = 0;
          localHp = 100;
          elapsed = 0;
          spawnCd = 0;
          fireCd = 0;
          shake = 0;
          setScore(0);
          setHp(100);
          setTimeLeft(Math.round(SURVIVE_MS / 1000));
        }

        function burst(x: number, y: number, color: number, n = 18) {
          for (let i = 0; i < n; i++) {
            const g = new Graphics();
            g.rect(-2, -2, 4, 4).fill(color);
            g.x = x;
            g.y = y;
            fx.addChild(g);
            const a = Math.random() * Math.PI * 2;
            const sp = Math.random() * 5 + 1;
            particles.push({ g, x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1, color });
          }
        }

        function spawnEnemy() {
          const edge = Math.random();
          let x: number, y: number;
          if (edge < 0.5) { x = Math.random() * W; y = -20; }
          else if (edge < 0.75) { x = -20; y = Math.random() * (H * 0.6); }
          else { x = W + 20; y = Math.random() * (H * 0.6); }
          const r = 12 + Math.random() * 8;
          const g = new Graphics();
          world.addChild(g);
          const diff = 1 + elapsed / 30000;
          enemies.push({
            g, x, y,
            vx: 0, vy: 0,
            hp: Math.ceil(r / 8) + Math.floor(elapsed / 25000),
            r,
          });
          void diff;
        }

        function fire() {
          const ang = Math.atan2(mouse.y - baseY, mouse.x - baseX);
          const speed = 11;
          const g = new Graphics();
          g.rect(-6, -1.5, 12, 3).fill(0xff3b3f);
          world.addChild(g);
          bullets.push({
            g,
            x: baseX + Math.cos(ang) * 30,
            y: baseY + Math.sin(ang) * 30,
            vx: Math.cos(ang) * speed,
            vy: Math.sin(ang) * speed,
          });
          burst(baseX + Math.cos(ang) * 30, baseY + Math.sin(ang) * 30, 0xffd23b, 4);
        }

        function damageBase(d: number) {
          localHp -= d;
          shake = 12;
          setHp(Math.max(0, Math.round(localHp)));
          if (localHp <= 0) endGame(false);
        }

        function endGame(won: boolean) {
          setState(won ? "win" : "over");
          const best = Math.max(localScore, Number(localStorage.getItem(HS_KEY) || 0));
          localStorage.setItem(HS_KEY, String(best));
          setHighScore(best);
        }

        function drawStatic() {
          // base core
          base.clear();
          base.circle(baseX, baseY, 26).fill(0x121214).stroke({ width: 2, color: 0xc9ccd1 });
          base.circle(baseX, baseY, 14).fill({ color: 0xe11331, alpha: 0.8 });
        }
        drawStatic();

        let last = performance.now();
        app.ticker.add(() => {
          const now = performance.now();
          const dt = Math.min(now - last, 40);
          last = now;

          const sx = shake > 0 ? (Math.random() - 0.5) * shake : 0;
          const sy = shake > 0 ? (Math.random() - 0.5) * shake : 0;
          world.x = sx; world.y = sy;
          fx.x = sx; fx.y = sy;
          if (shake > 0) shake *= 0.9;

          // stars
          stars.clear();
          for (const s of starPts) {
            s.y += s.z * 0.4;
            if (s.y > H) s.y = 0;
            stars.rect(s.x, s.y, s.z, s.z).fill({ color: 0xc9ccd1, alpha: 0.4 });
          }

          const playing = stateRef.current === "running";

          // Kaldris grows as the clock runs down
          const prog = Math.min(elapsed / SURVIVE_MS, 1);
          kaldris.clear();
          const kr = 30 + prog * 120;
          kaldris.circle(W * 0.5, -40 + prog * 120, kr).fill({ color: 0x7a0f1c, alpha: 0.55 });
          kaldris.circle(W * 0.5, -40 + prog * 120, kr * 0.7).fill({ color: 0xe11331, alpha: 0.3 });

          // turret aims at mouse
          const ang = Math.atan2(mouse.y - baseY, mouse.x - baseX);
          turret.clear();
          turret.rect(-4, -4, 34, 8).fill(0xc9ccd1);
          turret.x = baseX;
          turret.y = baseY;
          turret.rotation = ang;

          if (playing) {
            elapsed += dt;
            const left = Math.max(0, Math.ceil((SURVIVE_MS - elapsed) / 1000));
            setTimeLeft(left);
            if (elapsed >= SURVIVE_MS) {
              // Kaldris impact — massive blast, you survived
              burst(W / 2, H / 2, 0xffd23b, 120);
              shake = 30;
              endGame(true);
            }

            // spawn
            spawnCd -= dt;
            const rate = Math.max(1100 - elapsed / 60, 350);
            if (spawnCd <= 0) { spawnEnemy(); spawnCd = rate; }

            // fire
            fireCd -= dt;
            if (firing && fireCd <= 0) { fire(); fireCd = 130; }

            // bullets
            for (const b of bullets) {
              b.x += b.vx; b.y += b.vy;
              b.g.x = b.x; b.g.y = b.y;
              if (b.x < -20 || b.x > W + 20 || b.y < -20 || b.y > H + 20) b.dead = true;
            }

            // enemies move toward base
            for (const e of enemies) {
              const a = Math.atan2(baseY - e.y, baseX - e.x);
              const sp = 0.8 + elapsed / 90000;
              e.x += Math.cos(a) * sp * (dt / 16);
              e.y += Math.sin(a) * sp * (dt / 16);
              e.g.clear();
              // chrome Null machine with red optic
              e.g.rect(-e.r, -e.r, e.r * 2, e.r * 2).fill(0x2a2a2f).stroke({ width: 2, color: 0x9ea2a8 });
              e.g.circle(0, 0, e.r * 0.4).fill(0xff3b3f);
              e.g.x = e.x; e.g.y = e.y;

              // reached base?
              if (Math.hypot(e.x - baseX, e.y - baseY) < 28 + e.r) {
                e.dead = true;
                damageBase(12);
                burst(e.x, e.y, 0xe11331, 20);
              }
            }

            // bullet vs enemy
            for (const b of bullets) {
              if (b.dead) continue;
              for (const e of enemies) {
                if (e.dead) continue;
                if (Math.hypot(b.x - e.x, b.y - e.y) < e.r + 4) {
                  b.dead = true;
                  e.hp -= 1;
                  burst(b.x, b.y, 0xffd23b, 6);
                  if (e.hp <= 0) {
                    e.dead = true;
                    localScore += 10;
                    setScore(localScore);
                    burst(e.x, e.y, 0xff3b3f, 22);
                    shake = Math.max(shake, 4);
                  }
                  break;
                }
              }
            }

            // cleanup
            bullets = bullets.filter((b) => { if (b.dead) b.g.destroy(); return !b.dead; });
            enemies = enemies.filter((e) => { if (e.dead) e.g.destroy(); return !e.dead; });
          }

          // particles
          for (const p of particles) {
            p.x += p.vx; p.y += p.vy; p.vy += 0.12; p.life -= 0.03;
            p.g.x = p.x; p.g.y = p.y;
            p.g.alpha = Math.max(p.life, 0);
          }
          particles = particles.filter((p) => { if (p.life <= 0) p.g.destroy(); return p.life > 0; });

          hud.text = `HOLD THE LINE · Null destroyed: ${localScore}`;
        });

        // input
        const rectOf = () => app.canvas.getBoundingClientRect();
        function onMove(ev: PointerEvent) {
          const r = rectOf();
          mouse.x = ((ev.clientX - r.left) / r.width) * W;
          mouse.y = ((ev.clientY - r.top) / r.height) * H;
        }
        function onDown(ev: PointerEvent) {
          onMove(ev);
          if (stateRef.current === "running") firing = true;
        }
        function onUp() { firing = false; }
        app.canvas.addEventListener("pointermove", onMove);
        app.canvas.addEventListener("pointerdown", onDown);
        window.addEventListener("pointerup", onUp);

        apiRef.current = {
          start: () => {
            reset();
            setState("running");
          },
        };

        // store cleanup on the app for the outer effect
        (app as any)._cleanup = () => {
          app.canvas.removeEventListener("pointermove", onMove);
          app.canvas.removeEventListener("pointerdown", onDown);
          window.removeEventListener("pointerup", onUp);
        };
      });

    return () => {
      destroyed = true;
      const a = appRef.current;
      if (a) {
        (a as any)._cleanup?.();
        a.destroy(true, { children: true });
        appRef.current = null;
      }
    };
  }, []);

  function start() {
    apiRef.current?.start();
  }

  return (
    <div className="mx-auto max-w-4xl px-5">
      <div className="relative overflow-hidden rounded-xl border border-white/10 bg-ink shadow-card">
        <div ref={mountRef} className="w-full" style={{ cursor: "crosshair" }} />

        {/* Live HUD */}
        {state === "running" && (
          <div className="pointer-events-none absolute right-5 top-3 text-right font-display text-sm font-semibold">
            <div style={{ color: "#ffd23b" }}>KALDRIS IMPACT: {timeLeft}s</div>
            <div className="text-silver">
              BASE{" "}
              <span style={{ color: hp > 40 ? "#c9ccd1" : "#ff3b3f" }}>{hp}%</span>
            </div>
          </div>
        )}

        {state !== "running" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-ink/85 text-center backdrop-blur-sm">
            {state === "ready" && (
              <>
                <h3 className="font-display text-3xl font-bold text-chrome">REBEL: BASE SIEGE</h3>
                <p className="mt-2 max-w-md px-6 text-sm text-ash">
                  The machine intelligence, the <span className="text-ember">Null</span>, overran
                  Veyra's databases. The fleet fled to Ostara. You stayed. Hold the last Rebel base
                  while the asteroid <span className="text-ember">Kaldris</span> falls. Aim with the
                  mouse, click to fire the plasma blaster.
                </p>
              </>
            )}
            {state === "over" && (
              <>
                <h3 className="font-display text-3xl font-bold text-ignite">THE BASE HAS FALLEN</h3>
                <p className="mt-2 text-sm text-ash">
                  Null destroyed <span className="text-silver">{score}</span> · Best{" "}
                  <span className="text-silver">{highScore}</span>
                </p>
              </>
            )}
            {state === "win" && (
              <>
                <h3 className="font-display text-3xl font-bold" style={{ color: "#ffd23b" }}>
                  YOU HELD THE LINE
                </h3>
                <p className="mt-2 max-w-md px-6 text-sm text-ash">
                  Kaldris struck, but the base endured. Now the Rebels rebuild Veyra, and watch the
                  sky for a signal from the Infinity fleet on Ostara. Null destroyed{" "}
                  <span className="text-silver">{score}</span>.
                </p>
              </>
            )}
            <button
              onClick={start}
              className="btn-silver sheen mt-6 rounded-sm px-8 py-3 font-display font-semibold"
            >
              {state === "ready" ? "Hold the line" : "Fight again"}
            </button>
            <p className="mt-4 text-xs text-ash">Mouse to aim · click / hold to fire</p>
          </div>
        )}
      </div>
    </div>
  );
}
