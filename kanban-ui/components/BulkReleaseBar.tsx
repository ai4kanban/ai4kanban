"use client";

// The bar that shows while cards are ticked (#114) — how many, where to send
// them, and the way to untick them all.
//
// It only exists while there is a selection, so a board nobody is planning a
// version on looks exactly as it did before this card. That is why the count
// leads: the bar appearing is itself the news, and the number is what the user
// has to check before moving anything.
//
// The releases sit in a menu, not a select: a select answers "which one is
// this", and picking one here writes twenty files. The menu's rows do things,
// which is what these rows do. "No release" is one of them, so sending cards
// back out of a version is one more pick rather than a second button — and it
// is the only fast way out, since the fill that runs when a release is made
// only ever adds.

import { useState } from "react";
import { FiTag, FiX } from "react-icons/fi";
import { useCopy } from "@/i18n/use-copy";
import { Button } from "./button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

export function BulkReleaseBar({
  count,
  releases,
  failed,
  error,
  onMove,
  onClear,
}: {
  /** How many cards are ticked right now. */
  count: number;
  /** The open releases in ship order — the same list the card page's Release
   *  box reads, so nothing is typed and a version that isn't on the list can't
   *  be picked. */
  releases: string[];
  /** The cards the last move left behind, each with why. The rest went through. */
  failed: { id: number; error: string }[];
  /** The last move was refused whole — nothing was written. */
  error: string | null;
  onMove: (release: string) => Promise<void>;
  onClear: () => void;
}) {
  const c = useCopy().board.bulk;
  const [busy, setBusy] = useState(false);

  const move = async (release: string) => {
    setBusy(true);
    try {
      await onMove(release);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="mx-4 mt-4 nb-panel-sm p-3 text-[13px] sm:mx-6"
      style={{ background: "var(--color-nb-accent-soft)" }}
    >
      <div className="flex flex-wrap items-center gap-2.5">
        <strong className="mr-auto">
          {count === 1 ? c.tickedOne : c.tickedMany(count)}
        </strong>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" disabled={busy || count === 0}>
              <FiTag aria-hidden style={{ width: 13, height: 13, flex: "0 0 auto" }} />
              {busy ? c.moving : c.move}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {releases.map((r) => (
              <DropdownMenuItem key={r} onSelect={() => move(r)}>
                {r}
              </DropdownMenuItem>
            ))}
            {/* Out is the same action as in. A board that plans no versions
                still gets this row, so a card the agent put in a release that
                has since been hand-edited away can still be sent back out. */}
            {releases.length > 0 && <DropdownMenuSeparator />}
            <DropdownMenuItem onSelect={() => move("")}>{c.noRelease}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button size="sm" variant="ghost" disabled={busy} onClick={onClear}>
          <FiX aria-hidden style={{ width: 13, height: 13, flex: "0 0 auto" }} />
          {c.untickAll}
        </Button>
      </div>

      {/* What the last move couldn't do. The cards that failed stay ticked, so
          this sits above the very cards it names and a second try needs no
          re-ticking. */}
      {(error || failed.length > 0) && (
        <div
          className="nb-panel-sm mt-3 p-2.5 text-[12px] leading-relaxed"
          style={{ background: "var(--color-nb-peach-soft)" }}
        >
          {error ? (
            error
          ) : (
            <>
              <p>
                {failed.length === 1 ? c.failedOne : c.failedMany(failed.length)}
              </p>
              <ul className="mt-1 max-h-[140px] overflow-y-auto">
                {failed.map((f) => (
                  <li key={f.id}>
                    #{f.id} — {f.error}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
