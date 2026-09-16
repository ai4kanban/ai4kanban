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
// the sentence has to stay in the box to be sent again. The plan handoff's two answers work
// the same way (#706): the sheet stays up until a run is actually going, and a refusal goes
// back into it under the three answers. It only reaches this button when the reader is no
// longer there to read it — at phone width, where there is no rail row to mark instead.
//
// Feedback on a landed task (#603) rides here rather than in the sheet, because the sheet
// closes the moment a run starts: the block is drawn in the sheet and its state is held
// here, so a submission that did not go is said under this button, where there is still
// something on screen to say it on. The task is created either way — the feedback goes after
// the run has started, and nothing about it can stop a card being written.

import { useRouter } from "next/navigation";
import {
  startDiscussionAction,
  startPlanBuildAction,
  startPlanningAction,
} from "@/app/actions";
import { useCallback, useEffect, useRef, useState } from "react";
import { FiPlus } from "react-icons/fi";
import { useCopy } from "@/i18n/use-copy";
import { createSheet, useArchivedDiscussion, useCreateSheetRequest } from "@/lib/create-open";
import { failureText, startFailure, type StartFailure } from "@/lib/start-failure";
import { dropDraft } from "@/lib/draft";
import { usePhone } from "@/lib/media";
import type { DiscussionTarget, SessionView } from "@/lib/types";
import type { PlanAnswer } from "@/lib/format/agent/types";
import type { AgentReq } from "./agent-shared";
import { Button } from "./button";
import { useChatRailHere } from "./Chat";
import { CreateSheet } from "./CreateSheet";
import { useLandedFeedback, useTaskFailureLine } from "./Feedback";
import { sessionsPanel, useAgentSessions } from "./sessions";

