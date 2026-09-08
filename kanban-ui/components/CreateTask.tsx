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
// A create or a build that was refused goes back to the sheet rather than to a popover under
// this button: the sheet is still up, so a message behind it is a message nobody reads — and
// the sentence has to stay in the box to be sent again. Start planning (#427) is the one that
// cannot: it closes the sheet first, so its refusal is said under the button.
//
// On a marketing board this is New topic instead (#507), and it opens nothing: marketing work
// starts from source material, so the press writes the card and lands in its editor. There is
// no sheet, no discussion and no agent — everything the sheet asks for is a decision about a
// topic nobody has written yet.

import { useRouter } from "next/navigation";
import {
  newTopicAction,
  startDiscussionAction,
  startPlanBuildAction,
  startPlanningAction,
} from "@/app/actions";
import { useCallback, useEffect, useRef, useState } from "react";
import { FiPlus } from "react-icons/fi";
import { useCopy } from "@/i18n/use-copy";
import { useCreateSheetRequest } from "@/lib/create-open";
import { usePhone } from "@/lib/media";
import { armNewTopic } from "@/lib/new-topic";
import type { DiscussionTarget, SessionView } from "@/lib/types";
import type { AgentReq } from "./agent-shared";
import { Button } from "./button";
import { useChatRailHere } from "./Chat";
import { CreateSheet } from "./CreateSheet";
import { sessionsPanel, useAgentSessions } from "./sessions";
import { useSolution } from "./solution";

