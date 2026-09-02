"use client";

// The window: the top row, the rail, and the body — the one frame both pages are
// drawn in, so the board and a card page are the same window with different
// contents rather than two screens that happen to share a header.
//
// Nothing in it is separated by a border. The top row and the rail sit straight
// on the window's cream and read as a single L; the body says where it starts by
// being paper instead of cream, with 16px of that cream down the two sides the
// chrome is on — half of it the chrome's own padding. The other two sides get
// none: the body runs into the window's own edges, so the only corner it rounds
// is the top-left one, where it turns away from the chrome.
//
// The whole thing is exactly one screen tall and never scrolls: the body is what
// scrolls, which is what keeps the rail on screen with the card it opened.
//
// At phone width the rail is gone (app/globals.css) and a bottom tab bar takes its place
// (#357, components/Phone.tsx). The frame is otherwise the same one: Find, Memory and More
// are drawn over the body rather than instead of it, so the board or the card page under
// them keeps its state and its scroll while the reader looks something up.
//
// See app/design/layouts for the mockup this is drawn from.

import { useCopy } from "@/i18n/use-copy";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { cloudCardLinkAction } from "@/app/actions";
import { FiAlertCircle, FiX } from "react-icons/fi";
import { BELL_MAX, BELL_MIN, BELL_W, samePath, switchProject, useBellRail } from "@/lib/bell-rail";
import { CHAT_MAX, CHAT_MIN, CHAT_W, useChatRail, type BoardChange } from "@/lib/chat-rail";
import { usePhone } from "@/lib/media";
import { useOpenCards } from "@/lib/open-cards";
import { RAIL_MAX, RAIL_MIN, RAIL_W, useRailWidth } from "@/lib/rail-width";
import type { MemoryModule } from "@/lib/types";
import { ChatPane, ChatProvider } from "./Chat";
import { raiseNotifications, useCardLinkFromApp, useOpenNotificationFromApp } from "./desktop";
import { BellPane, BellProvider } from "./Notifications";
import {
  FindScreen,
  MemoryScreen,
  MoreScreen,
  PHONE_TABS_H,
  PhoneTabs,
  type PhoneTab,
} from "./Phone";
import { Rail } from "./Rail";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "./ui/resizable";

/** Stood in for a caller that doesn't watch sessions. One instance, so a page
 *  without it doesn't hand the rail a fresh empty set on every render. */
const EMPTY: Set<number> = new Set();

/** The one thing this window says on its own: a card link that leads nowhere. It sits over
 *  the top of the body, says the one sentence, and goes when it is dismissed — there is
 *  nothing to do about it here, and the checkout can come back. */
function LinkNotice({ words, onClose }: { words: string; onClose: () => void }) {
  return (
    <div className="px-4 pb-1 md:px-1">
      <button
        type="button"
        onClick={onClose}
        className="flex w-full items-center gap-2 rounded-[9px] bg-nb-peach-soft px-3.5 py-2 text-left"
      >
        <FiAlertCircle className="shrink-0 text-nb-peach-ink" size={13} aria-hidden />
        <span className="min-w-0 flex-1 text-[12px] leading-[16px] text-nb-ink">{words}</span>
        <FiX className="shrink-0 text-nb-ink-soft" size={13} aria-hidden />
      </button>
    </div>
  );
}

