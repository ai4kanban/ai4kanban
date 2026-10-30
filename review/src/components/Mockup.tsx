// Copied from legacy kanban-ui/components/Mockup.tsx: a preview on a card page (#239), drawn
// where its tag sits in the body.
//
// The screen itself is a sandboxed iframe with scripts and never `allow-same-origin`: it has no
// origin to reach the page with, and its styling and the page's never meet.
//
// A screen is drawn on its device's canvas and scaled down to whatever width the page gives
// it; the caption switches between desktop and phone. A phone screen fills a phone frame at 3/4
// size, centered. Zooming (#1637) keeps the frame at that height and scrolls inside it. An
// image fits the width, never taller than a screen at that width. Video and audio get the
// browser's own player, a Markdown file is an article, anything else a download.
//
// Changed: a preview loads its artifact once it scrolls near (lib/artifacts.ts) instead of a
// `/asset-view` address; full size opens over the page instead of on its own route. Trimmed:
// the code view of a screen and copy path.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FiAlertCircle, FiCheck, FiChevronDown, FiChevronRight, FiCode, FiDownload, FiImage, FiMaximize2, FiMonitor, FiMoreHorizontal, FiSmartphone } from "react-icons/fi";
import { useCopy } from "../i18n";
import { SCREENS, type ComponentSpec, type Device, type Drawn, type MockupView } from "../lib/mockup-tag";
import { hostBridge, type BridgeContext } from "../lib/bridge";
import { phoneScreen, SAFE_AREA } from "../lib/phone-screen";
import { ArticleFolded, ArticleFull, useArticle } from "./Article";
import { HyperframePlayer } from "./HyperframePlayer";
import { ImagePreview, PreviewDialog } from "./image-preview";
import { MediaPlayer } from "./MediaPlayer";
import { Menu } from "./menu";
import { Shield, useFitWidth, usePinch, useZoom, ZoomControls, type Zoom } from "./zoom";

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
    <span className="absolute inset-x-0 top-0 flex items-center justify-between" style={{ height: STATUS_H, padding: "0 30px 0 44px", color: ink }}>
      <span style={{ fontSize: 17, fontWeight: 600, letterSpacing: -0.4, fontFamily: "-apple-system, 'SF Pro Text', system-ui, sans-serif" }}>9:41</span>
      <span className="absolute left-1/2 -translate-x-1/2 rounded-full bg-black" style={{ top: 11, width: 126, height: 37 }} />
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
    <span className="absolute inset-x-0 bottom-0 flex items-end justify-center" style={{ height: SAFE_AREA.bottom, paddingBottom: 8 }}>
      <span className="block rounded-full" style={{ width: 134, height: 5, background: ink }} />
    </span>
  );
}

/** Scripts only, never `allow-same-origin`: the page stays an opaque origin. */
export const sandboxOf = (scripts?: boolean) => (scripts ? "allow-scripts" : "");

const frameStyle = { border: 0, display: "block", position: "absolute", left: 0 } as const;

/** A phone at `scale` showing `doc` as an iPhone 16 would (#1215). */
export function Phone({ scale, doc, title, scripts }: { scale: number; doc: string; title: string; scripts?: boolean }) {
  const screen = useMemo(() => phoneScreen(doc), [doc]);
  const ink = screen.light ? "#fff" : "#000";
  const inner = screen.cover ? PHONE.h : PHONE.h - SAFE_AREA.top - SAFE_AREA.bottom;
  return (
    <span className="block shrink-0" style={{ width: PHONE_W * scale, height: PHONE_H * scale, padding: BEZEL * scale, borderRadius: 58 * scale, background: "var(--color-nb-ink)" }}>
      <span className="block overflow-hidden bg-white" style={{ width: PHONE.w * scale, height: PHONE.h * scale, borderRadius: 47 * scale }}>
        <span className="relative block" style={{ width: PHONE.w, height: PHONE.h, transform: `scale(${scale})`, transformOrigin: "top left" }}>
          {screen.backdrop !== null && <iframe sandbox="" srcDoc={screen.backdrop} aria-hidden tabIndex={-1} style={{ ...frameStyle, top: 0, width: PHONE.w, height: PHONE.h }} />}
          <iframe sandbox={sandboxOf(scripts)} srcDoc={screen.doc} title={title} style={{ ...frameStyle, top: screen.cover ? 0 : SAFE_AREA.top, width: PHONE.w, height: inner }} />
          <StatusBar ink={ink} />
          <HomeIndicator ink={ink} />
        </span>
      </span>
    </span>
  );
}

