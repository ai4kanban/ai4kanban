"use client";

// Getting words out of the app and onto the clipboard (#269), and saying so.
//
// A leaf: the mechanics only. Each surface draws its own copy button in its own chrome —
// the chat rail's is a quiet 11px word, a code block's is an icon in the corner — and takes
// the check, the timer and the announcement from here.

import { useCallback, useEffect, useState } from "react";
import { useCopy } from "@/i18n/use-copy";

/** How long the icon stays a check before going back to being a copy button. */
const COPIED_MS = 1600;

/** A copy button's state: whether it just worked, and how to copy.
 *
 *  A copy that fails says nothing. Where there is no clipboard the words are on screen to
 *  select by hand, and claiming a copy that never happened is worse than saying nothing. */
export function useCopyText(): { copied: boolean; copy(text: string): void } {
  const [copied, setCopied] = useCopied();
  const copy = useCallback(
    (text: string) => {
      navigator.clipboard
        ?.writeText(text)
        .then(() => setCopied(true))
        .catch(() => {});
    },
    [setCopied],
  );
  return { copied, copy };
}

/** Whether this browser can put a picture on the clipboard. */
export function canCopyImage(): boolean {
  return typeof ClipboardItem !== "undefined" && typeof navigator.clipboard?.write === "function";
}

/** useCopyText for a picture (#1549). The clipboard only reliably takes PNG, so anything else
 *  is redrawn as one first. The item gets a promise rather than the bytes, so Safari still
 *  counts the write as part of the click. */
export function useCopyImage(): { copied: boolean; copy(src: string): void } {
  const [copied, setCopied] = useCopied();
  const copy = useCallback(
    (src: string) => {
      const png = fetch(src)
        .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(String(r.status)))))
        .then((blob) => (blob.type === "image/png" ? blob : toPng(blob)));
      navigator.clipboard
        .write([new ClipboardItem({ "image/png": png })])
        .then(() => setCopied(true))
        .catch(() => {});
    },
    [setCopied],
  );
  return { copied, copy };
}

async function toPng(blob: Blob): Promise<Blob> {
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    canvas.getContext("2d")?.drawImage(img, 0, 0);
    return await new Promise((ok, fail) =>
      canvas.toBlob((b) => (b ? ok(b) : fail(new Error("toBlob"))), "image/png"),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** True for COPIED_MS after it is set. */
function useCopied(): [boolean, (on: boolean) => void] {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), COPIED_MS);
    return () => clearTimeout(timer);
  }, [copied]);
  return [copied, setCopied];
}

/** The word a screen reader hears when a copy worked. Always in the DOM, empty at rest: a
 *  live region added at the same moment as its text is announced by no reader reliably. */
export function Copied({ on }: { on: boolean }) {
  const c = useCopy().shared;
  return (
    <span role="status" aria-live="polite" className="sr-only">
      {on ? c.copied : ""}
    </span>
  );
}
