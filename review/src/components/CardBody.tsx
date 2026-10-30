// Copied from legacy kanban-ui/components/CardBody.tsx. Changed: a ``## By … agent`` section
// is a row named after its preview, folding as one (#34); no avatar, no word "agent". Its
// `###` subsections fold on their own. The part after the boundary is one fold, shut, as
// legacy draws it. The card's English `##` headings show in the reader's language.
// Trimmed: questions.

import { useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { FiChevronRight } from "react-icons/fi";
import { COPY, useCopy } from "../i18n";
import { type HumanPiece, splitCardBody, splitHuman } from "../lib/agent-half";
import type { Previews } from "../lib/artifacts";
import { HAIRLINE } from "./chrome";
import { Fold } from "./fold";
import { Markdown, type CardLink } from "./Markdown";

const translated = (text: string) =>
  text.replace(/^## (.+)$/gm, (line, h: string) => (COPY.headings[h.trim()] ? `## ${COPY.headings[h.trim()]}` : line));

export type PreviewPiece = Extract<HumanPiece, { kind: "agent" }>;

/** A body cut for drawing: the human half in pieces — prose and one per preview section — and
 *  the agent half, headings in the reader's language. */
export function cardParts(body: string): { pieces: HumanPiece[]; agent: string } {
  const halves = splitCardBody(body);
  return { pieces: splitHuman(translated(halves.human)), agent: halves.agent && translated(halves.agent) };
}

/** A card's body: the part a reviewer reads first at the top, the agent's half folded under
 *  it. Nothing a reader has to act on is folded. A card carrying no boundary is all top. */
export function CardBody({
  body,
  previews,
  nameOf = humanise,
  cardLink,
  afterBody,
  canvas,
}: {
  body: string;
  previews: Previews;
  /** A preview's name in the reader's language, from its agent id. */
  nameOf?: (agent: string) => string;
  cardLink?: CardLink;
  afterBody?: React.ReactNode;
  /** Draws the preview sections on their own, between the prose and the agent half. */
  canvas?: (sections: PreviewPiece[]) => ReactNode;
}) {
  const c = useCopy();
  const { pieces, agent } = useMemo(() => cardParts(body), [body]);

  // Sections next to each other share one list, ruled above and below.
  const runs: (Extract<HumanPiece, { kind: "text" }> | PreviewPiece[])[] = [];
  for (const p of canvas ? pieces.filter((x) => x.kind === "text") : pieces) {
    const last = runs[runs.length - 1];
    if (p.kind === "text") runs.push(p);
    else if (Array.isArray(last)) last.push(p);
    else runs.push([p]);
  }

  return (
    <>
      {/* One ground for both halves, and it is the page's: a wash here would tint every line. */}
      {(!canvas || runs.length > 0 || afterBody) && (
        <div className="nb-section flex flex-col gap-5 bg-nb-sheet p-5 max-md:p-4">
          {runs.map((run, k) =>
            Array.isArray(run) ? (
              <div key={run[0]!.key} className="-mx-5 max-md:-mx-4" style={{ borderBottom: `1px solid ${HAIRLINE}` }}>
                {run.map((p) => (
                  <PreviewSection key={p.key} agent={p.name} name={nameOf(p.name)}>
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
                  </PreviewSection>
                ))}
              </div>
            ) : (
              <Markdown key={k} body={run.body} previews={previews} cardLink={cardLink} />
            ),
          )}
          {afterBody}
        </div>
      )}
      {canvas?.(pieces.filter((p): p is PreviewPiece => p.kind === "agent"))}
      {agent && !canvas && (
        <Fold label={<span>{c.agentHalf}</span>}>
          <Markdown body={agent} previews={previews} cardLink={cardLink} className="nb-md-soft" />
        </Fold>
      )}
    </>
  );
}

/** A name read off an agent id, for one nothing else names. */
export const humanise = (id: string) => id.replace(/[-_]+/g, " ").replace(/^./, (c) => c.toUpperCase());

// The previews shut in this browser, by agent id: shutting one shuts it on every card.
const SHUT_KEY = "nb.shut-previews";
const shutListeners = new Set<() => void>();
const readShut = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(SHUT_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
};
let shut = readShut();
const subscribeShut = (fn: () => void) => {
  shutListeners.add(fn);
  return () => shutListeners.delete(fn);
};
function setShut(agent: string, isShut: boolean) {
  if (shut.includes(agent) === isShut) return;
  shut = isShut ? [...shut, agent] : shut.filter((a) => a !== agent);
  try {
    localStorage.setItem(SHUT_KEY, JSON.stringify(shut));
  } catch {}
  for (const fn of shutListeners) fn();
}

// One preview, as legacy drew an agent's section: a full-width row ruled above, its name
// small and bold. Open unless the reader shut this preview.
function PreviewSection({ agent, name, children }: { agent: string; name: string; children: React.ReactNode }) {
  const open = !useSyncExternalStore(subscribeShut, () => shut.includes(agent));
  return (
    <details className="nb-fold" open={open} onToggle={(e) => setShut(agent, !e.currentTarget.open)} style={{ borderTop: `1px solid ${HAIRLINE}` }}>
      <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-2 text-nb-ink transition-colors hover:bg-[color-mix(in_srgb,var(--color-nb-ink)_5%,transparent)] max-md:px-4">
        <FiChevronRight size={13} aria-hidden className={`shrink-0 text-nb-ink-soft transition-transform duration-150 ease-out ${open ? "rotate-90" : ""}`} />
        <span className="min-w-0 truncate text-[13.5px] font-[700]">{name}</span>
      </summary>
      <div className="px-5 pb-4 pt-3 max-md:px-4">{children}</div>
    </details>
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
