import { Rich } from "../Rich";
import { SectionHeading } from "../SectionHeading";
import { panelInset, panelStatic } from "../styles";
import { MulticaMark } from "./MulticaMark";
import { oursStages, theirsStages } from "./vs-multica-content";
import { LogoMark } from "@/components/ui/Logo";
import type { VsMulticaCopy } from "@/i18n/vs-multica/types";

// One column per product. The job line is the only thing set large, so a reader
// who takes one second off this section leaves with "manages the project" and
// "runs the agents" — the stages under it are the evidence, not the message,
// and are set as a quiet numbered list rather than six competing blocks.
function Track({
  ours,
  label,
  job,
  stages,
}: {
  ours?: boolean;
  label: string;
  job: string;
  stages: string[];
}) {
  return (
    <div className={`${ours ? panelStatic : panelInset} overflow-hidden`}>
      <div className="flex items-center gap-2.5 px-5 pt-5 sm:px-6 sm:pt-6">
        {ours ? <LogoMark size="xs" /> : <MulticaMark className="h-5 w-5" />}
        <p className="font-mono text-[0.65rem] font-semibold uppercase tracking-[0.17em] text-muted">
          {label}
        </p>
      </div>
      <p className="px-5 pb-5 pt-2 text-2xl font-bold tracking-tight text-ink sm:px-6 sm:pb-6">
        {job}
      </p>
      <div className="divide-y-2 divide-border border-t-2 border-border">
        {stages.map((stage, index) => (
          <div
            key={stage}
            className="flex items-center gap-4 px-5 py-3.5 sm:px-6"
          >
            <span
              className={`font-mono text-[0.7rem] font-bold ${
                ours ? "text-accent-deep" : "text-muted"
              }`}
            >
              {String(index + 1).padStart(2, "0")}
            </span>
            <span className="text-[0.95rem] font-medium text-ink">{stage}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function MulticaLifecycle({ c }: { c: VsMulticaCopy["boundary"] }) {
  return (
    <section className="mt-24">
      <SectionHeading num="01" {...c.heading} />
      <p className="text-ink">
        <Rich>{c.lead}</Rich>
      </p>

      <div className="mt-7 grid gap-5 sm:grid-cols-2">
        <Track
          ours
          label={c.oursLabel}
          job={c.oursJob}
          stages={oursStages.map((key) => c.stages[key])}
        />
        <Track
          label={c.theirsLabel}
          job={c.theirsJob}
          stages={theirsStages.map((key) => c.stages[key])}
        />
      </div>
    </section>
  );
}
