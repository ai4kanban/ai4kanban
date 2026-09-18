"use client";

import { useMemo } from "react";
import { FiChevronRight } from "react-icons/fi";
import type { MockupSet } from "@/lib/mockup-tag";
import type { Question } from "@/lib/types";
import { useCopy } from "@/i18n/use-copy";
import { AGENT_HALF, type HumanPiece, splitCardBody, splitHuman, useCardFolds } from "@/lib/agent-half";
import { useAgentName } from "@/lib/agent-name";
import { Character } from "./Agents";
import { HAIRLINE } from "./chrome";
import { Fold } from "./fold";
import { Markdown } from "./Markdown";

/** A card's body, in its two halves (#262).
 *
 *  The human half — what a reviewer has to decide on — is at the top. Each agent's section in
 *  it is a row of its own, shut (#870), so a stack of them reads as a list of agents and the
 *  summary above stays in view. The agent half is a block of its own under it, shut too.
 *  Everything opens in place; nothing a reader has to act on is folded.
 *
 *  A card carrying no boundary has no agent half: its whole body is the human half. */
export function CardBody({
  body,
  title,
  cardId,
  mockups,
  questions,
}: {
  body: string;
  title: string;
  cardId: number;
  mockups?: MockupSet;
  questions?: Question[];
}) {
  const c = useCopy().card;
  const halves = useMemo(() => splitCardBody(body), [body]);
  const pieces = useMemo(() => splitHuman(halves.human), [halves.human]);
  const asking = (questions ?? []).flatMap((q) => (q.agent && !q.skipped ? [q.agent] : []));
  const { isOpen, onToggle } = useCardFolds(cardId, halves, pieces, title, asking);

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
      {/* One ground for both halves, and it is the page's. This is the longest prose the
          board sets, so a wash here would tint every line. */}
      <div className="nb-section flex flex-col gap-5 bg-nb-sheet p-5 max-md:p-4">
        {runs.map((run, k) =>
          Array.isArray(run) ? (
            <div key={run[0]!.key} className="-mx-5 max-md:-mx-4" style={{ borderBottom: `1px solid ${HAIRLINE}` }}>
              {run.map((p) => (
                <AgentSection
                  key={p.key}
                  name={p.name}
                  open={isOpen(p.key)}
                  onToggle={(open) => onToggle(p.key, open)}
                >
                  <Markdown body={p.body} mockups={mockups} />
                </AgentSection>
              ))}
            </div>
          ) : (
            <Markdown key={k} body={run.body} mockups={mockups} />
          ),
        )}
      </div>
      {halves.agent && (
        <Fold
          className="nb-section bg-nb-sheet"
          label={<span>{c.agentHalf}</span>}
          open={isOpen(AGENT_HALF)}
          onToggle={(open) => onToggle(AGENT_HALF, open)}
        >
          <Markdown body={halves.agent} mockups={mockups} className="nb-md-soft" />
        </Fold>
      )}
    </>
  );
}

// One agent's section: the row is its heading. A native <details>, like `Fold`, so the
// window's own Find opens it at the word and `toggle` keeps the state in step.
function AgentSection({
  name,
  open,
  onToggle,
  children,
}: {
  name: string;
  open: boolean;
  onToggle: (open: boolean) => void;
  children: React.ReactNode;
}) {
  const agentName = useAgentName();
  return (
    <details
      className="nb-fold"
      open={open}
      onToggle={(e) => onToggle(e.currentTarget.open)}
      style={{ borderTop: `1px solid ${HAIRLINE}` }}
    >
      <summary className="flex w-full cursor-pointer list-none items-center gap-2 px-5 py-2 text-nb-ink transition-colors hover:bg-[color-mix(in_srgb,var(--color-nb-ink)_5%,transparent)] max-md:px-4">
        <FiChevronRight
          size={13}
          aria-hidden
          className={`shrink-0 text-nb-ink-soft transition-transform duration-150 ease-out ${open ? "rotate-90" : ""}`}
        />
        <span className="shrink-0">
          <Character name={name} size={22} />
        </span>
        <span className="min-w-0 truncate text-[13.5px] font-[700]">{agentName(name)}</span>
      </summary>
      <div className="px-5 pb-4 pt-3 max-md:px-4">{children}</div>
    </details>
  );
}
