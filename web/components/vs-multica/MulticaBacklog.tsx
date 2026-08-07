import { FiArrowDown, FiMoon, FiRefreshCw, FiZap } from "react-icons/fi";
import { Rich } from "../Rich";
import { SectionHeading } from "../SectionHeading";
import { panelInset, panelStatic } from "../styles";
import { MulticaMark } from "./MulticaMark";
import { LogoMark } from "@/components/ui/Logo";
import type { VsMulticaCopy } from "@/i18n/vs-multica/types";

function Track({
  ours,
  c,
}: {
  ours?: boolean;
  c: VsMulticaCopy["backlog"]["ours"] | VsMulticaCopy["backlog"]["theirs"];
}) {
  return (
    <div className={`${ours ? panelStatic : panelInset} p-5 sm:p-6`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          {ours ? <LogoMark size="xs" /> : <MulticaMark />}
          <div>
            <p className="font-mono text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-accent-deep">
              {c.label}
            </p>
            <h3 className="font-semibold text-ink">{c.title}</h3>
          </div>
        </div>
        <span
          className={`rounded-full border-2 border-border px-2.5 py-1 font-mono text-[0.62rem] font-bold uppercase tracking-wider ${
            ours ? "bg-accent-deep text-elev" : "bg-code text-muted"
          }`}
        >
          {c.state}
        </span>
      </div>
      <p className="mt-3 text-sm text-muted">
        <Rich code={ours ? "paper" : "wash"}>{c.body}</Rich>
      </p>

      <div className="mt-5 space-y-2">
        {c.steps.map((step, index) => (
          <div key={step}>
            <div className="flex items-center gap-3 rounded-lg border border-border bg-elev px-3 py-2.5">
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${
                  ours ? "bg-accent-deep text-elev" : "bg-ink text-elev"
                }`}
              >
                {ours ? (
                  <FiRefreshCw className="h-3.5 w-3.5" />
                ) : index === 0 ? (
                  <FiMoon className="h-3.5 w-3.5" />
                ) : (
                  <FiZap className="h-3.5 w-3.5" />
                )}
              </span>
              <span className="text-sm font-medium text-ink">{step}</span>
            </div>
            {index < c.steps.length - 1 && (
              <FiArrowDown className="mx-auto my-1 h-3.5 w-3.5 text-muted" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function MulticaBacklog({
  c,
}: {
  c: VsMulticaCopy["backlog"];
}) {
  return (
    <section className="mt-24">
      <SectionHeading num="02" {...c.heading} />
      <p className="text-ink">
        <Rich>{c.lead}</Rich>
      </p>
      <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Track ours c={c.ours} />
        <Track c={c.theirs} />
      </div>
      <p className="mt-5 text-sm text-muted">
        <Rich>{c.note}</Rich>
      </p>
    </section>
  );
}
