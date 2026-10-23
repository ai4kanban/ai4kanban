"use client";

// One mockup, on its own, at full size (#239). The card page is where mockups are compared
// with each other, scaled down side by side; this is where one of them is read.
//
// It is drawn in the same window as everything else — header, rail, the card it belongs to
// highlighted in it — so it is a view of that card rather than a screen you fall into. The
// way back is a row in the rail and the link above the mockup, and both are ordinary
// navigation: `router.back()` was neither, since a pasted address has nothing behind it.
//
// The mockup keeps the sandbox the card page's frame has — nothing loads, and only a
// `.tsx` or `.html` page's own inline scripts run (#1626, #1628). It opens at 100% and zooms
// (#1637), and a panel narrower than it scrolls. A phone screen (#1097) stands in its phone frame.
//
// A `.txt` mockup opens here too (#256), in the same monospaced block the card page shows
// it in and at the size a drawing is read at. It never re-wraps either.
//
// An image (#803) is shown at its own pixel size, with that size beside its name. A video
// (#872) fits the panel's width, with its size and length there; audio shows its length.
// A Markdown file (#1651) is its article in full.

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FiArrowLeft } from "react-icons/fi";
import { useRouter } from "next/navigation";
import { useCopy } from "@/i18n/use-copy";
import { SCREENS, type ArticleFile, type Device, type MockupView } from "@/lib/mockup-tag";
import type { AgentInfo, MemoryOwner } from "@/lib/types";
import { ArticleFull, SourceSwitch, useArticle } from "./Article";
import { clock, MediaPlayer, type MediaMeta } from "./MediaPlayer";
import { HyperframePlayer } from "./HyperframePlayer";
import { CopyPath, DownloadIcon, Phone, PHONE_W, sandboxOf } from "./Mockup";
import { RunningNotice } from "./desktop";
import { Header } from "./Header";
import { OpenIdsProvider } from "./open-ids";
import { runningCardIds, useAgentSessions, useOnTabFocus } from "./sessions";
import { Window } from "./Window";
import { Shield, useFitWidth, usePinch, useZoom, ZoomControls } from "./zoom";

/** The panel's side padding, `px-6`. */
const PAD = 48;

/** The card a mockup belongs to — `.mockups/<card id>/` is where it is filed. */
export type MockupCard = { id: number; title: string };

function BackLink({ card }: { card: MockupCard }) {
  const c = useCopy().card.mockup;
  return (
    <Link
      href={`/${card.id}`}
      className="inline-flex min-w-0 items-center gap-1.5 text-[12.5px] font-[700] text-nb-ink-soft hover:text-nb-accent-deep"
    >
      <FiArrowLeft aria-hidden className="shrink-0 text-[14px]" />
      <span className="shrink-0">{c.back(card.id)}</span>
      <span className="truncate font-[500]">{card.title}</span>
    </Link>
  );
}

/** A Markdown asset (#1651): the article in full, its source switch above it. */
function ArticleMain({ file, src, path, card }: { file: ArticleFile; src: string; path?: string; card: MockupCard | null }) {
  const state = useArticle(file, src);
  return (
    <>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-6 py-4">
        {card && <BackLink card={card} />}
        <span className="min-w-0 truncate font-mono text-[12px] text-nb-ink-soft">{src}</span>
        <span className="ml-auto flex shrink-0 items-center gap-x-2.5">
          <SourceSwitch state={state} />
          {path && <CopyPath path={path} />}
          <DownloadIcon href={file.href} name={src.split("/").pop()!} />
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-6 pb-6">
        <ArticleFull state={state} />
      </div>
    </>
  );
}

