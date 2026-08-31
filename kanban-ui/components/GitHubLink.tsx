"use client";

// The one way out of the app in the top row: AI4Kanban's own repository.
//
// It is the header's ordinary control — the same press-down block as Goal and
// Chat beside it (components/button.tsx, ghost at `xs`), so the row stays one
// family of objects rather than a run of stickers with a flat icon leaning
// against it.
//
// Icon-only, where Goal and Chat carry a word. That is the whole of the
// difference in weight it needs: it is the same object, saying less. A "GitHub"
// label would spend the rail's width on the one control in the row that does
// nothing to this board.
//
// It sits at the head of the right-hand group rather than beside the mark. The
// left of the row is the project you have open — a GitHub mark next to a folder
// path reads as "open MY repo", which is not what this is. On the right, among
// the board's own controls, it reads as "the product", which is.
//
// Gone below `sm`, like the folder badge: on a window that narrow every pixel
// belongs to a control that acts on the board, and this is the one that doesn't.

import { SiGithub } from "react-icons/si";
import { useCopy } from "@/i18n/use-copy";
import { Button } from "./button";
import { openLink } from "./desktop";

/** Where the project lives. The guide drawer builds its own deep links off the
 *  same repo (components/Guide.tsx). */
export const REPO_URL = "https://github.com/ai4kanban/ai4kanban";

export function GitHubLink() {
  const c = useCopy().chrome.header;
  return (
    // `openLink` rather than an href: a desktop window must never navigate away
    // from the board, so the URL is handed to the system browser.
    <Button
      variant="ghost"
      size="xs"
      // Inverted against the rest of the row: ink fill, paper glyph — GitHub's
      // own mark, and the one control here that leaves the board. The shadow
      // stays ink and merges into the fill, so this one is a solid slab that
      // grows and settles as a whole rather than a block over a ledge.
      className="hidden w-7 shrink-0 bg-nb-ink px-0 text-nb-paper sm:inline-flex"
      title={c.github}
      aria-label={c.github}
      onClick={() => openLink(REPO_URL)}
    >
      {/* The filled brand mark, the same glyph the Cloud pane signs in with. It
          sits tight to its own box where the row's Feather icons carry padding
          inside theirs, so it takes 14 against the cluster's 15. */}
      <SiGithub size={14} aria-hidden />
    </Button>
  );
}
