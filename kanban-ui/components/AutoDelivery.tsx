"use client";

// Delivery: whether the board starts a build by itself, and how it builds one.
//
// Four switches, all repository-level, all saved with the board rather than with this
// machine, so a team shares one answer.
//
// **Build clear cards automatically** (#440) is first, because it is the only one that
// decides whether a delivery starts at all; the three under it decide how one is built. Off
// — the default — a card that reaches Ready to build waits for Implement. On, one gate run
// judges each card that gets there against the board's own writing standard: a card it
// passes goes straight into a delivery on the settings below, and a card it fails goes back
// to Not ready carrying the one question that stopped it. Its runtime is its own, so the
// judgment can run on a stronger model than the work it lets through.
//
// **Automatic Git commits** (#303) is the side each Implement opens on. On — the default —
// a build gets a branch and a worktree of its own, so several run at once without touching
// each other or your open edits, and what review passed is exactly what lands. Off, it
// builds in your own project folder, one at a time, and you commit it yourself once review
// has passed. Either way the Implement dialog's box can turn this one build round (#346),
// and it never writes its answer back here.
//
// **Approve diffs before landing** (#308) decides whether anything lands unread. Off — the
// default — a reviewed delivery lands by itself. On, every delivery that got a branch of
// its own waits after review until you approve the exact tree it would land — however that
// branch was chosen, so this stays settable with automatic commits off.
//
// **AI review** (#416) decides whether a build is judged at all. On — the default — a fresh
// paid session reviews each delivery. Off, the implementation is the last agent to read the
// code; the repository's own checks, the open-question hold and the switch above all still
// gate landing, and the Implement dialog's second box turns this one build round.

import { useEffect, useState } from "react";
import { FiAlertCircle } from "react-icons/fi";
import { useCopy } from "@/i18n/use-copy";
import {
  aiReviewAction,
  autoCommitAction,
  diffApprovalAction,
  gateRuntimeAction,
  readyGateAction,
  setAiReviewAction,
  setAutoCommitAction,
  setDiffApprovalAction,
  setGateRuntimeAction,
  setReadyGateAction,
} from "@/app/actions";
import { FLAT_CONTROL, Group, Panel, Row, Switch } from "./settings";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";

/** The board's runtimes as the gate row reads them (#343, #440). */
type GateRuntimes = Awaited<ReturnType<typeof gateRuntimeAction>>;

// The value the picker uses for "whatever the board runs" — a runtime name can never be
// empty, so it can never collide with one.
const FOLLOW = "-";

/** Whether the picker has anything to offer: a board that names runtimes, and more than one
 *  to pick between. Asked by the row rather than by the picker, so a row with nothing to put
 *  under it leaves no gap where the picker would have been. */
const canPickRuntime = (view: GateRuntimes | null): view is GateRuntimes =>
  !!view && view.named && view.names.length > 1;

/** Which runtime the gate judges on. Drawn behind `canPickRuntime`: a board that names no
 *  runtimes has a single one and nothing to choose between. */
