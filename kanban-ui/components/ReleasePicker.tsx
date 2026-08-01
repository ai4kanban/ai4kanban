"use client";

// Which release the board is showing, and where a release is started (#104, #115).
//
// A select, not a row of chips: a board can plan several versions and the entries
// carry counts, so the list belongs behind one control that says what you are
// looking at — the header row has to stay one line. It wears the same 36px sticker
// frame as the view switch beside it, and the sky fill the release chip on a card
// already uses, so picking a version reads as the same thing in both places.
//
// It is on every board, including one that has never planned a version. #104 hid
// it there so a user who never plans a release is never shown one, but hiding the
// only place the feature lives means the UI can never teach it — and that is the
// state where the user most needs telling it is there. One quiet select in the
// header costs that user nothing: it says All releases and offers New release,
// and nothing asks them for a version.
//
// The last entry is always New release, on a board with none and on one with
// five: a second release is made the same way as the first. Picking it asks for
// the version id and nothing else — where a release sits in the order is the
// order it was made in, and the note beside it in the board file is free text
// nothing reads.

import { useState } from "react";
import { FiTag } from "react-icons/fi";
import type { ReleasePick } from "@/lib/release-pick";
import { DEFAULT_RELEASE } from "@/lib/types";
import { Button } from "./button";
import { Dialog } from "./Dialog";
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "./ui/select";

// The values the All-releases and New-release entries carry. `readReleases`
// cuts a line at the em dash, so a release id can never hold one — not even
// from a hand edit — which makes these the two values no entry can collide
// with. (Radix refuses an empty-string value, so All can't just be "".)
const ALL = "—all—";
const NEW = "—new—";

export function ReleasePicker({
  releases,
  counts,
  value,
  onChange,
  onCreate,
}: {
  /** The open releases in ship order. Empty is a board that plans no versions. */
  releases: string[];
  /** How many open cards each release holds, `next` included. */
  counts: Record<string, number>;
  value: ReleasePick;
  onChange: (r: ReleasePick) => void;
  /** Write the release, then put the board on it. Returns why it couldn't. */
  onCreate: (id: string) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [making, setMaking] = useState(false);
  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
  const entry = (id: string) => `${id} (${counts[id] ?? 0})`;
  const filtering = value !== null;
  return (
    <>
      <Select
        value={value ?? ALL}
        onValueChange={(v) => {
          // New release is an action, not a thing to be showing. The pick isn't
          // passed on, and the select is controlled, so it stays on the release
          // the board is on — even if the user closes the dialog without making
          // anything.
          if (v === NEW) {
            setMaking(true);
            return;
          }
          onChange(v === ALL ? null : v);
        }}
      >
        {/* The trigger wears the same 36px sticker frame as the view switch
            beside it. The entry span is capped: a long version id truncates
            instead of pushing the header's other controls off a narrow
            screen. */}
        <SelectTrigger
          aria-label="Which release to show"
          title="Show one release at a time — blockers always stay on screen"
          className="h-9 w-auto gap-1.5 rounded-[9px] px-2 py-0 text-[12px] font-[700] leading-none shadow-[2px_2px_0_0_var(--color-nb-ink)] [&>span]:max-w-[104px] sm:[&>span]:max-w-[168px]"
          style={{
            background: filtering ? "var(--color-nb-sky-soft)" : "var(--color-nb-paper)",
            color: filtering ? "var(--color-nb-sky-ink)" : "var(--color-nb-ink-soft)",
          }}
        >
          <FiTag aria-hidden style={{ width: 13, height: 13, flex: "0 0 auto" }} />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All releases ({total})</SelectItem>
          {releases.map((r) => (
            <SelectItem key={r} value={r}>
              {entry(r)}
            </SelectItem>
          ))}
          {/* `next` is always last of the releases: it is where a card with no
              release sits, not a version, so it never joins the ship order above
              it. On a board with no releases it is left out — `next` is the whole
              board there, so an entry for it would say what All releases says. */}
          {releases.length > 0 && <SelectItem value={DEFAULT_RELEASE}>{entry(DEFAULT_RELEASE)}</SelectItem>}
          {/* Set off from the entries above: they are things to be looking at,
              this one does something. */}
          <SelectSeparator />
          <SelectItem value={NEW}>New release…</SelectItem>
        </SelectContent>
      </Select>

      {making && <NewReleaseDialog onCreate={onCreate} onClose={() => setMaking(false)} />}
    </>
  );
}

// Ask for the version id, and nothing else. A name the board can't take — empty,
// one it already has, `next`, or one that can't be a filename — keeps the dialog
// open with the reason under the box, so the name is fixed where it was typed
// rather than retyped from scratch. The check is the server's: it reads the
// release file as it writes, so a release a second tab added is caught too.
function NewReleaseDialog({
  onCreate,
  onClose,
}: {
  onCreate: (id: string) => Promise<{ ok: boolean; error?: string }>;
  onClose: () => void;
}) {
  const [id, setId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async () => {
    setSaving(true);
    setError(null);
    const res = await onCreate(id.trim());
    if (res.ok) {
      onClose();
      return;
    }
    setSaving(false);
    setError(res.error || "could not make the release");
  };

  return (
    <Dialog title="New release" width={440} onClose={onClose}>
      <p className="mb-3 text-[13px] leading-relaxed text-nb-ink-soft">
        A version id, in your own words — <code>v1</code>, <code>0.5.0</code>, <code>august</code>. It
        joins the end of the list in <code>docs/kanban/releases.md</code>, and the board switches to
        it so what you write next lands in it.
      </p>
      <input
        type="text"
        value={id}
        placeholder="v1"
        spellCheck={false}
        autoComplete="off"
        autoFocus
        disabled={saving}
        onChange={(e) => setId(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !saving) create();
        }}
        className="w-full rounded-[10px] border-[1.5px] border-nb-ink bg-nb-paper px-3 py-2 font-mono text-[14px] text-nb-ink placeholder:text-nb-ink-soft/60 focus:outline-2 focus:outline-offset-1 focus:outline-nb-accent disabled:cursor-wait"
      />
      {error && (
        <div
          className="nb-panel-sm mt-3 break-words p-2.5 text-[12px] leading-relaxed"
          style={{ background: "var(--color-nb-peach-soft)" }}
        >
          {error}
        </div>
      )}
      <div className="mt-4 flex justify-end gap-2.5">
        <Button size="sm" variant="ghost" disabled={saving} onClick={onClose}>
          Cancel
        </Button>
        <Button size="sm" disabled={saving} onClick={create}>
          {saving ? "Making…" : "Make release"}
        </Button>
      </div>
    </Dialog>
  );
}
