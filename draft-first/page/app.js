// The review page: delete drafts, leave notes, confirm — and export what you see.

const UI = {
  zh: {
    draft: "待确认",
    confirmed: "已确认",
    export: "导出",
    image: "导出图片",
    imageHint: "整页存成一张长图",
    html: "导出 HTML 文件",
    htmlHint: "单个文件，发给谁都能直接打开",
    confirm: "确认",
    note: "批注",
    remove: "删除",
    undo: "撤销",
    deleted: (l) => `已删除「${l}」`,
    notePlaceholder: "写下要改的地方…",
    blocked: (d, n) => `「${d}」还留着 ${n} 份草稿，删到只剩 1 份再确认`,
    keepOne: "只留 1 份",
    doneTitle: "已确认，agent 还没有开始构建",
    doneBody: "回到 Claude Code 或 Codex，告诉 agent 继续。",
    doneCounts: (d, n) => [d && `删除了 ${d} 份草稿`, n && `写入了 ${n} 条批注`].filter(Boolean).join("，") + (d || n ? "。" : ""),
    agentHalf: "agent 自己定的事",
    items: (n) => `${n} 项`,
    notes: (n) => `${n} 条批注`,
    contract: "合约文件",
    lostTitle: "审阅页已断开，之后的改动不会保存",
    lostBody: "回到 Claude Code 或 Codex，让 agent 重新打开审阅页。",
    exportedOn: (d) => `导出于 ${d}`,
    madeWith: "用 draft-first 制作",
    promo: "这些草稿可以直接放进 AI4Kanban 卡片，再加上记忆、并行和跟进。",
    promoLink: "了解 AI4Kanban",
    broken: "这份草稿没能显示，让 agent 修好后这里会自动刷新。",
    changed: "agent 刚改过草稿，已刷新，请再看一遍再确认。",
    failed: "没能保存，请再试一次。",
    exporting: "正在导出…",
    loading: "正在打开…",
    none: "还没有草稿",
    noneBody: "agent 出草稿后，会在这里打开。",
    missing: "找不到这份草稿",
  },
  en: {
    draft: "Draft",
    confirmed: "Confirmed",
    export: "Export",
    image: "Export image",
    imageHint: "The whole page as one long image",
    html: "Export HTML file",
    htmlHint: "One file anyone can open",
    confirm: "Confirm",
    note: "Note",
    remove: "Delete",
    undo: "Undo",
    deleted: (l) => `Deleted “${l}”`,
    notePlaceholder: "What should change…",
    blocked: (d, n) => `“${d}” still has ${n} drafts — delete down to one, then confirm`,
    keepOne: "Keep one",
    doneTitle: "Confirmed — the agent hasn't started building",
    doneBody: "Go back to Claude Code or Codex and tell the agent to go on.",
    doneCounts: (d, n) =>
      [d && `${d} ${d === 1 ? "draft" : "drafts"} deleted`, n && `${n} ${n === 1 ? "note" : "notes"} added`].filter(Boolean).join(", ") +
      (d || n ? "." : ""),
    agentHalf: "Decided by the agent",
    items: (n) => (n === 1 ? "1 item" : `${n} items`),
    notes: (n) => (n === 1 ? "1 note" : `${n} notes`),
    contract: "Contract",
    lostTitle: "This page lost its connection — changes from now on won't be saved",
    lostBody: "Go back to Claude Code or Codex and ask the agent to reopen the review.",
    exportedOn: (d) => `Exported ${d}`,
    madeWith: "Made with draft-first",
    promo: "These drafts drop straight into AI4Kanban cards, which add memory, parallel runs and follow-ups.",
    promoLink: "Meet AI4Kanban",
    broken: "This draft couldn't be shown. It refreshes here once the agent fixes it.",
    changed: "The agent just changed the drafts. Take another look, then confirm.",
    failed: "Couldn't save. Try again.",
    exporting: "Exporting…",
    loading: "Opening…",
    none: "No drafts yet",
    noneBody: "They open here once the agent drafts them.",
    missing: "This draft can't be found",
  },
};

const AI4KANBAN = "https://ai4kanban.dev";

