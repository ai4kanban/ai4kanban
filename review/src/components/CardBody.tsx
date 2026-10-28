// Copied from legacy kanban-ui/components/CardBody.tsx. Changed: a ``## By … agent`` section
// is read but draws no agent — no avatar, no name, no fold of its own; its `###` subsections
// still fold. The part after the boundary is one fold, shut, as legacy draws it. The card's
// English `##` headings show in the reader's language. Trimmed: the fold memory and questions.

import { useMemo, useState } from "react";
import { FiChevronRight } from "react-icons/fi";
import { COPY, useCopy } from "../i18n";
import { type HumanPiece, splitCardBody, splitHuman } from "../lib/agent-half";
import type { Previews } from "../lib/artifacts";
import { HAIRLINE } from "./chrome";
import { Fold } from "./fold";
import { Markdown, type CardLink } from "./Markdown";

const translated = (text: string) =>
  text.replace(/^## (.+)$/gm, (line, h: string) => (COPY.headings[h.trim()] ? `## ${COPY.headings[h.trim()]}` : line));

/** A card's body: the part a reviewer reads first at the top, the agent's half folded under
 *  it. Nothing a reader has to act on is folded. A card carrying no boundary is all top. */
export function CardBody({ body, previews, cardLink, afterBody }: { body: string; previews: Previews; cardLink?: CardLink; afterBody?: React.ReactNode }) {
  const c = useCopy();
  const halves = useMemo(() => splitCardBody(body), [body]);
  const pieces = useMemo(() => splitHuman(translated(halves.human)), [halves.human]);

  // Sections next to each other share one list, ruled above and below.
  const runs: (Extract<HumanPiece, { kind: "text" }> | Extract<HumanPiece, { kind: "agent" }>[])[] = [];
  for (const p of pieces) {
    const last = runs[runs.length - 1];
    if (p.kind === "text") runs.push(p);
    else if (Array.isArray(last)) last.push(p);
    else runs.push([p]);
  }

  return (
    <>
      {/* One ground for both halves, and it is the page's: a wash here would tint every line. */}
      <div className="nb-section flex flex-col gap-5 bg-nb-sheet p-5 max-md:p-4">
        {runs.map((run, k) =>
          Array.isArray(run) ? (
            <div key={run[0]!.key} className="flex flex-col gap-5">
              {run.map((p) => (
                <div key={p.key} className="pt-5 first:pt-0" style={{ borderTop: `1px solid ${HAIRLINE}` }}>
                  {p.intro && <Markdown body={p.intro} previews={previews} cardLink={cardLink} />}
                  {p.subs.length > 0 && (
                    <div className={p.intro ? "mt-3" : undefined}>
                      {p.subs.map((s) => (
                        <SubSection key={s.key} heading={s.heading}>
                          <Markdown body={s.body} previews={previews} cardLink={cardLink} />
                        </SubSection>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <Markdown key={k} body={run.body} previews={previews} cardLink={cardLink} />
          ),
        )}
        {afterBody}
      </div>
      {halves.agent && (
        <Fold label={<span>{c.agentHalf}</span>}>
          <Markdown body={translated(halves.agent)} previews={previews} cardLink={cardLink} className="nb-md-soft" />
        </Fold>
      )}
    </>
  );
}

// One `###` heading, folding on its own (#1019). The heading keeps its Markdown look and
// gains only the arrow: no rule, ground or border either way.
function SubSection({ heading, children }: { heading: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <details className="nb-fold" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary className="-mx-2 flex cursor-pointer list-none items-center gap-2 rounded-[6px] px-2 py-2 text-nb-ink transition-colors hover:bg-[color-mix(in_srgb,var(--color-nb-ink)_5%,transparent)]">
        <FiChevronRight size={13} aria-hidden className={`shrink-0 text-nb-ink-soft transition-transform duration-150 ease-out ${open ? "rotate-90" : ""}`} />
        <Markdown body={`### ${heading}`} className="min-w-0" />
      </summary>
      <div className="nb-sub pb-3 pl-[21px] pt-1">{children}</div>
    </details>
  );
}
