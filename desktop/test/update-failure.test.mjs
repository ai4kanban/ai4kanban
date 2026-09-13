// Sorting what went wrong into the categories the user is shown, and which of
// them are worth waiting out.

import assert from "node:assert/strict";
import test from "node:test";
import { UpdateFailed, failureOf, failureOfStatus, retriable } from "../out/lib/update/failure.js";
import { getCopy } from "../out/lib/copy/index.js";

test("a node error code says what kind of failure it was", () => {
  assert.equal(failureOf(Object.assign(new Error(""), { code: "ENOTFOUND" })), "network");
  assert.equal(failureOf(Object.assign(new Error(""), { code: "ETIMEDOUT" })), "timeout");
  assert.equal(failureOf(Object.assign(new Error(""), { code: "ENOSPC" })), "disk");
  assert.equal(failureOf(Object.assign(new Error(""), { code: "EACCES" })), "permission");
});

test("a category that already knows itself passes straight through", () => {
  assert.equal(failureOf(new UpdateFailed("checksum")), "checksum");
  assert.equal(failureOf(new Error("cannot write", { cause: new UpdateFailed("readOnly") })), "readOnly");
});

test("anything we cannot name is `unknown` — never a guess", () => {
  assert.equal(failureOf(new Error("the server answered oddly")), "unknown");
  assert.equal(failureOf("a string"), "unknown");
  assert.equal(failureOf(undefined), "unknown");
});

test("a rate limit or a server error is the host's bad minute; nothing else is", () => {
  assert.equal(failureOfStatus(429), "server");
  assert.equal(failureOfStatus(503), "server");
  assert.equal(failureOfStatus(404), "unknown");
});

test("waiting is tried on what waiting could fix, and on nothing else", () => {
  for (const f of ["network", "timeout", "server", "checksum"]) assert.equal(retriable(f), true);
  for (const f of ["disk", "permission", "readOnly", "noBuild", "notInstallable", "unknown"]) {
    assert.equal(retriable(f), false);
  }
});

test("every category has words in both languages, and none names an internal detail", () => {
  const categories = [
    "network",
    "timeout",
    "server",
    "disk",
    "permission",
    "checksum",
    "readOnly",
    "noBuild",
    "notInstallable",
    "unknown",
  ];
  for (const language of ["en", "zh"]) {
    const reason = getCopy(language).update.reason;
    for (const c of categories) {
      assert.equal(typeof reason[c], "string", `${language}/${c}`);
      assert.ok(reason[c].length > 0, `${language}/${c}`);
      // No error codes, no paths: a reason is what happened, not how we know.
      assert.doesNotMatch(reason[c], /E[A-Z]{3,}|\/|\b\d{3}\b/, `${language}/${c}`);
    }
  }
});
