"use client";

// Delivery: how the board builds a delivery once one starts.
//
// Three switches, all repository-level, all saved with the board rather than with this
// machine, so a team shares one answer.
//
// Whether a delivery starts by itself is NOT here: that is the Gater (#493), a board agent
// with its own switch, rule and connector on Configuration → Board.
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
// **Review every build** (#416) decides whether the Code reviewer gets a run of its own on
// each finished build. On — the default — because a review is what catches what a build
// missed; off, the build itself is the last agent to read the code, and the repository's
// checks, the open-question hold and diff approval still gate landing.
//
// It was the reviewer's own switch on Configuration → Agents until #783. An agent a workflow
// stage assigns carries no switch of its own (#749), and this one never asked an agent
// question: it asks what a DELIVERY does, beside the two above.

import { useEffect, useState } from "react";
import { FiAlertCircle } from "react-icons/fi";
import { useCopy } from "@/i18n/use-copy";
import {
  aiReviewAction,
  autoCommitAction,
  diffApprovalAction,
  setAiReviewAction,
  setAutoCommitAction,
  setDiffApprovalAction,
} from "@/app/actions";
import { Group, Panel, Row, Switch } from "./settings";
import { sayFailure } from "@/lib/start-failure";

/** The **Delivery** group of Configuration → General. It reads all three settings from the
 *  board when it draws. */
export function DeliveryGroup({ onError }: { onError?: (msg: string) => void }) {
  const c = useCopy().configuration.delivery;
  const caption = useCopy().configuration.general.delivery;
  const [commits, setCommits] = useState<boolean | null>(null);
  const [approval, setApproval] = useState<boolean | null>(null);
  const [review, setReview] = useState<boolean | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void Promise.all([autoCommitAction(), diffApprovalAction(), aiReviewAction()]).then(
      ([commit, approve, reviewed]) => {
        if (!live) return;
        setCommits(commit.on);
        setApproval(approve.on);
        setReview(reviewed.on);
        setLoadError(commit.error ?? approve.error ?? reviewed.error ?? null);
      },
    );
    return () => {
      live = false;
    };
  }, []);

  const flipCommits = async (next: boolean) => {
    setCommits(next);
    const res = await setAutoCommitAction(next);
    if (!res.ok) {
      setCommits(!next);
      onError?.(sayFailure(res, (next ? c.commits.failedOn : c.commits.failedOff)));
    }
  };

  const flipApproval = async (next: boolean) => {
    setApproval(next);
    const res = await setDiffApprovalAction(next);
    if (!res.ok) {
      setApproval(!next);
      onError?.(sayFailure(res, (next ? c.approval.failedOn : c.approval.failedOff)));
    }
  };

  const flipReview = async (next: boolean) => {
    setReview(next);
    const res = await setAiReviewAction(next);
    if (!res.ok) {
      setReview(!next);
      onError?.(sayFailure(res, (next ? c.review.failedOn : c.review.failedOff)));
    }
  };

  return (
    <Group title={caption}>
      <Panel>
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

      {/* Said once for all three, under them — a change is a change to any of them. */}
      <p className="mt-2.5 text-[11.5px] leading-relaxed text-nb-ink-soft">{c.frozen}</p>
    </Group>
  );
}
