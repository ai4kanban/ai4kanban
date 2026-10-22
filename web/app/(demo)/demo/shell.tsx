"use client";

// The desktop app's window around the screens: its top row and rail, copied as they look at
// rest. The real ones read this machine's state and act through the app's server
// (kanban-ui/components/Header.tsx, Rail.tsx, Window.tsx), so these only draw — keep them in
// step with those by hand.
import { BodySlotProvider } from "ai4kanban-ui/lib/body-slot";
import { Button } from "ai4kanban-ui/components/button";
import { HAIRLINE, PULSE_DOT, TOOL_BTN, ToolCluster } from "ai4kanban-ui/components/chrome";
import { LogoMark } from "ai4kanban-ui/components/Logo";
import { useCopy } from "ai4kanban-ui/i18n/use-copy";
import { useState } from "react";
import {
  FiActivity,
  FiArchive,
  FiBell,
  FiChevronRight,
  FiColumns,
  FiFolder,
  FiInbox,
  FiSearch,
  FiSettings,
  FiTrendingUp,
} from "react-icons/fi";
import { LuLightbulb, LuMessagesSquare } from "react-icons/lu";
import { SiGithub } from "react-icons/si";

export interface RailChat {
  name: string;
  /** The card the conversation is about; absent for a discussion. */
  cardId?: number;
  answering?: boolean;
}

/** The macOS window buttons, where the system draws them on the app's title-bar-less window
 *  (desktop/src/main.ts `trafficLightPosition`): inside the header's 96px gutter. */
function TrafficLights() {
  return (
    <div aria-hidden className="pointer-events-none absolute left-[14px] top-[14px] z-[50] flex gap-2">
      {[
        ["#FF5F57", "#E0443E"],
        ["#FEBC2E", "#DEA123"],
        ["#28C840", "#1AAB29"],
      ].map(([fill, edge]) => (
        <span key={fill} className="block size-3 rounded-full" style={{ background: fill, boxShadow: `inset 0 0 0 0.5px ${edge}` }} />
      ))}
    </div>
  );
}

