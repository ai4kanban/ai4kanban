import { ergoIssues, ergoKanban } from "./vs-content";
import { SectionHeading } from "../SectionHeading";
import { panelStatic } from "../styles";

type Line = { line: string; kind: "you" | "call" | "out" };

function Transcript({
  title,
  chip,
  chipClass,
  lines,
  footer,
}: {
  title: string;
  chip: string;
  chipClass: string;
  lines: Line[];
  footer: string;
}) {
  return (
    <div className={`${panelStatic} overflow-hidden bg-code`}>
      <div className="flex items-center justify-between border-b-2 border-border px-4 py-2.5">
        <span className="font-mono text-xs text-muted">{title}</span>
        <span
          className={`rounded-full px-2 py-0.5 font-mono text-[0.65rem] font-semibold uppercase tracking-wider ${chipClass}`}
        >
          {chip}
        </span>
      </div>
      <div className="space-y-2.5 px-4 py-4 font-mono text-[0.82rem] leading-relaxed">
        {lines.map((l, i) => {
          if (l.kind === "you") {
            return (
              <div key={i} className="flex items-baseline gap-2">
                <span className="select-none text-accent">›</span>
                <span className="font-semibold text-ink">{l.line}</span>
              </div>
            );
          }
          if (l.kind === "call") {
            return (
              <div key={i} className="flex items-baseline gap-2 pl-4 text-muted">
                <span className="select-none text-accent/60">⚙</span>
                <span>{l.line}</span>
              </div>
            );
          }
          return (
            <div key={i} className="flex items-baseline gap-2 pl-4 text-muted/70">
              <span className="select-none">←</span>
              <span>{l.line}</span>
            </div>
          );
        })}
        <div className="flex items-baseline gap-2 border-t border-border pt-2.5 text-muted">
          <span className="select-none">{"∑"}</span>
          <span>{footer}</span>
        </div>
      </div>
    </div>
  );
}

// The core argument, made concrete: the same request, two very different paths.
export function VsErgonomics() {
  return (
    <section className="mt-24">
      <SectionHeading num="04" eyebrow="The crux" title="Why agents prefer files" />
      <p className="text-ink">
        The real difference shows up when an agent does the work. Ask the same
        thing — <span className="font-medium">&ldquo;find my high-priority open
        tasks&rdquo;</span> — and the two paths barely rhyme.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Transcript
          title="you › agent + GitHub MCP"
          chip="many turns"
          chipClass="bg-muted/15 text-muted"
          lines={ergoIssues}
          footer="several tool calls · KBs of JSON · network each time"
        />
        <Transcript
          title="you › agent + ai4kanban"
          chip="one turn"
          chipClass="bg-accent/15 text-accent"
          lines={ergoKanban}
          footer="one tool call · a few paths · all local"
        />
      </div>

      <p className="mt-5 text-sm text-muted">
        It compounds. Every &ldquo;what&apos;s next?&rdquo;, every archive, every
        board review pays the round-trip tax on GitHub Issues — and models, left to
        choose, quietly avoid the remote tool and reach for the files instead.
      </p>
    </section>
  );
}