// `release` is the version the board is showing (#104), or null for the whole
// board. A card written while one release is on screen ships in it, so it doesn't
// vanish the moment it is written.
export function CreateTask({
  release = null,
  projectRoot,
}: {
  release?: string | null;
  /** Which board this is — the sheet's Discuss reads the board's own conversation, which on
   *  a card's page is not the one the window is holding. */
  projectRoot: string;
}) {
  const c = useCopy().board.create;
  const router = useRouter();
  const marketing = useSolution() === "marketing";
  const [open, setOpen] = useState(false);
  // The discussion the sheet is holding (#496). A press opens a fresh one; a rail row hands
  // over the one it is picking back up. Null while the board's rules are older than the list,
  // which still holds its one conversation.
  const [discussion, setDiscussion] = useState<DiscussionTarget | null>(null);
  // Start planning closes the sheet before the run is asked for (#427), so a refusal there
  // has no box to go back to — it is said under the button instead. A refused create still
  // goes to the sheet, which is still up.
  const [error, setError] = useState<string | null>(null);

  // The rail and this screen are never both up. Pressing Chat asks for the board's
  // conversation or a card's — and on the board the sheet is already showing the board's, so
  // both up is one exchange drawn twice, in two boxes that answer each other. Opening either
  // folds the other, the way the chat rail and the bell already treat each other
  // (components/Window.tsx).
  const rail = useChatRailHere();
  const railOpen = rail?.open === true;
  const foldRail = rail?.fold;
  useEffect(() => {
    if (railOpen) setOpen(false);
  }, [railOpen]);
  useEffect(() => {
    if (open) foldRail?.();
  }, [open, foldRail]);

  // Every press is a new subject (#496): the sheet opens on a discussion of its own, so a
  // second idea is never typed into the first. Nothing is written until the first message,
  // so a sheet opened and closed again leaves no row in the rail.
  //
  // At phone width there is no rail to list them, so the press stays on the discussion it
  // already had — one is reachable there, and a new one every press would be a subject with
  // no way back to it.
  const phone = usePhone();
  const openFresh = useCallback(async () => {
    setError(null);
    if (phone && discussion) return setOpen(true);
    // Opened after the discussion is in hand, so the sheet never paints a frame of the last
    // subject's exchange on its way to the new one.
    // Null is a board whose rules are older than the list. It holds one conversation, which
    // is exactly what `null` reads as.
    setDiscussion(await startDiscussionAction());
    setOpen(true);
  }, [phone, discussion]);

  // The empty board asks for the sheet from the middle of the page (#437), and a rail row
  // picks a discussion back up the same way (#496) — the first card is offered where the
  // reader is looking, not by pointing at this button. Only an ask made while this row was on
  // screen: the store outlives a page change, and a sheet opening by itself on the page
  // someone navigated to is a box nobody pressed for.
  // New topic (#507): write the card, then go to its page with the mark that puts the cursor
  // in the Source pane. `busy` is only about not writing two topics from one double-press —
  // the press is over in a board write, so there is nothing to tail and nothing to watch.
  const [writing, setWriting] = useState(false);
  const openTopic = useCallback(async () => {
    if (writing) return;
    setWriting(true);
    setError(null);
    const res = await newTopicAction();
    setWriting(false);
    if (!res.ok || res.id === undefined) return setError(res.error || c.topicFailed);
    armNewTopic(res.id);
    router.push(`/${res.id}`);
  }, [writing, router, c]);

  const asked = useCreateSheetRequest();
  const seen = useRef(asked);
  useEffect(() => {
    if (!asked || asked === seen.current) return;
    seen.current = asked;
    setError(null);
    // A row named the discussion it is picking back up; the empty board's ask names none, so
    // it opens a fresh one exactly as the button does.
    // On a marketing board the only surface that asks is the empty board, and what it is
    // asking for is a topic: there is no sheet there to open (#507).
    if (marketing) void openTopic();
    else if (asked.discussion) {
      setDiscussion(asked.discussion);
      setOpen(true);
    } else {
      void openFresh();
    }
  }, [asked, openFresh, marketing, openTopic]);

  // A session this tab started finished — re-open the sessions panel on it so the
  // result/errors are never lost, and re-read the server component so the new card shows up
  // (on the board; harmless on a card page). A Build now writes one too (#470).
  const onFinish = useCallback(
    (session: SessionView) => {
      sessionsPanel.open(session.sessionId);
      router.refresh();
    },
    [router],
  );

  const { start, watch } = useAgentSessions(onFinish);

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

  // The two answers under the plan handoff that start a run (#427, #481): the same handoff Add
  // task makes — the screen closes, the run starts behind it, and Runs opens on it and tails
  // it from the first frame. Which plan is the board's own to say, so nothing about it is
  // sent from here; only the release on screen is, exactly as a card written here carries it.
  const startFromPlan = useCallback(
    async (answer: "plan" | "build") => {
      setOpen(false);
      const start = answer === "build" ? startPlanBuildAction : startPlanningAction;
      const res = await start(release ?? undefined, discussion);
      if (!res.ok) {
        setError(res.error || c.startFailed);
        return;
      }
      if (!res.sessionId) return;
      // The server started it, so it is `watch` and not `start` that takes it on — otherwise
      // the card it writes would not reach the board until something else re-read it.
      watch(res.sessionId, answer === "build" ? "Build now" : "Start planning");
      sessionsPanel.open(res.sessionId);
    },
    [release, discussion, watch, c],
  );

  // The top row's 28px box, 36px at phone width where a thumb has to hit it (#357). Narrow
  // screens keep the button but drop its label — a plus in the same square frame, still the
  // same target.
  const label = marketing ? c.topicButton : c.button;
  return (
    <div className="relative flex shrink-0 items-center">
      <Button
        size="xs"
        className="shrink-0 max-md:h-9 max-sm:w-9 max-sm:px-0"
        aria-label={label}
        disabled={writing}
        onClick={() => void (marketing ? openTopic() : openFresh())}
      >
        <FiPlus className="text-[15px]" aria-hidden />
        <span className="sr-only sm:not-sr-only">{label}</span>
      </Button>

      {error && (
        <div
          className="nb-panel-sm absolute right-0 top-full z-30 mt-2 max-w-[300px] cursor-pointer p-2.5 text-[12px]"
          style={{ background: "var(--color-nb-peach-soft)" }}
          onClick={() => setError(null)}
        >
          {error}
        </div>
      )}

      {/* The sheet and its discuss / plan / build modes are the product board's (#507): on a
          marketing board the press above has already written the topic and moved the page. */}
      {open && !marketing && (
        <CreateSheet
          release={release}
          projectRoot={projectRoot}
          discussion={discussion}
          onClose={() => setOpen(false)}
          onSend={(description, mode) =>
            startSession(
              // Build now carries no card id (#428): the sentence is the requirement, and
              // the run opens a delivery of its own. It carries the release all the same —
              // the run writes a card from that sentence and it ships in the version on
              // screen, like one Add task wrote (#470).
              mode === "build"
                ? { action: "implement", description, release: release ?? undefined }
                : { action: "create", description, release: release ?? undefined },
              mode === "build" ? "Build now" : "Create task",
            )
          }
          onPlan={() => void startFromPlan("plan")}
          onBuildPlan={() => void startFromPlan("build")}
        />
      )}
    </div>
  );
}