const svg = (body, size = 12) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
const ICON = {
  check: svg('<polyline points="20 6 9 17 4 12"/>'),
  down: svg('<polyline points="6 9 12 15 18 9"/>'),
  right: svg('<polyline points="9 18 15 12 9 6"/>', 16),
  download: svg('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>'),
  edit: svg('<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>'),
  image: svg('<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>', 14),
  code: svg('<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>', 14),
  trash: svg('<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>'),
  off: svg('<line x1="1" y1="1" x2="23" y2="23"/><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/><path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/><path d="M10.71 5.05A16 16 0 0 1 22.58 9"/><path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/>', 16),
  done: svg('<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>', 16),
  alert: svg('<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>', 14),
  arrow: svg('<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>'),
};
const LOGO =
  '<span class="df-logo"><svg viewBox="0 0 60 60" fill="currentColor" aria-hidden="true"><rect x="5" y="8" width="12" height="44" rx="3.5"/><rect x="24" y="8" width="12" height="35" rx="3.5"/><rect x="43" y="8" width="12" height="26" rx="3.5"/></svg></span>';

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

const state = {
  lang: localStorage.getItem("draft-first:lang") ?? (navigator.language.startsWith("zh") ? "zh" : "en"),
  list: [],
  slug: new URLSearchParams(location.search).get("c"),
  model: null,
  missing: false,
  deleted: new Set(),
  notes: {},
  editing: null,
  menu: false,
  online: true,
  justConfirmed: null,
  toast: null,
};

const t = () => UI[state.lang];

// --- what the user has done so far, kept per contract until it is confirmed ---

const key = () => `draft-first:review:${state.slug}`;

function loadLocal() {
  const saved = JSON.parse(localStorage.getItem(key()) ?? "{}");
  const ids = new Set([
    ...(state.model?.sections ?? []).flatMap((s) => s.drafts.map((d) => d.id)),
    ...(state.model?.agent?.items ?? []).map((i) => i.id),
  ]);
  state.deleted = new Set((saved.deleted ?? []).filter((id) => ids.has(id)));
  state.notes = Object.fromEntries(Object.entries(saved.notes ?? {}).filter(([id]) => ids.has(id)));
}

function saveLocal() {
  localStorage.setItem(key(), JSON.stringify({ deleted: [...state.deleted], notes: state.notes }));
}

// --- the view, as HTML; `exported` is the static copy a person sends on ---

function blockedSection(model) {
  for (const s of model.sections) {
    const left = s.drafts.filter((d) => !state.deleted.has(d.id));
    if (left.length > 1) return { section: s, left: left.length };
  }
  return null;
}

function noteView(id, live) {
  const text = state.notes[id] ?? "";
  if (state.editing === id && live) {
    return `<div class="df-note editing">${ICON.edit}<textarea data-note="${id}" rows="1" placeholder="${esc(t().notePlaceholder)}">${esc(text)}</textarea><small>${t().note}</small></div>`;
  }
  if (!text.trim()) return "";
  return `<div class="df-note${live ? " live" : ""}" ${live ? `data-act="note" data-id="${id}"` : ""}>${ICON.edit}<span>${esc(text)}</span><small>${t().note}</small></div>`;
}

function draftView(section, draft, live) {
  const tools = live
    ? `<span class="df-acts"><button class="df-quiet" data-act="note" data-id="${draft.id}">${ICON.edit}${t().note}</button><button class="df-quiet danger" data-act="delete" data-id="${draft.id}">${ICON.trash}${t().remove}</button></span>`
    : "";
  const head =
    draft.heading || draft.src || tools
      ? `<div class="df-head">${draft.heading ? `<span class="df-chip">${esc(draft.heading)}</span>` : ""}${
          draft.src ? `<span class="df-src">${esc(draft.src)}</span>` : ""
        }${tools}</div>`
      : "";
  return `<div class="df-draft">${head}<div class="df-prose">${draft.html}</div>${noteView(draft.id, live)}</div>`;
}

