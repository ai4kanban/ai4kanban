import type { ReactNode } from "react";
import { Rich } from "../Rich";
import { SectionHeading } from "../SectionHeading";
import { panelInset } from "../styles";
import { LogoMark } from "@/components/ui/Logo";
import type { VsLinearCopy } from "@/i18n/vs-linear/types";

function ModelPanel({
  tag,
  name,
  is,
  isnt,
}: {
  tag: ReactNode;
  name: string;
  is: string;
  isnt: string;
}) {
  return (
    <div className={`${panelInset} p-6`}>
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

export function LinearModel({ c }: { c: VsLinearCopy["model"] }) {
  return (
    <section className="mt-24">
      <SectionHeading num="03" {...c.heading} />
      <p className="text-ink">
        <Rich>{c.lead}</Rich>
      </p>
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <ModelPanel tag={<LogoMark size="xs" />} {...c.ours} />
        <ModelPanel tag="◩" {...c.theirs} />
      </div>
      <p className="mt-5 text-sm text-muted">{c.note}</p>
    </section>
  );
}
