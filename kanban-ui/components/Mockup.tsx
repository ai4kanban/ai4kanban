"use client";

// A mockup on a card page (#239): the screen a `<Mockup>` tag points at, drawn where the
// tag sits in the body.
//
// The screen itself is a sandboxed iframe, which is the whole isolation: it has no origin to
// reach the board with, and its styling and the board's never meet — the board's fonts,
// colours and layout rules stop at the frame, and a mockup's `<style>` stops there too. A
// `.tsx` or `.html` page's inline scripts run (#1626, #1628); its own CSP keeps it off the network.
//
// A screen is drawn on its device's canvas — desktop unless the tag says `device="mobile"`
// (#1097) — and scaled down to whatever width the card page gives it. A phone screen fills
// a phone frame at 3/4 size, centered. Zooming (#1637) keeps the frame at that height and
// scrolls inside it.
//
// A `.txt` mockup is not a screen and gets none of that (#256): it is the file's own
// characters in a monospaced block, at full size, scrolled rather than scaled.
//
// An image (#803) fits the width, never taller than a screen at that width, and links to its
// own page at full size. Video and audio (#872) get the browser's own player. A delivered
// file (#969) is a download, and a Markdown file (#1651) an article.
//
// A tag with `variants` (#1663) shows one version at a time, switched from its caption. A
// `<Compare>` (#1740) is drawn by Compare.tsx in the same frame.
//
// A card page hands a screen over undrawn (#906): it is loaded once it scrolls near, and its
// code only when the switch asks for it. Until then the frame holds its final size.

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FiAlertCircle, FiCheck, FiChevronDown, FiChevronRight, FiCode, FiCopy, FiDownload, FiImage, FiLoader, FiMaximize2, FiMoreHorizontal } from "react-icons/fi";
import { useCopy } from "@/i18n/use-copy";
import { mockupHref, mockupViewHref, SCREENS, type ArticleFile, type Device, type MockupView } from "@/lib/mockup-tag";
import { phoneScreen, SAFE_AREA } from "@/lib/phone-screen";
import { useMachine } from "@/lib/screen";
import { ArticleFolded, useArticle } from "./Article";
import { useCopyText } from "./copy";
import { MediaPlayer } from "./MediaPlayer";
import { HyperframePlayer } from "./HyperframePlayer";
import { ImageMenu } from "./image-preview";
import { useFitWidth, useZoom, ZoomControls, type Zoom } from "./zoom";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./ui/dropdown-menu";

const { w: W, h: H } = SCREENS.desktop;
const PHONE = SCREENS.mobile;

/** The phone frame's bezel and the status bar and home indicator it overlays, at 1:1. */
const BEZEL = 12;
const STATUS_H = 54;
export const PHONE_W = PHONE.w + 2 * BEZEL;
const PHONE_H = PHONE.h + 2 * BEZEL;
/** A phone screen on a card page is never drawn larger than this. */
const PHONE_SCALE = 0.75;
/** The band a phone stands in: its vertical padding. */
const BAND_PAD = 24;