/** A missing preview, or one that could not be drawn. One plain note, and the rest of the
 *  card carries on as usual. */
export function Note({ text }: { text: string }) {
  return (
    <span className="nb-outline my-3 flex items-start gap-2 px-3 py-2.5 text-[12.5px] leading-[18px] text-nb-ink-soft" style={{ background: "var(--color-nb-peach-soft)" }}>
      <FiAlertCircle aria-hidden className="relative top-[3px] shrink-0" style={{ width: 13, height: 13 }} />
      <span className="min-w-0 break-words">{text}</span>
    </span>
  );
}

/** The box a zoomed view scrolls in: as high as the view at fit, centering anything smaller. */
function ZoomArea({ height, zoom, children }: { height?: number; zoom: Zoom; children: React.ReactNode }) {
  const area = useRef<HTMLSpanElement>(null);
  usePinch(zoom, area);
  const zoomed = zoom.scale > zoom.fit;
  return (
    <span ref={area} className="flex w-full overflow-auto bg-nb-wash" style={{ height, overscrollBehavior: zoomed ? "contain" : undefined }}>
      {children}
    </span>
  );
}

/** An image at fit: as wide as the body and no taller than a screen of that width would be. */
function Picture({ image, alt, zoom }: { image: string; alt: string; zoom: Zoom }) {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const measure = useCallback((img: HTMLImageElement | null) => {
    if (!img?.complete || !img.naturalWidth) return;
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    setSize((prev) => (prev?.w === w && prev.h === h ? prev : { w, h }));
  }, []);
  const fitOf = useMemo(() => (size ? (width: number) => Math.min(width / size.w, Math.min(H, (width * H) / W) / size.h) : null), [size]);
  const box = useFitWidth<HTMLSpanElement>(zoom.setFit, fitOf);
  const { scale, fit } = zoom;
  return (
    <span className="relative block bg-nb-wash">
      <span ref={box} className="block w-full">
        <ZoomArea height={size && fit ? size.h * fit : undefined} zoom={zoom}>
          <img
            src={image}
            alt={alt}
            ref={measure}
            onLoad={(e) => measure(e.currentTarget)}
            style={
              size && scale
                ? { display: "block", width: size.w * scale, height: size.h * scale, maxWidth: "none", margin: "auto", flexShrink: 0, border: 0, borderRadius: 0 }
                : { display: "block", width: "100%", height: "auto", maxWidth: "100%", maxHeight: H, objectFit: "contain", border: 0, borderRadius: 0 }
            }
          />
        </ZoomArea>
      </span>
    </span>
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
const phoneFull = (width: number) => Math.min(1, (width - 24) / PHONE_W, (window.innerHeight - 160) / PHONE_H);

/** A phone screen at 3/4 size, shrunk further when the body is narrower than that. */
function PhoneScreen({ doc, title, scripts, zoom, full }: { doc: string; title: string; scripts?: boolean; zoom: Zoom; full?: boolean }) {
  const box = useFitWidth<HTMLSpanElement>(zoom.setFit, full ? phoneFull : phoneFit);
  const { scale, fit } = zoom;
  return (
    <span ref={box} className="block w-full">
      <ZoomArea height={(fit ? PHONE_H * fit : PHONE_H * PHONE_SCALE) + 2 * BAND_PAD} zoom={zoom}>
        <span className="relative m-auto block shrink-0" style={{ padding: `${BAND_PAD}px 12px` }}>
          {scale > 0 && <Phone scale={scale} doc={doc} title={title} scripts={scripts} />}
          <Shield />
        </span>
      </ZoomArea>
    </span>
  );
}

const screenFit = (width: number) => Math.min(1, width / W);
const screenFull = (width: number) => Math.min(1, width / W, (window.innerHeight - 140) / H);

/** One desktop screen, at fit scaled to the width it is given and never past its true size. */
function Screen({ doc, title, scripts, zoom, full }: { doc: string; title: string; scripts?: boolean; zoom: Zoom; full?: boolean }) {
  const box = useFitWidth<HTMLSpanElement>(zoom.setFit, full ? screenFull : screenFit);
  const { scale, fit } = zoom;
  return (
    <span ref={box} className="block w-full">
      <ZoomArea height={fit ? H * fit : H} zoom={zoom}>
        <span className="relative m-auto block shrink-0 overflow-hidden" style={{ width: W * scale, height: H * scale }}>
          <iframe
            sandbox={sandboxOf(scripts)}
            srcDoc={doc}
            title={title}
            style={{ width: W, height: H, border: 0, transform: scale === 1 ? undefined : `scale(${scale})`, transformOrigin: "top left" }}
          />
          <Shield />
        </span>
      </ZoomArea>
    </span>
  );
}

/** How far ahead of the viewport a preview starts loading. */
const NEAR = "800px 0px";

/** A preview on its way: the screen's own size and fill, and a breathing mark. */
function Pending({ device, screen, hyperframe }: { device: Device; screen: boolean; hyperframe?: boolean }) {
  const c = useCopy().card.mockup;
  if (device === "mobile" && screen)
    return (
      <PhoneBand>
        <span
          role="status"
          aria-busy="true"
          aria-label={c.loadingPreview}
          className="flex items-center justify-center"
          style={{ width: `min(${PHONE_W * PHONE_SCALE}px, 100%)`, aspectRatio: `${PHONE_W} / ${PHONE_H}`, borderRadius: 58 * PHONE_SCALE, border: `${BEZEL * PHONE_SCALE}px solid var(--color-nb-ink)` }}
        >
          <FiImage aria-hidden className="a4k-breathe text-nb-ink-soft" style={{ width: 22, height: 22 }} />
        </span>
      </PhoneBand>
    );
  return (
    <span role="status" aria-busy="true" aria-label={c.loadingPreview} className={`flex w-full items-center justify-center ${hyperframe ? "bg-[#f8f5ef]" : "bg-nb-wash"}`} style={hyperframe ? { aspectRatio: "16 / 9" } : screen ? { aspectRatio: `${W} / ${H}`, maxHeight: H } : { height: 240 }}>
      <FiImage aria-hidden className="a4k-breathe text-nb-ink-soft" style={{ width: 22, height: 22 }} />
    </span>
  );
}

export const ICON_BTN =
  "nb-tip nb-tip-below relative inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-[6px] text-nb-ink-soft hover:bg-[color-mix(in_srgb,var(--color-nb-ink)_6%,transparent)] hover:text-nb-ink aria-disabled:cursor-default aria-disabled:opacity-40 aria-disabled:hover:bg-transparent";
const PRESSED = "bg-[color-mix(in_srgb,var(--color-nb-ink)_6%,transparent)] text-nb-ink";

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
    <Menu
      trigger={({ open, onClick }) => (
        <button
          type="button"
          onClick={onClick}
          aria-expanded={open}
          aria-label={`${c.version}: ${labels[at]}`}
          className={`inline-flex min-w-0 shrink cursor-pointer items-center gap-0.5 rounded-[6px] py-[2px] pl-2 pr-1 text-[12px] font-[600] text-nb-ink hover:bg-[color-mix(in_srgb,var(--color-nb-ink)_10%,transparent)] ${open ? "bg-[color-mix(in_srgb,var(--color-nb-ink)_10%,transparent)]" : "bg-nb-wash"}`}
        >
          <span className="truncate">{labels[at]}</span>
          <FiChevronDown aria-hidden size={12} className="shrink-0 text-nb-ink-soft" />
        </button>
      )}
      items={labels.map((label, i) => ({
        key: i,
        className: "justify-between gap-3",
        onSelect: () => pick(i),
        body: (
          <>
            {label}
            {i === at && <FiCheck aria-hidden size={12} />}
          </>
        ),
      }))}
    />
  );
}

