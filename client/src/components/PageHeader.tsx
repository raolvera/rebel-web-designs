export default function PageHeader({
  kicker,
  title,
  subtitle,
}: {
  kicker: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <header className="relative overflow-hidden border-b border-white/5 pt-28 pb-14">
      <div className="pointer-events-none absolute inset-0 grid-floor" />
      <div className="pointer-events-none absolute left-1/2 top-0 h-64 w-64 -translate-x-1/2 rounded-full bg-silver/10 blur-[100px]" />
      <div className="relative mx-auto max-w-6xl px-5">
        <p className="rise mb-3 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-silver">
          <span className="h-px w-8 bg-blood" />
          {kicker}
        </p>
        <h1 className="rise font-display text-4xl font-bold text-chrome sm:text-6xl">
          {title}
        </h1>
        {subtitle && (
          <p className="rise mt-4 max-w-2xl text-ash" style={{ animationDelay: "0.1s" }}>
            {subtitle}
          </p>
        )}
      </div>
    </header>
  );
}
