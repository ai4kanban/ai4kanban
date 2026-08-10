"use strict";

// The little the app remembers between launches, in one JSON file under the
// user's app-data folder.
//
// It is deliberately almost nothing: the last repo it opened, and the version
// of an update the user said "later" to. There is no project list — the app
// shows one board at a time, and pointing a window with no terminal at a folder
// is the whole of what this is for. Nothing about the board itself is kept
// here; the markdown files in `docs/kanban/` stay the single source of truth.

const fs = require("node:fs");
const path = require("node:path");
const { app } = require("electron");

function file() {
  return path.join(app.getPath("userData"), "settings.json");
}

function read() {
  try {
    const raw = JSON.parse(fs.readFileSync(file(), "utf8"));
    return raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  } catch {
    // No file yet, or one somebody hand-edited into nonsense. Either way the
    // app opens as if it were the first time, which is a fine place to be.
    return {};
  }
}

function write(patch) {
  const next = { ...read(), ...patch };
  try {
    fs.mkdirSync(path.dirname(file()), { recursive: true });
    fs.writeFileSync(file(), `${JSON.stringify(next, null, 2)}\n`);
  } catch {
    // A settings file we can't write costs the user one folder pick next
    // launch. Not worth an error in their face.
  }
  return next;
}

/** The repo the app last opened, or null when there isn't one any more — a
 *  remembered folder that has since been moved or deleted counts as none, so
 *  the app asks again instead of opening a window onto nothing. */
function lastRepo() {
  const dir = read().repo;
  if (typeof dir !== "string" || !dir) return null;
  try {
    return fs.statSync(dir).isDirectory() ? dir : null;
  } catch {
    return null;
  }
}

function rememberRepo(dir) {
  write({ repo: dir });
}

/** The newest version the user has already been told about and waved off. */
function skippedVersion() {
  const v = read().skippedVersion;
  return typeof v === "string" ? v : null;
}

function skipVersion(version) {
  write({ skippedVersion: version });
}

module.exports = { lastRepo, rememberRepo, skippedVersion, skipVersion };
