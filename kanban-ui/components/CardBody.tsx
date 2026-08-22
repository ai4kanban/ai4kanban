"use client";

import { useMemo } from "react";
import { FiChevronRight } from "react-icons/fi";
import type { MockupSet } from "@/lib/mockup-tag";
import { splitCardBody, useAgentHalf } from "@/lib/agent-half";
import { HAIRLINE } from "./chrome";
import { Markdown } from "./Markdown";

/** A card's body, in its two halves (#262).
 *
 *  The human half — what a reviewer has to decide on — is at the top and looks as it always
 *  has. The agent half sits under one control and opens in place: it is the same page, so
 *  nothing is a click away that used to be on it, and nothing a reader has to act on is
 *  folded — the card format keeps those above the boundary.
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
  const halves = useMemo(() => splitCardBody(body), [body]);
  const { open, byHand, onToggle } = useAgentHalf(cardId, halves, title);

  return (
    <div className="nb-panel-sm p-5">
      <Markdown body={halves.human} mockups={mockups} />
      {halves.agent && (
        // A native <details> rather than a div we hide ourselves: the window's own Find
        // reaches into a closed one and opens it at the word, in the browsers that can do
        // that, and the `toggle` it fires is how the control above catches up. Only a click
        // on the control is written down (see useAgentHalf), so being opened by a Find
        // changes nothing about how the next card opens.
        <details
          className="nb-fold mt-5 pt-3"
          style={{ borderTop: `1px solid ${HAIRLINE}` }}
          open={open}
          onToggle={(e) => onToggle(e.currentTarget.open)}
        >
          <summary
            onClick={byHand}
            className="nb-tag -mx-1 flex cursor-pointer list-none items-center gap-2 rounded-[8px] px-1 py-1.5 text-nb-ink-soft hover:text-nb-ink"
          >
            <FiChevronRight
              size={13}
              aria-hidden
              className={`shrink-0 transition-transform duration-150 ease-out ${open ? "rotate-90" : ""}`}
            />
            <span>what the agent worked out</span>
            {halves.sections > 0 && (
              <span className="font-[600] opacity-70">
                · {halves.sections} {halves.sections === 1 ? "section" : "sections"}
              </span>
            )}
          </summary>
          <div className="pt-2">
            <Markdown body={halves.agent} mockups={mockups} className="nb-md-soft" />
          </div>
        </details>
      )}
    </div>
  );
}
