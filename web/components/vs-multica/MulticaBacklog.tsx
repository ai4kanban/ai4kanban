import { FiCheck } from "react-icons/fi";
import { Rich } from "../Rich";
import { SectionHeading } from "../SectionHeading";
import { panelInset, panelStatic } from "../styles";
import { MulticaMark } from "./MulticaMark";
import { LogoMark } from "@/components/ui/Logo";
import type { VsMulticaCopy } from "@/i18n/vs-multica/types";

// Both titles are the same sentence with one phrase swapped — "project
// management, ready to run" against "agent infrastructure, ready to run" —
// which is the whole comparison, so the title is what carries the weight and
// the contents below it are a plain checklist of nouns.
function Box({
  ours,
  c,
}: {
  ours?: boolean;
  c: VsMulticaCopy["backlog"]["ours"];
}) {
  return (
    <div
      className={`${ours ? panelStatic : panelInset} p-5 sm:row-span-3 sm:grid sm:grid-rows-subgrid sm:gap-0 sm:p-6`}
    >
      <div className="flex items-center gap-2.5">
        {ours ? <LogoMark size="xs" /> : <MulticaMark className="h-5 w-5" />}
        <p className="font-mono text-[0.65rem] font-semibold uppercase tracking-[0.17em] text-muted">
          {c.label}
        </p>
      </div>
      <h3 className="mt-2 text-xl font-bold leading-snug tracking-tight text-ink">
        {c.title}
      </h3>
      <ul className="mt-5 space-y-3">
        {c.items.map((item) => (
          <li key={item} className="flex items-start gap-3">
            <FiCheck
              className={`mt-1 h-4 w-4 shrink-0 ${ours ? "text-growth" : "text-muted"}`}
              aria-hidden="true"
            />
            <span className="text-[0.95rem] text-ink">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function MulticaBacklog({
  c,
  num = "02",
}: {
  c: VsMulticaCopy["backlog"];
  num?: string;
}) {
  return (
    <section className="mt-24">
      <SectionHeading num={num} {...c.heading} />
      <p className="text-ink">
        <Rich>{c.lead}</Rich>
      </p>
      {/* Subgrid so the eyebrow, the title and the checklist line up across the
          gutter however many lines either title runs to. */}
      <div className="mt-7 grid grid-cols-1 gap-5 sm:grid-cols-2 sm:grid-rows-[auto_auto_auto]">
        <Box ours c={c.ours} />
        <Box c={c.theirs} />
      </div>
    </section>
  );
}
