"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { cardLinkPath, clearOpening, markOpening } from "@/lib/card-opening";

/** Marks every card link clicked anywhere in the window until its page is drawn. */
export function CardOpening() {
  const pathname = usePathname();
  useEffect(() => clearOpening(), [pathname]);
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const hit = cardLinkPath(e);
      if (hit) markOpening(hit.link, hit.path);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);
  return null;
}