export function Window({
  /** The top row — <Header>, built by the page so it can hand it the board-only
   *  controls a card page has nothing to say about. */
  header,
  projectRoot,
  /** Every card the board holds open: the count on All cards, and what keeps the
   *  rail from offering a row that leads nowhere. */
  openIds,
  /** The card this page is showing, if it is showing one. Landing on a card is
   *  what opens it in the rail — every way in goes through the card page, so
   *  there is nothing for a board card or a `#12` link to remember to do. */
  currentId = null,
  currentTitle = "",
  currentMemory = null,
  currentArchive = false,
  memoryModules = [],
  goalWritten = false,
  running,
  onBoardChanged,
  children,
}: {
  header: React.ReactNode;
  projectRoot: string;
  openIds: number[];
  currentId?: number | null;
  currentTitle?: string;
  /** The memory file this page is showing, if it is showing one (#129) — as a memory key,
   *  which is what highlights its row in the rail's Memory panel, opens that panel on
   *  landing, and opens the module the file belongs to (#130). */
  currentMemory?: string | null;
  /** True while this page is showing the archive — the list, or one card in it (#380). It
   *  is what highlights the rail's Archive row and takes the highlight off All cards. */
  currentArchive?: boolean;
  /** The modules the rail's Memory panel offers, from the board read every page already
   *  does (#130). Empty on a board whose map names none. */
  memoryModules?: MemoryModule[];
  /** Whether `memory/goal.md` holds the user's own words — the phone's More screen offers
   *  the goal the top row offers at window width (#357), and neither offers a file that
   *  isn't written. */
  goalWritten?: boolean;
  /** The cards an agent is inside, for the rail's pulsing rows. Handed down
   *  rather than polled for here: both pages already watch the registry, and a
   *  fourth poll for one dot would be a poll to say nothing new. */
  running?: Set<number>;
  /** The board moved while this page was open — a chat wrote it as it answered, here or in
   *  a terminal (#243). The page re-reads itself; a card page whose card has gone goes back
   *  to the board. The chat's own poll is what notices, so nothing else has to watch. */
  onBoardChanged?(change: BoardChange): void;
  children: React.ReactNode;
}) {
  const c = useCopy().chrome;
  // Read up here because the rails below have to know: at phone width one of them covers
  // the whole body, and a rail that stays up over what it just opened is a rail nobody can
  // get out from behind (#357).
  const phone = usePhone();
  const { rows, close } = useOpenCards(projectRoot, openIds, currentId, currentTitle);
  const { panel, onLayoutChanged, onDoubleClick } = useRailWidth();
  // The chat rail follows what this window is showing (#242): a card's page gets that
  // card's own conversation, the board and a memory file get the board's. One chat on
  // screen, and nothing to choose.
  const chat = useChatRail({
    projectRoot,
    cardId: currentId ?? null,
    cardTitle: currentTitle,
    onBoardChanged,
  });
  // The bell (#319) shares the right side with the chat: one rail at a time, so opening
  // either folds the other. It carries every board Cloud is on for, not only this one, so
  // a row can lead out of this project — which is why it needs the router.
  const router = useRouter();
  // Held in a ref because the bell is built from this callback: at phone width the bell is
  // the whole screen, so a row opening a card has to take the list off first — otherwise
  // the card it opened is behind the list that opened it (#357).
  const foldBellRef = useRef<() => void>(() => {});
  const goToCard = useCallback(
    (taskId: number) => {
      if (phone) foldBellRef.current();
      router.push(`/${taskId}`);
    },
    [phone, router],
  );
  const bell = useBellRail({ projectRoot, onAlerts: raiseNotifications, onOpenCard: goToCard });
  foldBellRef.current = bell.fold;
  // A notification clicked outside the window opens its own row: the same read mark, and
  // the same switch to that row's board when it is not the one on screen.
  useOpenNotificationFromApp(bell.openRow);
  // The card link a Slack message carries (#320). It names the board as well as the card,
  // so it lands on the right one while another project is open — and says so plainly when
  // that board has been moved off this machine, rather than opening whatever card wears
  // that number on the board in front of the user.
  const [linkNotice, setLinkNotice] = useState<string | null>(null);
  const openCardLink = useCallback(
    (url: string) => {
      void (async () => {
        const where = await cloudCardLinkAction(url);
        // Not a card link at all — an older app handing every scheme URL over, say.
        if (!where) return;
        if (!where.ok) return setLinkNotice(c.cardLink.notHere);
        setLinkNotice(null);
        if (samePath(where.boardPath, projectRoot)) return goToCard(where.taskId);
        await switchProject(where.boardPath, where.taskId);
      })();
    },
    [c, goToCard, projectRoot],
  );
  useCardLinkFromApp(openCardLink);

  // One rail at a time. Each effect fires only on the move INTO open, and folding the other
  // sets it closed — so opening one folds the other and neither can chase the other back.
  const foldChat = chat.fold;
  const foldBell = bell.fold;
  useEffect(() => {
    if (bell.open) foldChat();
  }, [bell.open, foldChat]);
  useEffect(() => {
    if (chat.open) foldBell();
  }, [chat.open, foldBell]);

  // The phone shell (#357). Board is a place you go; Find, Memory and More are screens
  // drawn over whatever page is up. So what is held here is which of those three is
  // covering the page — `null` is the page itself — and which tab is LIT is worked out
  // from that plus the page underneath: a memory file is what the Memory tab leads to, and
  // everything else is the board's.
  //
  // Going anywhere uncovers the page, because every row on Find and Memory opens one, and
  // landing on it still looking at the list you left would be a tap that did nothing.
  const path = usePathname();
  const onMemory = path.startsWith("/memory/");
  const [cover, setCover] = useState<PhoneTab | null>(null);
  useEffect(() => setCover(null), [path]);
  const tab: PhoneTab = cover ?? (onMemory ? "memory" : "board");
  const goTab = useCallback(
    (next: PhoneTab) => {
      // The bell and the chat lie over the body here, so a tab tapped under one of them
      // would light up behind it. The tap folds the rail first: the tab bar is the way off
      // every screen the phone reaches, including those two.
      foldBell();
      foldChat();
      // Board is the board — from a card page, from a memory file, from a covered board.
      if (next === "board") {
        setCover(null);
        if (path !== "/") router.push("/");
        return;
      }
      // Memory from a memory file is the list again, not the file you are already on.
      setCover(next);
    },
    [foldBell, foldChat, path, router],
  );

  // Beside the body on a wide window, over it on a narrow one — the same rail either way,
  // so what has been typed survives the window being dragged across that line.
  const chatBeside = chat.open && !chat.overlay && !bell.open;
  const bellBeside = bell.open && !bell.overlay;
  const beside = chatBeside || bellBeside;
  const corners = phone
    ? "rounded-t-[14px]"
    : `rounded-tl-[14px] ${beside ? "rounded-tr-[14px]" : ""}`;
  const phoneScreen =
    !phone || cover === null ? null : cover === "find" ? (
      <FindScreen rows={rows} />
    ) : cover === "memory" ? (
      <MemoryScreen active={currentMemory} modules={memoryModules} />
    ) : (
      <MoreScreen projectRoot={projectRoot} goalWritten={goalWritten} />
    );
  return (
    <BellProvider rail={bell}>
    <ChatProvider rail={chat}>
    {/* `dvh`, not `vh`: a phone browser's URL bar shrinks the viewport as you scroll, and
        100vh is the tall one — the tab bar at the foot would sit under the bar until the
        page was scrolled. Everywhere else the two are the same number. */}
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-nb-cream">
      {header}
      {linkNotice && <LinkNotice words={linkNotice} onClose={() => setLinkNotice(null)} />}
      {/* The rail and the body are a panel group so the rail can be dragged
          wider — a title is the only thing a row has to say, and how much of one
          fits is a judgement about the cards you happen to have open, not one we
          can make for you once at 216px. `preserve-pixel-size` keeps that
          judgement: widening the window gives the new room to the body, and the
          rail stays the width you left it. */}
      <div className="min-h-0 flex-1">
        {/* One group, two draggable panels, so both handlers are called: each reads its own
            panel's width and writes it down, and ignores a layout it didn't cause. */}
        <ResizablePanelGroup
          orientation="horizontal"
          onLayoutChanged={(layout, meta) => {
            onLayoutChanged(layout, meta);
            chat.onLayoutChanged(layout, meta);
          }}
        >
          <ResizablePanel
            id="rail"
            panelRef={panel}
            defaultSize={RAIL_W}
            minSize={RAIL_MIN}
            maxSize={RAIL_MAX}
            groupResizeBehavior="preserve-pixel-size"
          >
            <Rail
              rows={rows}
              activeId={currentId}
              activeMemory={currentMemory}
              activeArchive={currentArchive}
              memoryModules={memoryModules}
              total={openIds.length}
              running={running ?? EMPTY}
              onClose={close}
            />
          </ResizablePanel>
          <ResizableHandle aria-label={c.resize.rail} onDoubleClick={onDoubleClick} />
          {/* With the rail, the gutter is shared with the handle and the rail's own
              padding and comes to 12px of cream. Without it — phone width — the paper
              runs to both edges: 16px of cream down the side of a 375px screen is width
              spent saying the rail isn't there. */}
          <ResizablePanel
            id="body"
            className={`md:pl-1 ${beside ? "pr-1" : ""}`}
            style={{ overflow: "hidden" }}
          >
            {/* The paper rounds the corner it turns away from the chrome on. With the chat
                up there is chrome on the right too, so it rounds that corner as well — and
                at phone width the chrome is the top row above and the tab bar below, so
                both top corners turn away from it. */}
            <div className={`h-full overflow-hidden bg-nb-paper ${corners}`}>
              {/* Find, Memory and More are drawn OVER the page rather than instead of it:
                  the page stays mounted, so the board keeps its scroll and a card page
                  keeps its state while the reader looks something up, and the tab back is
                  instant rather than a re-read. */}
              {phoneScreen && <div className="h-full">{phoneScreen}</div>}
              <div className={phoneScreen ? "hidden" : "h-full"}>{children}</div>
            </div>
          </ResizablePanel>
          {/* The right side holds ONE rail. The bell wins when both are up, because
              opening it is what folded the chat. */}
          {bellBeside ? (
            <>
              <ResizableHandle aria-label={c.resize.bell} onDoubleClick={bell.onDoubleClick} />
              <ResizablePanel
                id="bell"
                panelRef={bell.panel}
                defaultSize={BELL_W}
                minSize={BELL_MIN}
                maxSize={BELL_MAX}
                groupResizeBehavior="preserve-pixel-size"
              >
                <BellPane rail={bell} />
              </ResizablePanel>
            </>
          ) : chatBeside ? (
            <>
              <ResizableHandle aria-label={c.resize.chat} onDoubleClick={chat.onDoubleClick} />
              <ResizablePanel
                id="chat"
                panelRef={chat.panel}
                defaultSize={CHAT_W}
                minSize={CHAT_MIN}
                maxSize={CHAT_MAX}
                groupResizeBehavior="preserve-pixel-size"
              >
                <ChatPane rail={chat} />
              </ResizablePanel>
            </>
          ) : null}
        </ResizablePanelGroup>
      </div>
      {/* Too narrow to stand beside the board, so it covers it. It is given the paper's own
          ground and an ink edge, since here it is a thing laid over the window rather than
          a part of its frame. On a phone it stops above the tab bar: a cover with no way
          off it is a screen you are stuck on. */}
      {bell.open && bell.overlay ? (
        <div
          className="fixed right-0 top-[43px] z-40 w-[min(400px,100vw)] bg-nb-cream"
          style={{ bottom: phone ? PHONE_TABS_H : 0, borderLeft: "1.5px solid var(--color-nb-ink)" }}
        >
          <BellPane rail={bell} />
        </div>
      ) : (
        chat.open &&
        chat.overlay && (
          <div
            className="fixed right-0 top-[43px] z-40 w-[min(400px,100vw)] bg-nb-cream"
            style={{ bottom: phone ? PHONE_TABS_H : 0, borderLeft: "1.5px solid var(--color-nb-ink)" }}
          >
            <ChatPane rail={chat} />
          </div>
        )
      )}
      {/* The rail's four ways into the board, at the foot of every screen the phone
          reaches (#357). Last in the window, so it is drawn over nothing and nothing is
          drawn over it. */}
      {phone && <PhoneTabs tab={tab} onTab={goTab} />}
    </div>
    </ChatProvider>
    </BellProvider>
  );
}
