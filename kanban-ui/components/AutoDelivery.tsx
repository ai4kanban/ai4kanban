"use client";

// Auto-delivery: may the board commit? (#303)
//
// One switch, and it decides how every delivery started after it works. On — the default —
// each delivery builds on a branch of its own in a worktree of its own, so several run at
// once without touching each other or your open edits, and what review passed is exactly
// what lands. Off, a delivery works in your own project folder, one at a time, and you
// commit it yourself once review has passed.
//
// The answer is saved with the board rather than with this machine, so a team shares one.

import { useEffect, useState } from "react";
import { FiAlertCircle } from "react-icons/fi";
import { autoCommitAction, setAutoCommitAction } from "@/app/actions";

export function AutoDeliveryPanel({ onError }: { onError?: (msg: string) => void }) {
  const [on, setOn] = useState<boolean | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let live = true;
    void autoCommitAction().then((res) => {
      if (!live) return;
      setOn(res.on);
      setLoadError(res.error ?? null);
    });
    return () => {
      live = false;
    };
  }, []);

  // On screen at once, saved behind it, and put back if the save fails: this switch is the
  // whole pane, so one that silently didn't land would be a setting nobody can trust.
  const flip = async () => {
    if (on === null) return;
    const next = !on;
    setOn(next);
    setSaving(true);
    try {
      const res = await setAutoCommitAction(next);
      if (!res.ok) {
        setOn(!next);
        onError?.(res.error || `couldn't switch automatic Git commits ${next ? "on" : "off"}`);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="mb-5">
        <h3 className="text-[17px] font-[800] tracking-[-0.02em] text-nb-ink">Auto-delivery</h3>
        <p className="mt-1 max-w-[56ch] text-[13px] leading-relaxed text-nb-ink-soft">
          How the board builds a card once you press Implement.
        </p>
      </div>

      {loadError && (
        <p className="mb-4 flex items-start gap-2 rounded-[10px] border-[1.5px] border-nb-ink/20 bg-nb-wash px-3 py-2 text-[12px] leading-relaxed text-nb-ink-soft">
          <FiAlertCircle className="mt-[2px] shrink-0" aria-hidden />
          <span>{loadError}</span>
        </p>
      )}

      <div className="border-y border-nb-ink/12 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h4 className="text-[14px] font-[800] text-nb-ink">Allow automatic Git commits</h4>
            <p className="mt-1 max-w-[52ch] text-[12px] leading-relaxed text-nb-ink-soft">
              Each delivery gets its own branch and worktree, so several run side by side and
              the reviewed code is what lands. Off, a delivery works in your project folder,
              one at a time, and you commit it after review.
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2.5">
            <span className="text-[11px] font-[700] leading-none text-nb-ink-soft">
              {on === null ? "…" : on ? "On" : "Off"}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={on === true}
              aria-label={`Allow automatic Git commits — ${on ? "on" : "off"}`}
              disabled={on === null || saving}
              onClick={() => void flip()}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-[1.5px] border-nb-ink transition-[background-color,opacity] duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nb-accent disabled:cursor-wait disabled:opacity-50 ${
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

        {/* The one thing a flip does NOT do, said where the flip is made: a delivery
            already building keeps the mode it started in. */}
        <p className="mt-3 text-[12px] leading-relaxed text-nb-ink-soft">
          A change applies to deliveries started afterwards. One already in flight keeps the
          mode it started in.
        </p>
      </div>
    </div>
  );
}
