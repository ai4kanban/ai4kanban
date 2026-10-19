// README figure: the six built-in workflow teams (cli/src/lib/agent/workflows.ts).
// Run from the repo root: node scripts/readme-figures.mjs [out dir]. Writes HTML, then 2× PNGs via headless Chrome.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const out = path.resolve(process.argv[2] ?? "screenshots/readme-figures");
const ART = "kanban-ui/public/agent-art";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const art = (name) => {
  const file = path.join(ART, `${name}.png`);
  return fs.existsSync(file) ? `data:image/png;base64,${fs.readFileSync(file).toString("base64")}` : null;
};

// kanban-ui's `Lettered`: base.png holding a card with the initial, in an ink picked by name.
const INKS = ["#2c5c86", "#5a3f92", "#2f6b46", "#8a4a28", "#b83a12"];
const GLYPHS = { v: "11011 11011 11011 01110 01110 00100 00100" };
function character(name, size) {
  const own = art(name);
  if (own) return `<img src="${own}" width="${size}" height="${size}" class="px">`;
  const ink = INKS[[...name].reduce((s, ch) => s + ch.charCodeAt(0), 0) % INKS.length];
  const rows = (GLYPHS[name[0]] ?? GLYPHS.v).split(" ");
  const cells = rows
    .flatMap((row, y) => [...row].map((on, x) => (on === "1" ? `<rect x="${27 + x * 4}" y="${53 + y * 4}" width="4" height="4" fill="#fff8e6"/>` : "")))
    .join("");
  return `<span class="lettered" style="width:${size}px;height:${size}px"><img src="${art("base")}" width="${size}" height="${size}" class="px"><svg viewBox="0 0 96 96" width="${size}" height="${size}" shape-rendering="crispEdges"><rect x="22" y="48" width="35" height="37" fill="#12130f"/><rect x="25" y="51" width="29" height="31" fill="${ink}"/>${cells}</svg></span>`;
}

// Names and workflows as the app shows them (kanban-ui/i18n, cli/src/agents/*/AGENT.md).
const NAMES = {
  en: {
    "software-planner": "Software planner", "ui-designer": "UI designer", copywriting: "Copy & docs",
    illustrator: "Illustrator", "prompt-writer": "Prompt writer", "email-planner": "Email planner",
    "competitor-research": "Competitor research", "tech-stack-advisor": "Tech stack advisor",
    builder: "Builder", "qa-manager": "QA manager", scriptwriter: "Scriptwriter",
    "demo-rehearser": "Demo rehearser", "hyperframes-editor": "Video editor", "cover-designer": "Cover designer",
    "deck-planner": "Deck planner", "carousel-planner": "Carousel planner", "blog-planner": "Blog planner",
    "blog-researcher": "Blog researcher", "blog-illustrator": "Blog illustrator", "video-cloner": "Video cloner",
  },
  zh: {
    "software-planner": "软件规划师", "ui-designer": "界面设计师", copywriting: "文案与文档",
    illustrator: "产品配图", "prompt-writer": "提示词撰写", "email-planner": "邮件策划",
    "competitor-research": "竞品调研", "tech-stack-advisor": "技术选型顾问",
    builder: "开发", "qa-manager": "质检员", scriptwriter: "脚本作者",
    "demo-rehearser": "演示排练", "hyperframes-editor": "视频剪辑", "cover-designer": "封面设计",
    "deck-planner": "演示文稿策划", "carousel-planner": "图文轮播策划", "blog-planner": "博客策划",
    "blog-researcher": "博客研究员", "blog-illustrator": "博客配图", "video-cloner": "视频克隆",
  },
};

const FLOWS = [
  {
    id: "coding", lead: "software-planner",
    helpers: ["ui-designer", "copywriting", "illustrator", "prompt-writer", "email-planner", "competitor-research", "tech-stack-advisor"],
    execute: "builder", scheduled: "qa-manager",
  },
  { id: "hyperframes-video", lead: "scriptwriter", helpers: ["demo-rehearser", "hyperframes-editor", "cover-designer"] },
  { id: "blog-post", lead: "blog-planner", helpers: ["blog-researcher", "blog-illustrator"] },
  { id: "slide-deck", lead: "deck-planner", helpers: [] },
  { id: "carousel-post", lead: "carousel-planner", helpers: [] },
  { id: "video-clone", lead: "video-cloner", helpers: [] },
];

const T = {
  en: {
    font: "", teamsCaption: "Six built-in workflows, each run by its own team of specialist agents.",
    flow: { coding: "Coding", "hyperframes-video": "Product video", "slide-deck": "Slide deck", "carousel-post": "Carousel post", "blog-post": "Blog post", "video-clone": "Video clone" },
    gets: { coding: "Software changes", "hyperframes-video": "Finished video + cover", "slide-deck": "Image-based .pptx", "carousel-post": "Page images + captions", "blog-post": "Article with images & links", "video-clone": "Clone + reusable template" },
    plan: "Plan", execute: "Execute", scheduled: "Scheduled", lead: "Lead", helpers: "Helpers", timed: "Runs on its own, not per card",
  },
  zh: {
    font: '"PingFang SC", "Hiragino Sans GB", ', teamsCaption: "6 个内置工作流，各由一支专业 agent 团队负责。",
    flow: { coding: "软件开发", "hyperframes-video": "产品视频", "slide-deck": "演示文稿", "carousel-post": "图文轮播", "blog-post": "博客文章", "video-clone": "视频克隆" },
    gets: { coding: "软件改动", "hyperframes-video": "成片与封面", "slide-deck": "图片版 PPT", "carousel-post": "逐页图片与配文", "blog-post": "带配图和链接的文章", "video-clone": "复刻成片与视频模板" },
    plan: "规划", execute: "执行", scheduled: "定期运行", lead: "负责", helpers: "规划助手", timed: "按时自动运行，与卡片无关",
  },
};

