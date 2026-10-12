import { FiCheck, FiCheckCircle, FiClock, FiCornerDownRight, FiFileText, FiFlag, FiPlus } from "react-icons/fi";
import { Chip, type Lang } from "./review-parts";

// Section 5's three figures: the AI4Kanban desktop app, one moment each, drawn at 400×250.
// Cards, chips and buttons follow kanban-ui's board.
export const BOARD_W = 400;
export const BOARD_H = 250;

const TEXT = {
  zh: {
    module: "site",
    page: "已定决定",
    path: "docs/kanban/memory/site/decisions.md",
    side: ["已发布", "已定决定", "设计失误"],
    notes: ["讲流程时用真实界面小图并排，不加步骤条。", "页面底色用中性灰白，避开米黄。", "中文标题不加标点。", "按钮文字用动词开头。"],
    added: "刚记下",
    cols: ["待办", "进行中", "已完成"],
    running: "运行中",
    waiting: "等 #41",
    cards: ["设置页改版", "commit Prompt", "补测试", "接入新模型", "导出 HTML", "落地页"],
    title: "设置页改版",
    done: "已完成",
    follow: "跟进项",
    items: ["同步设置页的英文文案", "模型列表标出默认项", "补上空模型列表的测试"],
    create: "新建",
  },
  en: {
    module: "site",
    page: "Settled decisions",
    path: "docs/kanban/memory/site/decisions.md",
    side: ["Shipped", "Decisions", "Mistakes"],
    notes: ["Show a flow as real screens side by side, with no step bar.", "Keep page grounds neutral; no yellowish tones.", "Headlines carry no trailing period.", "Buttons start with a verb."],
    added: "Just noted",
    cols: ["Todo", "Doing", "Done"],
    running: "Running",
    waiting: "Waits for #41",
    cards: ["Settings redesign", "Commit prompt", "Add tests", "New model", "HTML export", "Landing page"],
    title: "Settings redesign",
    done: "Done",
    follow: "Follow-ups",
    items: ["Sync the settings page's Chinese copy", "Mark the default model in the list", "Test an empty model list"],
    create: "Create",
  },
};

const INK = "border-[1.5px] border-nb-ink";
const LIFT = "shadow-[2px_2px_0_0_var(--color-nb-ink)]";

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden bg-nb-cream text-nb-ink" style={{ width: BOARD_W, height: BOARD_H }}>
      {children}
    </div>
  );
}

function Id({ n }: { n: number }) {
  return <span className="font-mono text-[10.5px] font-[700] text-nb-accent">#{n}</span>;
}

