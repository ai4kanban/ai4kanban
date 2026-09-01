import { assetUrl } from "@/lib/release";

// What the release holds, and which file a system takes. None of it is copy
// (design.md §6): system names are product names, an architecture is an
// identifier, and a file name is a fact about the build — all five stay in
// English in every language.

/** What the browser can tell us about the CPU. `null` is a build that serves
 *  both, which is what the Windows installer does. */
export type Arch = "arm" | "x86" | null;

type Build = {
  /** What a reader picks between inside one system, in the words they would
   *  use: the chip's name, or the machine's width. Never the file's name — the
   *  page says which machine it is for, and hands the file over. */
  label: string;
  arch: Arch;
  /** The asset name on the release, which carries the version. */
  file: (version: string) => string;
};

/** The systems, in the order the cards list them, and the files under each. The
 *  first build is the default: it is what a browser that won't say which CPU it
 *  is on gets, so it has to be the one most readers want. */
const SYSTEMS: { os: OS; name: string; builds: Build[] }[] = [
  {
    os: "mac",
    name: "macOS",
    builds: [
      // Apple Silicon first, and not only because it is newer: no browser but
      // Chromium will say which Mac this is, so this row is also the guess.
      { label: "Apple Silicon", arch: "arm", file: (v) => `AI4Kanban-${v}-arm64.dmg` },
      { label: "Intel", arch: "x86", file: (v) => `AI4Kanban-${v}.dmg` },
    ],
  },
  {
    os: "windows",
    name: "Windows",
    // One NSIS installer covers x64 and arm64, so there is nothing to pick.
    builds: [
      { label: "Installer", arch: null, file: (v) => `AI4Kanban-Setup-${v}.exe` },
    ],
  },
  {
    os: "linux",
    name: "Linux",
    builds: [
      { label: "64-bit", arch: "x86", file: (v) => `AI4Kanban-${v}.AppImage` },
      { label: "ARM64", arch: "arm", file: (v) => `AI4Kanban-${v}-arm64.AppImage` },
    ],
  },
];

export type OS = "mac" | "windows" | "linux";

/** One system with its files resolved to URLs — plain data, so it crosses into
 *  the client component that aims the button. */
export type ResolvedSystem = {
  os: OS;
  name: string;
  builds: { label: string; arch: Arch; url: string }[];
};

/** Call once, on the server: `assetUrl` needs the version off disk. */
export function releaseBuilds(version: string): ResolvedSystem[] {
  return SYSTEMS.map((system) => ({
    os: system.os,
    name: system.name,
    builds: system.builds.map((build) => ({
      label: build.label,
      arch: build.arch,
      url: assetUrl(build.file(version)),
    })),
  }));
}
