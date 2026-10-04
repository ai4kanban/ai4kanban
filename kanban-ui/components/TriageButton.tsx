"use client";

// The way into Triage (#1510): items there wait for the user's own call, so the button sits
// left of the bell rather than at the rail's foot with the archive. The bell's own shape —
// a ghost block while empty, filled crimson with the count in white while items wait. Crimson
// rather than red, so it never reads as the bell's ember.

import { usePathname, useRouter } from "next/navigation";
import { FiInbox } from "react-icons/fi";
import { useCopy } from "@/i18n/use-copy";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { useSignalsRow } from "./signals-row";

export function TriageButton() {
  const c = useCopy().chrome.header;
  const { show, count } = useSignalsRow();
  const router = useRouter();
  const here = usePathname() === "/inbox";
  if (!show) return null;
  const lit = count > 0;
  const label = lit ? c.triageWaiting(count) : c.triage;
  return (
    <Button
      variant="ghost"
      size="xs"
      className={cn("nb-tip nb-tip-below shrink-0 max-md:h-9", lit ? "gap-1 px-2" : "w-7 px-0 max-md:w-9")}
      aria-label={label}
      data-tip={label}
      aria-pressed={here}
      onClick={() => router.push("/inbox")}
      style={
        lit
          ? {
              background: here ? "color-mix(in srgb, var(--color-nb-crimson) 82%, black)" : "var(--color-nb-crimson)",
              color: "#fff",
            }
          : here
            ? { background: "color-mix(in srgb, var(--color-nb-crimson) 14%, white)" }
            : undefined
      }
    >
      <FiInbox className="text-[14px]" aria-hidden />
      {lit && <span className="text-[11.5px] font-[800] leading-none">{count > 99 ? "99+" : count}</span>}
    </Button>
  );
}
