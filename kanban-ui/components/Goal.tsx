"use client";

// The project's direction, one click from the board (#128). `docs/kanban/memory/goal.md`
// is the file a proposal is judged against — optional, and nothing waits on it (#437).
//
// It wears the ordinary control of the top row — ink frame, hard shadow, the same object
// as everything else there — and carries its word: a compass alone said "navigate" and
// nothing about the goal, so it is a north star with "Goal" beside it. The label goes on a
// narrow window, like Create task's; the mark stays, since one icon costs nothing.
//
// One control, two states, both quiet:
//
//   • written — the star opens the file, rendered. Reading only: the words are the user's,
//     and the second place to edit them is the box below.
//   • empty — the same star, in soft ink, saying Add goal, and it opens that box. This is
//     the ONLY thing that offers to write a goal (#437). The board carries no band about
//     it: the goal is optional, so a strip nagging for one would be the board holding
//     itself up over a file nobody has to write.
//
// The offer belongs to the board's own top row (`offer`), the one screen the goal is read
// off. Everywhere else — a card page, the archive, the guided run that is asking a screen
// away — the star appears only when there is something to open, as it always did.
//
// A marketing board is offered nothing (#407): its install writes no `goal.md` at all,
// positioning is a `decisions.md` line and the product board's goal is one of its planning
// sources, so the empty state draws no entry there.

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FiChevronRight } from "react-icons/fi";
import { TbNorthStar } from "react-icons/tb";
import { getGoalAction, saveGoalAction } from "@/app/actions";
import { useCopy } from "@/i18n/use-copy";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { PHONE_ROW } from "./chrome";
import { Dialog } from "./Dialog";
import { GuideDrawer } from "./Guide";
import { Markdown } from "./Markdown";
import { useSolution } from "./solution";

// Same input rules as the agent dialogs' textarea, taller: the goal is a few
// paragraphs and a roadmap, not a note.
const INPUT =
  "min-h-[260px] w-full resize-y rounded-[10px] border border-nb-ink/25 bg-nb-paper px-3 py-2.5 font-mono text-[13px] leading-relaxed text-nb-ink placeholder:text-nb-ink-soft/60 focus:outline-2 focus:outline-offset-1 focus:outline-nb-accent";

export function Goal({
  written,
  offer = false,
  row = false,
  onSaved,
}: {
  written: boolean;
  /** Whether this screen offers to write a goal that isn't there. The board's top row does;
   *  every other one draws the star only when the file holds something. */
  offer?: boolean;
  row?: boolean;
  /** Re-read the board after the box saves, so the entry turns back into Goal without a
   *  reload. Absent where nothing behind this button is drawn from the goal. */
  onSaved?: () => void;
}) {
  const c = useCopy().rail.goal;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const marketing = useSolution() === "marketing";
  if (!written && (!offer || marketing)) return null;
  const label = written ? c.open : c.write;
  const hint = written ? c.openHint : c.writeHint;
  return (
    <>
      {/* `row` is the phone's More screen (#357): the same button, laid out for a width
          where a 28px sticker in a corner is not something a thumb can aim at. */}
      {row ? (
        <button type="button" className={PHONE_ROW} title={hint} onClick={() => setOpen(true)}>
          <TbNorthStar className="shrink-0 text-[17px] text-nb-ink-soft" aria-hidden />
          <span className="min-w-0 flex-1">{label}</span>
          <FiChevronRight className="shrink-0 text-nb-ink-soft" size={16} aria-hidden />
        </button>
      ) : (
      <Button
        variant="ghost"
        size="xs"
        // An empty goal is an offer, not a job: it wears the same frame in soft ink, so it
        // sits in the row without asking to be pressed.
        className={cn("shrink-0 font-[700] max-sm:w-7 max-sm:px-0", !written && "text-nb-ink-soft")}
        title={hint}
        aria-label={label}
        onClick={() => setOpen(true)}
      >
        <TbNorthStar className="text-[15px]" aria-hidden />
        <span className="sr-only sm:not-sr-only">{label}</span>
      </Button>
      )}

      {open && written && (
        <Dialog title={c.title} width={720} height="min(660px, 85vh)" flush onClose={() => setOpen(false)}>
          <GoalPanel />
        </Dialog>
      )}
      {open && !written && (
        <GoalEditor
          onClose={() => setOpen(false)}
          onSaved={() => {
            setOpen(false);
            // The page re-reads itself, for the screens drawn from the server's own read;
            // `onSaved` is for the board, which holds its read in state and would not
            // notice a server re-render.
            router.refresh();
            onSaved?.();
          }}
        />
      )}
    </>
  );
}

// The whole of goal.md below its frontmatter, read fresh each time the dialog
// opens — an agent run may have reshaped the file since the page loaded.
// `flush`, so the long file scrolls inside the dialog rather than the dialog
// growing to hold it.
function GoalPanel() {
  const c = useCopy().rail.goal;
  const { text, error } = useGoalText();

  if (error) return <div className="min-w-0 flex-1 p-5"><Failure text={error} /></div>;
  if (text === null) {
    return <p className="min-w-0 flex-1 p-5 text-[13px] italic text-nb-ink-soft">{c.reading}</p>;
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-5">
      <Markdown body={text} />
    </div>
  );
}

// The box behind the header's Add goal, and the first run's own goal step (#53, #85) — the
// place the goal is typed after setup, with the note about what belongs in the file. The
// words stay the user's and the judgment stays the agent's: a save marks the goal
// `reviewed: pending` and leaves the rest of the frontmatter alone (#108).
export function GoalEditor({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const c = useCopy().rail.goal;
  const { text, setText, error } = useGoalText();
  return (
    <Dialog title={c.editTitle} width={640} onClose={onClose}>
      {/* The box starts empty (#108), so what belongs in a goal is said here — the
          file no longer opens with a paragraph the user has to delete first. */}
      <GuideDrawer
        guide="what-makes-a-good-goal"
        title={c.guideTitle}
        className="mb-3 text-[13px] leading-relaxed text-nb-ink-soft"
      >
        {c.guideLine}
      </GuideDrawer>
      {error && <Failure text={error} />}
      {text === null && !error && <p className="text-[13px] italic text-nb-ink-soft">{c.reading}</p>}
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
  const t = useCopy();
  const [text, setText] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setError(null);
    const res = await saveGoalAction(text);
    setSaving(false);
    if (!res.ok) {
      setError(res.error || t.rail.goal.saveFailed);
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
          {t.shared.cancel}
        </Button>
        <Button size="sm" disabled={saving} onClick={save}>
          {saving ? t.shared.saving : t.shared.save}
        </Button>
      </div>
    </>
  );
}

// The same peach panel the rest of the board reports a failed read or save in.
function Failure({ text }: { text: string }) {
  return (
    <div
      className="break-words rounded-[12px] border border-nb-ink/12 p-2.5 text-[12px] leading-relaxed"
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