function StatusBar({ ink }: { ink: string }) {
  return (
    <span
      className="absolute inset-x-0 top-0 flex items-center justify-between"
      style={{ height: STATUS_H, padding: "0 30px 0 44px", color: ink }}
    >
      <span
        style={{
          fontSize: 17,
          fontWeight: 600,
          letterSpacing: -0.4,
          fontFamily: "-apple-system, 'SF Pro Text', system-ui, sans-serif",
        }}
      >
        9:41
      </span>
      <span
        className="absolute left-1/2 -translate-x-1/2 rounded-full bg-black"
        style={{ top: 11, width: 126, height: 37 }}
      />
      <span className="flex items-center" style={{ gap: 6 }}>
        <svg width="18" height="12" viewBox="0 0 18 12" fill={ink} aria-hidden>
          <rect x="0" y="8" width="3" height="4" rx="1" />
          <rect x="5" y="5.5" width="3" height="6.5" rx="1" />
          <rect x="10" y="3" width="3" height="9" rx="1" />
          <rect x="15" y="0" width="3" height="12" rx="1" />
        </svg>
        <svg width="16" height="12" viewBox="0 0 16 12" fill={ink} aria-hidden>
          <path d="M8 2.2c2.4 0 4.6.9 6.3 2.5l1.2-1.3C13.5 1.5 10.9.4 8 .4S2.5 1.5.5 3.4l1.2 1.3C3.4 3.1 5.6 2.2 8 2.2Z" />
          <path d="M8 5.6c1.5 0 2.8.6 3.8 1.5l1.2-1.3C11.7 4.6 9.9 3.8 8 3.8s-3.7.8-5 2l1.2 1.3c1-.9 2.3-1.5 3.8-1.5Z" />
          <path d="M8 9c.6 0 1.1.2 1.5.6L8 11.2 6.5 9.6c.4-.4.9-.6 1.5-.6Z" />
        </svg>
        <svg width="27" height="13" viewBox="0 0 27 13" fill={ink} aria-hidden>
          <rect x="0.5" y="0.5" width="23" height="12" rx="3.8" fill="none" stroke={ink} strokeOpacity="0.35" />
          <rect x="2" y="2" width="20" height="9" rx="2.5" />
          <path d="M25 4.5v4c.8-.3 1.3-1.1 1.3-2s-.5-1.7-1.3-2Z" fillOpacity="0.4" />
        </svg>
      </span>
    </span>
  );
}

function HomeIndicator({ ink }: { ink: string }) {
  return (
    <span
      className="absolute inset-x-0 bottom-0 flex items-end justify-center"
      style={{ height: SAFE_AREA.bottom, paddingBottom: 8 }}
    >
      <span className="block rounded-full" style={{ width: 134, height: 5, background: ink }} />
    </span>
  );
}

/** Scripts only, never `allow-same-origin`: the page stays an opaque origin. */
export const sandboxOf = (scripts?: boolean) => (scripts ? "allow-scripts" : "");

const frameStyle = { border: 0, display: "block", position: "absolute", left: 0 } as const;

/** A phone at `scale` showing `doc` as an iPhone 16 would (#1215): the page fills the
 *  393×852 screen, or sits inside its safe areas over its own background, and the status bar
 *  and home indicator are drawn over it. */
export function Phone({ scale, doc, title, scripts }: { scale: number; doc: string; title: string; scripts?: boolean }) {
  const screen = useMemo(() => phoneScreen(doc), [doc]);
  const ink = screen.light ? "#fff" : "#000";
  const inner = screen.cover ? PHONE.h : PHONE.h - SAFE_AREA.top - SAFE_AREA.bottom;
  return (
    <span
      className="block shrink-0"
      style={{
        width: PHONE_W * scale,
        height: PHONE_H * scale,
        padding: BEZEL * scale,
        borderRadius: 58 * scale,
        background: "var(--color-nb-ink)",
      }}
    >
      <span
        className="block overflow-hidden bg-white"
        style={{ width: PHONE.w * scale, height: PHONE.h * scale, borderRadius: 47 * scale }}
      >
        <span
          className="relative block"
          style={{ width: PHONE.w, height: PHONE.h, transform: `scale(${scale})`, transformOrigin: "top left" }}
        >
          {screen.backdrop !== null && (
            <iframe
              sandbox=""
              srcDoc={screen.backdrop}
              aria-hidden
              tabIndex={-1}
              style={{ ...frameStyle, top: 0, width: PHONE.w, height: PHONE.h }}
            />
          )}
          <iframe
            sandbox={sandboxOf(scripts)}
            srcDoc={screen.doc}
            title={title}
            style={{ ...frameStyle, top: screen.cover ? 0 : SAFE_AREA.top, width: PHONE.w, height: inner }}
          />
          <StatusBar ink={ink} />
          <HomeIndicator ink={ink} />
        </span>
      </span>
    </span>
  );
}

/** A missing file, a `src` pointing outside the mockups folder, a file in none of the
 *  three formats, or a `.tsx` the board could not draw. One plain note either way, naming
 *  the file, and the rest of the card carries on as usual. */
