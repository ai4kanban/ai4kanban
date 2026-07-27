import { features } from "../content";
import { panel } from "../styles";

export function Features() {
  return (
    <section className="mt-20">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        {features.map((f) => (
          <div key={f.title} className={`${panel} p-6`}>
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-lg border-2 border-border bg-code text-xl">
              <span aria-hidden="true">{f.icon}</span>
            </div>
            <h3 className="mb-2 text-lg font-semibold">{f.title}</h3>
            <p className="text-[0.95rem] text-muted">{f.body}</p>
          </div>
        ))}
      </div>
      <p className="mx-auto mt-10 max-w-2xl text-center text-muted">
        AI4Kanban is built for small teams. Today&apos;s coding agents already
        turn a clear spec into working code — hand them a vague idea, though,
        and they&apos;ll build the wrong thing on top of the wrong assumptions.
        AI4Kanban remembers your past decisions and draws on them to turn the
        same vague idea into a spec concrete enough to build.
      </p>
    </section>
  );
}
