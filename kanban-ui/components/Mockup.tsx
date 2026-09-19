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
//
// An image (#803) fills the width, never taller than a screen at that width, and links to its
// own page at full size. Video and audio (#872) get the browser's own player.
//
// A card page hands a screen over undrawn (#906): it is loaded once it scrolls near, and its
// code only when the switch asks for it. Until then the frame holds its final size.

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { FiAlertCircle, FiImage, FiMaximize2 } from "react-icons/fi";
import { useCopy } from "@/i18n/use-copy";
import { mockupHref, mockupViewHref, type MockupView } from "@/lib/mockup-tag";
import { MediaPlayer } from "./MediaPlayer";
import { HyperframePlayer } from "./HyperframePlayer";

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

/** An image, as wide as the body and no taller than a screen of that width would be. The
 *  inline styles win over `.nb-md img`, whose border and corners are for prose images. */
function Picture({ image, src, alt }: { image: string; src: string; alt: string }) {
  return (
    <Link href={mockupHref(src)} className="block bg-nb-wash" style={{ containerType: "inline-size" }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- a file on this machine */}
      <img
        src={image}
        alt={alt}
        style={{
          display: "block",
          width: "100%",
          height: "auto",
          maxWidth: "100%",
          maxHeight: `min(${H}px, ${(H / W) * 100}cqw)`,
          objectFit: "contain",
          border: 0,
          borderRadius: 0,
        }}
      />
    </Link>
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

/** How far ahead of the viewport a screen starts loading. */
const NEAR = "800px 0px";

/** A screen or its code on its way: the screen's own size and fill, and a breathing mark. */
function Pending({ hyperframe }: { hyperframe: boolean }) {
  const c = useCopy().card.mockup;
  return (
    <span
      role="status"
      aria-busy="true"
      aria-label={c.loadingPreview}
      className={`flex w-full items-center justify-center ${hyperframe ? "bg-[#f8f5ef]" : "bg-nb-wash"}`}
      style={hyperframe ? { aspectRatio: "16 / 9" } : { aspectRatio: `${W} / ${H}`, maxHeight: H }}
    >
      <FiImage aria-hidden className="a4k-breathe text-nb-ink-soft" style={{ width: 22, height: 22 }} />
    </span>
  );
}

/** Fetch `href` once `box` is near the viewport; `null` until it arrives. A new `href`
 *  keeps the last answer on screen until its own one lands. */
function useNearFetch<T>(box: React.RefObject<HTMLElement | null>, href: string | null, fail: T): T | null {
  const [got, setGot] = useState<{ href: string; value: T } | null>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = box.current;
    if (!href || near || !el) return;
    const io = new IntersectionObserver((seen) => seen.some((e) => e.isIntersecting) && setNear(true), {
      rootMargin: NEAR,
    });
    io.observe(el);
    return () => io.disconnect();
  }, [box, href, near]);
  useEffect(() => {
    if (!href || !near) return;
    const abort = new AbortController();
    fetch(href, { signal: abort.signal })
      .then((r) => (r.ok ? (r.json() as Promise<T>) : fail))
      .catch(() => fail)
      .then((value) => !abort.signal.aborted && setGot({ href, value }));
    return () => abort.abort();
  }, [href, near, fail]);
  return got?.value ?? null;
}

/** One mockup, framed: its label and its file over the screen, and the switch between the
 *  screen and the code the file holds. */
export function Mockup({ view, label }: { view: MockupView; label: string }) {
  const c = useCopy().card.mockup;
  const [showCode, setShowCode] = useState(false);
  const box = useRef<HTMLSpanElement>(null);
  const deferred = view.deferred;
  const failed = useMemo(() => ({ src: view.src, error: c.previewFailed }) as MockupView, [view.src, c]);
  const loaded = useNearFetch(box, deferred ? mockupViewHref(view.src, deferred.version) : null, failed);
  // A view from another `src` is a stale answer for this slot.
  const drawn = deferred ? (loaded?.src === view.src ? loaded : null) : view;
  const needsCode = showCode && drawn?.doc !== undefined && drawn.code === undefined;
  const codeHref = needsCode && deferred ? mockupViewHref(view.src, deferred.version, true) : null;
  const noCode = useMemo(() => ({ error: c.previewFailed }), [c]);
  const fetched = useNearFetch<{ code?: string; error?: string }>(box, codeHref, noCode);
  const code = drawn?.code ?? (codeHref ? (fetched ? (fetched.code ?? fetched.error ?? "") : null) : null);

  if (drawn?.error !== undefined) return <Note text={drawn.error} />;

  return (
    // No frame around it: a mockup is a picture of a screen, and a box drawn round it is
    // one more edge competing with the edges inside it. The caption sits over the screen,
    // and the screen's own fill is what marks where it starts.
    <span ref={box} className="my-4 block bg-nb-paper">
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
          title={c.openFull}
        >
          <span className="truncate">{view.src}</span>
          <FiMaximize2 aria-hidden className="shrink-0" style={{ width: 11, height: 11 }} />
        </Link>
        {/* No switch on a `.txt` mockup, an image or media: there is nothing behind it. */}
        {(deferred || view.doc !== undefined) && (
          <button
            type="button"
            onClick={() => setShowCode((v) => !v)}
            className="ml-auto shrink-0 cursor-pointer text-[11px] font-[800] uppercase tracking-[0.06em] text-nb-ink-soft hover:text-nb-accent-deep"
          >
            {showCode ? c.screen : c.code}
          </button>
        )}
      </span>
      {drawn === null || (showCode && code === null) ? (
        <Pending hyperframe={!showCode && !!deferred?.hyperframe} />
      ) : drawn.doc !== undefined && drawn.hyperframe && !showCode ? (
        <span className={deferred ? "a4k-reveal block" : "block"}>
          <HyperframePlayer key={view.src} doc={drawn.doc} title={label || view.src} />
        </span>
      ) : view.media !== undefined ? (
        <MediaPlayer key={view.media.href} kind={view.media.kind} href={view.media.href} title={label || view.src} fill />
      ) : view.image !== undefined ? (
        <Picture image={view.image} src={view.src} alt={label || view.src} />
      ) : view.text !== undefined ? (
        <Drawing text={view.text} />
      ) : showCode ? (
        <span
          className="block max-h-[520px] overflow-auto whitespace-pre p-3 font-mono text-[11.5px] leading-[17px]"
          style={{ background: "var(--color-nb-wash)" }}
        >
          {code}
        </span>
      ) : (
        drawn.doc !== undefined && (
          <span className={deferred ? "a4k-reveal block" : "block"}>
            <Screen doc={drawn.doc} title={label ? c.frame(label) : view.src} />
          </span>
        )
      )}
    </span>
  );
}