/** A row of the ⋯ menu. */
export type MenuItem = { icon: React.ReactNode; text: string; onSelect: () => void };

function More({ items }: { items: MenuItem[] }) {
  const c = useCopy().card.mockup;
  return (
    <Menu
      align="end"
      trigger={({ open, onClick }) => (
        <button type="button" onClick={onClick} aria-expanded={open} className={`${ICON_BTN} ${open ? PRESSED : ""}`} data-tip={c.download} aria-label={c.download}>
          <FiMoreHorizontal aria-hidden size={15} />
        </button>
      )}
      items={items.map((it, k) => ({
        key: k,
        onSelect: it.onSelect,
        body: (
          <>
            <span aria-hidden className="text-nb-ink-soft">
              {it.icon}
            </span>
            {it.text}
          </>
        ),
      }))}
    />
  );
}

/** Saves `href` under `name`. */
export function download(href: string, name: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = name;
  a.click();
}

/** The frame every draft sits in — an asset, a storyboard, a compare (#1793). Edge to edge on a
 *  phone (markdown.css). */
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
  children,
}: {
  label: string;
  meta?: string;
  variants: Variants | null;
  open?: boolean;
  onToggle?: () => void;
  menu?: (MenuItem | null | false | undefined)[];
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
          {items.length > 0 && <More items={items} />}
        </span>
      </span>
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

function FullSize({ onClick }: { onClick: () => void }) {
  const c = useCopy().card.mockup;
  return (
    <button type="button" onClick={onClick} className={ICON_BTN} data-tip={c.openFull} aria-label={c.openFull}>
      <FiMaximize2 aria-hidden size={13} />
    </button>
  );
}

const downloadItem = (text: string, href: string, name: string): MenuItem => ({ icon: <FiDownload size={13} />, text, onSelect: () => download(href, name) });

/** A Markdown asset (#1651): the article, folded, under the same caption a screen has. */
function ArticleAsset({ drawn, label, variants, fold }: { drawn: Drawn & { article: NonNullable<Drawn["article"]> }; label: string; variants: Variants | null; fold: Fold }) {
  const c = useCopy().card.mockup;
  const state = useArticle(drawn.article, drawn.src);
  const [full, setFull] = useState(false);
  return (
    <DraftFrame>
      <Caption label={label} variants={variants} menu={[downloadItem(c.download, drawn.article.href, nameOf(drawn.src))]} {...fold}>
        <HeadButton tip={state.source ? c.viewArticle : c.viewSource} on={state.source} onClick={() => state.setSource((v) => !v)}>
          <FiCode aria-hidden size={14} />
        </HeadButton>
        <FullSize onClick={() => setFull(true)} />
      </Caption>
      {fold.open && <ArticleFolded state={state} />}
      {full && (
        <PreviewDialog label={label} onClose={() => setFull(false)}>
          <span onClick={(e) => e.stopPropagation()} className="block max-h-[calc(100dvh-80px)] w-[min(820px,calc(100vw-32px))] overflow-y-auto rounded-[10px] bg-nb-paper shadow-[0_8px_40px_rgba(0,0,0,0.35)]">
            <ArticleFull state={state} />
          </span>
        </PreviewDialog>
      )}
    </DraftFrame>
  );
}

/** `load` once `box` is near the viewport; `null` until it arrives. */
function useNearLoad<T>(box: React.RefObject<HTMLElement | null>, load: (() => Promise<T>) | null): T | null {
  const [got, setGot] = useState<{ load: () => Promise<T>; value: T } | null>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = box.current;
    if (!load || near || !el) return;
    const io = new IntersectionObserver((seen) => seen.some((e) => e.isIntersecting) && setNear(true), { rootMargin: NEAR });
    io.observe(el);
    return () => io.disconnect();
  }, [box, load, near]);
  useEffect(() => {
    if (!load || !near) return;
    let live = true;
    load().then((value) => live && setGot({ load, value }));
    return () => {
      live = false;
    };
  }, [load, near]);
  return got && got.load === load ? got.value : null;
}

