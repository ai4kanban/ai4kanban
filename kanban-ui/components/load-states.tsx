"use client";

// A read on its way, or failed: skeleton lines once it is slow enough to notice, and a
// retry when it failed.

import { useEffect, useState } from "react";
import { FiRotateCw } from "react-icons/fi";
import { Button } from "./button";

/** How long a read may take before its skeleton shows, so a quick one never flashes it. */
const SKELETON_MS = 300;

export function Skeleton({ label }: { label: string }) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShown(true), SKELETON_MS);
    return () => clearTimeout(t);
  }, []);
  return (
    <div role="status" aria-busy="true" aria-label={label} className="flex flex-col gap-3 pt-1">
      {shown &&
        ["92%", "100%", "64%"].map((w) => (
          <span key={w} aria-hidden className="a4k-skel block h-3 rounded-full" style={{ width: w }} />
        ))}
    </div>
  );
}

export function OpenFailed({ text, retry, onRetry }: { text: string; retry: string; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="nb-section flex items-center gap-3 bg-nb-peach-soft py-2.5 pl-3.5 pr-2.5 text-[13px] text-nb-peach-ink"
    >
      <span className="min-w-0 flex-1">{text}</span>
      <Button variant="ghost" size="sm" onClick={onRetry}>
        <FiRotateCw className="text-[15px]" aria-hidden />
        {retry}
      </Button>
    </div>
  );
}
