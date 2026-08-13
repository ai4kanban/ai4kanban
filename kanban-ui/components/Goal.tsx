"use client";

// The project's direction, one click from the board (#128). `docs/kanban/memory/goal.md`
// is the file every proposal is judged against, and until now the UI only showed it while
// the agent judged it weak — the moment it read fine it left the board for good. A quiet
// icon beside the folder path opens the whole file, rendered.
//
// Reading only: the goal is written once through the first run's goal step, and
// after that it is the file on disk (or an agent run) that changes it — the board doesn't
// offer a second place to edit the same words.
//
// It wears the ordinary control of the top row — ink frame, hard shadow, the same object
// as everything else there — and carries its word: a compass alone said "navigate" and
// nothing about the goal, so it is a north star with "Goal" beside it. The label goes on a
// narrow window, like Create task's; the mark stays, since one icon costs nothing.
//
// It appears only when there is something to read (`goalWritten`, lib/goal.ts): a missing
// or empty file has nothing to open, and the guided first run — or the board's goal
// notice — is what asks for the goal there.

import { useEffect, useState } from "react";
import { TbNorthStar } from "react-icons/tb";
import { getGoalAction, saveGoalAction } from "@/app/actions";
import { Button } from "./button";
import { Dialog } from "./Dialog";
import { Markdown } from "./Markdown";

// Same input rules as the agent dialogs' textarea, taller: the goal is a few
// paragraphs and a roadmap, not a note.
const INPUT =
  "min-h-[260px] w-full resize-y rounded-[10px] border-[1.5px] border-nb-ink bg-nb-paper px-3 py-2.5 font-mono text-[13px] leading-relaxed text-nb-ink placeholder:text-nb-ink-soft/60 focus:outline-2 focus:outline-offset-1 focus:outline-nb-accent";

export function Goal({ written }: { written: boolean }) {
  const [open, setOpen] = useState(false);
  if (!written) return null;
  return (
    <>
      <Button
        variant="ghost"
        size="xs"
        className="shrink-0 font-[700] max-sm:w-7 max-sm:px-0"
        title="What this board is for"
        aria-label="Goal"
        onClick={() => setOpen(true)}
      >
        <TbNorthStar className="text-[15px]" aria-hidden />
        <span className="sr-only sm:not-sr-only">Goal</span>
      </Button>

      {open && (
        <Dialog title="Goal" width={720} height="min(660px, 85vh)" flush onClose={() => setOpen(false)}>
          <GoalPanel />
        </Dialog>
      )}
    </>
  );
}

// The whole of goal.md below its frontmatter, read fresh each time the dialog
// opens — an agent run may have reshaped the file since the page loaded.
// `flush`, so the long file scrolls inside the dialog rather than the dialog
// growing to hold it.
function GoalPanel() {
  const { text, error } = useGoalText();

  if (error) return <div className="min-w-0 flex-1 p-5"><Failure text={error} /></div>;
  if (text === null) {
    return <p className="min-w-0 flex-1 p-5 text-[13px] italic text-nb-ink-soft">Reading goal.md…</p>;
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-5">
      <Markdown body={text} />
    </div>
  );
}

// The goal editor the board's goal notice opens (#53, #85) — the second place the goal is
// typed, with the note about what belongs in the file. The words stay the user's
// and the judgment stays the agent's: a save marks the goal `reviewed: pending`
// and leaves the rest of the frontmatter alone (#108).
export function GoalEditor({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { text, setText, error } = useGoalText();
  return (
    <Dialog title="Write the goal" width={640} onClose={onClose}>
      {/* The box starts empty (#108), so what belongs in a goal is said here — the
          file no longer opens with a paragraph the user has to delete first. */}
      <p className="mb-3 text-[13px] leading-relaxed text-nb-ink-soft">
        Where the project is headed, in your own words: what you want, how far out, and roughly
        what comes next. Rough and short is fine, and you can change it later — the agent never
        drafts the goal for you.{" "}
        <a
          href="https://github.com/ai4kanban/ai4kanban/blob/main/docs/guides/what-makes-a-good-goal.md"
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-2 hover:text-nb-ink"
        >
          What makes a good goal
        </a>
      </p>
      {error && <Failure text={error} />}
      {text === null && !error && <p className="text-[13px] italic text-nb-ink-soft">Reading goal.md…</p>}
      {text !== null && (
        <GoalForm
          initial={text}
          onCancel={onClose}
          onSaved={(saved) => {
            setText(saved);
            onSaved();
          }}
        />
      )}
    </Dialog>
  );
}

// The textarea and its Save / Cancel. The editor's dialog sizes to its
// content, so the buttons sit under the box rather than on a fixed strip.
function GoalForm({
  initial,
  onCancel,
  onSaved,
}: {
  initial: string;
  onCancel: () => void;
  onSaved: (text: string) => void;
}) {
  const [text, setText] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setError(null);
    const res = await saveGoalAction(text);
    setSaving(false);
    if (!res.ok) {
      setError(res.error || "could not save the goal");
      return;
    }
    onSaved(text);
  };

  return (
    <>
      <textarea className={INPUT} value={text} onChange={(e) => setText(e.target.value)} autoFocus />
      {error && <div className="mt-3"><Failure text={error} /></div>}
      <div className="mt-4 flex justify-end gap-2.5">
        <Button size="sm" variant="ghost" disabled={saving} onClick={onCancel}>
          Cancel
        </Button>
        <Button size="sm" disabled={saving} onClick={save}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
    </>
  );
}

// The same peach panel the rest of the board reports a failed read or save in.
function Failure({ text }: { text: string }) {
  return (
    <div
      className="nb-panel-sm break-words p-2.5 text-[12px] leading-relaxed"
      style={{ background: "var(--color-nb-peach-soft)" }}
    >
      {text}
    </div>
  );
}

// Read goal.md's body once, when whatever is showing it mounts. Both the goal
// dialog and the goal editor only mount while open, so every open is a
// fresh read. `null` means still reading.
function useGoalText() {
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    getGoalAction()
      .then((t) => alive && setText(t))
      .catch((e) => alive && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      alive = false;
    };
  }, []);
  return { text, setText, error };
}
