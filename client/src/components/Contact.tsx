import { SectionHeading } from "./Services";

export default function Contact() {
  return (
    <section id="contact" className="relative mx-auto max-w-6xl px-5 py-16">
      <div className="sheen relative overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-steel to-ink p-10">
        <div className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-silver/10 blur-3xl" />
        <SectionHeading kicker="Contact" title="Let's build something iconic" />
        <p className="mt-4 max-w-xl text-ash">
          Buy a package, or send a note for a custom quote. I usually reply within
          one business day.
        </p>

        <form
          className="mt-8 grid max-w-2xl gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            alert("Thanks! Wire this form to your email or CRM when you're ready.");
          }}
        >
          <input
            required
            placeholder="Your name"
            className="rounded-sm border border-white/10 bg-coal px-4 py-3 text-sm text-silver outline-none placeholder:text-ash focus:border-silver/60"
          />
          <input
            required
            type="email"
            placeholder="Email"
            className="rounded-sm border border-white/10 bg-coal px-4 py-3 text-sm text-silver outline-none placeholder:text-ash focus:border-silver/60"
          />
          <textarea
            required
            rows={4}
            placeholder="What do you want to build?"
            className="sm:col-span-2 rounded-sm border border-white/10 bg-coal px-4 py-3 text-sm text-silver outline-none placeholder:text-ash focus:border-silver/60"
          />
          <button
            type="submit"
            className="btn-silver sheen sm:col-span-2 rounded-sm py-3 font-display font-semibold"
          >
            Send it
          </button>
        </form>
      </div>
    </section>
  );
}
