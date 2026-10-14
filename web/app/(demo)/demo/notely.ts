// #39's key draft: Notely's own Sync settings, in Notely's look rather than the board's. The
// first version asks for a sync password; the revised one hands out a recovery key.

const BLUE = "#2f6fed";
const INK = "#1d1f24";
const SOFT = "#6b7080";
const LINE = "#e6e7eb";

const NAV = ["General", "Editor", "Sync", "Account", "Shortcuts"];

const WORDS = [
  "orbit", "maple", "lantern", "quartz", "harbor", "velvet",
  "ember", "cobalt", "meadow", "falcon", "pebble", "summit",
  "willow", "canyon", "jasmine", "anchor", "drift", "nectar",
  "glacier", "saffron", "timber", "echo", "violet", "compass",
];

const field = (label: string, value: string | null, placeholder = "") => `
  <label class="field">
    <span class="label">${label}</span>
    <span class="input" style="border-color:${value ? BLUE : LINE};color:${value ? INK : "#a3a7b3"}">
      ${value ?? `<span class="placeholder">${placeholder}</span>`}
    </span>
  </label>`;

const PASSWORD = `
  <p class="lead">Pick a sync password. You&rsquo;ll type it on every new device.</p>
  <div class="pair">
    ${field("Sync password", "••••••••••")}
    ${field("Confirm password", null, "Type it again")}
  </div>
  <p class="warn">Forget this password and your synced notes can&rsquo;t be recovered.</p>`;

const RECOVERY_KEY = `
  <p class="lead">Save this recovery key. It&rsquo;s the only way to open your notes on a new device.</p>
  <div class="key">
    ${WORDS.map((w, i) => `<span><i>${i + 1}</i>${w}</span>`).join("")}
  </div>
  <div class="row">
    <span class="ghost">Download key</span>
    <span class="ghost">Copy</span>
    <span class="check"><b>✓</b>I&rsquo;ve saved my recovery key</span>
  </div>`;

const STYLE = `
  * { box-sizing: border-box; margin: 0; }
  html, body { height: 100%; }
  body { display: flex; background: #fff; color: ${INK};
    font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
  aside { width: 240px; flex-shrink: 0; display: flex; flex-direction: column; gap: 4px; padding: 24px 16px;
    background: #f6f6f4; border-right: 1px solid ${LINE}; }
  .brand { display: flex; align-items: center; gap: 10px; margin-bottom: 24px; padding: 0 12px; font-size: 18px; font-weight: 800; }
  .brand b { display: grid; place-items: center; width: 32px; height: 32px; border-radius: 9px; background: ${BLUE};
    color: #fff; font-size: 16px; }
  .cap { margin-bottom: 4px; padding: 0 12px; font-size: 12px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.08em; color: ${SOFT}; }
  .nav { padding: 8px 12px; border-radius: 8px; font-size: 15px; }
  .nav.on { background: #e4ebfd; color: ${BLUE}; font-weight: 700; }
  main { flex: 1; min-width: 0; padding: 28px 56px; }
  main > div { max-width: 820px; }
  h1 { font-size: 30px; font-weight: 800; letter-spacing: -0.02em; }
  .toggle-row { display: flex; align-items: center; gap: 24px; margin-top: 16px; padding: 16px 24px;
    border: 1px solid ${LINE}; border-radius: 12px; }
  .toggle-row div { flex: 1; }
  .toggle-row p:first-child { font-size: 17px; font-weight: 700; }
  .toggle-row p + p { margin-top: 4px; font-size: 15px; color: ${SOFT}; }
  .toggle { position: relative; width: 46px; height: 26px; flex-shrink: 0; border-radius: 999px; background: ${BLUE}; }
  .toggle::after { content: ""; position: absolute; right: 3px; top: 3px; width: 20px; height: 20px;
    border-radius: 999px; background: #fff; box-shadow: 0 1px 2px rgb(0 0 0 / 0.2); }
  h2 { margin-top: 24px; font-size: 19px; font-weight: 800; }
  .lead { margin-top: 8px; font-size: 16px; line-height: 24px; color: ${SOFT}; }
  .pair { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 16px; }
  .field { display: flex; flex-direction: column; gap: 8px; }
  .label { font-size: 15px; font-weight: 600; }
  .input { display: flex; align-items: center; height: 48px; padding: 0 16px; border: 1.5px solid; border-radius: 10px;
    font-size: 18px; letter-spacing: 0.2em; }
  .placeholder { font-size: 15px; letter-spacing: normal; }
  .warn { margin-top: 12px; padding: 12px 16px; border-radius: 10px; background: #fff4e0; color: #8a5a00;
    font-size: 15px; line-height: 22px; }
  .key { display: grid; grid-template-columns: repeat(6, 1fr); gap: 12px 16px; margin-top: 16px; padding: 20px 24px;
    border: 1.5px solid #cdd9fb; border-radius: 12px; background: #eef3ff;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 15px; }
  .key span { display: flex; gap: 8px; }
  .key i { font-style: normal; color: #8b93a7; }
  .row { display: flex; align-items: center; gap: 12px; margin-top: 16px; }
  .ghost { padding: 10px 16px; border: 1.5px solid ${LINE}; border-radius: 10px; font-size: 15px; font-weight: 600; }
  .check { display: flex; align-items: center; gap: 10px; margin-left: 12px; font-size: 15px; }
  .check b { display: grid; place-items: center; width: 20px; height: 20px; border-radius: 5px; background: ${BLUE};
    color: #fff; font-size: 13px; }
  .cta { display: inline-flex; margin-top: 24px; padding: 12px 24px; border-radius: 10px; background: ${BLUE};
    color: #fff; font-size: 16px; font-weight: 700; }`;

/** The whole screen, as the HTML document a card's `<Asset>` frame draws. */
export function syncSettings(version: 1 | 2): string {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${STYLE}</style></head><body>
<aside>
  <div class="brand"><b>N</b>Notely</div>
  <span class="cap">Settings</span>
  ${NAV.map((n) => `<span class="nav${n === "Sync" ? " on" : ""}">${n}</span>`).join("")}
</aside>
<main><div>
  <h1>Sync</h1>
  <div class="toggle-row">
    <div><p>Sync across devices</p><p>Keep every note the same on your laptop, phone and tablet.</p></div>
    <span class="toggle"></span>
  </div>
  <h2>Encryption</h2>
  ${version === 1 ? PASSWORD : RECOVERY_KEY}
  <span class="cta">Turn on sync</span>
</div></main>
</body></html>`;
}
