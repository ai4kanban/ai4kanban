"use client";

// The goal bar (#53): when the agent judged `goal.md` weak, a strip between the
// header and the columns asks the user to write the goal — every proposal is
// judged against it, so a rough answer now beats a blank file. It's a nudge, not
// a gate: the board works either way, and a dismiss hides it for the browser
// session (sessionStorage — nothing is written to the board files). Saving the
// goal hides it for the session too: `reviewed:` stays weak until an agent flow
// re-judges it, and nagging right after the user wrote would be wrong. Once the
// value turns `good` or `strong` the bar drops out with the board refresh — no
// reload.

import { useEffect, useState } from "react";
import { FiX } from "react-icons/fi";
import { getGoalAction, saveGoalAction } from "@/app/actions";
import { Button } from "./button";
import { Dialog } from "./Dialog";

const DISMISS_KEY = "kanban-ui.goal-bar-dismissed";

// Same input rules as the agent dialogs' textarea, taller: the goal is a few
// paragraphs, not a note.
const INPUT =
  "min-h-[260px] w-full resize-y rounded-[10px] border-[1.5px] border-nb-ink bg-nb-paper px-3 py-2.5 font-mono text-[13px] leading-relaxed text-nb-ink placeholder:text-nb-ink-soft/60 focus:outline-2 focus:outline-offset-1 focus:outline-nb-accent";

export function GoalBar({ onSaved }: { onSaved: () => void }) {
  // Start hidden and reveal after mount: sessionStorage doesn't exist during
  // SSR, so reading it in the first render would mismatch the server markup.
  const [dismissed, setDismissed] = useState(true);
  useEffect(() => {
    setDismissed(sessionStorage.getItem(DISMISS_KEY) === "1");
  }, []);
  const dismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  };

  const [editing, setEditing] = useState(false);
  const [text, setText] = useState<string | null>(null); // null = still loading
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch the current goal text fresh each time the editor opens — an agent run
  // may have seeded or reshaped the file since the page loaded.
  useEffect(() => {
    if (!editing) return;
    let alive = true;
    getGoalAction()
      .then((t) => alive && setText(t))
      .catch((e) => alive && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      alive = false;
    };
  }, [editing]);

  const save = async () => {
    if (text === null) return;
    setSaving(true);
    setError(null);
    const res = await saveGoalAction(text);
    setSaving(false);
    if (!res.ok) {
      setError(res.error || "could not save the goal");
      return;
    }
    setEditing(false);
    dismiss();
    onSaved();
  };

  if (dismissed) return null;

  return (
    <div
      className="mx-6 mt-4 nb-panel-sm flex items-center gap-4 p-3.5"
      style={{ background: "var(--color-nb-accent-soft)" }}
    >
      <p className="flex-1 text-[13px] leading-snug">
        <span className="font-[800]">The project goal is missing or unclear.</span>{" "}
        <span className="text-nb-ink-soft">
          Every proposal the agent makes is judged against it. Say where the project is headed and
          roughly how far — rough and short is fine, you can change it later.
        </span>
      </p>
      <Button size="sm" className="shrink-0" onClick={() => setEditing(true)}>
        Write the goal
      </Button>
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        title="Hide for this session"
        className="grid h-7 w-7 shrink-0 cursor-pointer place-items-center rounded-[6px] text-nb-ink-soft transition-[transform,background-color,color] duration-100 hover:bg-nb-ink/5 hover:text-nb-ink active:scale-90"
      >
        <FiX className="h-[16px] w-[16px]" />
      </button>

      {editing && (
        <Dialog title="Write the goal" width={640} onClose={() => setEditing(false)}>
          <p className="mb-3 text-[13px] leading-relaxed text-nb-ink-soft">
            Your own words go in — the agent never drafts the goal for you. This one file holds the
            whole direction, the horizon and roadmap included. A rough, short answer is fine and can
            change later.
          </p>
          {text === null && !error && (
            <p className="text-[13px] italic text-nb-ink-soft">Reading goal.md…</p>
          )}
          {text !== null && (
            <textarea
              className={INPUT}
              value={text}
              onChange={(e) => setText(e.target.value)}
              autoFocus
            />
          )}
          {error && (
            <div
              className="mt-3 nb-panel-sm p-2.5 text-[12px]"
              style={{ background: "var(--color-nb-peach-soft)" }}
            >
              {error}
            </div>
          )}
          <div className="mt-4 flex justify-end gap-2.5">
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button size="sm" disabled={text === null || saving} onClick={save}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
