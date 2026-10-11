// An `.html` asset's document (#1626): the policy comes before anything the author wrote.
import assert from "node:assert/strict";
import { test } from "node:test";
import { PAGE_CSP, pageDocument } from "../lib/page-document.ts";

const META = `<meta http-equiv="Content-Security-Policy" content="${PAGE_CSP}">`;

test("the policy runs inline scripts and reaches nothing", () => {
  const rules = Object.fromEntries(PAGE_CSP.split(";").map((r) => r.trim().split(/\s+/)).map(([k, ...v]) => [k, v]));
  assert.deepEqual(rules["default-src"], ["'none'"]);
  assert.deepEqual(rules["script-src"], ["'unsafe-inline'"]);
  assert.deepEqual(rules["worker-src"], ["'none'"]);
  assert.equal(rules["connect-src"], undefined);
  for (const sources of Object.values(rules)) {
    for (const s of sources) assert.match(s, /^('none'|'unsafe-inline'|data:)$/);
  }
});

test("the policy leads a page, ahead of a script before <head>", () => {
  const doc = pageDocument("<html><script>x()</script><head></head><body></body></html>", "<style></style>");
  assert.ok(doc.startsWith(META + "<style></style><html>"));
});

test("the doctype stays first, so the page keeps standards mode", () => {
  const doc = pageDocument("<!-- a -->\n<!DOCTYPE html><html lang=en><body>hi</body></html>", "");
  assert.ok(doc.startsWith("<!-- a -->\n<!DOCTYPE html>" + META + "<html lang=en>"));
});

test("a fragment is wrapped in a page", () => {
  assert.equal(pageDocument("<canvas></canvas>", ""), `<!doctype html><html><head>${META}</head><body><canvas></canvas></body></html>`);
});
