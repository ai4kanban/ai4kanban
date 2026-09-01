"use client";

import { useEffect, useState } from "react";
import { FiChevronDown } from "react-icons/fi";
import { Rich } from "@/components/Rich";
import type { DownloadCopy } from "@/i18n/download/types";
import { detectSystem } from "./detect";
import type { OS, ResolvedSystem } from "./builds";
import { SYSTEM_ICON } from "./icons";

type Props = {
  systems: ResolvedSystem[];
  firstOpen: DownloadCopy["firstOpen"];
  command: DownloadCopy["command"];
};

export function PlatformGuide({ systems, firstOpen, command }: Props) {
  const [selected, setSelected] = useState<OS | null>(null);

  useEffect(() => {
    let live = true;
    detectSystem(systems).then((pick) => {
      if (live && pick) setSelected(pick.system.os);
    });
    return () => {
      live = false;
    };
  }, [systems]);

  return (
    <>
      <div
        role="group"
        aria-label={firstOpen.platformLabel}
        className="mt-6 flex flex-wrap gap-3"
      >
        {systems.map((system) => {
          const Icon = SYSTEM_ICON[system.os];
          const active = selected === system.os;

          return (
            <button
              key={system.os}
              type="button"
              aria-pressed={active}
              onClick={() => setSelected(system.os)}
              className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border-2 px-3 py-2 font-semibold transition-all duration-150 ${
                active
                  ? "border-border bg-elev text-ink shadow-[3px_3px_0_0_var(--color-ink)]"
                  : "border-transparent text-muted hover:bg-code hover:text-ink"
              }`}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {system.name}
            </button>
          );
        })}
      </div>

      {selected ? (
        <div className="mt-8 max-w-3xl" aria-live="polite">
          {selected === "mac" ? (
            <ol className="space-y-4 text-[0.95rem] leading-relaxed text-muted">
              {firstOpen.mac.steps.map((step, i) => (
                <li key={step} className="grid grid-cols-[1.75rem_1fr] gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-md bg-ink text-sm font-bold text-elev">
                    {i + 1}
                  </span>
                  <span className="pt-0.5">
                    <Rich code="paper" mono={false}>{step}</Rich>
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-[0.95rem] leading-relaxed text-muted">
              <Rich mono={false}>{firstOpen[selected].body}</Rich>
            </p>
          )}

          <details className="group mt-8">
            <summary className="inline-flex cursor-pointer list-none items-center gap-2 font-semibold text-ink [&::-webkit-details-marker]:hidden">
              <Rich code="paper" mono={false}>{command.title}</Rich>
              <FiChevronDown
                aria-hidden="true"
                className="h-4 w-4 transition-transform duration-150 group-open:rotate-180"
              />
            </summary>
            <p className="mt-3 max-w-2xl text-[0.95rem] leading-relaxed text-muted">
              <Rich code="paper" mono={false}>{command[selected]}</Rich>
            </p>
          </details>
        </div>
      ) : null}
    </>
  );
}
