"use client";

// The project's direction, one click from the board (#128). `docs/kanban/memory/goal.md`
// is the file every proposal is judged against, and until now the UI only showed it while
// the agent judged it weak — the moment it read fine it left the board for good. A quiet
// icon beside the folder path opens the whole file, rendered, and lets the user edit it
// there.
//
// The button is deliberately lighter than the sticker buttons on the right: those four
// start something, this is something you read now and then. It stays at every width — the
// path badge shrinks and drops on a narrow screen, one icon costs nothing.
//
// It appears only when there is something to read (`goalWritten`, lib/goal.ts): a missing
// or empty file has nothing to open, and the setup bar is what asks for the goal there.
//
// The editor here and the setup bar's "Write the goal" are one form (GoalForm) — same
// textarea, same save, same rule that the words are the user's and the judgment is the
// agent's: a save marks the goal `reviewed: pending` and leaves the rest of the
// frontmatter alone (#108).

import { useEffect, useState } from "react";
import { FiCompass } from "react-icons/fi";
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
      <button
        type="button"
        title="Goal"
        aria-label="Goal"
        onClick={() => setOpen(true)}
        className="grid h-7 w-7 shrink-0 cursor-pointer place-items-center self-center rounded-[6px] text-nb-ink-soft transition-[transform,background-color,color] duration-100 hover:bg-nb-ink/5 hover:text-nb-ink active:scale-90"
      >
        <FiCompass className="h-[17px] w-[17px]" aria-hidden />
      </button>

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
// `flush`, so the goal scrolls under a footer that stays put: the file is long
// and an Edit button at the end of it would be a scroll away.
function GoalPanel() {
  const { text, setText, error } = useGoalText();
  const [editing, setEditing] = useState(false);

  if (error) return <div className="min-w-0 flex-1 p-5"><Failure text={error} /></div>;
  if (text === null) {
    return <p className="min-w-0 flex-1 p-5 text-[13px] italic text-nb-ink-soft">Reading goal.md…</p>;
  }

  if (editing) {
    return (
      <GoalForm
        initial={text}
        onCancel={() => setEditing(false)}
        onSaved={(saved) => {
          // Straight back to the rendered goal, showing what was just written —
          // nothing is re-read, the text on screen is the text on disk.
          setText(saved);
          setEditing(false);
        }}
      />
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        <Markdown body={text} />
      </div>
      <Footer>
        <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
          Edit
        </Button>
      </Footer>
    </div>
  );
}

// The goal editor the setup bar opens (#53, #85) — the same form, in a dialog of
// its own with the note about what belongs in the file.
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
          bare
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

// The textarea and its Save / Cancel. `bare` drops the scrolling body and the
// footer rule — the setup bar's dialog sizes to its content, so the buttons sit
// under the box rather than on a fixed strip.
function GoalForm({
  initial,
  bare = false,
  onCancel,
  onSaved,
}: {
  initial: string;
  bare?: boolean;
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

  const buttons = (
    <>
      <Button size="sm" variant="ghost" disabled={saving} onClick={onCancel}>
        Cancel
      </Button>
      <Button size="sm" disabled={saving} onClick={save}>
        {saving ? "Saving…" : "Save"}
      </Button>
    </>
  );

  if (bare) {
    return (
      <>
        <textarea className={INPUT} value={text} onChange={(e) => setText(e.target.value)} autoFocus />
        {error && <div className="mt-3"><Failure text={error} /></div>}
        <div className="mt-4 flex justify-end gap-2.5">{buttons}</div>
      </>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* The box fills the pane, so the editor is as tall as the goal it
          replaced and the dialog doesn't resize when you press Edit. */}
      <div className="flex min-h-0 flex-1 flex-col gap-3 p-5">
        <textarea
          className={`${INPUT} min-h-0 flex-1 resize-none`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoFocus
        />
        {error && <Failure text={error} />}
      </div>
      <Footer>{buttons}</Footer>
    </div>
  );
}

// The dialog's own action strip, ruled off from the scrolling body above it.
function Footer({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex shrink-0 justify-end gap-2.5 px-5 py-3"
      style={{ borderTop: "1.5px solid color-mix(in srgb, var(--color-nb-ink) 14%, transparent)" }}
    >
      {children}
    </div>
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
// dialog and the setup bar's editor only mount while open, so every open is a
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