function Header({ projectRoot, running, unread, card, chatOpen }: {
  projectRoot: string;
  running: number;
  unread: number;
  /** Discuss shows on a card's pages only. */
  card: boolean;
  chatOpen: boolean;
}) {
  const c = useCopy();
  const ghost = "nb-tip nb-tip-below shrink-0 w-7 px-0";
  const bell = unread > 0 ? c.notifications.bellUnread(unread) : c.notifications.bell;
  return (
    <header data-titlebar className="relative z-[45] flex shrink-0 items-center gap-2 px-3 pb-2 pt-[7px]">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span className="flex shrink-0 items-center justify-center" title={c.chrome.header.home}>
          <LogoMark />
        </span>
        <span className="flex h-[26px] min-w-0 items-center gap-1.5 overflow-hidden rounded-full bg-nb-paper px-2.5 text-[12px] font-[500] text-nb-ink-soft">
          <FiFolder className="shrink-0 opacity-70" size={12} />
          <span className="truncate">{projectRoot.split("/").pop()}</span>
        </span>
      </div>
      <div data-controls className="flex shrink-0 items-center gap-2">
        <Button variant="ghost" size="xs" className={`${ghost} bg-nb-ink text-nb-paper`} aria-label={c.chrome.header.github} data-tip={c.chrome.header.github}>
          <SiGithub size={14} aria-hidden />
        </Button>
        <ToolCluster>
          <button type="button" className={TOOL_BTN} data-tip={c.rail.insights.open} aria-label={c.rail.insights.open}>
            <FiTrendingUp size={15} aria-hidden />
          </button>
          <button type="button" className={TOOL_BTN} data-tip={c.runs.panel.openRunning(running)} aria-label={c.runs.panel.openRunning(running)}>
            <FiActivity size={15} aria-hidden />
            {running > 0 && (
              <span className="absolute right-[5px] top-[5px] flex size-[7px] items-center justify-center">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-nb-accent opacity-60" aria-hidden />
                <span className="relative inline-flex h-full w-full rounded-full bg-nb-accent" aria-hidden />
              </span>
            )}
          </button>
          <button type="button" className={TOOL_BTN} data-tip={c.configuration.open} aria-label={c.configuration.open}>
            <FiSettings size={15} aria-hidden />
          </button>
        </ToolCluster>
        <Button variant="ghost" size="xs" className={ghost} aria-label={c.chrome.header.triage} data-tip={c.chrome.header.triage}>
          <FiInbox className="text-[14px]" aria-hidden />
        </Button>
        <Button
          variant="ghost"
          size="xs"
          className={`nb-tip nb-tip-below shrink-0 ${unread > 0 ? "gap-1 px-2" : "w-7 px-0"}`}
          aria-label={bell}
          data-tip={bell}
          style={unread > 0 ? { background: "color-mix(in srgb, var(--color-nb-accent) 88%, white)", color: "#fff" } : undefined}
        >
          <FiBell className="text-[14px]" aria-hidden />
          {unread > 0 && <span className="text-[11.5px] font-[800] leading-none">{unread}</span>}
        </Button>
        {card && (
          <Button
            variant="ghost"
            size="xs"
            className="nb-tip nb-tip-below nb-tip-narrow shrink-0"
            aria-label={c.chat.label}
            data-tip={c.chat.label}
            aria-pressed={chatOpen}
            style={chatOpen ? { background: "var(--color-nb-accent-soft)" } : undefined}
          >
            <LuMessagesSquare className="text-[14px]" aria-hidden />
            <span>{c.chat.label}</span>
          </Button>
        )}
        <Button
          size="xs"
          data-demo="new-idea"
          className="nb-tip nb-tip-below nb-tip-end shrink-0"
          data-tip={c.chrome.header.newIdea}
        >
          <LuLightbulb className="text-[15px]" aria-hidden />
          <span>{c.board.create.button}</span>
          <kbd
            className="ml-0.5 hidden h-[17px] min-w-[17px] items-center justify-center rounded-[5px] bg-white/20 px-1 font-sans text-[10.5px] font-[800] leading-none md:inline-flex"
            aria-hidden
          >
            N
          </kbd>
        </Button>
      </div>
    </header>
  );
}

const ROW = "flex h-[30px] w-full items-center gap-2 rounded-[8px] pl-2.5 text-left text-[12.5px]";
const ROW_ON = "bg-nb-paper font-[700] shadow-[inset_0_0_0_1.5px_var(--color-nb-ink)]";
const ROW_OFF = "font-[600] text-nb-ink-soft hover:bg-[color-mix(in_srgb,var(--color-nb-ink)_6%,transparent)]";