const ICON = {
  plan: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>',
  execute: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4l6 6-3 3-6-6z"/><path d="M11 7L3 15l3 3 8-8"/></svg>',
  clock: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
};

const CSS = (t) => `
*{box-sizing:border-box;margin:0}
body{background:#f7f7f4;color:#24231f;font-family:ui-sans-serif,-apple-system,BlinkMacSystemFont,${t.font}"Segoe UI",sans-serif;-webkit-font-smoothing:antialiased}
.page{padding:36px 40px 40px;width:max-content}
.caption{font-size:22px;font-weight:700;letter-spacing:-.01em;margin-bottom:24px}
.px{image-rendering:pixelated;display:block}
.lettered{position:relative;display:block}.lettered svg{position:absolute;inset:0}
.block{background:#fff;border:1.5px solid #24231f;border-radius:14px;box-shadow:3px 3px 0 #24231f}
.grid{display:flex;gap:20px;align-items:flex-start}
.col{display:flex;flex-direction:column;gap:20px;width:300px}
.flow{padding:14px 12px 14px}
.flow h3{font-size:15px;font-weight:700;line-height:20px;padding:0 6px}
.gets{display:inline-block;margin:6px 6px 16px;font-size:11.5px;font-weight:600;line-height:16px;padding:2px 8px;border-radius:999px;background:#e4f3ea;color:#2f6b46}
.frame{position:relative;border:1px solid rgba(36,35,31,.1);border-radius:12px;padding:14px 4px 6px;margin-top:14px}
.frame:first-of-type{margin-top:6px}
.frame h4{position:absolute;top:-11px;left:8px;display:flex;align-items:center;gap:6px;background:#fff;padding:0 6px;font-size:12.5px;font-weight:500;line-height:20px}
.mark{display:grid;place-items:center;width:20px;height:20px;border-radius:6px;background:#efeeeb}
.row{display:flex;align-items:center;gap:8px;padding:4px 10px;font-size:12.5px;font-weight:700;line-height:16px}
.row .who{flex:1}
.pill{font-size:10.5px;font-weight:700;line-height:14px;padding:1px 7px;border-radius:999px;background:rgba(36,35,31,.07);color:#565550}
.rule{display:flex;align-items:center;gap:8px;height:24px;padding:0 10px;font-size:10.5px;font-weight:700;color:rgba(86,85,80,.75)}
.rule::after{content:"";height:1px;flex:1;background:rgba(36,35,31,.1)}
`;

const row = (n, name, extra = "") => `<div class="row">${character(name, 28)}<span class="who">${n[name]}</span>${extra}</div>`;

function teams(lang) {
  const t = T[lang], n = NAMES[lang];
  const card = (f) => {
    const helpers = f.helpers.length ? `<div class="rule">${t.helpers}</div>${f.helpers.map((h) => row(n, h)).join("")}` : "";
    const frame = (kind, label, body) => `<section class="frame"><h4><span class="mark">${ICON[kind]}</span>${label}</h4>${body}</section>`;
    return `<div class="block flow"><h3>${t.flow[f.id]}</h3><span class="gets">${t.gets[f.id]}</span>
${frame("plan", t.plan, row(n, f.lead, `<span class="pill">${t.lead}</span>`) + helpers)}
${f.execute ? frame("execute", t.execute, row(n, f.execute, `<span class="pill">${t.lead}</span>`)) : ""}
${f.scheduled ? frame("clock", t.scheduled, `<div class="rule">${t.timed}</div>` + row(n, f.scheduled)) : ""}</div>`;
  };
  const [coding, video, blog, deck, carousel, clone] = FLOWS;
  const col = (fs) => `<div class="col">${fs.map(card).join("")}</div>`;
  return `<div class="page"><p class="caption">${t.teamsCaption}</p><div class="grid">${col([coding])}${col([video, blog])}${col([deck, carousel, clone])}</div></div>`;
}

// The script stamps the page's own size so the shot is cropped to it.
const page = (lang, body) =>
  `<!doctype html><html lang="${lang === "zh" ? "zh-CN" : "en"}"><meta charset="utf-8"><style>${CSS(T[lang])}</style><body>${body}<script>const p=document.querySelector(".page");document.body.dataset.size=Math.ceil(p.offsetWidth)+","+Math.ceil(p.offsetHeight)</script></body></html>`;

fs.mkdirSync(out, { recursive: true });
for (const [name, draw] of [["workflow-teams", teams]]) {
  for (const lang of ["en", "zh"]) {
    const html = path.join(out, `illus-${name}.${lang}.html`);
    fs.writeFileSync(html, page(lang, draw(lang)));
    if (process.argv.includes("--html")) continue;
    const dom = execFileSync(CHROME, ["--headless", "--disable-gpu", "--window-size=1600,1200", "--dump-dom", `file://${html}`]).toString();
    const size = dom.match(/data-size="(\d+,\d+)"/)[1];
    execFileSync(CHROME, ["--headless", "--disable-gpu", "--hide-scrollbars", `--window-size=${size}`, "--force-device-scale-factor=2",
      `--screenshot=${path.join(out, `illus-${name}.${lang}.png`)}`, `file://${html}`], { stdio: "ignore" });
  }
}
