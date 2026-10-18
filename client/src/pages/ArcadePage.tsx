import { lazy, Suspense, useState } from "react";
import PageHeader from "../components/PageHeader";
import RebelRunner from "../components/RebelRunner";
import RebelOutlaw from "../components/RebelOutlaw";

// Heavy engine-based games load only when selected (keeps the rest of the site light).
const BaseSiege = lazy(() => import("../components/BaseSiege"));
const FirstContact = lazy(() => import("../components/FirstContact"));

type Game = "runner" | "outlaw" | "siege" | "fps";

const GAMES: { id: Game; name: string; tagline: string }[] = [
  { id: "runner", name: "Rebel Runner", tagline: "Defeat the beast. Save the helpless." },
  { id: "outlaw", name: "Rebel Outlaw", tagline: "Rob the outlaws. Feed the poor." },
  { id: "siege", name: "Rebel: Base Siege", tagline: "Hold the line against the Null." },
  { id: "fps", name: "Rebel: First Contact", tagline: "3D FPS · blaster + blade." },
];

export default function ArcadePage() {
  const [game, setGame] = useState<Game>("runner");

  return (
    <>
      <PageHeader
        kicker="Arcade"
        title="Rebel Arcade"
        subtitle="Four original games: canvas arcade classics and a 3D FPS. Pick your fight."
      />

      {/* Game picker */}
      <div className="mx-auto mt-8 flex max-w-4xl flex-wrap justify-center gap-4 px-5">
        {GAMES.map((g) => (
          <button
            key={g.id}
            onClick={() => setGame(g.id)}
            className={`sheen flex-1 min-w-[220px] rounded-md border p-4 text-left transition ${
              game === g.id
                ? "border-blood/60 bg-coal shadow-glow"
                : "border-white/10 bg-coal/60 hover:border-silver/30"
            }`}
          >
            <div className="font-display text-lg font-bold text-silver">{g.name}</div>
            <div className="mt-1 text-xs text-ash">{g.tagline}</div>
          </button>
        ))}
      </div>

      <section className="py-10">
        <Suspense
          fallback={
            <div className="mx-auto max-w-4xl px-5 py-20 text-center text-sm text-ash">
              Loading game…
            </div>
          }
        >
          {game === "runner" ? (
            <RebelRunner />
          ) : game === "outlaw" ? (
            <RebelOutlaw />
          ) : game === "siege" ? (
            <BaseSiege />
          ) : (
            <FirstContact />
          )}
        </Suspense>
        <p className="mx-auto mt-8 max-w-2xl px-5 text-center text-sm text-ash">
          Built from scratch with an HTML5 canvas and WebGL. Rebel Outlaw even names the
          ones you save using a live API. Just the kind of thing Rebel Web Designs builds
          when it's time to show off. 🤘
        </p>
      </section>
    </>
  );
}
