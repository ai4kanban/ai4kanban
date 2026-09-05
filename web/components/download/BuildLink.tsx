"use client";

import { FiDownload } from "react-icons/fi";
import { countDownloadPress } from "@/lib/usage";
import type { OS, ResolvedSystem } from "./builds";

// One file in the list under the download block. It is a client component only
// so the press can be counted (#297) — the list around it stays on the server.

export function BuildLink({
  build,
  os,
  version,
}: {
  build: ResolvedSystem["builds"][number];
  os: OS;
  version: string;
}) {
  return (
    <a
      href={build.url}
      rel="noopener"
      onClick={() =>
        countDownloadPress({ place: "builds", os, arch: build.arch, version })
      }
      className="group inline-flex items-baseline gap-2.5 font-semibold text-elev/80 no-underline transition-colors hover:text-elev"
    >
      <span className="group-hover:underline">{build.label}</span>
      <FiDownload
        aria-hidden="true"
        className="h-4 w-4 shrink-0 translate-y-0.5 text-accent transition-transform duration-150 group-hover:translate-y-1"
      />
    </a>
  );
}
