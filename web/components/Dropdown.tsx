"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { FiChevronDown } from "react-icons/fi";

// The header's menus: a <details> so it opens, closes, and takes the keyboard
// with no JS in the static export. The one thing <details> won't do on its own
// is close when you click past it, so that part — and Escape — is wired up here.
export function Dropdown({
  label,
  ariaLabel,
  align = "center",
  width,
  children,
}: {
  /** What the closed menu shows, left of the chevron. */
  label: ReactNode;
  /** Only needed when `label` alone doesn't read as a label. */
  ariaLabel?: string;
  /** Which edge the panel hangs from — centred under the label, or flush right. */
  align?: "center" | "right";
  /** The panel's width, as a Tailwind class: menus size to their longest entry. */
  width: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const close = (event: Event) => {
      const el = ref.current;
      if (!el?.open) return;
      if (event.target instanceof Node && el.contains(event.target)) return;
      el.open = false;
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !ref.current?.open) return;
      ref.current.open = false;
    };
    // `pointerdown` rather than `click`: the menu should be gone by the time a
    // press that started outside it finishes.
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return (
    <details ref={ref} className="group relative [&_summary]:list-none">
      <summary
        aria-label={ariaLabel}
        className="flex cursor-pointer items-center gap-1.5 transition-colors hover:text-ink [&::-webkit-details-marker]:hidden"
      >
        {label}
        <FiChevronDown
          className="h-3 w-3 transition-transform duration-150 group-open:rotate-180"
          aria-hidden="true"
        />
      </summary>
      <div
        className={`absolute z-20 mt-2 rounded-lg border-2 border-border bg-elev p-1.5 shadow-[4px_4px_0_0_#010409] ${
          align === "right" ? "right-0" : "left-1/2 -translate-x-1/2"
        } ${width}`}
      >
        {children}
      </div>
    </details>
  );
}
