import { SectionHeading } from "../SectionHeading";
import { panelStatic } from "../styles";

// The crux of the whole page: these tools sit at different points in the loop.
// Say it as two plain panels so nobody mistakes one for a drop-in of the other.
function PurposePanel({
  tag,
  name,
  is,
  isnt,
}: {
  tag: string;
  name: string;
  is: string;
  isnt: string;
}) {
  return (
    <div className={`${panelStatic} bg-code p-6`}>
      <div className="mb-4 flex items-center gap-2.5">
        <span className="text-xl" aria-hidden="true">
          {tag}
        </span>
        <h3 className="text-lg font-semibold text-ink">{name}</h3>
      </div>
      <p className="text-[0.95rem] text-ink">{is}</p>
      <p className="mt-3 text-[0.9rem] text-muted">{isnt}</p>
    </div>
  );
}

export function VkPurpose() {
  return (
    <section className="mt-24">
      <SectionHeading num="03" eyebrow="The real difference" title="Planning board vs. orchestration cockpit" />
      <p className="text-ink">
        The two tools sit at different points in the loop. One is where you decide{" "}
        <span className="font-medium">what to build</span>; the other is where you{" "}
        <span className="font-medium">run the agents that build it</span>. Mistaking
        one for the other is how you end up disappointed — so here it is straight.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <PurposePanel
          tag="🗂️"
          name="Kanban skill — the plan"
          is="A board your agent reads and edits as plain Markdown in your repo. You save a rough idea, a refine loop sharpens it into a ready task, and you approve before code is written. The work lives in git, next to the code it changes."
          isnt="It does not run agents, spin up worktrees, or diff their output — your harness does that. It's the map, not the engine."
        />
        <PurposePanel
          tag="🎛️"
          name="Vibe Kanban — the engine"
          is="A local web app that runs many coding agents at once, each isolated in its own git worktree, then lets you review their diffs and preview the app in one place. Its value is throughput across parallel agent runs."
          isnt="It isn't built to sharpen a half-formed idea into a plan — the board mostly queues and tracks runs. Refinement is minimal."
        />
      </div>

      <p className="mt-5 text-sm text-muted">
        Plenty of people ran Vibe Kanban for its board alone. If that was you, the
        kanban skill is a lighter home for it — files in git, nothing to keep
        running. If you ran it to drive agents in parallel, keep an eye on the
        community forks; the kanban skill won&apos;t replace that engine.
      </p>
    </section>
  );
}
