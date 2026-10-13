// The cases in test/draft-compat/ are drawn the same way by draft-first — see its README.
// lib/mockup.ts is bundled with the board's rules stubbed to read assets from the fixture.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { after, test } from "node:test";
import { build } from "esbuild";

const UI = new URL("..", import.meta.url).pathname;
const DIR = path.join(UI, "test/draft-compat");
const CASES = JSON.parse(fs.readFileSync(path.join(DIR, "cases.json"), "utf8"));

const STUBS = {
  "./cli": `export const assetsDir = async () => ${JSON.stringify(path.join(DIR, ".assets"))}; export const mockupsDir = assetsDir;`,
  "./paths": `export const kanbanDir = () => ${JSON.stringify(DIR)};`,
  "./language": `import en from "../i18n/messages/en"; export const machineCopy = async () => ({ messages: en });`,
};
const tmp = fs.mkdtempSync(path.join(UI, ".test-"));
after(() => fs.rmSync(tmp, { recursive: true, force: true }));
const out = path.join(tmp, "mockup.mjs");
await build({
  entryPoints: [path.join(UI, "lib/mockup.ts")],
  absWorkingDir: UI,
  bundle: true,
  platform: "node",
  format: "esm",
  packages: "external",
  // The browser build holds a MessageChannel open, and the test never exits.
  alias: { "react-dom/server.browser": "react-dom/server" },
  outfile: out,
  logLevel: "silent",
  plugins: [
    {
      name: "stubs",
      setup(b) {
        b.onResolve({ filter: /^\.\/(cli|paths|language)$/ }, (a) =>
          a.importer.endsWith("mockup.ts") ? { path: a.path, namespace: "stub" } : undefined,
        );
        b.onLoad({ filter: /.*/, namespace: "stub" }, (a) => ({ contents: STUBS[a.path], resolveDir: path.join(UI, "lib"), loader: "ts" }));
      },
    },
  ],
});
const { readMockup } = await import(out);

for (const c of CASES) {
  test(`${c.src} draws as ${c.kind}`, async () => {
    const v = await readMockup(c.src);
    const kind = v.doc ? "doc" : v.error ? "error" : "text";
    assert.equal(kind, c.kind, v.error);
    const got = { doc: v.doc, text: v.text ?? v.article?.text, error: v.error }[kind];
    if (kind === "text") assert.equal(got, fs.readFileSync(path.join(DIR, c.src), "utf8"));
    for (const s of c.contains ?? []) assert.ok(got.includes(s), `missing ${JSON.stringify(s)}`);
  });
}
