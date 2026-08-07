import { FiFlag } from "react-icons/fi";
import { Rich } from "../Rich";
import { SectionHeading } from "../SectionHeading";
import { panelInset } from "../styles";
import type { VsMulticaCopy } from "@/i18n/vs-multica/types";

// Only the gap. This used to be "Multica provides X → you provide Y" with the
// two halves at the same weight, which buried the point and re-listed what the
// section above already inventories. What is left is the four questions you
// answer yourself, in the dashed frame the site uses for the not-yet-built.
export function MulticaHorizon({ c }: { c: VsMulticaCopy["horizon"] }) {
  return (
    <section className="mt-24">
      <SectionHeading num="05" {...c.heading} />
      {c.lead && (
        <p className="text-ink">
          <Rich>{c.lead}</Rich>
        </p>
      )}

      <div className={`${panelInset} mt-7 p-5 sm:p-7`}>
        <p className="font-mono text-[0.65rem] font-semibold uppercase tracking-[0.17em] text-accent-deep">
          {c.visionLabel}
        </p>
        <h3 className="mt-1.5 text-2xl font-bold tracking-tight text-ink">
          {c.visionTitle}
        </h3>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {c.items.map((item, index) => (
            <div
              key={item}
              className="flex items-start gap-3.5 rounded-lg border-2 border-dashed border-border bg-elev p-4"
            >
              <span className="mt-1 font-mono text-[0.7rem] font-bold text-muted">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="text-[0.95rem] font-medium text-ink">
                {item}
              </span>
            </div>
          ))}
        </div>
      </div>

      {c.note && (
        <p className="mt-5 flex items-start gap-2.5 text-sm text-muted">
          <FiFlag
            className="mt-0.5 h-4 w-4 shrink-0 text-caution"
            aria-hidden="true"
          />
          <Rich>{c.note}</Rich>
        </p>
      )}
    </section>
  );
}
