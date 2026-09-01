import type { Arch, ResolvedSystem } from "./builds";

// Which system the reader is on, and which file under it. Browser-only, and
// shared by the two things that aim a download: the landing page's button
// (`PlatformCta`) and the download page's hero (`DownloadHero`).

export type Pick = { system: ResolvedSystem; build: ResolvedSystem["builds"][number] };

/** `null` on anything that can't run the app — a phone — or that we don't
 *  build for. Callers fall back to the release page. */
export async function detectSystem(systems: ResolvedSystem[]): Promise<Pick | null> {
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
