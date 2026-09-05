"use client";

import { ENDPOINT, VERSION } from "../../telemetry/contract";
import type { EventName } from "../../telemetry/contract";
import type { Arch, OS } from "@/components/download/builds";
import { isTranslatedLocale, stripLocale } from "./i18n";

// What the site counts (#297), and the only place it is sent from.
//
// Two events and nothing else: a page was loaded, a download button was pressed. Nothing
// is stored in the browser — no cookie, no local storage, no identifier of any kind — so
// there is no banner to show and no press is ever tied to the visit before it. The rate
// this produces is therefore per visit, not per person.
//
// The names and the fields are `telemetry/contract.ts`'s, imported rather than copied, so
// a field renamed on the server's side stops the build here instead of losing a number in
// silence. `next.config.mjs` turns on `experimental.externalDir` for that import.
//
// A count that fails is lost: no retry, no queue, and nothing the reader sees ever waits
// on one.

/** Which download button was pressed. `page` is the path, and the landing page carries
 *  two of them, so which one works is a number that needs a field of its own. */
export type Place = "hero" | "start" | "download" | "builds";

/** Where a batch goes. A build made for development posts into the development copy, so
 *  trying the counter never moves the real numbers. */
const endpoint =
  process.env.NODE_ENV === "production" ? ENDPOINT.production : ENDPOINT.development;

/** The app's own word for each system, so one word means one thing across the two senders.
 *  The architecture stays the site's: the browser distinguishes arm from x86 and nothing
 *  finer, which is a coarser fact than the app's `process.arch`. */
const SYSTEM: Record<OS, string> = { mac: "macos", windows: "windows", linux: "linux" };

/** One page load. Called once per document — the site uses `next/link` nowhere, so every
 *  navigation is a full load and there is no route change to listen for. */
export function countPageView(): void {
  send("page_view", {});
}

/** A click on a link that leaves for GitHub: a release file, or the release page. A click
 *  that stays on the site is not a press, and is counted as the view of the page it lands
 *  on. A press with nothing detected still counts, as `unknown` twice. */
export function countDownloadPress(press: {
  place: Place;
  os: OS | null;
  arch: Arch;
  version: string;
}): void {
  send("download_press", {
    place: press.place,
    os: press.os ? SYSTEM[press.os] : "unknown",
    arch: press.arch ?? "unknown",
    version: press.version,
  });
}

function send(name: EventName, fields: Record<string, string>): void {
  try {
    const path = window.location.pathname;
    const body = JSON.stringify({
      v: VERSION,
      events: [{ name, day: today(), page: pageOf(path), language: languageOf(path), ...fields }],
    });
    // A string body, so this is a simple request and the browser sends no preflight. A
    // preflight would cost a round trip the click does not wait for, and the press would
    // be lost to the navigation behind it.
    if (navigator.sendBeacon?.(endpoint, body)) return;
    void fetch(endpoint, { method: "POST", body, keepalive: true }).catch(() => {});
  } catch {
    // A count is never worth an error the reader meets.
  }
}

/** The route with its language prefix removed, so a page reads across languages. Cut to
 *  what the contract stores rather than sent whole and dropped. The landing page is `/` in
 *  every language. */
function pageOf(pathname: string): string {
  return (stripLocale(pathname) || "/").slice(0, 64);
}

/** The language in its own field, so a language reads across pages. */
function languageOf(pathname: string): string {
  const first = pathname.split("/")[1] ?? "";
  return isTranslatedLocale(first) ? first : "en";
}

/** The calendar date as THIS browser's clock and time zone saw it — never the time the
 *  batch arrives, which would move an evening's visit onto the next day for half the world. */
function today(at = new Date()): string {
  const two = (n: number) => String(n).padStart(2, "0");
  return `${at.getFullYear()}-${two(at.getMonth() + 1)}-${two(at.getDate())}`;
}
