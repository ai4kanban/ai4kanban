import { FiBookOpen, FiHelpCircle } from "react-icons/fi";
import { Rich } from "../Rich";
import { SectionHeading } from "../SectionHeading";
import { panelInset, panelStatic } from "../styles";
import { MulticaMark } from "./MulticaMark";
import { LogoMark } from "@/components/ui/Logo";
import type { VsMulticaCopy } from "@/i18n/vs-multica/types";

function MemoryCard({
  ours,
  c,
}: {
  ours?: boolean;
  c: VsMulticaCopy["memory"]["ours"] | VsMulticaCopy["memory"]["theirs"];
}) {
  return (
    <div className={`${ours ? panelStatic : panelInset} p-6`}>
      <div className="flex items-start gap-3">
        {ours ? <LogoMark size="xs" /> : <MulticaMark />}
        <div>
          <p className="font-mono text-[0.65rem] font-semibold uppercase tracking-[0.17em] text-accent-deep">
            {c.eyebrow}
          </p>
          <h3 className="mt-1 text-lg font-semibold text-ink">{c.title}</h3>
        </div>
      </div>
      <p className="mt-3 text-sm text-muted">
        <Rich code={ours ? "paper" : "wash"}>{c.body}</Rich>
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {c.examples.map((example) => (
          <span
            key={example}
            className="rounded-md border border-border bg-elev px-2 py-1 font-mono text-[0.68rem] font-semibold text-ink"
          >
            {example}
          </span>
        ))}
      </div>
      <div className="mt-5 rounded-lg border-2 border-border bg-elev p-4">
        <p className="flex items-start gap-2 text-sm font-semibold text-ink">
          <FiHelpCircle className="mt-0.5 h-4 w-4 shrink-0 text-accent-deep" />
          {c.question}
        </p>
        <p className="mt-2 text-sm text-muted">
          <Rich>{c.answer}</Rich>
        </p>
      </div>
    </div>
  );
}

export function MulticaMemory({
  c,
}: {
  c: VsMulticaCopy["memory"];
}) {
  return (
    <section className="mt-24">
      <SectionHeading num="04" {...c.heading} />
      <p className="text-ink">
        <Rich>{c.lead}</Rich>
      </p>
      <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
        <MemoryCard ours c={c.ours} />
        <MemoryCard c={c.theirs} />
      </div>
      <div className="mt-5 flex items-start gap-3 text-sm text-muted">
        <FiBookOpen className="mt-0.5 h-4 w-4 shrink-0 text-accent-deep" />
        <Rich>{c.note}</Rich>
      </div>
    </section>
  );
}
