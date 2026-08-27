"use client";

// Auto-delivery: how the board builds a card once you press Implement.
//
// Two switches, both repository-level, both saved with the board rather than with this
// machine, so a team shares one answer.
//
// **Allow automatic Git commits** (#303) decides where a delivery works. On — the default —
// each delivery builds on a branch of its own in a worktree of its own, so several run at
// once without touching each other or your open edits, and what review passed is exactly
// what lands. Off, a delivery works in your own project folder, one at a time, and you
// commit it yourself once review has passed.
//
// **Require diff approval before landing** (#308) decides whether anything lands unread.
// Off — the default — a reviewed delivery lands by itself. On, every delivery waits after
// review until you approve the exact tree it would land. It has nothing to hold with
// automatic commits off, where your own commit is already the approval.

import { useEffect, useState } from "react";
import { FiAlertCircle } from "react-icons/fi";
import { useCopy } from "@/i18n/use-copy";
import {
  autoCommitAction,
  diffApprovalAction,
  setAutoCommitAction,
  setDiffApprovalAction,
} from "@/app/actions";

// One setting: its name, what it does, and the switch. On screen at once, saved behind it,
// and put back if the save fails — a switch that silently didn't land is a setting nobody
// can trust.
function SettingRow({
  title,
  children,
  note,
  on,
  disabled,
  onFlip,
}: {
  title: string;
  children: React.ReactNode;
  note?: string;
  on: boolean | null;
  disabled?: boolean;
  onFlip: (next: boolean) => Promise<void>;
}) {
  const c = useCopy().configuration.delivery;
  const [saving, setSaving] = useState(false);
  const flip = async () => {
    if (on === null) return;
    setSaving(true);
    try {
      await onFlip(!on);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="border-b border-nb-ink/12 py-4 first:border-t-[1.5px] first:border-t-nb-ink/12">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h4 className="text-[14px] font-[800] text-nb-ink">{title}</h4>
          <p className="mt-1 max-w-[52ch] text-[12px] leading-relaxed text-nb-ink-soft">{children}</p>
        </div>

        <div className="flex shrink-0 items-center gap-2.5">
          <span className="text-[11px] font-[700] leading-none text-nb-ink-soft">
            {on === null ? c.loading : on ? c.on : c.off}
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={on === true}
            aria-label={(on ? c.switchOn : c.switchOff)(title)}
            disabled={on === null || saving || disabled}
            onClick={() => void flip()}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-[1.5px] border-nb-ink transition-[background-color,opacity] duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nb-accent disabled:cursor-not-allowed disabled:opacity-50 ${
              on ? "bg-nb-accent" : "bg-nb-wash"
            }`}
          >
            <span
              className={`inline-block size-[16px] rounded-full border border-nb-ink bg-nb-paper transition-transform duration-150 ${
                on ? "translate-x-[22px]" : "translate-x-[3px]"
              }`}
              aria-hidden
            />
          </button>
        </div>
      </div>

      {note && <p className="mt-3 text-[12px] leading-relaxed text-nb-ink-soft">{note}</p>}
    </div>
  );
}

export function AutoDeliveryPanel({ onError }: { onError?: (msg: string) => void }) {
  const c = useCopy().configuration.delivery;
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
    <div>
      <div className="mb-5">
        <h3 className="text-[17px] font-[800] tracking-[-0.02em] text-nb-ink">{c.title}</h3>
        <p className="mt-1 max-w-[56ch] text-[13px] leading-relaxed text-nb-ink-soft">{c.blurb}</p>
      </div>

      {loadError && (
        <p className="mb-4 flex items-start gap-2 rounded-[10px] border-[1.5px] border-nb-ink/20 bg-nb-wash px-3 py-2 text-[12px] leading-relaxed text-nb-ink-soft">
          <FiAlertCircle className="mt-[2px] shrink-0" aria-hidden />
          <span>{loadError}</span>
        </p>
      )}

      <SettingRow title={c.commits.title} on={commits} note={c.frozen} onFlip={flipCommits}>
        {c.commits.body}
      </SettingRow>

      {/* With commits off the board never lands anything, so there is nothing to approve —
          the switch stays readable and says why rather than disappearing. */}
      <SettingRow
        title={c.approval.title}
        on={approval}
        disabled={commits === false}
        note={commits === false ? c.approval.moot : c.frozen}
        onFlip={flipApproval}
      >
        {c.approval.body}
      </SettingRow>
    </div>
  );
}
