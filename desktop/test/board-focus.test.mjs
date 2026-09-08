// What the focus file says while several windows are open (#495).
//
// It is the one thing the app tells the board servers about the windows: a server whose
// board is named here has someone looking at it and may do work nobody asked for, and one
// that is not named must not (kanban-ui/lib/desktop.ts reads the other end). One window per
// line, rewritten whole every time — a line left behind would keep a board refining itself
// after its window closed.
//
// The order is the contract's other half: the FIRST line is the one board that raises the
// account's system notifications, so every on-screen board filling its own bell still
// interrupts the user once.

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { BoardServers } from "../out/lib/server.js";

function pool() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "akb-focus-"));
  const focusFile = path.join(dir, "state", "open-project");
  return {
    servers: new BoardServers({ env: {}, version: "0.0.0", focusFile }),
    lines: () =>
      fs
        .readFileSync(focusFile, "utf8")
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean),
  };
}

test("every open window's board is named, one per line", () => {
  const { servers, lines } = pool();
  servers.showing(["/p/docs/kanban", "/p/marketing/kanban"]);
  assert.deepEqual(lines(), ["/p/docs/kanban", "/p/marketing/kanban"]);
});

test("two windows on one board name it once", () => {
  const { servers, lines } = pool();
  servers.showing(["/p", "/p"]);
  assert.deepEqual(lines(), ["/p"]);
  assert.deepEqual(servers.boards, ["/p"]);
});

test("a window closing takes its board off, and leaves the others", () => {
  const { servers, lines } = pool();
  servers.showing(["/p/docs/kanban", "/p/marketing/kanban"]);
  servers.showing(["/p/docs/kanban"]);
  assert.deepEqual(lines(), ["/p/docs/kanban"]);
});

test("the boards keep the order they were handed, oldest window first", () => {
  const { servers, lines } = pool();
  servers.showing(["/p/marketing/kanban", "/p", "/p/marketing/kanban"]);
  assert.deepEqual(lines(), ["/p/marketing/kanban", "/p"]);
  // The oldest window's board leaves, and the next one along takes the first line — and
  // with it the raising of the account's notifications.
  servers.showing(["/p"]);
  assert.deepEqual(lines(), ["/p"]);
});

test("the last window closing leaves nothing named", () => {
  const { servers, lines } = pool();
  servers.showing(["/p"]);
  servers.showing([]);
  assert.deepEqual(lines(), []);
});
