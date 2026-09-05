"use client";

import { useEffect, useState } from "react";
import { FiDownload } from "react-icons/fi";
import { Button } from "./ui/Button";
import { SYSTEM_ICON } from "./download/icons";
import { detectSystem, type Pick } from "./download/detect";
import type { ResolvedSystem } from "./download/builds";
import { countDownloadPress } from "@/lib/usage";

// The landing page's download button — the hero's and the getting-started
// section's are both this one. Everything it needs arrives as a prop:
// `builds.ts` reaches the release through a module that reads the version off
// disk, and none of that can cross into the browser.
//
// It renders the fallback link first and swaps to the direct file once mounted,
// rather than guessing on the server: a static export ships one HTML file to
// every reader, so a server-side guess would send most of them another system's
// build. A reader with no JavaScript, or on a system we don't build for, lands
// on `fallback` — the download page's cards, which hold every file.

export function PlatformCta({
  systems,
  version,
  label,
  fallback,
  place,
}: {
  systems: ResolvedSystem[];
  /** The release this button hands over. Counted with the press, never shown:
   *  the landing page states the version nowhere. */
  version: string;
  /** One word. The system is the icon on the left, not more words. */
  label: string;
  /** Where the button points until the system is known, and on anything we
   *  don't build for. */
  fallback: string;
  /** Which of the landing page's two buttons this is (#297). */
  place: "hero" | "start";
}) {
  const [pick, setPick] = useState<Pick | null>(null);

  useEffect(() => {
    let live = true;
    detectSystem(systems).then((found) => {
      if (live) setPick(found);
    });
    return () => {
      live = false;
    };
  }, [systems]);

  // The mark carries the system, so the label stays one word. It is a step up
  // from the label's size — the button says what it hands over twice, once in
  // a word and once in a glyph, and the glyph is the half you read first.
  const Mark = pick ? SYSTEM_ICON[pick.system.os] : FiDownload;
  return (
    <Button
      href={pick ? pick.build.url : fallback}
      variant="primary"
      // Counted only once the link leaves for GitHub. Until the system is known
      // this button points at /download, and a page move is not a download —
      // that click is counted as the download page's own view (#297).
      onClick={
        pick
          ? () =>
              countDownloadPress({
                place,
                os: pick.system.os,
                arch: pick.build.arch,
                version,
              })
          : undefined
      }
    >
      <Mark className="h-[1.35em] w-[1.35em] shrink-0" aria-hidden="true" />
      {label}
      {pick ? <span className="sr-only"> — {pick.system.name}</span> : null}
    </Button>
  );
}