export function MockupPage({
  view,
  device,
  card,
  openIds,
  agent,
  projectRoot,
  memoryOwners,
  desktop,
}: {
  view: MockupView;
  device: Device;
  /** The card that pointed at this file, when it is still on the board. */
  card: MockupCard | null;
  openIds: number[];
  agent: AgentInfo;
  projectRoot: string;
  memoryOwners: MemoryOwner[];
  desktop: boolean;
}) {
  const c = useCopy().card.mockup;
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [showCode, setShowCode] = useState(!!view.error);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const measure = useCallback((img: HTMLImageElement | null) => {
    if (!img?.complete || !img.naturalWidth) return;
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    setSize((prev) => (prev?.w === w && prev.h === h ? prev : { w, h }));
  }, []);
  const [meta, setMeta] = useState<MediaMeta | null>(null);
  const zoom = useZoom(1);
  const { scale } = zoom;
  const width =
    view.image !== undefined
      ? size?.w
      : view.doc !== undefined && !view.hyperframe
        ? device === "mobile"
          ? PHONE_W
          : SCREENS.desktop.w
        : undefined;
  const zoomable = !showCode && width !== undefined;
  const fitOf = useMemo(() => (width ? (panel: number) => (panel - PAD) / width : null), [width]);
  const panel = useFitWidth<HTMLDivElement>(zoom.setFit, fitOf);
  usePinch(zoom, panel, zoomable);
  const refresh = useCallback(() => router.refresh(), [router]);

  // The same two triggers the memory page catches up on: a run finishing, and the window
  // being focused again. A run can rewrite the mockup file while this page sits open.
  const noRunsOfOurOwn = useCallback(() => {}, []);
  const { sessions } = useAgentSessions(noRunsOfOurOwn);
  const prevRunning = useRef<Set<string>>(new Set());
  useEffect(() => {
    const now = new Set(sessions.filter((r) => r.status === "running").map((r) => r.sessionId));
    let finished = false;
    for (const id of prevRunning.current) if (!now.has(id)) finished = true;
    prevRunning.current = now;
    if (finished) refresh();
  }, [sessions, refresh]);
  useOnTabFocus(refresh);

  return (
    <OpenIdsProvider ids={openIds}>
      <Window
        projectRoot={projectRoot}
        openIds={openIds}
        currentId={card?.id ?? null}
        currentTitle={card?.title ?? ""}
        memoryOwners={memoryOwners}
        running={runningCardIds(sessions)}
        header={
          <Header
            agent={agent}
            projectRoot={projectRoot}
            onError={setError}
            desktop={desktop}
          />
        }
      >
        <div className="flex h-full flex-col overflow-hidden">
          <RunningNotice desktop={desktop} />

          {error && (
            <div
              className="nb-panel-sm mx-6 mt-4 p-3 text-[13px]"
              style={{ background: "var(--color-nb-peach-soft)" }}
            >
              {error}
            </div>
          )}

          {view.article ? (
            <ArticleMain file={view.article} src={view.src} path={view.path} card={card} />
          ) : (
            <>
              {/* The way back, first thing on the page and named — a mockup is read on the way
                  through a card, and the card is where you were going. */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-6 py-4">
                {card && <BackLink card={card} />}
                <span className="min-w-0 truncate font-mono text-[12px] text-nb-ink-soft">
                  {view.src}
                </span>
                {size && (
                  <span className="shrink-0 font-mono text-[12px] text-nb-ink-soft">
                    {size.w} × {size.h} px
                  </span>
                )}
                {meta && (
                  <span className="shrink-0 font-mono text-[12px] text-nb-ink-soft">
                    {[meta.width ? `${meta.width} × ${meta.height} px` : "", clock(meta.duration)]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                )}
                <span className="ml-auto flex shrink-0 items-center gap-x-3">
                  {zoomable && <ZoomControls zoom={zoom} />}
                  {view.code && (
                    <button
                      type="button"
                      onClick={() => setShowCode((v) => !v)}
                      disabled={!!view.error}
                      className="shrink-0 cursor-pointer text-[12px] font-[600] text-nb-ink-soft hover:text-nb-accent-deep disabled:cursor-default disabled:opacity-40"
                    >
                      {showCode ? c.screen : c.code}
                    </button>
                  )}
                  {view.path && <CopyPath path={view.path} />}
                </span>
              </div>

              {view.error && (
                <p
                  className="nb-outline mx-6 mb-3 px-3 py-2.5 font-mono text-[12.5px] leading-[18px] text-nb-ink-soft"
                  style={{ background: "var(--color-nb-peach-soft)" }}
                >
                  {view.error}
                </p>
              )}

              {/* Full size, so the panel is what scrolls — both ways, since the screen is wider
                  than the body on most windows. */}
              <div ref={panel} className="min-h-0 flex-1 overflow-auto px-6 pb-6">
                {view.doc !== undefined && view.hyperframe && !showCode ? (
                  <HyperframePlayer key={view.src} doc={view.doc} title={view.src} />
                ) : view.media !== undefined ? (
                  <MediaPlayer
                    key={view.media.href}
                    kind={view.media.kind}
                    href={view.media.href}
                    title={view.src}
                    fill={false}
                    onMeta={setMeta}
                  />
                ) : view.image !== undefined ? (
                  // eslint-disable-next-line @next/next/no-img-element -- a file on this machine
                  <img
                    src={view.image}
                    alt={view.src}
                    // An image already loaded before hydration fires no load event.
                    ref={measure}
                    onLoad={(e) => measure(e.currentTarget)}
                    className="block max-w-none bg-nb-wash"
                    style={size ? { width: size.w * scale, height: size.h * scale } : undefined}
                  />
                ) : view.text !== undefined ? (
                  <pre className="w-max whitespace-pre bg-nb-wash p-4 font-mono text-[13px] leading-[19px]">
                    {view.text}
                  </pre>
                ) : showCode ? (
                  <pre className="w-max whitespace-pre bg-nb-wash p-3 font-mono text-[12px] leading-[18px]">
                    {view.code}
                  </pre>
                ) : (
                  view.doc &&
                  (device === "mobile" ? (
                    <span className="relative mx-auto block w-max">
                      <Phone scale={scale} doc={view.doc} title={view.src} scripts={view.scripts} />
                      <Shield />
                    </span>
                  ) : (
                    <span
                      className="relative block overflow-hidden"
                      style={{ width: SCREENS.desktop.w * scale, height: SCREENS.desktop.h * scale }}
                    >
                      <iframe
                        sandbox={sandboxOf(view.scripts)}
                        srcDoc={view.doc}
                        title={view.src}
                        style={{
                          width: SCREENS.desktop.w,
                          height: SCREENS.desktop.h,
                          border: 0,
                          display: "block",
                          transform: scale === 1 ? undefined : `scale(${scale})`,
                          transformOrigin: "top left",
                        }}
                      />
                      <Shield />
                    </span>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </Window>
    </OpenIdsProvider>
  );
}
