"use client";

// A guide readable where its link is. "What makes a good goal" used to be a link
// out to GitHub — in the desktop window that is a hand-off to the system browser,
// and when that hand-off fails the click does nothing. A short in-app version
// ships with the UI instead (public/guides/, condensed from web/docs/) and
// opens as a drawer under its own line: the rail's Memory slide, a 0fr → 1fr
// grid row with the content mounted throughout so there is something to slide.

import { useEffect, useId, useState } from "react";
import { FiChevronRight } from "react-icons/fi";
import { useCopy } from "@/i18n/use-copy";
import { Markdown } from "./Markdown";

// One fetch per guide per page, kept across open/close. A failed read is dropped
// so the next open tries again.
const guides = new Map<string, Promise<string>>();
function readGuide(name: string): Promise<string> {
  let read = guides.get(name);
  if (!read) {
    read = fetch(`/guides/${name}.md`).then(async (res) => {
      if (!res.ok) throw new Error(`${res.status}`);
      const text = await res.text();
      // Drop the mirror note and the H1 — the drawer's toggle is the title.
      return text.replace(/^\s*<!--[\s\S]*?-->\s*/, "").replace(/^# [^\n]*\n+/, "");
    });
    read.catch(() => guides.delete(name));
    guides.set(name, read);
  }
  return read;
}

/** A hint line whose last words open the guide they name, in place. `children`
 *  is the sentence before the toggle; `className` is the line's own type — the
 *  drawer inherits it and the markdown inside resets to its own. */
export function GuideDrawer({
  guide,
  title,
  children,
  className,
}: {
  guide: string;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  const c = useCopy().chrome.guide;
  const id = useId();
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  // Read on first open, not on mount: most visits never open it.
  useEffect(() => {
    if (!open || body !== null) return;
    let alive = true;
    setFailed(false);
    readGuide(guide).then(
      (text) => alive && setBody(text),
      () => alive && setFailed(true),
    );
    return () => {
      alive = false;
    };
  }, [open, body, guide]);

  return (
    <div className={className}>
      <p>
        {children}{" "}
        <button
          type="button"
          onClick={() => setOpen((on) => !on)}
          aria-expanded={open}
          aria-controls={id}
          className="cursor-pointer underline underline-offset-2 hover:text-nb-ink"
        >
          {title}
          <FiChevronRight
            size={12}
            aria-hidden
            className={`ml-0.5 inline-block align-[-1px] transition-transform duration-200 ease-out ${
              open ? "rotate-90" : ""
            }`}
          />
        </button>
      </p>
      <div
        className={`grid overflow-hidden transition-[grid-template-rows,opacity] duration-200 ease-out ${
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div id={id} inert={!open} className="min-h-0">
          {/* The margin lives inside the sliding row: padding on the row is
              floor a 0fr track can't shrink past, and closed has to close all
              the way. No frame — it is the hint line saying more, not a second
              panel on the form. */}
          <div className="mt-2 max-h-[45vh] overflow-y-auto">
            {failed ? (
              <p>
                {c.failed}{" "}
                <a
                  href={`https://ai4kanban.dev/docs/${guide}`}
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-2 hover:text-nb-ink"
                >
                  {c.readOnline}
                </a>
                {c.failedEnd}
              </p>
            ) : body === null ? (
              <p className="italic">{c.reading}</p>
            ) : (
              <Markdown body={body} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
