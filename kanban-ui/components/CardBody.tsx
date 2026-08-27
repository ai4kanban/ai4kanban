"use client";

import { useMemo } from "react";
import { FiChevronRight } from "react-icons/fi";
import type { MockupSet } from "@/lib/mockup-tag";
import { useCopy } from "@/i18n/use-copy";
import { splitCardBody, useAgentHalf } from "@/lib/agent-half";
import { HAIRLINE } from "./chrome";
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
      <div className="nb-panel-sm p-5">
        <Markdown body={halves.human} mockups={mockups} />
      </div>
      {halves.agent && (
        // A native <details> rather than a div we hide ourselves: the window's own Find
        // reaches into a closed one and opens it at the word, in the browsers that can do
        // that, and the `toggle` it fires is how the control above catches up.
        <details
          className="nb-panel-sm nb-fold overflow-hidden"
          open={open}
          onToggle={(e) => onToggle(e.currentTarget.open)}
        >
          {/* w-full because .nb-tag is inline-flex, which otherwise shrinks the row — and
              the tint has to cover the whole strip for it to read as one control. */}
          <summary className="nb-tag w-full cursor-pointer list-none items-center gap-2 px-5 py-3.5 text-nb-ink-soft transition-colors hover:bg-nb-wash hover:text-nb-ink">
            <FiChevronRight
              size={13}
              aria-hidden
              className={`shrink-0 transition-transform duration-150 ease-out ${open ? "rotate-90" : ""}`}
            />
            <span>{c.agentHalf}</span>
          </summary>
          <div className="px-5 pb-5 pt-4" style={{ borderTop: `1px solid ${HAIRLINE}` }}>
            <Markdown body={halves.agent} mockups={mockups} className="nb-md-soft" />
          </div>
        </details>
      )}
    </>
  );
}