function sectionView(s, live, blocked) {
  const kept = s.drafts.filter((d) => !state.deleted.has(d.id));
  const gone = live ? s.drafts.filter((d) => state.deleted.has(d.id)) : [];
  const isBlocked = blocked?.section === s;
  return `<section class="df-section${isBlocked ? " blocked" : ""}">
    <header><h2>${esc(s.title)}</h2>${isBlocked ? `<span class="df-chip peach">${t().keepOne}</span>` : ""}</header>
    ${s.leadHtml ? `<div class="df-lead df-prose">${s.leadHtml}</div>` : ""}
    ${kept.map((d) => draftView(s, d, live)).join("")}
    ${gone
      .map(
        (d) =>
          `<div class="df-gone">${ICON.trash}<s>${esc(t().deleted(d.heading ?? s.title))}</s><button data-act="undo" data-id="${d.id}">${t().undo}</button></div>`,
      )
      .join("")}
  </section>`;
}

function agentView(agent, live) {
  if (!agent) return "";
  const noted = agent.items.filter((i) => state.notes[i.id]?.trim()).length;
  return `<details class="df-agent"${state.agentOpen ? " open" : ""}>
    <summary>${ICON.right}<h2>${t().agentHalf}</h2><span class="df-count">${t().items(agent.items.length)}</span>${
      noted ? `<span class="df-noted">${ICON.edit}${t().notes(noted)}</span>` : ""
    }</summary>
    ${
      agent.items.length
        ? `<ul>${agent.items
            .map(
              (i) =>
                `<li><div><div class="df-prose">${i.html}</div>${
                  live ? `<button class="df-quiet" data-act="note" data-id="${i.id}">${ICON.edit}${t().note}</button>` : ""
                }</div>${noteView(i.id, live)}</li>`,
            )
            .join("")}</ul>`
        : ""
    }
    ${agent.restHtml ? `<div class="df-rest df-prose">${agent.restHtml}</div>` : ""}
  </details>`;
}

function promoView(exported) {
  return `<footer class="df-promo"><span class="df-made">${LOGO}${exported ? `<b>${t().madeWith}</b>` : ""}</span><span>${t().promo}</span><a href="${AI4KANBAN}" target="_blank" rel="noreferrer">${t().promoLink}${ICON.arrow}</a></footer>`;
}

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function barView(model, { exported, blocked }) {
  const done = model.status === "confirmed";
  const switcher =
    state.list.length > 1 && !exported
      ? `<select data-act="switch" aria-label="${esc(model.title)}">${state.list
          .map((c) => `<option value="${esc(c.slug)}"${c.slug === model.slug ? " selected" : ""}>${esc(c.title)}</option>`)
          .join("")}</select>${ICON.down}`
      : "";
  const tools = exported
    ? `<span class="df-meta">${t().exportedOn(today())}</span>`
    : `<span class="df-lang"><button data-act="lang" data-lang="zh" aria-pressed="${state.lang === "zh"}">中文</button><button data-act="lang" data-lang="en" aria-pressed="${state.lang === "en"}">EN</button></span>
       <span class="df-menu-wrap"><button class="df-btn ghost" data-act="menu">${ICON.download}${t().export}${ICON.down}</button>${
         state.menu
           ? `<span class="df-menu"><button data-act="png">${ICON.image}<span><b>${t().image}</b><small>${t().imageHint}</small></span></button><button data-act="html">${ICON.code}<span><b>${t().html}</b><small>${t().htmlHint}</small></span></button></span>`
           : ""
       }</span>
       ${done ? "" : `<button class="df-btn" data-act="confirm"${blocked || !state.online ? " disabled" : ""}>${ICON.check}${t().confirm}</button>`}`;
  return `<div class="df-bar"><span class="df-brand">draft-first</span><span class="df-slash">/</span><span class="df-switch"><span>${esc(model.title)}</span>${switcher}</span>${
    done ? `<span class="df-chip mint">${t().confirmed}</span>` : `<span class="df-chip">${t().draft}</span>`
  }<span class="df-tools">${tools}</span></div>${
    blocked && !exported ? `<div class="df-strip">${ICON.alert}${esc(t().blocked(blocked.section.title, blocked.left))}</div>` : ""
  }`;
}

