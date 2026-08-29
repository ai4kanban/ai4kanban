"use client";

// Delivery: how the board builds a card once you press Implement.
//
// Two switches, both repository-level, both saved with the board rather than with this
// machine, so a team shares one answer.
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

import { useEffect, useState } from "react";
import { FiAlertCircle } from "react-icons/fi";
import { useCopy } from "@/i18n/use-copy";
import {
  autoCommitAction,
  diffApprovalAction,
  setAutoCommitAction,
  setDiffApprovalAction,
} from "@/app/actions";
import { Group, Row, Switch } from "./settings";

/** The **Delivery** group of Configuration → General. It reads both settings from the board
 *  when it draws. */
export function DeliveryGroup({ onError }: { onError?: (msg: string) => void }) {
  const c = useCopy().configuration.delivery;
  const caption = useCopy().configuration.general.delivery;
  const [commits, setCommits] = useState<boolean | null>(null);
  const [approval, setApproval] = useState<boolean | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void Promise.all([autoCommitAction(), diffApprovalAction()]).then(([commit, approve]) => {
      if (!live) return;
      setCommits(commit.on);
      setApproval(approve.on);
      setLoadError(commit.error ?? approve.error ?? null);
    });
    return () => {
      live = false;
    };
  }, []);

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

  return (
    <Group title={caption}>
      {loadError && (
        <p className="mt-2.5 flex items-start gap-1.5 text-[12px] leading-relaxed text-nb-ink-soft">
          <FiAlertCircle className="mt-[3px] shrink-0" aria-hidden />
          <span>{loadError}</span>
        </p>
      )}

      <div>
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
      </div>

      {/* Said once for both, under them — a change is a change to either switch. */}
      <p className="mt-2 text-[11.5px] leading-relaxed text-nb-ink-soft">{c.frozen}</p>
    </Group>
  );
}
