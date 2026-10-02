// A project keeps its port across launches (#1427).
//
// The board's page remembers things in localStorage — the milestones it has cheered, a
// half-written draft, the chat rail's width — and localStorage is per address, port
// included. A new port every launch would hand the window an empty one every time.

import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import test from "node:test";

// The store asks Electron where the app's data lives; here that is a scratch folder.
const userData = fs.mkdtempSync(path.join(os.tmpdir(), "akb-port-"));
const require = createRequire(import.meta.url);
const electron = require.resolve("electron");
require.cache[electron] = { id: electron, filename: electron, loaded: true, exports: { app: { getPath: () => userData } } };
const store = require("../out/lib/store.js");
const { pickPort } = require("../out/lib/server.js");

const settings = path.join(userData, "settings.json");
const saved = () => JSON.parse(fs.readFileSync(settings, "utf8")).projects;
const start = (...dirs) => {
  fs.writeFileSync(settings, JSON.stringify({ projects: dirs.map((dir) => ({ path: dir, openedAt: 1 })) }));
};

function hold(port) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on("error", reject);
    server.listen(port, "127.0.0.1", () => resolve(server));
  });
}

test("one project gets the same port on every launch", async () => {
  start("/p/one");
  const first = await pickPort("/p/one", store);
  assert.equal(store.portOf("/p/one"), first);
  assert.equal(await pickPort("/p/one", store), first);
  assert.equal(await pickPort("/p/one", store), first);
});

test("a remembered port something else holds is stepped around, and stays remembered", async () => {
  start("/p/one");
  const kept = await pickPort("/p/one", store);
  const squatter = await hold(kept);
  try {
    const now = await pickPort("/p/one", store);
    assert.notEqual(now, kept);
    assert.equal(store.portOf("/p/one"), kept);
  } finally {
    await new Promise((done) => squatter.close(done));
  }
  assert.equal(await pickPort("/p/one", store), kept);
});

test("two projects never remember the same port", async () => {
  start("/p/one", "/p/two");
  const one = await pickPort("/p/one", store);
  // The OS is free to hand the same port out again — the store has to refuse it.
  store.rememberPort("/p/two", one);
  assert.equal(store.portOf("/p/two"), null);
  const two = await pickPort("/p/two", store);
  assert.notEqual(two, one);
  assert.deepEqual(store.otherPorts("/p/two"), [one]);
  assert.deepEqual(store.otherPorts("/p/one"), [two]);
});

test("opening, and forgetting another project, keep the port", async () => {
  start("/p/one", "/p/two");
  const port = await pickPort("/p/one", store);
  store.rememberRepo("/p/one");
  assert.equal(store.portOf("/p/one"), port);
  store.forgetProject("/p/two");
  assert.equal(store.portOf("/p/one"), port);
  assert.deepEqual(saved().map((p) => p.path), ["/p/one"]);
});

test("a project opened for the first time is given its port once it is listed", async () => {
  start();
  const port = await pickPort("/p/new", store);
  assert.equal(store.portOf("/p/new"), null);
  store.rememberRepo("/p/new");
  store.rememberPort("/p/new", port);
  assert.equal(await pickPort("/p/new", store), port);
});

test("a port that is not one reads as none", async () => {
  for (const port of ["4000", 0, -1, 70000, 12.5, null]) {
    fs.writeFileSync(settings, JSON.stringify({ projects: [{ path: "/p/one", openedAt: 1, port }] }));
    assert.equal(store.portOf("/p/one"), null);
  }
  const port = await pickPort("/p/one", store);
  assert.equal(saved()[0].port, port);
});