// `release` is the version the board is showing (#104), or null for the whole
// board. A card written while one release is on screen ships in it, so it doesn't
// vanish the moment it is written.
// A discussion as a key, and the one conversation of a board whose rules predate the list as
// the empty string — no `DiscussionTarget` is that, so the two never collide.
const askedOn = (discussion: DiscussionTarget | null): string => discussion ?? "";

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
  const plan = c.sheet.plan;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  // The discussion the sheet is holding (#496). A press opens a fresh one; a rail row hands
  // over the one it is picking back up. Null while the board's rules are older than the list,
  // which still holds its one conversation.
  const [discussion, setDiscussion] = useState<DiscussionTarget | null>(null);
  // A refusal with nothing left on screen to say it on: a feedback submission after the sheet
  // has closed (#603), and — at phone width, where there is no rail row to mark — a plan
  // answer whose run was refused after the reader closed the window (#706).
  const [error, setError] = useState<string | null>(null);
  // A feedback submission that went (#603). The sheet is gone by then, so the only place
  // left to say it is under this button — and it has to be said, because a send with no
  // answer reads as a send that vanished.
  const [notice, setNotice] = useState<string | null>(null);
  // The plan answer being asked for, keyed by the discussion it was pressed on (#706). Keyed
  // rather than single because the reader may pick another discussion up while the request is
  // out: only the one that pressed goes down, and the one picked up is live and startable.
  const [starting, setStarting] = useState<Readonly<Record<string, PlanAnswer>>>({});
  // Why the last start on the discussion the sheet is holding never came up. It lives here
  // rather than in the sheet so an answer pressed on one discussion cannot say it on another.
  const [failure, setFailure] = useState<StartFailure | null>(null);
  // The same, readable in the same tick: the answers go down on the next render, and two
  // clicks inside one would otherwise both find nothing started and ask for two runs.
  const asking = useRef(new Set<string>());
  // The Link-a-landed-task block on the sheet (#603) — held here so its outcome outlives the
  // sheet, and reset only once a send has actually taken it.
  const feedback = useLandedFeedback();
  const failureLine = useTaskFailureLine();
  const feedbackCopy = useCopy().board.feedback;

  // The discussion this screen is holding, readable after an await — a rail row may have
  // handed over another one while a run was starting (#610).
  const held = useRef(discussion);
  useEffect(() => {
    held.current = discussion;
  }, [discussion]);
  // And whether the window is still up at all — Esc and the close button answer while a start
  // is in flight (#706), and a refusal has nowhere to land once they have.
  const openHere = useRef(open);
  useEffect(() => {
    openHere.current = open;
  }, [open]);

  // Back to a fresh Create task. A discussion has no page of its own, so the sheet closing is
  // the whole of "the discussion is over" — and what it was holding goes with it, transcript,
  // selection and box alike, or the next press opens on a subject that is finished.
  const freshen = useCallback(() => {
    setOpen(false);
    setDiscussion(null);
    setError(null);
    setNotice(null);
    setFailure(null);
    feedback.reset();
    dropDraft("create");
  }, [feedback]);

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
    setNotice(null);
    setFailure(null);
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
  // Archived from the rail (#610). Only the one this screen is holding: archiving another
  // discussion, or this one after the reader has already moved to a different subject, leaves
  // the screen where it is.
  const dropped = useArchivedDiscussion();
  const seenDropped = useRef(dropped);
  useEffect(() => {
    if (!dropped || dropped === seenDropped.current) return;
    seenDropped.current = dropped;
    if (dropped.discussion === held.current) freshen();
  }, [dropped, freshen]);

  // What is on screen, for the rail's mark (#722): the sheet covers the page under it, so
  // the discussion it is holding is where the reader is, and the row below is the one to
  // mark.
  const showing = open ? discussion : null;
  useEffect(() => {
    createSheet.showing(showing);
    return () => createSheet.showing(null);
  }, [showing]);

  const asked = useCreateSheetRequest();
  const seen = useRef(asked);
  useEffect(() => {
    if (!asked || asked === seen.current) return;
    seen.current = asked;
    setError(null);
    setFailure(null);
    // A row named the discussion it is picking back up; the empty board's ask names none, so
    // it opens a fresh one exactly as the button does.
    if (asked.discussion) {
      // Opening it is reading it, so the rail's mark on that row has done its job (#706).
      createSheet.startCleared(asked.discussion);
      setDiscussion(asked.discussion);
      setOpen(true);
    } else {
      void openFresh();
    }
  }, [asked, openFresh]);

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
      // The feedback goes after the run is going, and only if it was ticked (#603). Whatever
      // comes of it the card is already being written; a refusal is said under this button
      // rather than retried.
      const sent = await feedback.submit(req.description ?? "");
      feedback.reset();
      if (sent?.ok) setNotice(feedbackCopy.taskSent);
      else if (sent) setError(failureLine(sent));
      return { ok: true };
    },
    [start, c, feedback, failureLine, feedbackCopy],
  );

  // The two answers under the plan handoff that start a run (#427, #481). The screen stays up
  // until a run is actually going (#706): a start can be refused — uncommitted changes, a
  // build already working in this checkout — and closing first left the reader with no window,
  // no answers and no way to press again. Which plan is the board's own to say, so nothing
  // about it is sent from here; only the release on screen is, and the words the answer put in
  // the transcript, which the start writes once the run is up.
  //
  // Everything after the await is about the discussion the answer was PRESSED on, which may no
  // longer be the one on screen: a rail row hands another one over while the request is out,
  // and a window Esc closed is gone altogether. So the outcome goes wherever that discussion
  // still is — this window, its row in the rail, or, at phone width where there is no rail,
  // under the button.
  const startFromPlan = useCallback(
    async (answer: PlanAnswer) => {
      const on = discussion;
      const key = askedOn(on);
      if (asking.current.has(key)) return;
      asking.current.add(key);
      setStarting((was) => ({ ...was, [key]: answer }));
      setFailure(null);
      createSheet.startCleared(on);
      const start = answer === "build" ? startPlanBuildAction : startPlanningAction;
      const res = await start(release ?? undefined, on, answer === "build" ? plan.build : plan.start);
      asking.current.delete(key);
      setStarting((was) => Object.fromEntries(Object.entries(was).filter(([at]) => at !== key)));
      // A run needs an id to be watched and tailed, so a yes with none is a start that did not
      // happen — said as one rather than leaving the window on "Starting…".
      if (res.ok && res.sessionId) {
        // The run is going, which is where the board archives the discussion it was handed
        // (#551) — so the screen lets go of it too (#610). Unless the reader has picked up
        // another subject in the meantime; that one is not over.
        if (held.current === on) freshen();
        // The server started it, so it is `watch` and not `start` that takes it on — otherwise
        // the card it writes would not reach the board until something else re-read it.
        watch(res.sessionId, answer === "build" ? "Build now" : "Start planning");
        sessionsPanel.open(res.sessionId);
        return;
      }
      const why = startFailure(res, plan.failed);
      // Still looking at it: the window says it under the three answers, which are live again.
      if (openHere.current && held.current === on) return setFailure(why);
      // Gone elsewhere. A discussion has a row to mark; at phone width it has none, and the
      // button is the only thing left on screen to say it on.
      if (on && !phone) createSheet.startFailed(on, failureText(why));
      else setError(failureText(why));
    },
    [release, discussion, watch, freshen, phone, plan],
  );

  // The top row's 28px box, 36px at phone width where a thumb has to hit it (#357). Narrow
  // screens keep the button but drop its label — a plus in the same square frame, still the
  // same target.
  const label = c.button;
  return (
    <div className="relative flex shrink-0 items-center">
      <Button
        size="xs"
        className="shrink-0 max-md:h-9 max-sm:w-9 max-sm:px-0"
        aria-label={label}
        onClick={() => void openFresh()}
      >
        <FiPlus className="text-[15px]" aria-hidden />
        <span className="sr-only sm:not-sr-only">{label}</span>
      </Button>

      {error && (
        <div
          // Wide enough for short lines rather than a tall column (#544), and clamped to the
          // viewport so it stays on screen. `pre-line` keeps the paths the board listed under
          // the sentence on their own lines; `break-words` keeps a long one inside the panel.
          className="nb-panel-sm absolute right-0 top-full z-30 mt-2 w-[min(420px,calc(100vw-32px))] cursor-pointer whitespace-pre-line break-words p-3 text-[12px] leading-relaxed"
          style={{ background: "var(--color-nb-peach-soft)" }}
          onClick={() => setError(null)}
        >
          {error}
        </div>
      )}

      {/* A feedback submission that went (#603), said where its failure would have been. It
          carries the one-way sentence, because this path never showed it: the standing sheet
          says it in place of its box, and here there is no box left. */}
      {!error && notice && (
        <div
          className="nb-panel-sm absolute right-0 top-full z-30 mt-2 w-[min(420px,calc(100vw-32px))] cursor-pointer break-words p-3 text-[12px] leading-relaxed"
          onClick={() => setNotice(null)}
        >
          {notice}
        </div>
      )}

      {open && (
        <CreateSheet
          release={release}
          projectRoot={projectRoot}
          discussion={discussion}
          feedback={feedback}
          onClose={() => setOpen(false)}
          onSend={(description, mode, pictures, runtime, workflow) =>
            startSession(
              // Build now carries no card id (#428): the sentence is the requirement, and
              // the run opens a delivery of its own. It carries the release all the same —
              // the run writes a card from that sentence and it ships in the version on
              // screen, like one Add task wrote (#470). Whatever was pasted into the box
              // goes with it (#517) — the board renames that folder after the run and hands
              // it the paths — and so does the runtime the sheet picked (#518), which is this
              // one run's and is remembered nowhere.
              {
                action: mode === "build" ? "implement" : "create",
                description,
                release: release ?? undefined,
                ...(pictures.shots.length ? { box: pictures.box, shots: pictures.shots } : {}),
                ...(runtime ? { runtime } : {}),
                // The workflow the sheet was on (#715). The run writes it onto the card it
                // creates; with none, the card runs on the board's default.
                ...(workflow ? { workflow } : {}),
              },
              mode === "build" ? "Build now" : "Create task",
            )
          }
          starting={starting[askedOn(discussion)] ?? null}
          failure={failure}
          onPlan={() => void startFromPlan("plan")}
          onBuildPlan={() => void startFromPlan("build")}
        />
      )}
    </div>
  );
}
