// A subtitle editor: reads a JSON list of `{ start, end, text }` (seconds), edits the text and
// the times, and saves the list as the artifact's next version.

import { connect } from "./sdk.js";

const COPY = {
  zh: { start: "开始", end: "结束", text: "字幕", add: "添加一行", save: "保存", saving: "正在保存…", saved: "已保存", badTime: "时间格式应为 分:秒，例如 0:03.5", remove: "删除" },
  en: { start: "Start", end: "End", text: "Subtitle", add: "Add line", save: "Save", saving: "Saving…", saved: "Saved", badTime: "Use minutes:seconds, such as 0:03.5", remove: "Remove" },
};

/** @param {string} id */
const $ = (id) => /** @type {HTMLElement} */ (document.getElementById(id));

/** @param {number} s */
const clock = (s) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, "0")}`;
/** @param {string} t */
const seconds = (t) => {
  const m = /^(\d+):(\d{1,2}(?:\.\d+)?)$/.exec(t.trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

/** @param {import("./sdk.js").Artifact} artifact @returns {{ start: number, end: number, text: string }[]} */
function linesOf(artifact) {
  const data = artifact.file ? JSON.parse(new TextDecoder().decode(artifact.file.data)) : artifact.content;
  return Array.isArray(data) ? data : [];
}

const bridge = await connect();
let lines = linesOf(bridge.artifact);

function paint() {
  const c = COPY[bridge.locale];
  document.documentElement.classList.toggle("dark", bridge.theme === "dark");
  document.body.classList.toggle("readonly", bridge.readOnly);
  $("h-start").textContent = c.start;
  $("h-end").textContent = c.end;
  $("h-text").textContent = c.text;
  $("add").textContent = c.add;
  $("save").textContent = c.save;
  const rows = $("rows");
  rows.replaceChildren(
    ...lines.map((line, i) => {
      const tr = document.createElement("tr");
      /** @param {"start" | "end"} key */
      const time = (key) => {
        const td = document.createElement("td");
        td.className = "time";
        const input = document.createElement("input");
        input.className = "time";
        input.value = clock(line[key]);
        input.disabled = bridge.readOnly;
        input.title = c.badTime;
        input.onchange = () => {
          const s = seconds(input.value);
          input.classList.toggle("bad", s === null);
          if (s !== null) lines[i] = { ...lines[i], [key]: s };
        };
        td.append(input);
        return td;
      };
      const text = document.createElement("td");
      const input = document.createElement("input");
      input.value = line.text;
      input.disabled = bridge.readOnly;
      input.oninput = () => (lines[i] = { ...lines[i], text: input.value });
      text.append(input);
      const remove = document.createElement("td");
      const x = document.createElement("button");
      x.className = "remove";
      x.type = "button";
      x.textContent = "×";
      x.title = c.remove;
      x.onclick = () => {
        lines.splice(i, 1);
        paint();
      };
      remove.append(x);
      tr.append(time("start"), time("end"), text, remove);
      return tr;
    }),
  );
}

$("add").onclick = () => {
  const last = lines.at(-1);
  lines.push({ start: last?.end ?? 0, end: (last?.end ?? 0) + 2, text: "" });
  paint();
};

$("save").onclick = async () => {
  const c = COPY[bridge.locale];
  const button = /** @type {HTMLButtonElement} */ ($("save"));
  button.disabled = true;
  $("status").textContent = c.saving;
  try {
    await bridge.save(lines);
    $("status").textContent = c.saved;
  } catch (e) {
    $("status").textContent = e instanceof Error ? e.message : String(e);
  } finally {
    button.disabled = false;
  }
};

bridge.onChange(() => {
  lines = linesOf(bridge.artifact);
  paint();
});
paint();
