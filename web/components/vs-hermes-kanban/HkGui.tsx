import type { ReactNode } from "react";
import { SectionHeading } from "../SectionHeading";
import { HermesMark } from "./HermesMark";
import { panelStatic } from "../styles";

// Expands the table's "Dashboard GUI" row into a section of its own. Both
// sides ship a web board, but they're driven differently: the skill's local
// board turns card actions into agent runs; Hermes's board is a live window
// onto the dispatcher. The shots are real captures of each board — framed
// object-cover from the top-left so the columns read at a glance.

function Screenshot({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="aspect-[3024/1490] w-full overflow-hidden rounded-lg border border-border bg-code">
      <img
        src={src}
        alt={alt}
        loading="lazy"
        className="h-full w-full object-cover object-top"
      />
    </div>
  );
}

function GuiCard({
  tag,
  heading,
  src,
  alt,
  children,
}: {
  tag: ReactNode;
  heading: string;
  src: string;
  alt: string;
  children: ReactNode;
}) {
  return (
    <div className={`${panelStatic} p-5`}>
      <Screenshot src={src} alt={alt} />
      <div className="mt-4 mb-1.5 flex items-center gap-2.5">
        <span className="text-lg" aria-hidden="true">
          {tag}
        </span>
        <h3 className="font-semibold text-ink">{heading}</h3>
      </div>
      <p className="text-sm text-muted">{children}</p>
    </div>
  );
}

export function HkGui() {
  return (
    <section className="mt-24">
      <SectionHeading num="06" eyebrow="The dashboards" title="Kanban Board GUI" />
      <p className="text-ink">
        Both ship a web board, but they play different roles. The skill&apos;s
        board is a <span className="font-semibold">control surface for your agent</span>{" "}
        — card actions kick off runs. Hermes&apos;s board is a{" "}
        <span className="font-semibold">live window onto the dispatcher</span> —
        it shows what the fleet is doing right now.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-6">
        <GuiCard
          tag="🗂️"
          heading="Kanban skill — local board"
          src="https://cdn.ai4kanban.dev/kanban-skill-ui-v2.jpg"
          alt="The kanban skill's local web board — a light board with Blockers, UI, Skill, Docs, and Distribution columns and a Create task button."
        >
          A local web board over the Markdown files. Card actions —{" "}
          <em>implement, review, archive</em> — hand the work to an agent, and
          you watch its log stream back with human-in-the-loop prompts.
        </GuiCard>
        <GuiCard
          tag={<HermesMark className="h-5 w-5" />}
          heading="Hermes Kanban — live dispatcher view"
          src="/hermes-kanban-ui.jpg"
          alt="Hermes Agent's Kanban dashboard — a dark board with Triage, Todo, Scheduled, and Ready columns and an orchestration toolbar."
        >
          A live board that tails the event log — drag-drop between columns, a
          side drawer with run history and exit-status badges, and the same
          board steerable from Discord, Slack, or SMS.
        </GuiCard>
      </div>
    </section>
  );
}
