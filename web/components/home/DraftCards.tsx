import type { CSSProperties, ReactNode } from "react";
import Image from "next/image";
import { FiCheck, FiChevronRight, FiCopy, FiMaximize2, FiZoomIn, FiZoomOut } from "react-icons/fi";
import { CROP, Chip, HAIR, MONO, NB, SANS, Shot, em } from "../shots/nb";

// 01's four drafts, each the open agent section of a real card page
// (CardBody.tsx's `AgentSection`): the UI designer's mockup from /demo, the copy
// draft of #1050, a storyboard from #1694's script and the figures of #1684.
// Only English and Chinese are drawn; every other locale shows English.

export type Lang = "zh" | "en";

const SERIF = "Georgia, 'Times New Roman', serif";

function AgentHead({ agent, name }: { agent: string; name: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: em(8),
        padding: `${em(12)} ${em(20)} ${em(8)}`,
      }}
    >
      <FiChevronRight aria-hidden style={{ width: em(13), height: em(13), color: NB.inkSoft, transform: "rotate(90deg)" }} />
      <Image
        src={`/agent-art/${agent}.png`}
        alt=""
        width={44}
        height={44}
        style={{ width: em(22), height: em(22), imageRendering: "pixelated" }}
      />
      <span style={{ fontSize: em(13.5), fontWeight: 700 }}>{name}</span>
    </div>
  );
}

function Body({ children }: { children: ReactNode }) {
  return <div style={{ padding: `${em(4)} ${em(20)} ${em(20)}` }}>{children}</div>;
}

/** The row over an `<Asset>`: its label, then zoom, Code, copy and full screen. */
function AssetHead({ label }: { label: string }) {
  const icon: CSSProperties = { width: em(12), height: em(12) };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: em(10), height: em(28), color: NB.inkSoft }}>
      <Chip bg={NB.accentSoft} ink={NB.accentDeep}>{label}</Chip>
      <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: em(10) }}>
        <FiZoomOut aria-hidden style={icon} />
        <span style={{ fontSize: em(11), fontWeight: 600 }}>100%</span>
        <FiZoomIn aria-hidden style={icon} />
        <span style={{ fontSize: em(11), fontWeight: 600, marginLeft: em(4) }}>Code</span>
        <FiCopy aria-hidden style={icon} />
        <FiMaximize2 aria-hidden style={icon} />
      </span>
    </div>
  );
}

/** A `###` heading of an agent section, open. */
function Sub({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: em(8), padding: `${em(6)} 0` }}>
      <FiChevronRight aria-hidden style={{ width: em(13), height: em(13), color: NB.inkSoft, transform: "rotate(90deg)" }} />
      <span style={{ fontSize: em(15), fontWeight: 700, display: "flex", alignItems: "center", gap: em(6) }}>{children}</span>
    </div>
  );
}

// ——— UI designer: Notely's Sync settings, as /demo's #39 leaves it ———

const KEY = ["orbit", "maple", "lantern", "quartz", "harbor", "velvet", "ember", "cobalt", "meadow", "falcon", "pebble", "summit"];
const BLUE = "#2f6fed";
const LINE = "#e6e7eb";

