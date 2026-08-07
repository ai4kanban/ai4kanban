import { LogoMark } from "@/components/ui/Logo";
import type { ReactNode } from "react";
import { Rich } from "../Rich";
import { SectionHeading } from "../SectionHeading";
import { HermesMark } from "./HermesMark";
import { panelStatic } from "../styles";
import type { VsHermesCopy } from "@/i18n/vs-hermes-kanban/types";

// Expands the table's "Dashboard GUI" row into a section of its own. Both
// sides ship a web board, but they're driven differently: the skill's local
// board turns card actions into agent runs; Hermes's board is a live window
// onto the dispatcher. The shots are real captures of each board — framed
// object-cover from the top-left so the columns read at a glance.

function GuiCard({
  tag,
  heading,
  src,
  alt,
  body,
}: {
  tag: ReactNode;
  heading: string;
  src: string;
  alt: string;
  body: string;
}) {
  return (
    <div className={`${panelStatic} p-5`}>
      <div className="aspect-[3024/1490] w-full overflow-hidden rounded-lg border border-border bg-code">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          loading="lazy"
          className="h-full w-full object-cover object-top"
        />
      </div>
      <div className="mt-4 mb-1.5 flex items-center gap-2.5">
        <span className="text-lg" aria-hidden="true">
          {tag}
        </span>
        <h3 className="font-semibold text-ink">{heading}</h3>
      </div>
      <p className="text-sm text-muted">
        <Rich>{body}</Rich>
      </p>
    </div>
  );
}

export function HkGui({
  c,
  num = "06",
  compact = false,
}: {
  c: VsHermesCopy["gui"];
  num?: string;
  compact?: boolean;
}) {
  return (
    <section className="mt-24">
      <SectionHeading num={num} {...c.heading} />
      <p className="text-ink">
        <Rich>{c.lead}</Rich>
      </p>

      <div
        className={`mt-6 grid grid-cols-1 gap-6 ${
          compact ? "sm:grid-cols-2" : ""
        }`}
      >
        <GuiCard
          tag={<LogoMark size="xs" />}
          src="https://cdn.ai4kanban.dev/kanban-skill-ui-v3.jpg"
          {...c.ours}
        />
        <GuiCard
          tag={<HermesMark className="h-5 w-5" />}
          src="/hermes-kanban-ui.jpg"
          {...c.theirs}
        />
      </div>
    </section>
  );
}