function pageView(model, { exported = false } = {}) {
  const done = model.status === "confirmed";
  const live = !exported && !done;
  const blocked = done ? null : blockedSection(model);
  const counts = state.justConfirmed ?? { deleted: 0, notes: model.notes };
  const banner = exported
    ? ""
    : done
      ? `<div class="df-banner mint">${ICON.done}<div><b>${t().doneTitle}</b><div>${t().doneBody}${t().doneCounts(counts.deleted, counts.notes)}</div><div class="df-file">${t().contract}<code>${esc(model.file)}</code></div></div></div>`
      : !state.online
        ? `<div class="df-banner peach">${ICON.off}<div><b>${t().lostTitle}</b><div>${t().lostBody}</div></div></div>`
        : "";
  return `${barView(model, { exported, blocked })}<main class="df-doc" id="df-doc">${banner}
    <h1 class="df-title">${esc(model.title)}</h1>
    <div class="df-intro df-prose">${model.introHtml}</div>
    ${model.sections.map((s) => sectionView(s, live, blocked)).join("")}
    ${agentView(model.agent, live)}
    ${promoView(exported)}
  </main>`;
}

// --- drafts: each drawn into a shadow root at its device's width, scaled to the column ---

function assetView(a, i, exported, images) {
  if (a.kind === "error") return `<div class="df-broken" title="${esc(a.error)}">${t().broken}</div>`;
  const caption = a.label ? `<figcaption>${esc(a.label)}</figcaption>` : "";
  if (a.kind === "image") return `<figure class="df-frame"><img src="${esc(images?.[a.url] ?? a.url)}" alt="${esc(a.label)}" />${caption}</figure>`;
  if (a.kind === "text") return `<figure class="df-frame"><pre>${esc(a.text)}</pre>${caption}</figure>`;
  const inner = exported ? `<template shadowrootmode="open">${a.html}</template>` : "";
  return `<figure class="df-frame ${a.device}"><div class="df-fit" data-w="${a.width}"><div class="df-screen" data-i="${i}" style="width:${a.width}px;min-height:${a.height}px">${inner}</div></div>${caption}</figure>`;
}

function fit(root = document) {
  for (const el of root.querySelectorAll(".df-fit")) {
    const room = el.parentElement.clientWidth - parseFloat(getComputedStyle(el.parentElement).paddingLeft) * 2;
    el.style.zoom = String(Math.min(1, room / Number(el.dataset.w)));
  }
}

function placeAssets(html, model, exported, images) {
  return html.replace(/<div class="df-asset" data-asset="(\d+)"><\/div>/g, (_, n) => assetView(model.assets[n], n, exported, images));
}

function drawAssets(model) {
  for (const el of document.querySelectorAll(".df-screen[data-i]")) {
    const a = model.assets[el.dataset.i];
    if (!el.shadowRoot) el.attachShadow({ mode: "open" }).innerHTML = a.html;
  }
  fit();
}

// --- render and events ---

const app = document.getElementById("app");

function render() {
  document.documentElement.lang = state.lang === "zh" ? "zh-CN" : "en";
  if (!state.model) {
    const [title, body] = state.missing ? [t().missing, ""] : state.list.length ? [t().loading, ""] : [t().none, t().noneBody];
    app.innerHTML = `<div class="df-bar"><span class="df-brand">draft-first</span></div><div class="df-empty"><b>${title}</b>${body}</div>`;
    return;
  }
  document.title = `${state.model.title} · draft-first`;
  app.innerHTML = placeAssets(pageView(state.model), state.model, false) + (state.toast ? `<div class="df-toast">${esc(state.toast)}</div>` : "");
  drawAssets(state.model);
  const editor = app.querySelector("textarea[data-note]");
  if (editor) {
    editor.focus();
    editor.setSelectionRange(editor.value.length, editor.value.length);
  }
}

function toast(text) {
  state.toast = text;
  render();
  setTimeout(() => {
    if (state.toast === text) {
      state.toast = null;
      render();
    }
  }, 3500);
}

async function load() {
  state.list = await (await fetch("/api/contracts")).json();
  if (!state.slug && state.list.length) state.slug = state.list[0].slug;
  if (!state.slug) return render();
  const res = await fetch(`/api/contract/${encodeURIComponent(state.slug)}`);
  state.missing = !res.ok;
  const model = res.ok ? await res.json() : null;
  if (model && state.model && model.version !== state.model.version && model.status !== "confirmed") state.justConfirmed = null;
  state.model = model;
  if (model) loadLocal();
  render();
}

function download(name, blob) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