function GateRuntime({
  view,
  onSaved,
  onError,
}: {
  view: GateRuntimes;
  onSaved: (view: GateRuntimes) => void;
  onError?: (msg: string) => void;
}) {
  const c = useCopy().configuration.delivery.gate;
  const [saving, setSaving] = useState(false);

  const pick = async (next: string) => {
    const runtime = next === FOLLOW ? "" : next;
    if (saving || runtime === view.runtime) return;
    setSaving(true);
    const was = view;
    onSaved({ ...view, runtime });
    try {
      const res = await setGateRuntimeAction(runtime);
      if (!res.ok) {
        onSaved(was);
        onError?.(res.error || c.runtimeFailed);
        return;
      }
      // Which agent the pick resolves to is the board's answer, not one this row can work
      // out — a runtime is bound per machine.
      onSaved(await gateRuntimeAction());
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-center gap-2.5">
      <span className="text-[11.5px] font-[700] text-nb-ink-soft">{c.runtime}</span>
      <Select
        value={view.runtime || FOLLOW}
        disabled={saving}
        onValueChange={(next) => void pick(next)}
      >
        <SelectTrigger
          aria-label={c.runtime}
          className={`${FLAT_CONTROL} h-8 w-auto rounded-[9px] py-0 text-[12px] font-[700] disabled:cursor-wait`}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={FOLLOW}>{c.followGlobal}</SelectItem>
          {view.names.map((name) => (
            <SelectItem key={name} value={name}>
              {name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {view.harness && (
        <span className="font-mono text-[11.5px] text-nb-ink-soft">{view.harness}</span>
      )}
      <span className="text-[11.5px] text-nb-ink-soft">{c.runtimeScope}</span>
    </div>
  );
}

/** The **Delivery** group of Configuration → General. It reads all four settings from the
 *  board when it draws. */
export function DeliveryGroup({ onError }: { onError?: (msg: string) => void }) {
  const c = useCopy().configuration.delivery;
  const caption = useCopy().configuration.general.delivery;
  const [gate, setGate] = useState<boolean | null>(null);
  const [runtimes, setRuntimes] = useState<GateRuntimes | null>(null);
  const [commits, setCommits] = useState<boolean | null>(null);
  const [approval, setApproval] = useState<boolean | null>(null);
  const [review, setReview] = useState<boolean | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void Promise.all([
      autoCommitAction(),
      diffApprovalAction(),
      aiReviewAction(),
      readyGateAction(),
      gateRuntimeAction(),
    ]).then(([commit, approve, judge, ready, where]) => {
      if (!live) return;
      setCommits(commit.on);
      setApproval(approve.on);
      setReview(judge.on);
      setGate(ready.on);
      setRuntimes(where);
      setLoadError(commit.error ?? approve.error ?? judge.error ?? ready.error ?? null);
    });
    return () => {
      live = false;
    };
  }, []);

  const flipGate = async (next: boolean) => {
    setGate(next);
    const res = await setReadyGateAction(next);
    if (!res.ok) {
      setGate(!next);
      onError?.(res.error || (next ? c.gate.failedOn : c.gate.failedOff));
    }
  };

  const flipCommits = async (next: boolean) => {
    setCommits(next);
    const res = await setAutoCommitAction(next);
    if (!res.ok) {
      setCommits(!next);
      onError?.(res.error || (next ? c.commits.failedOn : c.commits.failedOff));
    }
  };

  const flipApproval = async (next: boolean) => {
    setApproval(next);
    const res = await setDiffApprovalAction(next);
    if (!res.ok) {
      setApproval(!next);
      onError?.(res.error || (next ? c.approval.failedOn : c.approval.failedOff));
    }
  };

  const flipReview = async (next: boolean) => {
    setReview(next);
    const res = await setAiReviewAction(next);
    if (!res.ok) {
      setReview(!next);
      onError?.(res.error || (next ? c.review.failedOn : c.review.failedOff));
    }
  };

  return (
    <Group title={caption}>
      <Panel>
        {/* First (#440): this row decides whether a delivery starts at all, and the three
            under it decide how one is built. Its runtime sits under it rather than beside
            the switch — it is a second answer about the same row, not a second setting. */}
        <Row
          label={c.gate.title}
          hint={c.gate.body}
          below={
            gate && canPickRuntime(runtimes) ? (
              <GateRuntime view={runtimes} onSaved={setRuntimes} onError={onError} />
            ) : undefined
          }
        >
          <Switch
            on={gate}
            label={(gate ? c.switchOn : c.switchOff)(c.gate.title)}
            onFlip={flipGate}
          />
        </Row>

        <Row label={c.commits.title} hint={c.commits.body}>
          <Switch
            on={commits}
            label={(commits ? c.switchOn : c.switchOff)(c.commits.title)}
            onFlip={flipCommits}
          />
        </Row>

        {/* Always settable (#346): approval follows whether a build got a branch of its own,
            and the Implement box can give one that here even with commits off. */}
        <Row label={c.approval.title} hint={c.approval.body}>
          <Switch
            on={approval}
            label={(approval ? c.switchOn : c.switchOff)(c.approval.title)}
            onFlip={flipApproval}
          />
        </Row>

        {/* Independent of the one above (#416): a board that wants a human in the loop with
            review off is exactly a board with approval on. */}
        <Row label={c.review.title} hint={c.review.body}>
          <Switch
            on={review}
            label={(review ? c.switchOn : c.switchOff)(c.review.title)}
            onFlip={flipReview}
          />
        </Row>
      </Panel>

      {loadError && (
        <p className="mt-2.5 flex items-start gap-1.5 text-[12px] leading-relaxed text-nb-ink-soft">
          <FiAlertCircle className="mt-[3px] shrink-0" aria-hidden />
          <span>{loadError}</span>
        </p>
      )}

      {/* Said once for all three, under them — a change is a change to any of the switches. */}
      <p className="mt-2.5 text-[11.5px] leading-relaxed text-nb-ink-soft">{c.frozen}</p>
    </Group>
  );
}