function Memory({ lang }: { lang: Lang }) {
  const t = TEXT[lang];
  return (
    <div className="flex h-full">
      <aside className="w-[104px] shrink-0 border-r border-[color-mix(in_srgb,var(--color-nb-ink)_10%,transparent)] px-2.5 py-3">
        <div className="font-mono text-[8.5px] font-[700] uppercase tracking-[0.14em] text-nb-ink-soft">{t.module}</div>
        <ul className="mt-1.5 flex flex-col gap-0.5 text-[10px]">
          {t.side.map((s, i) => (
            <li key={s} className={`flex items-center gap-1.5 rounded-[6px] px-1.5 py-1 ${i === 1 ? `${INK} bg-nb-paper font-[700]` : "text-nb-ink-soft"}`}>
              <FiFileText className="h-2.5 w-2.5 shrink-0" />
              <span className="truncate">{s}</span>
            </li>
          ))}
        </ul>
      </aside>
      <div className="min-w-0 flex-1 px-3.5 pt-3">
        <div className="text-[14px] font-[800] leading-tight">{t.page}</div>
        <div className="mt-0.5 truncate font-mono text-[8.5px] text-nb-ink-soft">{t.path}</div>
        <div className={`mt-2.5 rounded-[10px] bg-nb-paper px-3 py-2.5 ${INK} ${LIFT}`}>
          <ul className="flex flex-col gap-1.5 text-[11px] leading-[15px]">
            {t.notes.map((n, i) => (
              <li key={n} className={`flex gap-1.5 ${i ? "" : "-mx-1.5 rounded-[6px] bg-nb-accent-wash px-1.5 py-1"}`}>
                <span className="mt-[6px] h-1 w-1 shrink-0 rounded-full bg-nb-ink" />
                <span>
                  {n}
                  {!i && (
                    <span className="ml-1.5 align-[1px]">
                      <Chip>{t.added}</Chip>
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function BoardCard({ id, title, children }: { id: number; title: string; children?: React.ReactNode }) {
  return (
    <div className={`rounded-[8px] bg-nb-paper px-2 py-1.5 ${INK} ${LIFT}`}>
      <div className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 shrink-0 rounded-[3px] border-[1.5px] border-nb-ink" />
        <Id n={id} />
      </div>
      <div className="mt-0.5 text-[11px] font-[700] leading-[14px]">{title}</div>
      {children && <div className="mt-1 flex items-center gap-1">{children}</div>}
    </div>
  );
}

function Parallel({ lang }: { lang: Lang }) {
  const t = TEXT[lang];
  const dots = ["var(--color-nb-sky)", "var(--color-nb-accent)", "var(--color-nb-mint)"];
  const cols: [number, number][][] = [[[45, 3]], [[41, 0], [43, 1], [44, 2]], [[39, 4], [40, 5]]];
  return (
    <div className="grid h-full grid-cols-3 gap-2.5 px-3 pt-3">
      {cols.map((cards, c) => (
        <div key={c}>
          <div className="flex items-center gap-1.5 px-0.5 font-mono text-[9px] font-[700] uppercase tracking-[0.12em] text-nb-ink-soft">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: dots[c] }} />
            {t.cols[c]}
            <span className="ml-auto">{cards.length}</span>
          </div>
          <div className="mt-2 flex flex-col gap-2">
            {cards.map(([id, k]) => (
              <BoardCard key={id} id={id} title={t.cards[k]}>
                {c === 0 && (
                  <span className="flex items-center gap-1 text-[9.5px] font-[600] text-nb-ink-soft">
                    <FiClock className="h-2.5 w-2.5" />
                    {t.waiting}
                  </span>
                )}
                {c === 1 && (
                  <Chip tone="mint">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-nb-mint-ink" />
                    {t.running}
                  </Chip>
                )}
                {c === 2 && (
                  <Chip tone="mint">
                    <FiCheck className="h-2.5 w-2.5" />
                    {t.done}
                  </Chip>
                )}
              </BoardCard>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function FollowUps({ lang }: { lang: Lang }) {
  const t = TEXT[lang];
  return (
    <div className="h-full px-3.5 pt-3.5">
      <div className="flex items-center gap-2">
        <Id n={42} />
        <Chip tone="mint">
          <FiCheckCircle className="h-2.5 w-2.5" />
          {t.done}
        </Chip>
        <span className="ml-auto flex items-center gap-1 text-[9.5px] font-[700] text-nb-ink-soft">
          <FiFlag className="h-2.5 w-2.5" />
          MED
        </span>
      </div>
      <div className="mt-1 text-[16px] font-[800] leading-tight">{t.title}</div>
      <div className={`mt-3 rounded-[10px] bg-nb-paper px-3 py-2.5 ${INK} ${LIFT}`}>
        <div className="text-[11.5px] font-[800]">{t.follow}</div>
        <ul className="mt-1.5 flex flex-col">
          {t.items.map((it, i) => (
            <li key={it} className={`flex items-center gap-2 py-1.5 text-[11px] ${i ? "border-t border-[color-mix(in_srgb,var(--color-nb-ink)_10%,transparent)]" : ""}`}>
              <FiCornerDownRight className="h-3 w-3 shrink-0 text-nb-accent" />
              <span className="min-w-0 flex-1">{it}</span>
              <span className={`flex shrink-0 items-center gap-1 rounded-[6px] bg-nb-paper px-1.5 py-0.5 text-[10px] font-[800] ${INK} shadow-[1.5px_1.5px_0_0_var(--color-nb-ink)]`}>
                <FiPlus className="h-2.5 w-2.5" />
                {t.create}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

const MOMENTS = [Memory, Parallel, FollowUps];

export function BoardMoment({ kind, lang }: { kind: number; lang: Lang }) {
  const Moment = MOMENTS[kind];
  return (
    <Frame>
      <Moment lang={lang} />
    </Frame>
  );
}