/** Notely's screen at its own pixel sizes; the wrapper scales it into the frame. */
function Notely() {
  const soft = "#6b7080";
  return (
    <div style={{ display: "flex", fontSize: "0.72em", background: "#fff", color: "#1d1f24", height: em(470) }}>
      <div style={{ width: em(170), padding: `${em(22)} ${em(12)}`, background: "#f6f6f4", borderRight: `1px solid ${LINE}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: em(8), marginBottom: em(20), padding: `0 ${em(10)}`, fontSize: em(17), fontWeight: 800 }}>
          <span style={{ display: "grid", placeItems: "center", width: em(28, 17), height: em(28, 17), borderRadius: em(8, 17), background: BLUE, color: "#fff", fontSize: em(14, 17) }}>N</span>
          Notely
        </div>
        {["General", "Editor", "Sync", "Account"].map((n) => (
          <div
            key={n}
            style={{
              padding: `${em(7)} ${em(10)}`,
              borderRadius: em(8),
              fontSize: em(15),
              ...(n === "Sync" ? { background: "#e4ebfd", color: BLUE, fontWeight: 700 } : {}),
            }}
          >
            {n}
          </div>
        ))}
      </div>
      <div style={{ flex: 1, minWidth: 0, padding: `${em(22)} ${em(32)}` }}>
        <div style={{ fontSize: em(28), fontWeight: 800, letterSpacing: "-0.02em" }}>Sync</div>
        <div style={{ display: "flex", alignItems: "center", gap: em(20), marginTop: em(12), padding: `${em(12)} ${em(18)}`, border: `1px solid ${LINE}`, borderRadius: em(12) }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: em(16), fontWeight: 700 }}>Sync across devices</div>
            <div style={{ fontSize: em(14), color: soft }}>Keep every note the same on every device.</div>
          </div>
          <span style={{ position: "relative", width: em(44), height: em(25), borderRadius: em(999), background: BLUE }}>
            <span style={{ position: "absolute", right: em(3), top: em(3), width: em(19), height: em(19), borderRadius: em(999), background: "#fff" }} />
          </span>
        </div>
        <div style={{ marginTop: em(18), fontSize: em(18), fontWeight: 800 }}>Encryption</div>
        <div style={{ marginTop: em(4), fontSize: em(15), color: soft }}>Save this recovery key. It’s the only way to open your notes on a new device.</div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: `${em(9)} ${em(14)}`,
            marginTop: em(12),
            padding: `${em(14)} ${em(18)}`,
            border: "1.5px solid #cdd9fb",
            borderRadius: em(12),
            background: "#eef3ff",
            fontFamily: MONO,
            fontSize: em(15),
          }}
        >
          {KEY.map((w, i) => (
            <span key={w} style={{ display: "flex", gap: em(6) }}>
              <i style={{ fontStyle: "normal", color: "#8b93a7" }}>{i + 1}</i>
              {w}
            </span>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: em(10), marginTop: em(14) }}>
          {["Download key", "Copy"].map((b) => (
            <span key={b} style={{ padding: `${em(8)} ${em(14)}`, border: `1.5px solid ${LINE}`, borderRadius: em(10), fontSize: em(14), fontWeight: 600 }}>
              {b}
            </span>
          ))}
          <span style={{ marginLeft: "auto", padding: `${em(9)} ${em(18)}`, borderRadius: em(10), background: BLUE, color: "#fff", fontSize: em(15), fontWeight: 700 }}>
            Turn on sync
          </span>
        </div>
      </div>
    </div>
  );
}

const UI = {
  en: { name: "UI designer", label: "Sync settings" },
  zh: { name: "界面设计师", label: "同步设置" },
};

export function DraftUi({ locale }: { locale: Lang }) {
  const t = UI[locale];
  return (
    <Shot crop={CROP}>
      <AgentHead agent="ui-designer" name={t.name} />
      <Body>
        <AssetHead label={t.label} />
        <div style={{ marginTop: em(4), borderRadius: em(6), overflow: "hidden", boxShadow: `0 0 0 1px ${HAIR}` }}>
          <Notely />
        </div>
      </Body>
    </Shot>
  );
}

// ——— Copy & docs: #1050's page copy ———

const COPY = {
  en: {
    name: "Copy & docs",
    page: "Product video page",
    lang: "English",
    lines: [
      ["Hero title", "A product video, from one card."],
      ["Hero lead", "Describe the video you need. Your agents write the script; once you approve it, they produce and check the film."],
    ],
    points: [
      ["Script first.", "The script sets the audience, the one claim and the story in viewing order, with every spoken line written out."],
      ["One approval before production.", "You approve the script once. Nothing is recorded or rendered before that."],
      ["Your real product, when it helps.", "A live demo is recorded in the running app when it makes the point better than a screenshot. Nothing on screen is mocked up."],
      ["A checked film, not a draft.", "The editor watches and listens to the render — facts, pacing, sound — and fixes what it finds."],
    ],
  },
  zh: {
    name: "文案与文档",
    page: "产品视频页",
    lang: "简体中文",
    lines: [
      ["主标题", "一张卡片，一支产品视频。"],
      ["导语", "说出你需要什么样的视频。Agent 先写脚本，你确认后再制作并检查成片。满意就归档卡片。"],
    ],
    points: [
      ["先有脚本。", "脚本写明受众、核心主张和观看顺序，每句旁白和屏幕文字都逐字写出。"],
      ["制作前只确认一次。", "你只需确认一次脚本，确认前不录制、不渲染；脚本改动后会再请你确认。"],
      ["需要时才展示真实产品。", "介绍、演示或两者结合。真实操作比截图、动画更能说明问题时，才在运行中的产品里录制，画面不做假界面。"],
      ["交付检查过的成片。", "剪辑会完整看一遍、听一遍，检查事实、可读性、节奏、声音和隐私信息，修好后再交给你。"],
      ["满意就归档，不满意就修订。", "成片直接在卡片里播放。满意就归档；需要修改时可改脚本，也可只改成片。"],
    ],
  },
};

export function DraftCopy({ locale }: { locale: Lang }) {
  const t = COPY[locale];
  const dash = locale === "zh" ? "——" : " — ";
  const li: CSSProperties = { display: "flex", gap: em(10), fontSize: em(13.5), lineHeight: 1.55, marginTop: em(7) };
  const dot = <span style={{ flex: "0 0 auto", marginTop: em(8), width: em(5), height: em(5), borderRadius: em(9), background: NB.ink }} />;
  return (
    <Shot crop={CROP}>
      <AgentHead agent="copywriting" name={t.name} />
      <Body>
        <Sub>
          {t.page}
          <code style={{ fontFamily: MONO, fontSize: em(12, 15), fontWeight: 500, padding: `${em(1, 15)} ${em(6, 15)}`, borderRadius: em(5, 15), background: NB.wash, border: `1px solid ${HAIR}` }}>
            /workflows/product-video
          </code>
        </Sub>
        <div style={{ paddingLeft: em(21) }}>
          <div style={{ marginTop: em(4), fontSize: em(14), fontWeight: 700 }}>{t.lang}</div>
          {t.lines.map(([k, v]) => (
            <div key={k} style={li}>
              {dot}
              <span>
                <span style={{ color: NB.inkSoft }}>{k}{locale === "zh" ? "：" : ": "}</span>
                {v}
              </span>
            </div>
          ))}
          {t.points.map(([k, v]) => (
            <div key={k} style={li}>
              {dot}
              <span>
                <b>{k}</b>
                {dash}
                {v}
              </span>
            </div>
          ))}
        </div>
      </Body>
    </Shot>
  );
}

// ——— Scriptwriter: a storyboard of #1694's script (Storyboard.tsx) ———

const SHOTS = [10, 16, 16, 14, 14, 10, 10];
const BEIGE = "#f5ede1";

/** A sketch frame of the opening shot: one person, more cards than they can keep up with. */
function OpeningFrame() {
  return (
    <div style={{ position: "relative", aspectRatio: "16 / 9", borderRadius: em(6), overflow: "hidden", background: BEIGE }}>
      <div style={{ position: "absolute", insetInline: 0, top: "9%", textAlign: "center", fontSize: em(12.5), fontWeight: 800, letterSpacing: "-0.01em" }}>
        Agents work fast.
        <br />
        Can you keep up?
      </div>
      <svg viewBox="0 0 160 90" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} aria-hidden>
        <g fill={NB.paper} stroke={NB.ink} strokeWidth="0.8">
          {[0, 1, 2, 3, 4].map((i) => (
            <g key={i}>
              <rect x={58 + i * 18} y={52 - (i % 2) * 4} width="14" height="20" rx="2" />
              <circle cx={65 + i * 18} cy={47 - (i % 2) * 4} r="3" fill={i === 4 ? NB.accent : NB.ink} stroke="none" />
            </g>
          ))}
        </g>
        <g stroke={NB.ink} strokeWidth="1.2" strokeLinecap="round" fill="none">
          <circle cx="32" cy="50" r="5" fill={NB.paper} />
          <path d="M32 55 L32 68 M32 59 L25 54 M32 59 L39 63 M32 68 L27 77 M32 68 L37 77" />
        </g>
        <path d="M44 42 q4 -3 8 0" stroke={NB.accent} strokeWidth="1" fill="none" />
      </svg>
    </div>
  );
}

/** A timeline thumbnail: the frame's big line and its picture, sketched. */
function Thumb({ k, current }: { k: number; current: boolean }) {
  const tones = [NB.peach, NB.accent, NB.lilac, NB.sky, NB.mint, NB.peach, NB.accent];
  return (
    <div
      style={{
        position: "relative",
        aspectRatio: "16 / 9",
        borderRadius: em(4),
        background: BEIGE,
        outline: current ? `1px solid ${NB.accentDeep}` : undefined,
        outlineOffset: em(1),
        overflow: "hidden",
      }}
    >
      <span style={{ position: "absolute", left: "20%", right: "20%", top: "16%", height: "11%", borderRadius: em(9), background: NB.ink }} />
      <span style={{ position: "absolute", left: "30%", width: "40%", top: "45%", height: "38%", borderRadius: em(3), background: tones[k] }} />
    </div>
  );
}

const SCRIPT = {
  en: {
    name: "Scriptwriter",
    heading: "Storyboard",
    summary: "7 shots · 90s",
    sketch: "Sketch · Not final footage",
    voiceover: "Voiceover",
    vo: "Your agents can work on many things at once. The hard part is keeping up with all of them.",
    source: "Hosted TTS · Sulafat",
    action: "Action",
    act: "A person faces a row of cards. Several agents start at once and the cards keep piling up.",
    details: "Production details",
  },
  zh: {
    name: "脚本作者",
    heading: "静态分镜",
    summary: "7 镜 · 90 秒",
    sketch: "示意 · 非成片画面",
    voiceover: "旁白",
    vo: "agent 可以同时做很多事，难的是你跟不上它们。",
    source: "托管 TTS · Sulafat",
    action: "动作",
    act: "一个小人面前排着一列卡片，几个 agent 同时开工，卡片越来越多。",
    details: "制作说明",
  },
};

export function DraftScript({ locale }: { locale: Lang }) {
  const t = SCRIPT[locale];
  const lab: CSSProperties = { fontWeight: 700, marginBottom: em(3) };
  return (
    <Shot crop={CROP}>
      <AgentHead agent="scriptwriter" name={t.name} />
      <Body>
        <div style={{ fontSize: em(13), lineHeight: 1.5 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: em(10), marginTop: em(4), marginBottom: em(10) }}>
            <span style={{ fontSize: em(15, 13), fontWeight: 700 }}>{t.heading}</span>
            <span style={{ color: NB.inkSoft }}>{t.summary}</span>
            <span style={{ marginLeft: "auto", fontSize: em(11, 13), color: NB.inkSoft }}>{t.sketch}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: em(7, 13) }}>
            {SHOTS.map((s, k) => (
              <div key={k}>
                <Thumb k={k} current={k === 0} />
                <div style={{ display: "flex", justifyContent: "space-between", padding: `${em(3, 11)} ${em(3, 11)} 0`, fontSize: em(11, 13) }}>
                  <b>{k + 1}</b>
                  <span style={{ color: NB.inkSoft }}>{s}s</span>
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: em(16, 13), marginBottom: em(7, 13), fontWeight: 700, color: NB.accentDeep }}>S1 · 0–10s</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: em(18, 13), alignItems: "start" }}>
            <OpeningFrame />
            <div style={{ display: "flex", flexDirection: "column", gap: em(10, 13) }}>
              <div>
                <div style={lab}>{t.voiceover}</div>
                <div>{t.vo}</div>
                <div style={{ marginTop: em(2, 13), fontSize: em(12, 13), color: NB.inkSoft }}>{t.source}</div>
              </div>
              <div>
                <div style={lab}>{t.action}</div>
                <div>{t.act}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: em(4, 13), fontWeight: 600, color: NB.inkSoft }}>
                <FiChevronRight aria-hidden style={{ width: em(13, 13), height: em(13, 13) }} />
                {t.details}
              </div>
            </div>
          </div>
        </div>
      </Body>
    </Shot>
  );
}

// ——— Illustrator: #1684's README figures ———

function Box({ checked, children }: { checked: boolean; children: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: em(9), marginTop: em(6), fontSize: em(13.5) }}>
      <span
        style={{
          display: "grid",
          placeItems: "center",
          width: em(16),
          height: em(16),
          borderRadius: em(4),
          border: `1.5px solid ${checked ? NB.ink : NB.inkSoft}`,
          background: checked ? NB.ink : NB.paper,
          color: NB.paper,
        }}
      >
        {checked && <FiCheck aria-hidden style={{ width: em(11), height: em(11) }} />}
      </span>
      <span>{children}</span>
    </div>
  );
}

/** One of the four white cards in #1684's "Draft the key parts first" figure. */
function Tile({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ background: NB.paper, borderRadius: em(8), padding: em(7), boxShadow: "0 3px 9px -4px rgba(36,35,31,0.4)" }}>
      <div style={{ background: NB.sheet, borderRadius: em(7), padding: `${em(9)} ${em(10)}`, height: "100%", boxSizing: "border-box" }}>
        <div style={{ fontSize: em(11.5), fontWeight: 750, letterSpacing: "-0.01em" }}>{title}</div>
        <div style={{ marginTop: em(7) }}>{children}</div>
      </div>
    </div>
  );
}

function Field({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: em(6), marginTop: em(4), fontSize: em(8.5) }}>
      <span style={{ flex: "0 0 auto", width: em(54, 8.5), color: NB.inkSoft }}>{k}</span>
      <span style={{ flex: 1, padding: `${em(2.5)} ${em(5)}`, border: `1px solid #d7d8dc`, borderRadius: em(3) }}>{v}</span>
    </div>
  );
}

const ILL = {
  en: { name: "Illustrator", todos: ["The user approved the images", "The render was checked"], label: "Draft the key parts first" },
  zh: { name: "产品配图", todos: ["用户确认了配图", "检查了渲染结果"], label: "先起草关键部分" },
};

export function DraftIll({ locale }: { locale: Lang }) {
  const t = ILL[locale];
  return (
    <Shot crop={CROP}>
      <AgentHead agent="illustrator" name={t.name} />
      <Body>
        <Box checked>{t.todos[0]}</Box>
        <Box checked={false}>{t.todos[1]}</Box>
        <div style={{ marginTop: em(12) }}>
          <AssetHead label={t.label} />
        </div>
        <div style={{ marginTop: em(4), display: "grid", gridTemplateColumns: "1fr 1fr", gap: em(12), padding: em(12), background: NB.wash, borderRadius: em(6) }}>
          <Tile title="How the settings page looks">
            <div style={{ display: "flex", alignItems: "center", gap: em(6) }}>
              <Chip bg={NB.accentSoft} ink={NB.accentDeep}>A: One-page form</Chip>
              <span style={{ fontFamily: MONO, fontSize: em(8.5), color: NB.inkSoft }}>settings-form.tsx</span>
            </div>
            <div style={{ marginTop: em(7), background: NB.paper, borderRadius: em(4), padding: `${em(7)} ${em(9)}`, boxShadow: `0 0 0 1px ${HAIR}`, fontFamily: SANS }}>
              <div style={{ fontSize: em(9.5), fontWeight: 700 }}>Commit message</div>
              <Field k="Model" v="claude-sonnet-5-5" />
              <Field k="Language" v="System" />
              <div style={{ textAlign: "right", marginTop: em(6) }}>
                <span style={{ padding: `${em(2.5)} ${em(8)}`, borderRadius: em(3), background: BLUE, color: "#fff", fontSize: em(8.5), fontWeight: 700 }}>Save</span>
              </div>
            </div>
          </Tile>
          <Tile title="The prompt that writes the message">
            <div style={{ background: NB.wash, borderRadius: em(5), padding: `${em(7)} ${em(8)}`, fontFamily: MONO, fontSize: em(8.5), lineHeight: 1.5 }}>
              You write one git commit message for the staged diff below.
              <br />- Subject: imperative mood, at most 50 characters.
              <br />Return the message only.
            </div>
            <div style={{ marginTop: em(6), fontSize: em(9.5) }}>
              <b>Input</b> <span style={{ color: NB.inkSoft }}>· Add a --dry-run flag to parseArgs</span>
            </div>
          </Tile>
          <Tile title="Home page headline">
            <div style={{ background: NB.paper, borderRadius: em(5), padding: em(8) }}>
              <Chip bg={NB.accentSoft} ink={NB.accentDeep}>A</Chip>
              <div style={{ marginTop: em(5), fontSize: em(13), fontWeight: 800, letterSpacing: "-0.02em" }}>See the draft. Then build.</div>
            </div>
          </Tile>
          <Tile title="Blog cover">
            <div style={{ background: NB.sheet, border: `1px solid ${HAIR}`, borderRadius: em(5), padding: em(8), fontFamily: SERIF, fontSize: em(14), lineHeight: 1.1 }}>
              Rework the drafts, not the code.
            </div>
          </Tile>
        </div>
      </Body>
    </Shot>
  );
}
