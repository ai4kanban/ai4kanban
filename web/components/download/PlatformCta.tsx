"use client";

import { useEffect, useState } from "react";
import { FiDownload } from "react-icons/fi";
import { Button } from "../ui/Button";
import type { Arch, ResolvedSystem } from "./builds";

// The page's one button, aimed at the system the reader is on. Everything it
// needs arrives as a prop: `builds.ts` reaches the release through a module that
// reads the version off disk, and none of that can cross into the browser.
//
// It renders the plain release link first and swaps to the direct file once
// mounted, rather than guessing on the server: a static export ships one HTML
// file to every reader, so a server-side guess would show most of them another
// system's name. The cards below hold every file either way — which is what a
// reader with no JavaScript, or on a system we don't build for, gets.

type Pick = { system: ResolvedSystem; build: ResolvedSystem["builds"][number] };

export function PlatformCta({
  systems,
  version,
  label,
  labelAny,
  releasesUrl,
}: {
  systems: ResolvedSystem[];
  version: string;
  /** `Download for {system}` — the label once the system is known. */
  label: string;
  /** `Download` — until then, and on anything we don't build for. */
  labelAny: string;
  releasesUrl: string;
}) {
  const [pick, setPick] = useState<Pick | null>(null);

  useEffect(() => {
    let live = true;
    detect(systems).then((found) => {
      if (live) setPick(found);
    });
    return () => {
      live = false;
    };
  }, [systems]);

  // The version is on the line whether or not the system is known: it is what
  // the button is about to hand over, and the one thing the release page would
  // otherwise be the only place to read.
  const meta = pick ? `v${version} · ${pick.build.label} · ${pick.build.ext}` : `v${version}`;

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
      <Button href={pick ? pick.build.url : releasesUrl} variant="primary">
        <FiDownload className="h-4 w-4" aria-hidden="true" />
        {pick ? label.replace("{system}", pick.system.name) : labelAny}
      </Button>
      <span className="font-mono text-[0.85rem] text-muted">{meta}</span>
    </div>
  );
}

/** Which system, and which file under it. `null` on anything that can't run the
 *  app — a phone — or that we don't build for. */
async function detect(systems: ResolvedSystem[]): Promise<Pick | null> {
  const ua = navigator.userAgent;
  // A phone can't open a desktop app, and an iPad reports itself as a Mac.
  if (/Android|iPhone|iPad|iPod|Mobile/i.test(ua)) return null;

  const os = /Mac/i.test(ua)
    ? "mac"
    : /Win/i.test(ua)
      ? "windows"
      : /Linux|X11/i.test(ua)
        ? "linux"
        : null;
  const system = systems.find((s) => s.os === os);
  if (!system) return null;

  const arch = await architecture();
  const build = system.builds.find((b) => b.arch === arch) ?? system.builds[0];
  return { system, build };
}

/** Only Chromium will say which CPU it is on, and only when asked. Every other
 *  browser reports `Intel Mac OS X` on an Apple Silicon Mac too, so the UA
 *  string can't answer this — `null` means take the system's first build, which
 *  is why the arm one is listed first. */
async function architecture(): Promise<Arch> {
  const data = (navigator as NavigatorUA).userAgentData;
  if (!data?.getHighEntropyValues) return null;
  try {
    const values = await data.getHighEntropyValues(["architecture"]);
    return values.architecture === "arm" ? "arm" : values.architecture === "x86" ? "x86" : null;
  } catch {
    return null;
  }
}

/** User-Agent Client Hints, which TypeScript's DOM library doesn't declare. */
type NavigatorUA = Navigator & {
  userAgentData?: {
    getHighEntropyValues?: (hints: string[]) => Promise<{ architecture?: string }>;
  };
};
