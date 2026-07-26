import { SectionHeading } from "../SectionHeading";
import { panelStatic } from "../styles";

// The honest TL;DR up front: GitHub Issues can do it too — the difference is cost.
export function VsSummary() {
  return (
    <section className="mt-24">
      <SectionHeading num="01" eyebrow="The short version" title="So why not just use GitHub Issues?" />
      <p className="text-ink">
        You can. Almost everything ai4kanban does, you could do with GitHub
        Issues plus the{" "}
        <code className="rounded bg-accent/10 px-1.5 py-0.5 font-mono text-[0.9em] text-ink">
          gh
        </code>{" "}
        CLI or a GitHub MCP server. The difference is what it costs to get there.
      </p>

      <div className={`${panelStatic} mt-5 bg-code p-6`}>
        <p className="text-[0.95rem] text-muted">
          The same task on GitHub Issues means{" "}
          <span className="font-semibold text-ink">more noise</span>,{" "}
          <span className="font-semibold text-ink">more turns</span>,{" "}
          <span className="font-semibold text-ink">more tokens</span>,{" "}
          <span className="font-semibold text-ink">higher latency</span>, and{" "}
          <span className="font-semibold text-ink">heavier prompting</span> to get
          the agent to reach for it at all. ai4kanban trades GitHub&apos;s
          reach for local speed — and for a solo builder driving an agent, speed is
          usually the thing in short supply.
        </p>
      </div>
    </section>
  );
}
