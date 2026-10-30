// Copied from legacy kanban-ui/components/fold.tsx. Changed: it keeps its own open state.

import { useState, type CSSProperties, type ReactNode } from "react";
import { FiChevronRight } from "react-icons/fi";
import { HAIRLINE } from "./chrome";

/** A section on the card page that opens on its own heading (#262, #276).
 *
 *  A native <details> rather than a div we hide ourselves: the window's own Find reaches
 *  into a closed one and opens it at the word, in the browsers that can do that. */
export function Fold({
  label,
  open: start = false,
  className = "nb-section bg-nb-sheet",
  style,
  children,
}: {
  /** The heading, marks and counts included — worth reading while it is shut. */
  label: ReactNode;
  open?: boolean;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(start);
  return (
    <details className={`nb-fold overflow-hidden ${className}`} style={style} open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      {/* w-full because .nb-tag is inline-flex, which otherwise shrinks the row. */}
      <summary className="nb-tag w-full cursor-pointer list-none items-center gap-2 px-5 py-3.5 max-md:px-4 text-nb-ink-soft transition-colors hover:bg-[color-mix(in_srgb,var(--color-nb-ink)_5%,transparent)] hover:text-nb-ink">
        <FiChevronRight size={13} aria-hidden className={`shrink-0 transition-transform duration-150 ease-out ${open ? "rotate-90" : ""}`} />
        {label}
      </summary>
      <div className="px-5 pb-5 pt-4 max-md:px-4 max-md:pb-4" style={{ borderTop: `1px solid ${HAIRLINE}` }}>
        {children}
      </div>
    </details>
  );
}
