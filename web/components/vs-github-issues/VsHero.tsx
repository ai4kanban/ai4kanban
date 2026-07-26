import { FaGithub } from "react-icons/fa";
import { panelStatic } from "../styles";

// A compact two-chip header that states the framing before any detail:
// two different tools, not two takes on the same one.
export function VsHero() {
  return (
    <section className="mt-12 text-center">
      <p className="mb-5 inline-block rounded-full bg-accent/10 px-3 py-1 text-[0.78rem] font-semibold uppercase tracking-wider text-accent">
        Comparison
      </p>
      <h1 className="text-4xl font-bold leading-[1.15] tracking-tight sm:text-5xl">
        AI4Kanban vs.
        <br />
        GitHub Issues
      </h1>
      <p className="mx-auto mt-5 max-w-2xl text-lg text-muted">
        Not a replacement — a different tool for a different bottleneck. GitHub
        Issues is a shared, durable, public system of record. ai4kanban is
        a private, local, agent-native working surface. Pick by what&apos;s
        actually slowing you down.
      </p>

      <div className="mt-8 flex flex-col items-stretch gap-3 text-left sm:flex-row">
        <div className={`${panelStatic} flex-1 bg-code p-5`}>
          <div className="mb-1.5 flex items-center gap-2">
            <span className="text-lg" aria-hidden="true">
              🗂️
            </span>
            <span className="font-semibold text-ink">AI4Kanban</span>
          </div>
          <p className="text-sm text-muted">
            Plain Markdown in your repo. The agent&apos;s fast local scratch-board.
          </p>
        </div>
        <div className="hidden items-center justify-center px-1 font-mono text-sm font-semibold text-muted sm:flex">
          vs
        </div>
        <div className={`${panelStatic} flex-1 bg-code p-5`}>
          <div className="mb-1.5 flex items-center gap-2">
            <FaGithub className="text-lg text-ink" aria-hidden="true" />
            <span className="font-semibold text-ink">GitHub Issues</span>
          </div>
          <p className="text-sm text-muted">
            A database behind an API. The shared, public system of record.
          </p>
        </div>
      </div>
    </section>
  );
}
