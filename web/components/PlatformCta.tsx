"use client";

import { useEffect, useState } from "react";
import { FiDownload } from "react-icons/fi";
import { Button } from "./ui/Button";
import { SYSTEM_ICON } from "./download/icons";
import { detectSystem, type Pick } from "./download/detect";
import type { ResolvedSystem } from "./download/builds";

// The site's download button — the hero's, the landing page's getting-started
// section's, and the download page's are all this one. Everything it needs
// arrives as a prop: `builds.ts` reaches the release through a module that reads
// the version off disk, and none of that can cross into the browser.
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
}: {
  systems: ResolvedSystem[];
  /** Pass it to put the release line beside the button; leave it off for a
   *  button on its own, which is what the landing page takes. */
  version?: string;
  /** One word. The system is the icon on the left, not more words. */
  label: string;
  /** Where the button points until the system is known, and on anything we
   *  don't build for. */
  fallback: string;
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
  const button = (
    <Button href={pick ? pick.build.url : fallback} variant="primary">
      <Mark className="h-[1.35em] w-[1.35em] shrink-0" aria-hidden="true" />
      {label}
      {pick ? <span className="sr-only"> — {pick.system.name}</span> : null}
    </Button>
  );

  if (!version) return button;

  // The version is on the line whether or not the system is known: it is what
  // the button is about to hand over, and the one thing the release page would
  // otherwise be the only place to read.
  const meta = pick ? `v${version} · ${pick.build.label}` : `v${version}`;

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
      {button}
      <span className="text-[0.85rem] text-muted">{meta}</span>
    </div>
  );
}