export function Note({ text }: { text: string }) {
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

/** The box a zoomed view scrolls in: as high as the view at fit, centering anything smaller. */
function ZoomArea({ height, zoomed, children }: { height?: number; zoomed: boolean; children: React.ReactNode }) {
  return (
    <span
      className="flex w-full overflow-auto bg-nb-wash"
      style={{ height, overscrollBehavior: zoomed ? "contain" : undefined }}
    >
      {children}
    </span>
  );
}

/** An image at fit: as wide as the body and no taller than a screen of that width would be.
 *  The inline styles win over `.nb-md img`, whose border and corners are for prose images. */
function Picture({ image, src, alt, zoom }: { image: string; src: string; alt: string; zoom: Zoom }) {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const measure = useCallback((img: HTMLImageElement | null) => {
    if (!img?.complete || !img.naturalWidth) return;
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    setSize((prev) => (prev?.w === w && prev.h === h ? prev : { w, h }));
  }, []);
  const fitOf = useMemo(
    () => (size ? (width: number) => Math.min(width / size.w, Math.min(H, (width * H) / W) / size.h) : null),
    [size],
  );
  const box = useFitWidth<HTMLSpanElement>(zoom.setFit, fitOf);
  const { scale, fit } = zoom;
  const img = (
    // eslint-disable-next-line @next/next/no-img-element -- a file on this machine
    <img
      src={image}
      alt={alt}
      // An image already loaded before hydration fires no load event.
      ref={measure}
      onLoad={(e) => measure(e.currentTarget)}
      style={
        size && scale
          ? { display: "block", width: size.w * scale, height: size.h * scale, maxWidth: "none", margin: "auto", flexShrink: 0, border: 0, borderRadius: 0 }
          : { display: "block", width: "100%", height: "auto", maxWidth: "100%", maxHeight: H, objectFit: "contain", border: 0, borderRadius: 0 }
      }
    />
  );
  const machine = useMachine();
  const inner = (badge: React.ReactNode) => (
    <>
      <span ref={box} className="block w-full">
        <ZoomArea height={size && fit ? size.h * fit : undefined} zoomed={scale > fit}>
          {img}
        </ZoomArea>
      </span>
      {badge}
    </>
  );
  return (
    <ImageMenu src={image}>
      {(badge) =>
        // Its own page is the board's: anywhere else the picture is just the picture.
        machine ? (
          <Link href={mockupHref(src)} className="relative block bg-nb-wash">
            {inner(badge)}
          </Link>
        ) : (
          <span className="relative block bg-nb-wash">{inner(badge)}</span>
        )
      }
    </ImageMenu>
  );
}

/** The band a phone screen stands in, centered, so a phone never stretches to the body. */
function PhoneBand({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex w-full justify-center bg-nb-wash" style={{ padding: `${BAND_PAD}px 12px` }}>
      {children}
    </span>
  );
}

const phoneFit = (width: number) => Math.min(PHONE_SCALE, (width - 24) / PHONE_W);

/** A phone screen at 3/4 size, shrunk further when the body is narrower than that. */
function PhoneScreen({ doc, title, scripts, zoom }: { doc: string; title: string; scripts?: boolean; zoom: Zoom }) {
  const box = useFitWidth<HTMLSpanElement>(zoom.setFit, phoneFit);
  const { scale, fit } = zoom;
  return (
    <span ref={box} className="block w-full">
      <ZoomArea height={(fit ? PHONE_H * fit : PHONE_H * PHONE_SCALE) + 2 * BAND_PAD} zoomed={scale > fit}>
        <span className="m-auto block shrink-0" style={{ padding: `${BAND_PAD}px 12px` }}>
          {scale > 0 && <Phone scale={scale} doc={doc} title={title} scripts={scripts} />}
        </span>
      </ZoomArea>
    </span>
  );
}

const screenFit = (width: number) => Math.min(1, width / W);

/** The picture: one desktop screen, at fit scaled to the width it is given and never past its
 *  true size. The frame is that scaled height, so the card page reflows around it. */
function Screen({ doc, title, scripts, zoom }: { doc: string; title: string; scripts?: boolean; zoom: Zoom }) {
  const box = useFitWidth<HTMLSpanElement>(zoom.setFit, screenFit);
  // 0 until the width is measured, so the first paint is never a full-size screen that
  // then jumps to its scaled size.
  const { scale, fit } = zoom;
  return (
    <span ref={box} className="block w-full">
      <ZoomArea height={fit ? H * fit : H} zoomed={scale > fit}>
        <span className="m-auto block shrink-0 overflow-hidden" style={{ width: W * scale, height: H * scale }}>
          <iframe
            // No forms, no origin of its own. Everything else the mockup must not do — the
            // network, the fonts — the document's own CSP stops.
            sandbox={sandboxOf(scripts)}
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
      </ZoomArea>
    </span>
  );
}

/** How far ahead of the viewport a screen starts loading. */
const NEAR = "800px 0px";

/** A screen or its code on its way: the screen's own size and fill, and a breathing mark. */
function Pending({ hyperframe, device }: { hyperframe: boolean; device: Device }) {
  const c = useCopy().card.mockup;
  if (device === "mobile" && !hyperframe)
    return (
      <PhoneBand>
        <span
          role="status"
          aria-busy="true"
          aria-label={c.loadingPreview}
          className="flex items-center justify-center"
          style={{
            width: `min(${PHONE_W * PHONE_SCALE}px, 100%)`,
            aspectRatio: `${PHONE_W} / ${PHONE_H}`,
            borderRadius: 58 * PHONE_SCALE,
            border: `${BEZEL * PHONE_SCALE}px solid var(--color-nb-ink)`,
          }}
        >
          <FiImage aria-hidden className="a4k-breathe text-nb-ink-soft" style={{ width: 22, height: 22 }} />
        </span>
      </PhoneBand>
    );
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

export const ICON_BTN =
  "nb-tip nb-tip-below relative inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-[6px] text-nb-ink-soft hover:bg-[color-mix(in_srgb,var(--color-nb-ink)_6%,transparent)] hover:text-nb-ink aria-disabled:cursor-default aria-disabled:opacity-40 aria-disabled:hover:bg-transparent";
const PRESSED = "bg-[color-mix(in_srgb,var(--color-nb-ink)_6%,transparent)] text-nb-ink";

/** Puts the file's absolute path on the clipboard. */
export function CopyPath({ path }: { path: string }) {
  const c = useCopy().card.mockup;
  const { copied, copy } = useCopyText();
  const tip = copied ? c.copied : c.copyPath;
  return (
    <button type="button" onClick={() => copy(path)} className={ICON_BTN} data-tip={tip} aria-label={tip}>
      {copied ? <FiCheck aria-hidden size={12} /> : <FiCopy aria-hidden size={12} />}
    </button>
  );
}

export function DownloadIcon({ href, name }: { href: string; name: string }) {
  const c = useCopy().card.mockup;
  return (
    <a href={href} download={name} className={ICON_BTN} data-tip={c.download} aria-label={c.download}>
      <FiDownload aria-hidden size={13} />
    </a>
  );
}

/** A head control: an icon with its tip, pressed while its view is on. */
export function HeadButton({ tip, on, onClick, children }: { tip: string; on?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on} className={`${ICON_BTN} ${on ? PRESSED : ""}`} data-tip={tip} aria-label={tip}>
      {children}
    </button>
  );
}

export type Variants = { labels: string[]; at: number; pick: (i: number) => void };

/** The version switch: the version shown, and the menu. */
function VariantSwitch({ variants }: { variants: Variants }) {
  const c = useCopy().card.mockup;
  const { labels, at, pick } = variants;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`${c.version}: ${labels[at]}`}
          className="inline-flex min-w-0 shrink cursor-pointer items-center gap-0.5 rounded-[6px] bg-nb-wash py-[2px] pl-2 pr-1 text-[12px] font-[600] text-nb-ink hover:bg-[color-mix(in_srgb,var(--color-nb-ink)_10%,transparent)] data-[state=open]:bg-[color-mix(in_srgb,var(--color-nb-ink)_10%,transparent)]"
        >
          <span className="truncate">{labels[at]}</span>
          <FiChevronDown aria-hidden size={12} className="shrink-0 text-nb-ink-soft" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {labels.map((label, i) => (
          <DropdownMenuItem key={i} className="justify-between gap-3" onSelect={() => pick(i)}>
            {label}
            {i === at && <FiCheck aria-hidden size={12} />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** A row of the ⋯ menu: a link to a file, or an action. */
export type MenuItem = { icon: React.ReactNode; text: string; href?: string; download?: string; onSelect?: () => void; keepOpen?: boolean };

/** The menu's copy-path row, which stays open to say it worked. Only where the board's own
 *  machine is: anywhere else the path means nothing. */
export function useCopyPathItem(path: string | undefined): MenuItem | null {
  const c = useCopy().card.mockup;
  const machine = useMachine();
  const { copied, copy } = useCopyText();
  if (!machine || !path) return null;
  return {
    icon: copied ? <FiCheck size={13} /> : <FiCopy size={13} />,
    text: copied ? c.copied : c.copyPath,
    onSelect: () => copy(path),
    keepOpen: true,
  };
}

function More({ items, busy }: { items: MenuItem[]; busy?: boolean }) {
  const c = useCopy().card.mockup;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={`${ICON_BTN} data-[state=open]:bg-[color-mix(in_srgb,var(--color-nb-ink)_6%,transparent)] data-[state=open]:text-nb-ink`}
          data-tip={c.more}
          aria-label={c.more}
        >
          {busy ? <FiLoader aria-hidden size={14} className="animate-spin" /> : <FiMoreHorizontal aria-hidden size={15} />}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {items.map((it, k) => {
          const body = (
            <>
              <span aria-hidden className="text-nb-ink-soft">
                {it.icon}
              </span>
              {it.text}
            </>
          );
          return it.href ? (
            <DropdownMenuItem key={k} asChild>
              <a href={it.href} download={it.download}>
                {body}
              </a>
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              key={k}
              onSelect={(e) => {
                if (it.keepOpen) e.preventDefault();
                it.onSelect?.();
              }}
            >
              {body}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** The frame every draft sits in — an asset, a storyboard, a compare (#1793). Edge to edge on a
 *  phone (app/markdown.css). */
export function DraftFrame({ className = "", children, ...rest }: React.ComponentProps<"span">) {
  return (
    <span className={`nb-draft @container/draft my-4 block min-w-0 bg-nb-paper ${className}`} {...rest}>
      {children}
    </span>
  );
}

/** The row over every draft: fold arrow and name, one muted fact, versions; on the right the
 *  kind's own controls (`children`, drawn only while open) and a ⋯ menu for the rest. */
export function Caption({
  label,
  meta,
  variants,
  open = true,
  onToggle,
  menu = [],
  busy,
  children,
}: {
  label: string;
  meta?: string;
  variants: Variants | null;
  open?: boolean;
  onToggle?: () => void;
  menu?: (MenuItem | null | false | undefined)[];
  busy?: boolean;
  children?: React.ReactNode;
}) {
  const c = useCopy().card.mockup;
  const items = menu.filter((m): m is MenuItem => !!m);
  const Arrow = open ? FiChevronDown : FiChevronRight;
  const name = <span className="min-w-0 truncate text-[13.5px] font-[700] leading-5 text-nb-ink">{label}</span>;
  const fact = meta && <span className="shrink-0 text-[12px] tabular-nums text-nb-ink-soft">{meta}</span>;
  return (
    <span className="block">
      <span className="flex h-11 items-center gap-2 px-2.5">
        {onToggle ? (
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={open}
            aria-label={`${open ? c.collapseAsset : c.expandAsset} ${label}`}
            className="group/fold inline-flex min-w-0 cursor-pointer items-center gap-2 rounded-[6px] text-left nb-focus"
          >
            <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-[6px] text-nb-ink-soft group-hover/fold:bg-[color-mix(in_srgb,var(--color-nb-ink)_6%,transparent)] group-hover/fold:text-nb-ink">
              <Arrow aria-hidden size={14} />
            </span>
            {name}
          </button>
        ) : (
          <span className="inline-flex min-w-0 pl-1.5">{name}</span>
        )}
        {fact && <span className="contents @max-[480px]/draft:hidden">{fact}</span>}
        {variants && <VariantSwitch variants={variants} />}
        <span className="ml-auto flex min-w-0 items-center gap-0.5">
          {open && children}
          {items.length > 0 && <More items={items} busy={busy} />}
        </span>
      </span>
      {/* A phone has no room for the fact beside the name. */}
      {fact && <span className="-mt-2 hidden pb-2 pl-[42px] @max-[480px]/draft:block">{fact}</span>}
    </span>
  );
}

const nameOf = (src: string) => src.split("/").pop()!;

/** Whether an asset is unfolded, and the label's switch for it. */
export function useFold() {
  const [open, setOpen] = useState(true);
  return { open, onToggle: useCallback(() => setOpen((v) => !v), []) };
}

type Fold = ReturnType<typeof useFold>;

/** Opens the draft on its own page in the board, not a separate browser: the desktop app
 *  hands any new window to the system browser. Only where the board is. */
function FullSize({ href }: { href: string }) {
  const c = useCopy().card.mockup;
  if (!useMachine()) return null;
  return (
    <Link href={href} className={ICON_BTN} data-tip={c.openFull} aria-label={c.openFull}>
      <FiMaximize2 aria-hidden size={13} />
    </Link>
  );
}

const downloadItem = (text: string, href: string, name: string): MenuItem => ({ icon: <FiDownload size={13} />, text, href, download: name });

/** A `.md`/`.mdx` asset (#1651): the article, folded, under the same caption a screen has. */
function ArticleAsset({ file, view, label, variants, fold }: { file: ArticleFile; view: MockupView; label: string; variants: Variants | null; fold: Fold }) {
  const c = useCopy().card.mockup;
  const state = useArticle(file, view.src);
  const copyPath = useCopyPathItem(view.path);
  return (
    <DraftFrame>
      <Caption label={label} variants={variants} menu={[downloadItem(c.download, file.href, nameOf(view.src)), copyPath]} {...fold}>
        <HeadButton tip={state.source ? c.viewArticle : c.viewSource} on={state.source} onClick={() => state.setSource((v) => !v)}>
          <FiCode aria-hidden size={14} />
        </HeadButton>
        <FullSize href={mockupHref(view.src)} />
      </Caption>
      {fold.open && <ArticleFolded state={state} />}
    </DraftFrame>
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

/** One tag, framed: one version at a time when it declares `variants` (#1663). Each version
 *  keeps its own view state, reset as the switch moves. */
export function Mockup({
  views,
  first = 0,
  label,
  alt = "",
  device,
  loop = false,
}: {
  /** The versions in written order; one, with an empty label, for a tag with no variants. */
  views: { label: string; view: MockupView }[];
  /** The version `src` names, shown first. */
  first?: number;
  label: string;
  alt?: string;
  device: Device;
  loop?: boolean;
}) {
  const [at, setAt] = useState(first);
  const labels = useMemo(() => views.map((v) => v.label), [views]);
  const variants = views.length > 1 ? { labels, at, pick: setAt } : null;
  const view = (views[at] ?? views[0]!).view;
  const fold = useFold();
  return <One key={view.src} view={view} label={label} alt={alt} device={device} loop={loop} variants={variants} fold={fold} />;
}

/** One file, framed: its caption over the screen, and the switch between the screen and the
 *  code the file holds. */
function One({
  view,
  label,
  alt,
  device,
  loop,
  variants,
  fold,
}: {
  view: MockupView;
  label: string;
  alt: string;
  device: Device;
  loop: boolean;
  variants: Variants | null;
  fold: Fold;
}) {
  const c = useCopy().card.mockup;
  const [showCode, setShowCode] = useState(false);
  const zoom = useZoom();
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
  // Only a `.tsx`/`.html` screen is laid out on a device.
  const screen = deferred ? !deferred.hyperframe : view.doc !== undefined && !view.hyperframe;
  const shown: Device = screen ? device : "desktop";


  const copyPath = useCopyPathItem(view.path);

  if (drawn?.error !== undefined)
    return variants ? (
      <DraftFrame>
        <Caption label={label} variants={variants} {...fold} />
        {fold.open && <Note text={drawn.error} />}
      </DraftFrame>
    ) : (
      <Note text={drawn.error} />
    );
  // A delivered file: its name is the download.
  if (view.file)
    return (
      <DraftFrame>
        <Caption label={label} variants={variants} menu={[copyPath]}>
          <a
            href={view.file.href}
            download={view.file.name}
            className="mr-1 inline-flex min-w-0 max-w-[260px] items-center gap-1.5 rounded-[7px] bg-nb-wash px-3 py-1.5 text-[12.5px] font-[700] text-nb-ink no-underline hover:bg-[color-mix(in_srgb,var(--color-nb-ink)_10%,transparent)]"
            title={c.download}
          >
            <FiDownload aria-hidden className="shrink-0" style={{ width: 12, height: 12 }} />
            <span className="truncate">{view.file.name}</span>
          </a>
        </Caption>
      </DraftFrame>
    );
  if (view.article) return <ArticleAsset file={view.article} view={view} label={label} variants={variants} fold={fold} />;

  const bytes = view.image ?? view.media?.href;
  return (
    // No frame around it: a mockup is a picture of a screen, and a box drawn round it is
    // one more edge competing with the edges inside it.
    <DraftFrame ref={box}>
      <Caption
        label={label}
        variants={variants}
        menu={[bytes !== undefined && downloadItem(c.download, bytes, nameOf(view.src)), copyPath]}
        {...fold}
      >
        {/* No switch on a `.txt` mockup, an image or media: there is nothing behind it. */}
        {(deferred || view.doc !== undefined) && (
          <HeadButton tip={showCode ? c.viewScreen : c.viewCode} on={showCode} onClick={() => setShowCode((v) => !v)}>
            <FiCode aria-hidden size={14} />
          </HeadButton>
        )}
        <FullSize href={mockupHref(view.src, shown)} />
      </Caption>
      {!fold.open ? null : drawn === null || (showCode && code === null) ? (
        <Pending hyperframe={!showCode && !!deferred?.hyperframe} device={showCode ? "desktop" : shown} />
      ) : drawn.doc !== undefined && drawn.hyperframe && !showCode ? (
        <span className={deferred ? "a4k-reveal block" : "block"}>
          <HyperframePlayer key={view.src} doc={drawn.doc} title={label || view.src} />
        </span>
      ) : view.media !== undefined ? (
        <MediaPlayer
          key={view.media.href}
          kind={view.media.kind}
          href={view.media.href}
          title={label || view.src}
          fill
          loop={loop}
        />
      ) : view.image !== undefined ? (
        <Zoomable zoom={zoom}>
          <Picture image={view.image} src={view.src} alt={alt || label || view.src} zoom={zoom} />
        </Zoomable>
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
            <Zoomable zoom={zoom}>
              {shown === "mobile" ? (
                <PhoneScreen doc={drawn.doc} title={label ? c.frame(label) : view.src} scripts={drawn.scripts} zoom={zoom} />
              ) : (
                <Screen doc={drawn.doc} title={label ? c.frame(label) : view.src} scripts={drawn.scripts} zoom={zoom} />
              )}
            </Zoomable>
          </span>
        )
      )}
    </DraftFrame>
  );
}

/** A picture with its zoom floating in the corner, shown while the pointer is over it. */
function Zoomable({ zoom, children }: { zoom: Zoom; children: React.ReactNode }) {
  return (
    <span className="group/zoom relative block">
      {children}
      {zoom.fit > 0 && (
        <span
          className={`absolute bottom-3 right-3 z-10 inline-flex rounded-[8px] bg-nb-paper p-0.5 shadow-[0_1px_6px_rgba(36,35,31,.18)] transition-opacity focus-within:opacity-100 group-hover/zoom:opacity-100 [@media(hover:none)]:opacity-100 ${zoom.fitted ? "opacity-0" : ""}`}
        >
          <ZoomControls zoom={zoom} />
        </span>
      )}
    </span>
  );
}
