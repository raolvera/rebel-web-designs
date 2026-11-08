import PageHeader from "../components/PageHeader";
import RebelRunner from "../components/RebelRunner";

export default function ArcadePage() {
  return (
    <>
      <PageHeader
        kicker="Arcade"
        title="Rebel Arcade"
        subtitle="Rebel Runner: defeat the beast, save the helpless."
      />

      <section className="py-10">
        <RebelRunner />
        <p className="mx-auto mt-8 max-w-2xl px-5 text-center text-sm text-ash">
          Built from scratch on an HTML5 canvas. Just the kind of thing Rebel Web Designs
          builds when it's time to show off. 🤘
        </p>
      </section>
    </>
  );
}