export { useNearLoad };

/** One tag, framed: one version at a time when it declares `variants` (#1663). */
export function Mockup({
  views,
  first = 0,
  label,
  alt = "",
  device,
  loop = false,
}: {
  views: { label: string; view: MockupView }[];
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

/** One file, framed: its caption over the preview. */
function One({ view, label, alt, device, loop, variants, fold }: { view: MockupView; label: string; alt: string; device: Device; loop: boolean; variants: Variants | null; fold: Fold }) {
  const c = useCopy().card.mockup;
  const box = useRef<HTMLSpanElement>(null);
  const deferred = view.deferred;
  const loaded = useNearLoad(box, deferred?.load ?? null);
  const drawn: Drawn | null = deferred ? loaded : view.loading ? null : view;
  const screen = !!deferred?.screen;
  const [shown, setShown] = useState<Device>(screen ? device : "desktop");
  const [full, setFull] = useState(false);
  const zoom = useZoom();
  const name = label || nameOf(view.src);

  if (view.component) return <ComponentAsset spec={view.component} label={name} variants={variants} fold={fold} />;
  if (drawn?.error !== undefined)
    return variants ? (
      <DraftFrame>
        <Caption label={name} variants={variants} {...fold} />
        {fold.open && <Note text={drawn.error} />}
      </DraftFrame>
    ) : (
      <Note text={drawn.error} />
    );
  // A delivered file: its name is the download.
  const file = drawn?.file;
  if (file)
    return (
      <DraftFrame>
        <Caption label={name} variants={variants}>
          <button
            type="button"
            onClick={() => file.load().then((href) => download(href, file.name), () => {})}
            className="mr-1 inline-flex min-w-0 max-w-[260px] cursor-pointer items-center gap-1.5 rounded-[7px] bg-nb-wash px-3 py-1.5 text-[12.5px] font-[700] text-nb-ink hover:bg-[color-mix(in_srgb,var(--color-nb-ink)_10%,transparent)]"
            title={c.download}
          >
            <FiDownload aria-hidden className="shrink-0" style={{ width: 12, height: 12 }} />
            <span className="truncate">{file.name}</span>
          </button>
        </Caption>
      </DraftFrame>
    );
  if (drawn?.article) return <ArticleAsset drawn={drawn as Drawn & { article: NonNullable<Drawn["article"]> }} label={name} variants={variants} fold={fold} />;

  const bytes = drawn?.image ?? drawn?.media?.href;
  const title = label ? c.frame(label) : nameOf(view.src);
  const draw = (z: Zoom, big?: boolean) =>
    drawn?.doc === undefined ? null : shown === "mobile" ? (
      <PhoneScreen doc={drawn.doc} title={title} scripts={drawn.scripts} zoom={z} full={big} />
    ) : (
      <Screen doc={drawn.doc} title={title} scripts={drawn.scripts} zoom={z} full={big} />
    );
  return (
    <DraftFrame ref={box}>
      <Caption label={name} variants={variants} menu={[bytes !== undefined && downloadItem(c.download, bytes, nameOf(view.src))]} {...fold}>
        {screen && (
          <>
            <HeadButton tip={c.desktop} on={shown === "desktop"} onClick={() => setShown("desktop")}>
              <FiMonitor aria-hidden size={13} />
            </HeadButton>
            <HeadButton tip={c.phone} on={shown === "mobile"} onClick={() => setShown("mobile")}>
              <FiSmartphone aria-hidden size={13} />
            </HeadButton>
          </>
        )}
        {(screen || drawn?.image !== undefined) && <FullSize onClick={() => setFull(true)} />}
      </Caption>
      {!fold.open ? null : drawn === null ? (
        <Pending device={shown} screen={screen} hyperframe={deferred?.hyperframe} />
      ) : drawn.hyperframe && drawn.doc !== undefined ? (
        <span className="a4k-reveal block">
          <HyperframePlayer key={view.src} doc={drawn.doc} title={title} />
        </span>
      ) : drawn.media !== undefined ? (
        <MediaPlayer key={drawn.media.href} kind={drawn.media.kind} href={drawn.media.href} title={name} fill loop={loop} />
      ) : drawn.image !== undefined ? (
        <Zoomable zoom={zoom}>
          <Picture image={drawn.image} alt={alt || name} zoom={zoom} />
        </Zoomable>
      ) : (
        drawn.doc !== undefined && (
          <span className="a4k-reveal block">
            <Zoomable zoom={zoom}>{draw(zoom)}</Zoomable>
          </span>
        )
      )}
      {full && drawn?.image !== undefined && <ImagePreview src={drawn.image} alt={alt || name} onClose={() => setFull(false)} />}
      {full && drawn?.doc !== undefined && <FullScreen label={name} draw={draw} onClose={() => setFull(false)} />}
    </DraftFrame>
  );
}

/** How long a component has to say hello once its frame loads. */
const COMPONENT_TIMEOUT = 10_000;

type Loaded = Awaited<ReturnType<ComponentSpec["load"]>>;

/** A developer's component (#2006): its own origin, framed in place of a built-in preview. */
function ComponentAsset({ spec, label, variants, fold }: { spec: ComponentSpec; label: string; variants: Variants | null; fold: Fold }) {
  const c = useCopy().card.mockup;
  const box = useRef<HTMLSpanElement>(null);
  // `false`: it cannot be drawn — not pinned, removed, or the page could not reach it.
  const load = useCallback((): Promise<Loaded | false> => spec.load().catch(() => false as const), [spec]);
  const got = useNearLoad<Loaded | false>(box, load);
  const [failed, setFailed] = useState(false);
  const [full, setFull] = useState(false);
  const loaded = got || null;
  const broken = failed || got === false;
  const fail = useCallback(() => setFailed(true), []);
  const closeFull = useCallback(() => setFull(false), []);
  return (
    <DraftFrame ref={box}>
      <Caption label={label} variants={variants} {...fold}>
        {broken ? (
          <HeadButton tip={c.downloadFile} onClick={() => spec.file.load().then((href) => download(href, spec.file.name), () => {})}>
            <FiDownload aria-hidden size={13} />
          </HeadButton>
        ) : (
          loaded && <FullSize onClick={() => setFull(true)} />
        )}
      </Caption>
      {!fold.open ? null : broken ? (
        <span className="block px-3 pb-1">
          <Note text={c.componentFailed} />
        </span>
      ) : loaded ? (
        <ComponentFrame loaded={loaded} save={spec.save} title={c.frame(label)} onFail={fail} />
      ) : (
        <Pending device="desktop" screen={false} />
      )}
      {full && loaded && !broken && (
        <PreviewDialog label={label} onClose={() => setFull(false)}>
          <span onClick={(e) => e.stopPropagation()} className="block w-[calc(100vw-128px)] overflow-hidden rounded-[10px] bg-nb-paper shadow-[0_8px_40px_rgba(0,0,0,0.35)] max-md:w-[calc(100vw-32px)]">
            <ComponentFrame loaded={loaded} save={spec.save} title={c.frame(label)} onFail={closeFull} fill />
          </span>
        </PreviewDialog>
      )}
    </DraftFrame>
  );
}

/** One framed instance and its Bridge. `fill` takes the dialog's height and ignores resizes. */
function ComponentFrame({ loaded, save, title, onFail, fill }: { loaded: Loaded; save: ComponentSpec["save"]; title: string; onFail: () => void; fill?: boolean }) {
  const t = useCopy().card.save;
  const frame = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(320);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    const context: BridgeContext = loaded.context;
    const stop = hostBridge(el, new URL(loaded.url).origin, {
      context,
      save,
      refused: t.refused,
      busy: t.busy,
      resize: (h) => setHeight(Math.max(80, Math.min(h, 2 * window.innerHeight))),
      ready: () => setReady(true),
    });
    return stop;
  }, [loaded, save, t]);
  useEffect(() => {
    if (ready) return;
    const timer = setTimeout(onFail, COMPONENT_TIMEOUT);
    return () => clearTimeout(timer);
  }, [ready, onFail]);
  return (
    <span className="block border-t border-[color-mix(in_srgb,var(--color-nb-ink)_14%,transparent)]">
      <iframe
        ref={frame}
        src={loaded.url}
        title={title}
        sandbox="allow-scripts allow-same-origin"
        referrerPolicy="no-referrer"
        allow=""
        onError={onFail}
        className="block w-full border-0"
        style={{ height: fill ? "calc(100dvh - 120px)" : height }}
      />
    </span>
  );
}

/** A screen at full size over the page, with its own zoom. */
function FullScreen({ label, draw, onClose }: { label: string; draw: (z: Zoom, big?: boolean) => React.ReactNode; onClose: () => void }) {
  const zoom = useZoom();
  return (
    <PreviewDialog label={label} onClose={onClose}>
      <span onClick={(e) => e.stopPropagation()} className="block w-[calc(100vw-128px)] overflow-hidden rounded-[10px] bg-nb-paper shadow-[0_8px_40px_rgba(0,0,0,0.35)] max-md:w-[calc(100vw-32px)]">
        <Zoomable zoom={zoom}>{draw(zoom, true)}</Zoomable>
      </span>
    </PreviewDialog>
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
