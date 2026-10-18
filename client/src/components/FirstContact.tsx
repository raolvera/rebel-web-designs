import { useEffect, useRef, useState } from "react";
import {
  Engine,
  Scene,
  UniversalCamera,
  Vector3,
  Color3,
  Color4,
  HemisphericLight,
  PointLight,
  DirectionalLight,
  MeshBuilder,
  StandardMaterial,
  PBRMaterial,
  GlowLayer,
  DefaultRenderingPipeline,
  Texture,
  DynamicTexture,
  type Mesh,
} from "@babylonjs/core";

/**
 * REBEL: FIRST CONTACT — a DOOM-style first-person shooter (Babylon.js).
 *
 * Lore: inside Veyra's overrun server facility, the Rebel hunts the Null
 * machines room to room. Switch between the Plasma Blaster and the Rebel Blade.
 *
 * Controls: click to lock the mouse → look with mouse, WASD to move, click to
 * attack, 1 = blaster, 2 = sword, Esc to release the mouse. Self-contained 3D
 * (stylized shapes, no external models). Code-split so it only loads here.
 */

type GameState = "ready" | "running" | "over";
type Weapon = "blaster" | "blade";

const HS_KEY = "rebelFirstContactHighScore";

export default function FirstContact() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<GameState>("ready");
  const [kills, setKills] = useState(0);
  const [hp, setHp] = useState(100);
  const [weapon, setWeapon] = useState<Weapon>("blaster");
  const [highScore, setHighScore] = useState(0);
  const [locked, setLocked] = useState(false);

  const stateRef = useRef<GameState>("ready");
  const apiRef = useRef<{ start: () => void } | null>(null);

  useEffect(() => {
    setHighScore(Number(localStorage.getItem(HS_KEY) || 0));
  }, []);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = new Engine(canvas, true, {
      preserveDrawingBuffer: false,
      antialias: true,
    });
    const scene = new Scene(engine);
    scene.clearColor = new Color4(0.05, 0.06, 0.07, 1);
    scene.fogMode = Scene.FOGMODE_EXP2;
    scene.fogColor = new Color3(0.07, 0.08, 0.1);
    scene.fogDensity = 0.02;

    // Camera (the Rebel) with FPS collisions
    const camera = new UniversalCamera("cam", new Vector3(0, 1.6, 0), scene);
    camera.minZ = 0.1;
    camera.speed = 0.5;
    camera.inertia = 0.3;
    camera.angularSensibility = 900;
    camera.checkCollisions = true;
    camera.applyGravity = false;
    camera.ellipsoid = new Vector3(0.6, 0.9, 0.6);
    camera.keysUp = [87]; // W
    camera.keysDown = [83]; // S
    camera.keysLeft = [65]; // A
    camera.keysRight = [68]; // D
    scene.collisionsEnabled = true;
    camera.attachControl(canvas, true);

    // Lighting
    const amb = new HemisphericLight("amb", new Vector3(0, 1, 0), scene);
    amb.intensity = 0.3;
    amb.diffuse = new Color3(0.6, 0.65, 0.8);
    amb.groundColor = new Color3(0.1, 0.02, 0.05);
    const dir = new DirectionalLight("dir", new Vector3(-0.4, -1, 0.3), scene);
    dir.intensity = 0.5;
    dir.diffuse = new Color3(0.8, 0.85, 1);
    const redGlow = new PointLight("glow", new Vector3(0, 4, 0), scene);
    redGlow.diffuse = new Color3(0.85, 0.9, 1); // cool white/chrome highlight
    redGlow.intensity = 0.7;
    redGlow.range = 22;

    // --- Post-processing: subtle glow + bloom (tuned so reds stay crimson,
    // not pink — lower intensity + higher threshold keeps it deep/dark) ---
    const glow = new GlowLayer("glow", scene, { blurKernelSize: 32 });
    glow.intensity = 0.55;

    const pipeline = new DefaultRenderingPipeline("fx", true, scene, [scene.activeCamera!]);
    pipeline.bloomEnabled = true;
    pipeline.bloomThreshold = 0.85; // only the brightest bits bloom → no pink wash
    pipeline.bloomWeight = 0.3;
    pipeline.bloomKernel = 48;
    pipeline.bloomScale = 0.5;
    pipeline.fxaaEnabled = true;
    pipeline.imageProcessing.contrast = 1.3;
    pipeline.imageProcessing.exposure = 1.0;
    pipeline.imageProcessing.vignetteEnabled = true;
    pipeline.imageProcessing.vignetteWeight = 2.2;
    pipeline.imageProcessing.vignetteColor = new Color4(0.02, 0.03, 0.05, 1);
    pipeline.grainEnabled = true;
    pipeline.grain.intensity = 5;

    const SIZE = 48;

    // Procedural neon-grid texture for the floor
    const gridTex = new DynamicTexture("grid", { width: 1024, height: 1024 }, scene, false);
    const gctx = gridTex.getContext() as unknown as CanvasRenderingContext2D;
    gctx.fillStyle = "#0c0e12";
    gctx.fillRect(0, 0, 1024, 1024);
    gctx.strokeStyle = "rgba(180,195,215,0.45)"; // cool steel grid
    gctx.lineWidth = 2;
    for (let i = 0; i <= 1024; i += 64) {
      gctx.beginPath(); gctx.moveTo(i, 0); gctx.lineTo(i, 1024); gctx.stroke();
      gctx.beginPath(); gctx.moveTo(0, i); gctx.lineTo(1024, i); gctx.stroke();
    }
    gridTex.update();
    gridTex.uScale = 12;
    gridTex.vScale = 12;

    // PBR floor — reflective metal with the glowing grid
    const floorMat = new PBRMaterial("floor", scene);
    floorMat.albedoColor = new Color3(0.14, 0.15, 0.18);
    floorMat.metallic = 1;
    floorMat.roughness = 0.2; // polished chrome — more reflective
    floorMat.emissiveTexture = gridTex;
    floorMat.emissiveColor = new Color3(0.55, 0.6, 0.68);
    (floorMat.emissiveTexture as Texture).uScale = 12;
    (floorMat.emissiveTexture as Texture).vScale = 12;

    const wallMat = new PBRMaterial("wall", scene);
    wallMat.albedoColor = new Color3(0.16, 0.17, 0.2);
    wallMat.metallic = 1;
    wallMat.roughness = 0.3; // brushed chrome walls
    wallMat.emissiveColor = new Color3(0.03, 0.04, 0.05);

    const enemyMat = new PBRMaterial("enemy", scene);
    enemyMat.albedoColor = new Color3(0.72, 0.75, 0.82);
    enemyMat.metallic = 1;
    enemyMat.roughness = 0.15; // bright polished chrome robots
    enemyMat.emissiveColor = new Color3(0.02, 0.02, 0.03);

    const eyeMat = new StandardMaterial("eye", scene);
    eyeMat.emissiveColor = new Color3(0.4, 0.85, 1); // cyan optic reads clean on chrome
    eyeMat.disableLighting = true;

    // Arena
    const floor = MeshBuilder.CreateGround("floor", { width: SIZE, height: SIZE }, scene);
    floor.material = floorMat;
    floor.checkCollisions = true;
    const ceiling = MeshBuilder.CreateGround("ceil", { width: SIZE, height: SIZE }, scene);
    ceiling.position.y = 7;
    ceiling.rotation.x = Math.PI;
    const ceilMat = new PBRMaterial("ceil", scene);
    ceilMat.albedoColor = new Color3(0.03, 0.03, 0.04);
    ceilMat.metallic = 0.6;
    ceilMat.roughness = 0.6;
    ceiling.material = ceilMat;

    function wall(x: number, z: number, w: number, d: number) {
      const m = MeshBuilder.CreateBox("w", { width: w, height: 7, depth: d }, scene);
      m.position.set(x, 3.5, z);
      m.material = wallMat;
      m.checkCollisions = true;
      // glowing neon trim strip along the top of each wall
      const trim = MeshBuilder.CreateBox("trim", { width: w + 0.1, height: 0.18, depth: d + 0.1 }, scene);
      trim.position.set(x, 6.4, z);
      const trimMat = new StandardMaterial("trimmat", scene);
      trimMat.emissiveColor = new Color3(0.5, 0.7, 0.9); // cool steel-blue trim
      trimMat.disableLighting = true;
      trim.material = trimMat;
      trim.isPickable = false;
      return m;
    }
    const half = SIZE / 2;
    wall(0, half, SIZE, 1);
    wall(0, -half, SIZE, 1);
    wall(half, 0, 1, SIZE);
    wall(-half, 0, 1, SIZE);
    // a few interior pillars for cover
    wall(-10, -8, 3, 3);
    wall(9, 6, 3, 3);
    wall(6, -12, 3, 3);
    wall(-8, 11, 3, 3);

    // Weapon viewmodel (attached to camera)
    const blaster = MeshBuilder.CreateBox("blaster", { width: 0.4, height: 0.3, depth: 1.1 }, scene);
    const blasterMat = new StandardMaterial("bmat", scene);
    blasterMat.diffuseColor = new Color3(0.8, 0.82, 0.88);
    blasterMat.emissiveColor = new Color3(0.2, 0.2, 0.25);
    blaster.material = blasterMat;
    blaster.parent = camera;
    blaster.position.set(0.5, -0.45, 1.2);
    blaster.isPickable = false;

    const blade = MeshBuilder.CreateBox("blade", { width: 0.1, height: 0.1, depth: 1.6 }, scene);
    const bladeMat = new StandardMaterial("blademat", scene);
    bladeMat.emissiveColor = new Color3(1, 0.2, 0.25);
    bladeMat.diffuseColor = new Color3(0.9, 0.9, 0.95);
    blade.material = bladeMat;
    blade.parent = camera;
    blade.position.set(0.45, -0.4, 1.4);
    blade.rotation.x = 0.2;
    blade.setEnabled(false);
    blade.isPickable = false;

    // Muzzle flash sprite
    const muzzle = MeshBuilder.CreatePlane("muzzle", { size: 0.5 }, scene);
    const muzzleMat = new StandardMaterial("mmat", scene);
    muzzleMat.emissiveColor = new Color3(1, 0.85, 0.2);
    muzzleMat.disableLighting = true;
    muzzle.material = muzzleMat;
    muzzle.parent = camera;
    muzzle.position.set(0.5, -0.4, 2.0);
    muzzle.setEnabled(false);
    muzzle.isPickable = false;

    // Muzzle-flash light (bright pop when firing)
    const muzzleLight = new PointLight("muzzleLight", new Vector3(0, 0, 0), scene);
    muzzleLight.diffuse = new Color3(1, 0.85, 0.3);
    muzzleLight.intensity = 0;
    muzzleLight.range = 14;

    // ---- game state ----
    type Enemy = { mesh: Mesh; eye: Mesh; hp: number; dead?: boolean };
    type Shot = { mesh: Mesh; dir: Vector3; life: number; dead?: boolean };
    type Boom = { mesh: Mesh; life: number };
    let enemies: Enemy[] = [];
    let shots: Shot[] = [];
    let booms: Boom[] = [];
    let localKills = 0;
    let localHp = 100;
    let curWeapon: Weapon = "blaster";
    let fireCd = 0;
    let swingT = 0;
    let spawnCd = 0;
    let running = false;

    function spawnEnemy() {
      const ang = Math.random() * Math.PI * 2;
      const dist = 12 + Math.random() * 6;
      const x = Math.cos(ang) * dist;
      const z = Math.sin(ang) * dist;
      // Bipedal chrome war-machine: torso, head+visor, shoulders, arms, legs.
      // "body" is an invisible root so the whole rig moves/rotates together.
      const body = MeshBuilder.CreateBox("en", { width: 0.1, height: 0.1, depth: 0.1 }, scene);
      body.isVisible = false;
      body.position.set(x, 0, z);
      body.checkCollisions = false;

      const torso = MeshBuilder.CreateBox("torso", { width: 0.95, height: 1.0, depth: 0.6 }, scene);
      torso.material = enemyMat; torso.parent = body; torso.position.set(0, 1.35, 0);
      // chest core (glowing)
      const core = MeshBuilder.CreateBox("core", { width: 0.3, height: 0.3, depth: 0.1 }, scene);
      core.material = eyeMat; core.parent = torso; core.position.set(0, 0.05, 0.32);

      // head + visor
      const head = MeshBuilder.CreateBox("head", { width: 0.55, height: 0.45, depth: 0.55 }, scene);
      head.material = enemyMat; head.parent = body; head.position.set(0, 2.05, 0);
      const eye = MeshBuilder.CreateBox("eye", { width: 0.45, height: 0.1, depth: 0.08 }, scene);
      eye.material = eyeMat; eye.parent = head; eye.position.set(0, 0.02, 0.28);

      // shoulders + arms
      [-0.72, 0.72].forEach((ax) => {
        const sh = MeshBuilder.CreateSphere("sh", { diameter: 0.45, segments: 8 }, scene);
        sh.material = enemyMat; sh.parent = body; sh.position.set(ax, 1.7, 0);
        const arm = MeshBuilder.CreateBox("arm", { width: 0.28, height: 1.0, depth: 0.28 }, scene);
        arm.material = enemyMat; arm.parent = body; arm.position.set(ax, 1.1, 0.05);
      });

      // hips + legs
      const hips = MeshBuilder.CreateBox("hips", { width: 0.8, height: 0.4, depth: 0.55 }, scene);
      hips.material = enemyMat; hips.parent = body; hips.position.set(0, 0.75, 0);
      [-0.28, 0.28].forEach((lx) => {
        const leg = MeshBuilder.CreateBox("leg", { width: 0.3, height: 1.1, depth: 0.35 }, scene);
        leg.material = enemyMat; leg.parent = body; leg.position.set(lx, 0.1, 0);
      });

      enemies.push({ mesh: body, eye, hp: 2 + Math.floor(localKills / 10) });
    }

    function boom(pos: Vector3, color: Color3, size = 1.2) {
      const s = MeshBuilder.CreateSphere("boom", { diameter: size }, scene);
      const m = new StandardMaterial("boommat", scene);
      m.emissiveColor = color;
      m.disableLighting = true;
      m.alpha = 0.9;
      s.material = m;
      s.position.copyFrom(pos);
      booms.push({ mesh: s, life: 1 });
    }

    function fireBlaster() {
      if (fireCd > 0) return;
      fireCd = 180;
      muzzle.setEnabled(true);
      muzzleLight.position.copyFrom(camera.position);
      muzzleLight.intensity = 3;
      setTimeout(() => { muzzle.setEnabled(false); muzzleLight.intensity = 0; }, 60);
      const dir = camera.getDirection(new Vector3(0, 0, 1));
      const s = MeshBuilder.CreateSphere("shot", { diameter: 0.25 }, scene);
      const sm = new StandardMaterial("shotmat", scene);
      sm.emissiveColor = new Color3(1, 0.23, 0.25);
      sm.disableLighting = true;
      s.material = sm;
      s.position.copyFrom(camera.position).addInPlace(dir.scale(1.5));
      shots.push({ mesh: s, dir, life: 2000 });
    }

    function swingBlade() {
      if (swingT > 0) return;
      swingT = 300;
      // hit any enemy within ~3 units in front
      const fwd = camera.getDirection(new Vector3(0, 0, 1));
      for (const e of enemies) {
        if (e.dead) continue;
        const to = e.mesh.position.subtract(camera.position);
        const dist = to.length();
        if (dist < 3.2 && Vector3.Dot(to.normalize(), fwd) > 0.5) {
          e.hp -= 3;
          boom(e.mesh.position, new Color3(1, 0.2, 0.25), 1.4);
          if (e.hp <= 0) killEnemy(e);
        }
      }
    }

    function killEnemy(e: Enemy) {
      e.dead = true;
      localKills += 1;
      setKills(localKills);
      boom(e.mesh.position, new Color3(1, 0.55, 0.15), 2);
    }

    function hurt(d: number) {
      localHp -= d;
      setHp(Math.max(0, Math.round(localHp)));
      scene.clearColor = new Color4(0.25, 0.0, 0.03, 1);
      setTimeout(() => (scene.clearColor = new Color4(0.04, 0.04, 0.05, 1)), 90);
      if (localHp <= 0) end();
    }

    function end() {
      running = false;
      setState("over");
      const best = Math.max(localKills, Number(localStorage.getItem(HS_KEY) || 0));
      localStorage.setItem(HS_KEY, String(best));
      setHighScore(best);
      document.exitPointerLock?.();
    }

    // input: attack + weapon switch
    function onPointerDown() {
      if (!running) return;
      if (curWeapon === "blaster") fireBlaster();
      else swingBlade();
    }
    function onKey(e: KeyboardEvent) {
      if (e.code === "Digit1") { curWeapon = "blaster"; setWeapon("blaster"); blaster.setEnabled(true); blade.setEnabled(false); }
      if (e.code === "Digit2") { curWeapon = "blade"; setWeapon("blade"); blaster.setEnabled(false); blade.setEnabled(true); }
    }
    canvas.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKey);

    // pointer lock state
    function onLockChange() {
      setLocked(document.pointerLockElement === canvas);
    }
    document.addEventListener("pointerlockchange", onLockChange);

    // main loop
    scene.onBeforeRenderObservable.add(() => {
      const dt = engine.getDeltaTime();
      if (fireCd > 0) fireCd -= dt;

      // weapon bob / swing anim
      if (swingT > 0) {
        swingT -= dt;
        blade.rotation.z = Math.sin((1 - swingT / 300) * Math.PI) * 1.2;
      } else {
        blade.rotation.z = 0;
      }

      // shots
      for (const sh of shots) {
        sh.mesh.position.addInPlace(sh.dir.scale(dt * 0.04));
        sh.life -= dt;
        if (sh.life <= 0) sh.dead = true;
        for (const e of enemies) {
          if (e.dead) continue;
          if (Vector3.Distance(sh.mesh.position, e.mesh.position) < 1.1) {
            sh.dead = true;
            e.hp -= 1;
            boom(sh.mesh.position, new Color3(1, 0.85, 0.2), 0.8);
            if (e.hp <= 0) killEnemy(e);
            break;
          }
        }
      }
      shots = shots.filter((s) => { if (s.dead) s.mesh.dispose(); return !s.dead; });

      if (running) {
        // spawn
        spawnCd -= dt;
        if (spawnCd <= 0 && enemies.filter((e) => !e.dead).length < 14) {
          spawnEnemy();
          spawnCd = Math.max(1800 - localKills * 40, 700);
        }
        // enemies chase + attack
        for (const e of enemies) {
          if (e.dead) continue;
          const to = camera.position.subtract(e.mesh.position);
          to.y = 0;
          const d = to.length();
          if (d > 1.6) {
            to.normalize();
            const sp = (0.0025 + localKills * 0.00004) * dt;
            e.mesh.position.addInPlace(to.scale(sp));
            e.mesh.lookAt(new Vector3(camera.position.x, e.mesh.position.y, camera.position.z));
          } else {
            // attack on contact (throttled by cooldown baked into hp pulse)
            if (Math.random() < 0.04) hurt(6);
          }
        }
        enemies = enemies.filter((e) => { if (e.dead) { e.mesh.dispose(); } return !e.dead; });
      }

      // booms expand + fade
      for (const b of booms) {
        b.life -= dt / 400;
        b.mesh.scaling.setAll(1 + (1 - b.life) * 2);
        (b.mesh.material as StandardMaterial).alpha = Math.max(b.life, 0);
      }
      booms = booms.filter((b) => { if (b.life <= 0) b.mesh.dispose(); return b.life > 0; });

      redGlow.position.copyFrom(camera.position);
    });

    engine.runRenderLoop(() => scene.render());
    const onResize = () => engine.resize();
    window.addEventListener("resize", onResize);

    apiRef.current = {
      start: () => {
        // reset
        enemies.forEach((e) => e.mesh.dispose());
        shots.forEach((s) => s.mesh.dispose());
        booms.forEach((b) => b.mesh.dispose());
        enemies = []; shots = []; booms = [];
        localKills = 0; localHp = 100; curWeapon = "blaster";
        setKills(0); setHp(100); setWeapon("blaster");
        blaster.setEnabled(true); blade.setEnabled(false);
        camera.position.set(0, 1.6, 0);
        running = true;
        setState("running");
        canvas.requestPointerLock?.();
      },
    };

    return () => {
      canvas.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("pointerlockchange", onLockChange);
      engine.stopRenderLoop();
      scene.dispose();
      engine.dispose();
    };
  }, []);

  function start() {
    apiRef.current?.start();
  }

  return (
    <div className="mx-auto max-w-4xl px-5">
      <div className="relative overflow-hidden rounded-xl border border-white/10 bg-ink shadow-card">
        <canvas
          ref={canvasRef}
          style={{ width: "100%", height: "70vh", maxHeight: 560, display: "block" }}
        />

        {/* crosshair */}
        {state === "running" && (
          <>
            <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-silver/70">
              +
            </div>
            <div className="pointer-events-none absolute left-5 top-4 font-display text-sm font-semibold">
              <div className="text-silver">
                HP <span style={{ color: hp > 40 ? "#c9ccd1" : "#ff3b3f" }}>{hp}</span>
              </div>
              <div className="text-ash">Null down: {kills}</div>
            </div>
            <div className="pointer-events-none absolute right-5 top-4 text-right font-display text-sm font-semibold">
              <span className={weapon === "blaster" ? "text-silver" : "text-ash"}>1·Blaster</span>
              <span className="mx-2 text-ash">/</span>
              <span className={weapon === "blade" ? "text-ember" : "text-ash"}>2·Blade</span>
            </div>
            {!locked && (
              <div className="pointer-events-none absolute inset-x-0 bottom-6 text-center text-xs text-ash">
                Click the screen to lock the mouse and look around
              </div>
            )}
          </>
        )}

        {state !== "running" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-ink/85 text-center backdrop-blur-sm">
            {state === "ready" ? (
              <>
                <h3 className="font-display text-3xl font-bold text-chrome">REBEL: FIRST CONTACT</h3>
                <p className="mt-2 max-w-md px-6 text-sm text-ash">
                  Inside Veyra's overrun server facility, hunt the <span className="text-ember">Null</span>{" "}
                  machines room to room. Mouse to look, WASD to move, click to attack.
                  <span className="text-silver"> 1</span> = Plasma Blaster,{" "}
                  <span className="text-ember">2</span> = Rebel Blade.
                </p>
              </>
            ) : (
              <>
                <h3 className="font-display text-3xl font-bold text-ignite">OVERRUN</h3>
                <p className="mt-2 text-sm text-ash">
                  Null destroyed <span className="text-silver">{kills}</span> · Best{" "}
                  <span className="text-silver">{highScore}</span>
                </p>
              </>
            )}
            <button
              onClick={start}
              className="btn-silver sheen mt-6 rounded-sm px-8 py-3 font-display font-semibold"
            >
              {state === "ready" ? "Enter the facility" : "Re-enter"}
            </button>
            <p className="mt-4 text-xs text-ash">Mouse look · WASD move · click attack · 1/2 switch weapon · Esc release</p>
          </div>
        )}
      </div>
    </div>
  );
}
