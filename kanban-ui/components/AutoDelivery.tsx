"use client";

// Delivery: how the board builds a delivery once one starts.
//
// One switch, repository-level, saved with the board rather than with this machine, so a
// team shares one answer. Nothing reviews a build any more (#1203).
//
// **Automatic Git commits** (#303) is the side each Implement opens on. On — the default —
// a build gets a branch and a worktree of its own, so several run at once without touching
// each other or your open edits, and what was built is exactly what lands. Off, it builds in
// your own project folder, one at a time, and you commit it yourself once it is done. Either
// way the Implement dialog's box can turn this one build round (#346), and it never writes
// its answer back here.

import { useEffect, useState } from "react";
import { FiAlertCircle } from "react-icons/fi";
import { useCopy } from "@/i18n/use-copy";
import { autoCommitAction, setAutoCommitAction } from "@/app/actions";
import { Group, Panel, Row, Switch } from "./settings";
import { sayFailure } from "@/lib/start-failure";

/** The **Delivery** group of Configuration → General. It reads the setting from the board
 *  when it draws. */
export function DeliveryGroup({ onError }: { onError?: (msg: string) => void }) {
  const c = useCopy().configuration.delivery;
  const caption = useCopy().configuration.general.delivery;
  const [commits, setCommits] = useState<boolean | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void autoCommitAction().then((commit) => {
      if (!live) return;
      setCommits(commit.on);
      setLoadError(commit.error ?? null);
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
      onError?.(sayFailure(res, (next ? c.commits.failedOn : c.commits.failedOff)));
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
      </Panel>

      {loadError && (
        <p className="mt-2.5 flex items-start gap-1.5 text-[12px] leading-relaxed text-nb-ink-soft">
          <FiAlertCircle className="mt-[3px] shrink-0" aria-hidden />
          <span>{loadError}</span>
        </p>
      )}

      <p className="mt-2.5 text-[11.5px] leading-relaxed text-nb-ink-soft">{c.frozen}</p>
    </Group>
  );
}
