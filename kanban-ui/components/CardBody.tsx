"use client";

import { useMemo } from "react";
import type { MockupSet } from "@/lib/mockup-tag";
import { useCopy } from "@/i18n/use-copy";
import { splitCardBody, useAgentHalf } from "@/lib/agent-half";
import { Fold } from "./fold";
import { Markdown } from "./Markdown";

/** A card's body, in its two halves (#262).
 *
 *  The human half — what a reviewer has to decide on — is at the top and looks as it always
 *  has. The agent half is a block of its own under it, shut, so it reads as a thing to open
 *  rather than a line of the body; it opens in place, so nothing is a click away that used
 *  to be on the page, and nothing a reader has to act on is folded — the card format keeps
 *  those above the boundary.
 *
 *  A card carrying no boundary has no fold and no control: its whole body is the human half.
 *  Most of the board is still like that, and stays exactly as it reads today. */
export function CardBody({
  body,
  title,
  cardId,
  mockups,
}: {
  body: string;
  title: string;
  cardId: number;
  mockups?: MockupSet;
}) {
  const c = useCopy().card;
  const halves = useMemo(() => splitCardBody(body), [body]);
  const { open, onToggle } = useAgentHalf(cardId, halves, title);

  return (
    <>
      {/* One ground for both halves, and it is the page's — the warm sheet the bands above
          are on too. This is the longest prose the board sets, so it is read THROUGH whatever
          is under it: a signal wash here tints every line. Giving the second half a ground of
          its own made the prose change colour halfway down; what parts them is the heading. */}
      <div className="nb-section bg-nb-sheet p-5 max-md:p-4">
        <Markdown body={halves.human} mockups={mockups} />
      </div>
      {halves.agent && (
        <Fold className="nb-section bg-nb-sheet" label={<span>{c.agentHalf}</span>} open={open} onToggle={onToggle}>
          <Markdown body={halves.agent} mockups={mockups} className="nb-md-soft" />
        </Fold>
      )}
    </>
  );
}
