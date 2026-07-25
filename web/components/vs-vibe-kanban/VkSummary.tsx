import { SectionHeading } from "../SectionHeading";
import { panelStatic } from "../styles";

// The shutdown is why people are here — lead with it, honestly, then say what
// carries over to the kanban skill and what doesn't.
export function VkSummary() {
  return (
    <section className="mt-24">
      <SectionHeading num="01" eyebrow="The short version" title="Vibe Kanban shut down — where to now?" />
      <p className="text-ink">
        Bloop, the company behind Vibe Kanban, wound down in April 2026. Paid
        plans were cancelled and refunded, the cloud features were retired, and
        the project went fully local. It was left open source under Apache-2.0 —
        but the original repo has had no new commits since late April 2026, so
        its future now rides on community forks rather than the team that built
        it.
      </p>

      <div className={`${panelStatic} mt-5 bg-code p-6`}>
        <p className="text-[0.95rem] text-muted">
          If what you valued in Vibe Kanban was the{" "}
          <span className="font-semibold text-ink">board</span> — a calm place to
          line up and sharpen work for your coding agent — the kanban skill gives
          you that as plain files in git, with no company that can shut down and no
          server to keep alive. If what you valued was the{" "}
          <span className="font-semibold text-ink">
            engine that runs many agents in parallel
          </span>
          , be warned: the kanban skill is not that, and we&apos;d rather tell you
          now than lose you three sections in.
        </p>
      </div>
    </section>
  );
}
