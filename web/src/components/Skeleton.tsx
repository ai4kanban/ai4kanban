// Copied from legacy kanban-ui/components/load-states.tsx: skeleton lines for a read that is
// slow enough to notice, so a quick one never flashes them.

import { useEffect, useState } from "react";
import { cn } from "@review/lib/utils";
import { T } from "../i18n";

const SKELETON_MS = 300;

export function Skeleton({ className }: { className?: string }) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShown(true), SKELETON_MS);
    return () => clearTimeout(t);
  }, []);
  return (
    <div role="status" aria-busy="true" aria-label={T.loading} className={cn("flex flex-col gap-3 pt-1", className)}>
      {shown &&
        ["92%", "100%", "64%"].map((w) => (
          <span key={w} aria-hidden className="a4k-skel block h-3 rounded-full" style={{ width: w }} />
        ))}
    </div>
  );
}
