"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  addRunPictureAction,
  createImageAgentsAction,
  dropRunPictureAction,
  emptyRunBoxAction,
} from "@/app/actions";
import type { ChatRuntime, CreateImageAgents, ImageAgent } from "./types";

// One box of pictures waiting to be sent (#441, #511, #517).
//
// Two of them exist and they look the same in the window: a conversation's, which belongs to
// the exchange (lib/chat-rail.ts), and the create sheet's, which belongs to the run Add task
// or Build now is about to start. What is shared is the SHAPE — thumbnails, the ✕ on each,
// and the one line a turned-away paste leaves — so `Pasted` in components/Chat.tsx draws
// either without knowing which it has.
//
// The sheet's own box is here. It holds a uuid the sheet minted when it opened, so two
// windows never paste into one folder; the run that starts takes that folder as its own,
// beside its log.

/** What the last paste or drop left behind: the agent that would run can't see pictures at
 *  all, one picture could not be written to disk, or a dropped file was not a picture. The
 *  box draws each in the slot the thumbnails would have taken. */
export type PasteNote =
  | { kind: "blocked" }
  | { kind: "failed"; why: string }
  | { kind: "notImage"; name: string };

/** A box as the window draws it. */
export interface PictureBox {
  /** The pictures in it, oldest first — the names their files are saved under. */
  pasted: string[];
  /** What the last paste had to say for itself, or nothing. */
  note: PasteNote | null;
  /** Where one of them is served from. */
  src(name: string): string;
  /** Take one back out before it is sent — its file goes with it. */
  unpaste(name: string): void;
  /** Who turned a paste away, and who could have taken it — what the refusal names. */
  agent: string;
  imagesAble: string[];
}

/** The create sheet's box, and what the sheet does with it. */
export interface CreatePictures extends PictureBox {
  /** The folder these are written into, sent with the run so it becomes the run's own. */
  box: string;
  /** Whether this box takes a paste at all — a run mode, once what its agent can do has been
   *  read. A paste it cannot send is still TAKEN, and turned away with the sentence that says
   *  who can: a box that quietly ignores a screenshot says nothing at all. */
  offered: boolean;
  /** Pictures are in the box and the mode now picked cannot see them — the sheet says so
   *  and holds Send until they are taken out or the mode is changed back. */
  refused: boolean;
  paste(files: File[]): Promise<void>;
  dropFiles(files: File[]): Promise<void>;
  /** Take the note down — the hand has moved on to the keyboard. */
  clearNote(): void;
  /** A run is being asked for: the box is that run's from here, so closing the sheet leaves
   *  it alone. */
  handOver(): void;
  /** …and it was refused, so the box is the sheet's again. */
  takeBack(): void;
  /** …or it started: the files belong to the run now, and the sheet opens a fresh box. */
  sent(): void;
}

const nothing: ImageAgent = { agent: "", seesImages: false, imagesAble: [] };

/** The pictures pasted into Add task and Build now (#517). One box across both modes, so
 *  switching what sending does never loses what was pasted; Discuss has the conversation's
 *  own and never reaches this.
 *
 *  A picture is written as it is pasted — the thumbnail IS the file — so a paste that can't
 *  be saved says so straight away rather than failing the run later. A sheet closed without
 *  sending empties the box behind it. */
export function useCreatePictures(
  mode: "discuss" | "card" | "build",
  /** The runtime picked for this send (#518), or null for the mode's agent's own. It runs
   *  its own CLI, so what the run can do with a picture is that row's answer and not the
   *  agent's. */
  picked: ChatRuntime | null = null,
): CreatePictures {
  const [box, setBox] = useState(() => crypto.randomUUID());
  const [pasted, setPasted] = useState<string[]>([]);
  const [note, setNote] = useState<PasteNote | null>(null);
  const [agents, setAgents] = useState<CreateImageAgents | null>(null);
  // The run's, not the sheet's — set the moment a run is asked for, so the unmount below
  // leaves its files alone.
  const held = useRef(false);

  // What each mode's run can do with a picture. Read once: it follows the board's settings,
  // and a sheet that outlives a settings change is not the case to chase.
  useEffect(() => {
    void createImageAgentsAction().then(setAgents);
  }, []);

  // The sheet was closed without sending, so nothing it was pasted into is left behind.
  useEffect(() => {
    held.current = false;
    return () => {
      if (!held.current) void emptyRunBoxAction(box);
    };
  }, [box]);

  const own = agents ? (mode === "build" ? agents.build : agents.card) : nothing;
  // A picked row carries its CLI's label, and `imagesAble` is every CLI that can take a
  // picture — so the row says for itself whether this send's pictures reach the run.
  const sees =
    picked && agents
      ? { ...own, agent: picked.label, seesImages: own.imagesAble.includes(picked.label) }
      : own;
  const offered = agents !== null && mode !== "discuss";
  const refused = pasted.length > 0 && offered && !sees.seesImages;

  const paste = useCallback(
    async (files: File[]) => {
      const pictures = files.filter((f) => f.type.startsWith("image/"));
      if (!pictures.length) return;
      // Turned away whole: nothing is written, so a refused paste leaves no file behind.
      if (!sees.seesImages) {
        setNote({ kind: "blocked" });
        return;
      }
      setNote(null);
      for (const file of pictures) {
        const form = new FormData();
        form.set("image", file);
        const saved = await addRunPictureAction(box, form);
        if (!saved.ok) {
          setNote({ kind: "failed", why: saved.error });
          return;
        }
        setPasted((was) => [...was, saved.name]);
      }
    },
    [box, sees.seesImages],
  );

  // One drop. The pictures in it are a paste; anything else is named, because a mixed drop
  // that quietly took half of itself is a drop nobody can trust.
  const dropFiles = useCallback(
    async (files: File[]) => {
      const pictures = files.filter((f) => f.type.startsWith("image/"));
      const other = files.filter((f) => !f.type.startsWith("image/"));
      setNote(null);
      if (pictures.length) await paste(pictures);
      if (other.length) setNote((now) => now ?? { kind: "notImage", name: other[0].name });
    },
    [paste],
  );

  const unpaste = useCallback(
    (name: string) => {
      setPasted((was) => was.filter((n) => n !== name));
      setNote(null);
      void dropRunPictureAction(box, name);
    },
    [box],
  );

  const src = useCallback(
    (name: string) => `/create-image/${box}/${encodeURIComponent(name)}`,
    [box],
  );

  const handOver = useCallback(() => {
    held.current = true;
  }, []);
  const takeBack = useCallback(() => {
    held.current = false;
  }, []);
  const sent = useCallback(() => {
    held.current = true;
    setPasted([]);
    setNote(null);
    // A fresh box: the last one is the run's folder now, and a later paste must not land in
    // the middle of a build.
    setBox(crypto.randomUUID());
  }, []);

  return {
    box,
    pasted,
    // A standing refusal outlives the keystroke that clears an ordinary note: the pictures
    // are still in the box and this mode still cannot send them.
    note: refused ? { kind: "blocked" } : note,
    src,
    unpaste,
    agent: sees.agent,
    imagesAble: sees.imagesAble,
    offered,
    refused,
    paste,
    dropFiles,
    clearNote: useCallback(() => setNote(null), []),
    handOver,
    takeBack,
    sent,
  };
}
