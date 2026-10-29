import { lazy, Suspense } from "react";
import Intro from "./components/Intro";
import MusicPlayer from "./components/MusicPlayer";

// VITE_COMING_SOON=true (the public build) locks the site to the Coming Soon
// page. The flag is fixed at build time, so in a locked build the full site's
// code is left out of the bundle entirely: there is nothing hidden underneath
// to expose, on any device or to search engines.
const LOCKED = import.meta.env.VITE_COMING_SOON === "true";
const FullSite = LOCKED ? null : lazy(() => import("./FullSite"));

export default function App() {
  if (!FullSite) {
    return (
      <>
        <Intro />
        <MusicPlayer />
      </>
    );
  }
  return (
    <Suspense fallback={null}>
      <FullSite />
    </Suspense>
  );
}
