// A server redirect() from a page crashes Next 15's client router on a repeat visit
// ("Rendered more hooks than during the previous render", #1064). Pages draw the target in place.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";

const app = path.join(import.meta.dirname, "..", "app");

test("no page calls redirect()", () => {
  const pages = fs
    .readdirSync(app, { recursive: true })
    .filter((f) => /(^|\/)page\.tsx$/.test(f));
  assert.ok(pages.includes(path.join("[id]", "page.tsx")));
  const offenders = pages.filter((f) => /\bredirect\(/.test(fs.readFileSync(path.join(app, f), "utf8")));
  assert.deepEqual(offenders, []);
});
