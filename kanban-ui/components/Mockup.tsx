"use client";

// A mockup on a card page (#239): the screen a `<Mockup>` tag points at, drawn where the
// tag sits in the body.
//
// The screen itself is an iframe with an empty `sandbox`, which is the whole isolation:
// nothing in it runs, it has no origin to reach the board with, and its styling and the
// board's never meet — the board's fonts, colours and layout rules stop at the frame, and
// a mockup's `<style>` stops there too.
//
// Every mockup is drawn on the same desktop screen and scaled down to whatever width the
// card page gives it, because options only compare when they are the same size on the
// page. Type too small to read is what the two links on the frame are for: the code
// behind it, and the mockup on its own at full size.
//
// A `.txt` mockup is not a screen and gets none of that (#256): it is the file's own
// characters in a monospaced block, at full size, scrolled rather than scaled.

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { FiAlertCircle, FiMaximize2 } from "react-icons/fi";
import { mockupHref, type MockupView } from "@/lib/mockup-tag";

/** The desktop screen every mockup is drawn on, before it is scaled. Every option gets
 *  this same frame — they only compare when they are the same size on the page. */
const W = 1280;
const H = 800;

/** A missing file, a `src` pointing outside the mockups folder, a file in none of the
 *  three formats, or a `.tsx` the board could not draw. One plain note either way, naming
 *  the file, and the rest of the card carries on as usual. */
function Note({ text }: { text: string }) {
  return (
    <span
      className="nb-outline my-3 flex items-start gap-2 px-3 py-2.5 text-[12.5px] leading-[18px] text-nb-ink-soft"
      style={{ background: "var(--color-nb-peach-soft)" }}
    >
      <FiAlertCircle aria-hidden className="relative top-[3px] shrink-0" style={{ width: 13, height: 13 }} />
      <span className="min-w-0 break-words font-mono">{text}</span>
    </span>
  );
}

/** A `.txt` mockup (#256): the drawing as the file holds it. It is never re-wrapped — a
 *  drawing whose columns break is not the drawing any more — so a card page too narrow for
 *  it scrolls sideways instead, and the scroll stops here rather than carrying on into the
 *  page behind it. */
function Drawing({ text }: { text: string }) {
  return (
    <span
      className="block max-h-[560px] overflow-auto whitespace-pre p-3 font-mono text-[11.5px] leading-[17px] text-nb-ink"
      style={{ background: "var(--color-nb-wash)", overscrollBehavior: "contain" }}
    >
      {text}
    </span>
  );
}

/** The picture: one desktop screen, scaled to the width it is given and never past its
 *  true size. The frame is that scaled height, so the card page reflows around it. */
function Screen({ doc, title }: { doc: string; title: string }) {
  const box = useRef<HTMLSpanElement>(null);
  // 0 until the width is measured, so the first paint is never a full-size screen that
  // then jumps to its scaled size.
  const [scale, setScale] = useState(0);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const fit = () => setScale(Math.min(1, el.clientWidth / W));
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <span
      ref={box}
      className="block w-full overflow-hidden bg-nb-wash"
      style={{ height: scale ? H * scale : H }}
    >
      <iframe
        // Empty sandbox: no scripts, no forms, no origin of its own. Everything else the
        // mockup must not do — the network, the fonts — the document's own CSP stops.
        sandbox=""
        srcDoc={doc}
        title={title}
        style={{
          width: W,
          height: H,
          border: 0,
          transform: scale === 1 ? undefined : `scale(${scale})`,
          transformOrigin: "top left",
        }}
      />
    </span>
  );
}

/** One mockup, framed: its label and its file over the screen, and the switch between the
 *  screen and the code the file holds. */
export function Mockup({ view, label }: { view: MockupView; label: string }) {
  const [showCode, setShowCode] = useState(false);

  if (view.error !== undefined) return <Note text={view.error} />;

  return (
    // No frame around it: a mockup is a picture of a screen, and a box drawn round it is
    // one more edge competing with the edges inside it. The caption sits over the screen,
    // and the screen's own fill is what marks where it starts.
    <span className="my-4 block bg-nb-paper">
      <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1 px-0 py-2">
        {label && (
          <span
            className="nb-chip shrink-0"
            style={{ background: "var(--color-nb-accent-soft)", color: "var(--color-nb-accent-deep)" }}
          >
            {label}
          </span>
        )}
        {/* The file name is the way to the mockup on its own, at full size — which is
            where the words in it can be read. It opens in the board, not in a separate
            browser: the desktop app hands any new window to the system browser. */}
        <Link
          href={mockupHref(view.src)}
          className="inline-flex min-w-0 items-center gap-1 font-mono text-[11.5px] text-nb-ink-soft underline decoration-dotted underline-offset-2 hover:text-nb-accent-deep"
          title="Open this mockup on its own, at full size"
        >
          <span className="truncate">{view.src}</span>
          <FiMaximize2 aria-hidden className="shrink-0" style={{ width: 11, height: 11 }} />
        </Link>
        {/* No switch on a `.txt` mockup: the file IS the drawing, so there is nothing
            behind the picture to show. */}
        {view.text === undefined && (
          <button
            type="button"
            onClick={() => setShowCode((v) => !v)}
            className="ml-auto shrink-0 cursor-pointer text-[11px] font-[800] uppercase tracking-[0.06em] text-nb-ink-soft hover:text-nb-accent-deep"
          >
            {showCode ? "Screen" : "Code"}
          </button>
        )}
      </span>
      {view.text !== undefined ? (
        <Drawing text={view.text} />
      ) : showCode ? (
        <span
          className="block max-h-[520px] overflow-auto whitespace-pre p-3 font-mono text-[11.5px] leading-[17px]"
          style={{ background: "var(--color-nb-wash)" }}
        >
          {view.code}
        </span>
      ) : (
        <Screen doc={view.doc} title={label ? `Mockup ${label}` : view.src} />
      )}
    </span>
  );
}