function Rail({ activeId, archive, total, chats }: {
  activeId: number | null;
  /** The archive is showing: its row is marked, All cards is not. */
  archive: boolean;
  total: number;
  chats: RailChat[];
}) {
  const c = useCopy().rail;
  const label = "text-[10px] font-[800] uppercase tracking-[0.12em] text-nb-ink-soft";
  return (
    <div className="flex h-full flex-col py-2 pl-3 pr-1">
      <div className="relative mb-1.5 shrink-0">
        <FiSearch size={13} aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-nb-ink-soft" />
        <input
          type="text"
          readOnly
          placeholder={c.search}
          aria-label={c.search}
          className="nb-field h-[30px] w-full rounded-[8px] bg-nb-paper pl-[30px] pr-2 text-[12.5px] font-[600] text-nb-ink shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--color-nb-ink)_18%,transparent)] placeholder:font-[600] placeholder:text-nb-ink-soft/70"
        />
      </div>
      <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">
        <span className={`${ROW} pr-2 ${activeId === null && !archive ? ROW_ON : ROW_OFF}`}>
          <FiColumns size={13} className="shrink-0" aria-hidden />
          <span className="truncate">{c.allCards}</span>
          <span className="ml-auto shrink-0 font-mono text-[11px] tabular-nums text-nb-ink-soft">{total}</span>
        </span>
        <div className="mb-1 mt-2.5 flex items-center justify-between px-2.5 pb-1.5 pt-2.5" style={{ borderTop: `1px solid ${HAIRLINE}` }}>
          <span className={label}>{c.discussions.heading}</span>
          <span className="font-mono text-[10.5px] tabular-nums text-nb-ink-soft opacity-70">{chats.length}</span>
        </div>
        {chats.map((row) => {
          const on = row.cardId !== undefined && row.cardId === activeId;
          return (
            <span key={row.name} title={row.name} className={`${ROW} pr-7 ${on ? ROW_ON : ROW_OFF}`}>
              {row.cardId === undefined ? (
                <LuMessagesSquare size={13} className="shrink-0" aria-hidden />
              ) : (
                <span
                  className="shrink-0 font-mono text-[11px] tabular-nums"
                  style={{ color: on ? "var(--color-nb-accent)" : "inherit", opacity: on ? 1 : 0.6 }}
                >
                  {row.cardId}
                </span>
              )}
              <span className="truncate">{row.name}</span>
              {row.answering && <span className={`ml-auto ${PULSE_DOT}`} aria-hidden />}
            </span>
          );
        })}
      </nav>
      <span className={`${ROW} mt-0.5 shrink-0 pr-2 ${archive ? ROW_ON : ROW_OFF}`}>
        <FiArchive size={13} className="shrink-0" aria-hidden />
        <span className="truncate">{c.archive.row}</span>
      </span>
      <span
        className="mt-2.5 flex w-full shrink-0 items-center justify-between px-2.5 pb-1.5 pt-2.5 text-nb-ink-soft"
        style={{ borderTop: `1px solid ${HAIRLINE}` }}
      >
        <span className="text-[10px] font-[800] uppercase tracking-[0.12em]">{c.memory.heading}</span>
        <FiChevronRight size={13} aria-hidden />
      </span>
    </div>
  );
}

/** The rail and the chat at their resting widths, the body between them on the window's
 *  paper. The body is the slot a sheet over the board is drawn into. */
export function Window({
  projectRoot,
  running,
  unread = 0,
  currentId = null,
  archive = false,
  total,
  chats,
  chat,
  children,
}: {
  projectRoot: string;
  running: number;
  unread?: number;
  currentId?: number | null;
  archive?: boolean;
  total: number;
  chats: RailChat[];
  chat?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [body, setBody] = useState<HTMLElement | null>(null);
  return (
    <div className="relative flex h-[100dvh] flex-col overflow-hidden bg-nb-cream">
      <TrafficLights />
      <Header projectRoot={projectRoot} running={running} unread={unread} card={currentId !== null} chatOpen={!!chat} />
      <div className="flex min-h-0 flex-1">
        <div className="w-[216px] shrink-0 overflow-hidden">
          <Rail activeId={currentId} archive={archive} total={total} chats={chats} />
        </div>
        <div className="w-1 shrink-0" />
        <div className={`min-w-0 flex-1 overflow-hidden pl-1 ${chat ? "pr-1" : ""}`}>
          <div
            ref={setBody}
            data-demo-body
            className={`relative h-full overflow-hidden rounded-tl-[14px] bg-nb-paper ${chat ? "rounded-tr-[14px]" : ""}`}
          >
            <BodySlotProvider value={body}>{children}</BodySlotProvider>
          </div>
        </div>
        {chat && (
          <>
            <div className="w-1 shrink-0" />
            <div className="w-[420px] shrink-0 overflow-hidden">{chat}</div>
          </>
        )}
      </div>
    </div>
  );
}
