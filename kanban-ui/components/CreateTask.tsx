"use client";

// The Create-task action, self-contained so the shared Header can show it on
// both the board and a card page. The button opens the create dialog; starting a
// session pops the header's global sessions panel open on that new session so the
// agent is visibly working (a create takes a while — a silent button reads as
// "nothing happened"). When the session finishes it re-opens the panel on that
// session (so its result/errors are never lost) and re-reads the server component
// so the new card shows up on the board.
//
// A create touches no card, so it has no card page of its own — the sessions
// panel is its only home for the log. That log entry point (the archive icon, the
// badge, a past session's tail) now lives in the shared Sessions component; this
// component just starts the session and hands it to the panel.

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { FiPlus } from "react-icons/fi";
import { getModules } from "@/app/actions";
import { useCopy } from "@/i18n/use-copy";
import type { SessionView } from "@/lib/types";
import { ActionDialog, type AgentReq } from "./agent-shared";
import { Button } from "./button";
import { sessionsPanel, useAgentSessions } from "./sessions";

// `release` is the version the board is showing (#104), or null for the whole
// board. A card written while one release is on screen ships in it, so it doesn't
// vanish the moment it is written. Propose is different — it offers work nobody
// has planned — so its cards start with no release and this never reaches them.
export function CreateTask({ release = null }: { release?: string | null }) {
  const c = useCopy().board.create;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The module names for the dialog's picker, read from modules.md server-side.
  // Fetched once when the dialog first opens (the board's modules rarely change
  // within a session), so a closed Create button costs nothing.
  const [modules, setModules] = useState<string[]>([]);
  useEffect(() => {
    if (!open) return;
    let alive = true;
    getModules()
      .then((m) => alive && setModules(m))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [open]);

  // A create session this tab started finished — re-open the sessions panel on it
  // so the result/errors are never lost, and re-read the server component so the
  // new card shows up (on the board; harmless on a card page).
  const onFinish = useCallback(
    (session: SessionView) => {
      sessionsPanel.open(session.sessionId);
      router.refresh();
    },
    [router],
  );

  const { sessions, start } = useAgentSessions(onFinish);
  // Create and propose are both single global actions (the server refuses a
  // second of either) and share this one button, so disable it while either is
  // live.
  const creating = sessions.some(
    (r) => r.status === "running" && (r.action === "create" || r.action === "propose"),
  );

  // Start a non-blocking session. A lock refusal ("a task is already being
  // created") comes back as an error message.
  const startSession = useCallback(
    async (req: AgentReq, label: string) => {
      setOpen(false);
      const res = await start(req, label);
      if (!res.ok) {
        setError(res.error || c.startFailed);
        return;
      }
      // Pop the sessions panel open on the new session so it's visibly working
      // from the first frame — it tails live there until the agent finishes.
      if (res.sessionId) sessionsPanel.open(res.sessionId);
    },
    [start, c],
  );

  return (
    <div className="relative flex shrink-0 items-center">
      <Button
        // The top row's 28px box. Narrow screens keep the button but drop its
        // label — a plus in the same square frame, still the same target.
        size="xs"
        className="shrink-0 max-sm:w-7 max-sm:px-0"
        aria-label={c.button}
        disabled={creating}
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        <FiPlus className="text-[15px]" aria-hidden />
        <span className="sr-only sm:not-sr-only">{c.button}</span>
      </Button>

      {error && (
        <div
          className="absolute right-0 top-full z-30 mt-2 max-w-[300px] cursor-pointer nb-panel-sm p-2.5 text-[12px]"
          style={{ background: "var(--color-nb-peach-soft)" }}
          onClick={() => setError(null)}
        >
          {error}
        </div>
      )}

      {open && (
        <ActionDialog
          dialog={{ kind: "create" }}
          modules={modules}
          release={release}
          onClose={() => setOpen(false)}
          onRun={startSession}
        />
      )}
    </div>
  );
}
