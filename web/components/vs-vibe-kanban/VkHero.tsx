import { panelStatic } from "../styles";

// A compact two-chip header that states the framing before any detail:
// two different tools for two different bottlenecks, not two takes on one.
export function VkHero() {
  return (
    <section className="mt-12 text-center">
      <p className="mb-5 inline-block rounded-full bg-accent/10 px-3 py-1 text-[0.78rem] font-semibold uppercase tracking-wider text-accent">
        Comparison
      </p>
      <h1 className="text-4xl font-bold leading-[1.15] tracking-tight sm:text-5xl">
        Kanban skill vs.
        <br />
        Vibe Kanban
      </h1>
      <p className="mx-auto mt-5 max-w-2xl text-lg text-muted">
        Vibe Kanban is a cockpit for running many coding agents in parallel — and
        the company behind it, Bloop, shut down in April 2026. The kanban skill is
        a planning board your agent edits as plain files in your repo. They fix
        different bottlenecks. Here&apos;s the honest difference, and what actually
        carries over.
      </p>

      <div className="mt-8 flex flex-col items-stretch gap-3 text-left sm:flex-row">
        <div className={`${panelStatic} flex-1 bg-code p-5`}>
          <div className="mb-1.5 flex items-center gap-2">
            <span className="text-lg" aria-hidden="true">
              🗂️
            </span>
            <span className="font-semibold text-ink">Kanban skill</span>
          </div>
          <p className="text-sm text-muted">
            Plain Markdown in your repo. A planning board your agent edits.
          </p>
        </div>
        <div className="hidden items-center justify-center px-1 font-mono text-sm font-semibold text-muted sm:flex">
          vs
        </div>
        <div className={`${panelStatic} flex-1 bg-code p-5`}>
          <div className="mb-1.5 flex items-center gap-2">
            <span className="text-lg" aria-hidden="true">
              🎛️
            </span>
            <span className="font-semibold text-ink">Vibe Kanban</span>
          </div>
          <p className="text-sm text-muted">
            A local web app. A cockpit that runs many agents in parallel.
          </p>
        </div>
      </div>
    </section>
  );
}
