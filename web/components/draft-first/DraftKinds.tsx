import { CDN } from "@/lib/site";
import { Chip, DOC, DraftHead, OUT1, PROMPT, SettingsDraft, UI, type Lang } from "./review-parts";

// Section 2's four thumbnails: one draft of each kind as the review page shows it, drawn at 400×300.
export const KIND_W = 400;
export const KIND_H = 300;

// Three of the blog's own covers stand in as the image options.
const COVERS = [
  `${CDN}/draft-first-development/cover-v3.webp`,
  `${CDN}/stop-watching-your-coding-agent/cover.webp`,
  `${CDN}/why-we-built-a-pm-harness/cover.webp`,
];

const TEXT = {
  zh: {
    screens: "设置页长什么样",
    prompt: "生成 commit message 的 Prompt",
    input: "输入",
    output: "输出",
    copy: "首页标题",
    copyH: ["先看草稿，再往下做", "动手之前，先确认草稿"],
    copyB: "编码 agent 先出界面、Prompt 和文案的草稿。你看过、改好、确认，它再照着做。",
    images: "博客封面",
  },
  en: {
    screens: "How the settings page looks",
    prompt: "The prompt that writes the message",
    input: "Input",
    output: "Output",
    copy: "Home page headline",
    copyH: ["See the draft. Then build.", "Confirm the draft before the build"],
    copyB: "Your coding agent drafts the screens, prompts and copy. You review and revise them; then it builds from the version you confirm.",
    images: "Blog cover",
  },
};

function Sheet({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden bg-nb-paper p-3 text-nb-ink" style={{ width: KIND_W, height: KIND_H }}>
      <section className="nb-section h-full overflow-hidden bg-nb-sheet px-3.5 py-3">
        <h2 className="text-[15px] font-[800]">{title}</h2>
        <div className="mt-2">{children}</div>
      </section>
    </div>
  );
}

function Screens({ lang }: { lang: Lang }) {
  return (
    <Sheet title={TEXT[lang].screens}>
      <DraftHead label={DOC[lang].a} src="settings-form.tsx" tools={false} ui={UI[lang]} />
      <div style={{ zoom: 0.52 }}>
        <SettingsDraft lang={lang} />
      </div>
    </Sheet>
  );
}

const box = "rounded-[8px] bg-nb-wash p-2.5 font-mono text-[10.5px] leading-[16px]";

function Prompt({ lang }: { lang: Lang }) {
  const t = TEXT[lang];
  return (
    <Sheet title={t.prompt}>
      <pre className={`${box} whitespace-pre-wrap`}>{PROMPT}</pre>
      <div className="mt-2 text-[11.5px] text-nb-ink-soft">
        <span className="font-[700] text-nb-ink">{t.input}</span> · {DOC[lang].in1}
      </div>
      <div className="mt-1.5 text-[11.5px] font-[700]">{t.output}</div>
      <pre className={`${box} mt-1`}>{OUT1}</pre>
    </Sheet>
  );
}

function Copy({ lang }: { lang: Lang }) {
  const t = TEXT[lang];
  return (
    <Sheet title={t.copy}>
      {t.copyH.map((h, i) => (
        <div key={h} className="mt-2 rounded-[8px] bg-nb-paper px-3 py-2.5">
          <Chip>{i ? "B" : "A"}</Chip>
          <div className="mt-1.5 text-[17px] font-[800] leading-tight tracking-[-0.01em]">{h}</div>
          {!i && <p className="mt-1 text-[11.5px] leading-[17px] text-nb-ink-soft">{t.copyB}</p>}
        </div>
      ))}
    </Sheet>
  );
}

function Images({ lang }: { lang: Lang }) {
  const [a, b, c] = COVERS;
  const cover = (src: string, label: string) => (
    <div>
      {/* eslint-disable-next-line @next/next/no-img-element -- a thumbnail inside a drawing */}
      <img
        src={src}
        alt=""
        loading="lazy"
        className="block w-full rounded-[6px] border border-[color-mix(in_srgb,var(--color-nb-ink)_10%,transparent)] object-cover"
        style={{ aspectRatio: "16 / 10" }}
      />
      <div className="mt-1">
        <Chip>{label}</Chip>
      </div>
    </div>
  );
  return (
    <Sheet title={TEXT[lang].images}>
      <div className="mt-1 grid items-start gap-2.5" style={{ gridTemplateColumns: "2fr 1fr" }}>
        {cover(a, "A")}
        <div className="grid gap-1.5">
          {cover(b, "B")}
          {cover(c, "C")}
        </div>
      </div>
    </Sheet>
  );
}

export const KINDS = [Screens, Prompt, Copy, Images];
