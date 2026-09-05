"use client";

// The Create-task action, self-contained so the shared Header can show it on
// both the board and a card page. The button opens the create sheet (#426);
// starting a session pops the header's global sessions panel open on that new
// session so the agent is visibly working (a create takes a while — a silent
// button reads as "nothing happened"). When the session finishes it re-opens the
// panel on that session (so its result/errors are never lost) and re-reads the
// server component so the new card shows up on the board.
//
// A create touches no card, so it has no card page of its own — the sessions
// panel is its only home for the log. That log entry point (the archive icon, the
// badge, a past session's tail) now lives in the shared Sessions component; this
// component just starts the session and hands it to the panel.
//
// A start that was refused goes back to the sheet rather than to a popover under this
// button: the sheet is still up, so a message behind it is a message nobody reads — and the
// sentence has to stay in the box to be sent again.

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { FiPlus } from "react-icons/fi";
import { useCopy } from "@/i18n/use-copy";
import type { SessionView } from "@/lib/types";
import type { AgentReq } from "./agent-shared";
import { Button } from "./button";
import { CreateSheet } from "./CreateSheet";
import { sessionsPanel, useAgentSessions } from "./sessions";

// `release` is the version the board is showing (#104), or null for the whole
// board. A card written while one release is on screen ships in it, so it doesn't
// vanish the moment it is written.
export function CreateTask({ release = null }: { release?: string | null }) {
  const c = useCopy().board.create;
  const router = useRouter();
  const [open, setOpen] = useState(false);

  // A session this tab started finished — re-open the sessions panel on it so the
  // result/errors are never lost, and re-read the server component so the new card shows up
  // (on the board; harmless on a card page, and harmless after a Build now, which wrote
  // none).
  const onFinish = useCallback(
    (session: SessionView) => {
      sessionsPanel.open(session.sessionId);
      router.refresh();
    },
    [router],
  );

  const { start } = useAgentSessions(onFinish);

  // Start a non-blocking session. Creates run side by side — the board lease makes
  // each card's id and index entry atomic — so the button never locks.
  //
  // The sheet closes only once a run is actually going. A refusal — uncommitted changes, a
  // build already working in this checkout, a workspace out of reach — is handed back to
  // the sheet, which says it under the box with the sentence still there to send again.
  const startSession = useCallback(
    async (req: AgentReq, label: string) => {
      const res = await start(req, label);
      if (!res.ok) return { ok: false, error: res.error || c.startFailed };
      setOpen(false);
      // Pop the sessions panel open on the new session so it's visibly working
      // from the first frame — it tails live there until the agent finishes.
      if (res.sessionId) sessionsPanel.open(res.sessionId);
      return { ok: true };
    },
    [start, c],
  );

  return (
    <div className="relative flex shrink-0 items-center">
      <Button
        // The top row's 28px box, 36px at phone width where a thumb has to hit it
        // (#357). Narrow screens keep the button but drop its label — a plus in the
        // same square frame, still the same target.
        size="xs"
        className="shrink-0 max-md:h-9 max-sm:w-9 max-sm:px-0"
        aria-label={c.button}
        onClick={() => setOpen(true)}
      >
        <FiPlus className="text-[15px]" aria-hidden />
        <span className="sr-only sm:not-sr-only">{c.button}</span>
      </Button>

      {open && (
        <CreateSheet
          release={release}
          onClose={() => setOpen(false)}
          onSend={(description, mode) =>
            startSession(
              // Build now carries no card id (#428): the sentence is the requirement, and
              // the run opens a delivery of its own. It ships in no release — there is no
              // card to ship.
              mode === "build"
                ? { action: "implement", description }
                : { action: "create", description, release: release ?? undefined },
              mode === "build" ? "Build now" : "Create task",
            )
          }
        />
      )}
    </div>
  );
}