async function exportImage() {
  const doc = document.getElementById("df-doc");
  const url = await window.modernScreenshot.domToPng(doc, {
    scale: Math.min(2, devicePixelRatio || 1),
    backgroundColor: "#ffffff",
    filter: (node) => !node.classList?.contains("df-acts") && !node.classList?.contains("df-gone") && !node.classList?.contains("df-quiet"),
  });
  download(`${state.model.slug}.png`, await (await fetch(url)).blob());
}

async function exportHtml() {
  const model = state.model;
  const css = await (await fetch("/page/style.css")).text();
  const images = {};
  for (const a of model.assets) {
    if (a.kind !== "image") continue;
    const blob = await (await fetch(a.url)).blob();
    images[a.url] = await new Promise((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.readAsDataURL(blob);
    });
  }
  const body = placeAssets(pageView(model, { exported: true }), model, true, images);
  const html = `<!doctype html><html lang="${state.lang === "zh" ? "zh-CN" : "en"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(model.title)}</title><style>${css}</style></head><body>${body}<script>${fit.toString()};fit();addEventListener("resize",()=>fit())</script></body></html>`;
  download(`${model.slug}.html`, new Blob([html], { type: "text/html" }));
}

async function confirm() {
  const deleted = [...state.deleted];
  const notes = Object.fromEntries(Object.entries(state.notes).filter(([, v]) => v.trim()));
  const res = await fetch(`/api/contract/${encodeURIComponent(state.slug)}/confirm`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ version: state.model.version, deleted, notes }),
  });
  if (res.status === 409) {
    await load();
    return toast(t().changed);
  }
  if (!res.ok) return toast(t().failed);
  localStorage.removeItem(key());
  state.justConfirmed = { deleted: deleted.length, notes: state.model.notes + Object.keys(notes).length };
  await load();
}

function closeEditor() {
  if (!state.editing) return;
  if (!state.notes[state.editing]?.trim()) delete state.notes[state.editing];
  state.editing = null;
  saveLocal();
  render();
}

app.addEventListener("click", async (e) => {
  const el = e.target.closest("[data-act]");
  if (!el || el.tagName === "SELECT") {
    if (state.menu && !e.target.closest(".df-menu-wrap")) {
      state.menu = false;
      render();
    }
    return;
  }
  const { act, id } = el.dataset;
  if (act !== "menu") state.menu = false;
  if (act === "lang") {
    state.lang = el.dataset.lang;
    localStorage.setItem("draft-first:lang", state.lang);
  } else if (act === "menu") {
    state.menu = !state.menu;
  } else if (act === "note") {
    state.editing = id;
    state.notes[id] ??= "";
  } else if (act === "delete") {
    state.deleted.add(id);
    delete state.notes[id];
    saveLocal();
  } else if (act === "undo") {
    state.deleted.delete(id);
    saveLocal();
  } else if (act === "confirm") {
    return confirm();
  } else if (act === "png" || act === "html") {
    state.toast = t().exporting;
    render();
    try {
      await (act === "png" ? exportImage() : exportHtml());
    } finally {
      state.toast = null;
      render();
    }
    return;
  }
  render();
});

app.addEventListener("toggle", (e) => {
  if (e.target.classList?.contains("df-agent")) state.agentOpen = e.target.open;
}, true);

app.addEventListener("input", (e) => {
  const id = e.target.dataset?.note;
  if (!id) return;
  state.notes[id] = e.target.value;
  saveLocal();
});

app.addEventListener("focusout", (e) => {
  if (e.target.dataset?.note) setTimeout(closeEditor);
});

app.addEventListener("keydown", (e) => {
  if (e.target.dataset?.note && (e.key === "Escape" || (e.key === "Enter" && (e.metaKey || e.ctrlKey)))) e.target.blur();
});

app.addEventListener("change", (e) => {
  if (e.target.dataset?.act !== "switch") return;
  state.slug = e.target.value;
  state.model = null;
  state.justConfirmed = null;
  history.replaceState(null, "", `?c=${encodeURIComponent(state.slug)}`);
  load();
});

addEventListener("resize", () => fit());

// The service tells the page when a contract changed on disk, and its going away is how the
// page knows nothing it does will be saved.
const events = new EventSource("/events");
events.onopen = () => {
  if (state.online) return;
  state.online = true;
  load();
};
events.onerror = () => {
  state.online = false;
  render();
};
events.onmessage = (e) => {
  if (e.data === "changed" && !state.editing) load();
};

load();
