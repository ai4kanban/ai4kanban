// A `.tsx` mockup's document (#1628): its inline script survives, under the `.html` page's policy.
import assert from "node:assert/strict";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PAGE_CSP, componentDocument } from "../lib/page-document.ts";

test("an inline script in a .tsx mockup is kept, under the page policy", () => {
  const markup = renderToStaticMarkup(
    React.createElement("div", null,
      React.createElement("canvas", { id: "c" }),
      React.createElement("script", { dangerouslySetInnerHTML: { __html: "draw(1 < 2)" } })),
  );
  const doc = componentDocument("p{}", markup, true);
  assert.ok(doc.startsWith(`<!doctype html><meta http-equiv="Content-Security-Policy" content="${PAGE_CSP}">`));
  assert.ok(doc.includes("<script>draw(1 < 2)</script>"));
  assert.ok(doc.includes("overscroll-behavior:contain"));
});
