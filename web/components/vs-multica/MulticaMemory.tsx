import { FiBookOpen } from "react-icons/fi";
import { Rich } from "../Rich";
import { SectionHeading } from "../SectionHeading";
import { panelInset, panelStatic } from "../styles";
import { MulticaMark } from "./MulticaMark";
import { LogoMark } from "@/components/ui/Logo";
import type { VsMulticaCopy } from "@/i18n/vs-multica/types";

// Three layers, no more: the title (one side keeps the why, the other the how),
// the file names that prove it, and one question the memory answers. The
// paragraph that used to sit between the title and the chips said the same
// thing as both of them at a weight that competed with neither.
function MemoryCard({
  ours,
  c,
}: {
  ours?: boolean;
  c: VsMulticaCopy["memory"]["ours"];
}) {
  return (
    <div
      className={`${ours ? panelStatic : panelInset} p-5 sm:row-span-3 sm:grid sm:grid-rows-subgrid sm:gap-0 sm:p-6`}
    >
      <div>
        <div className="flex items-center gap-2.5">
          {ours ? <LogoMark size="xs" /> : <MulticaMark className="h-5 w-5" />}
          <p className="font-mono text-[0.65rem] font-semibold uppercase tracking-[0.17em] text-muted">
            {c.eyebrow}
          </p>
        </div>
        <h3 className="mt-2 text-xl font-bold leading-snug tracking-tight text-ink">
          {c.title}
        </h3>
      </div>

      {/* Both the chips and the answer box take the neighbouring step of the
          ramp, so they read as sunk into whichever card they are on: the wash
          on our paper card, the paper on their inset one. */}
      <div className="mt-4 flex flex-wrap gap-2">
        {c.examples.map((example) => (
          <span
            key={example}
            className={`rounded-md border-2 border-border px-2 py-1 font-mono text-[0.68rem] font-semibold text-ink ${
              ours ? "bg-code" : "bg-elev"
            }`}
          >
            {example}
          </span>
        ))}
      </div>

      <div
        className={`mt-5 rounded-lg p-4 ${ours ? "bg-code" : "bg-elev"}`}
      >
        <p className="text-sm font-semibold text-ink">{c.question}</p>
        <p className="mt-1.5 text-sm text-muted">
          <Rich code={ours ? "wash" : "paper"}>{c.answer}</Rich>
        </p>
      </div>
    </div>
  );
}

export function MulticaMemory({ c }: { c: VsMulticaCopy["memory"] }) {
  return (
    <section className="mt-24">
      <SectionHeading num="04" {...c.heading} />
      {c.lead && (
        <p className="text-ink">
          <Rich>{c.lead}</Rich>
        </p>
      )}
      <div className="mt-7 grid grid-cols-1 gap-5 sm:grid-cols-2 sm:grid-rows-[auto_auto_auto]">
        <MemoryCard ours c={c.ours} />
        <MemoryCard c={c.theirs} />
      </div>
      {c.note && (
        <div className="mt-5 flex items-start gap-3 text-sm text-muted">
          <FiBookOpen className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
          <Rich>{c.note}</Rich>
        </div>
      )}
    </section>
  );
}
