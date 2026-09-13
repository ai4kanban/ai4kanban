// One newer version, and how far along installing it is.
//
// The whole of what the chip draws lives here rather than in the page: the
// download belongs to the app, so moving between the board and a card, or
// reloading either, finds the same download exactly where it was.
//
// Three states and no more. `idle` is nothing under way. `downloading` covers
// the bytes and the waits between retries alike — a retry is still this one
// download, and the chip stays quiet through all of it. `ready` has the bytes on
// disk, checked, and installs on the restart the user picks and never before. A
// download that gives up goes back to `idle` carrying the category of what went
// wrong, which is the one thing the user is ever shown.
//
// Nothing here touches Electron, the network or the disk — the work arrives as
// hooks, so the states and their guards can be checked on their own.

import path from "node:path";
import type { UpdateFailure, UpdateStage, UpdateStatus } from "../../shared/bridge";
import { failureOf, retriable } from "./failure";
import { isNewer, type FeedFile } from "./feed";

export type { UpdateStage, UpdateStatus };

/** How long to wait before each retry. A network that is down is usually down
 *  for minutes, not seconds, and nothing on screen is waiting on this. */
export const RETRY_WAITS = [30_000, 120_000, 600_000];

/** A newer version, and the one build of it this machine takes. */
export interface Found {
  version: string;
  file: FeedFile;
  assetUrl: string;
}

export interface SessionHooks {
  /** Where a file of this name lands, in this version's own staging folder. */
  stage(name: string): string;
  /** Fetch it and check it against the sha512 published beside it. Rejects with
   *  an error `failureOf` can categorise. */
  download(
    url: string,
    into: string,
    expected: string,
    onProgress: (received: number, total: number) => void,
  ): Promise<void>;
  /** Get what landed ready to go in, while the app is still up. */
  prepare(downloaded: string): Promise<void>;
  /** Put it in place. The app quits behind this. */
  apply(downloaded: string): void;
  /** Throw away whatever this version staged. */
  discard(): void;
  /** Wait out a retry. Injected so a test does not sleep. */
  wait(ms: number): Promise<void>;
  /** Something changed and the chip should be redrawn. */
  changed(): void;
}

export class UpdateSession {
  stage: UpdateStage = "idle";
  received = 0;
  total = 0;
  failure: UpdateFailure | null;
  private downloaded: string | null = null;
  private percent = -1;
  /** A higher release replaced this one. Whatever is still in flight runs to its
   *  end and is thrown away: nothing here can stop a download mid-flight, and a
   *  session that keeps reporting after it has been superseded would put a
   *  version on the chip that will never be installed. */
  private dropped = false;

  constructor(
    readonly found: Found,
    /** Set when this copy cannot replace itself — nothing downloads. */
    readonly blocked: UpdateFailure | null,
    private readonly hooks: SessionHooks,
  ) {
    this.failure = blocked;
  }

  get version(): string {
    return this.found.version;
  }

  status(): UpdateStatus {
    return {
      version: this.found.version,
      stage: this.stage,
      received: this.received,
      total: this.total,
      failure: this.failure,
    };
  }

  /** Give this version up for a higher one. */
  abandon(): void {
    if (this.dropped) return;
    this.dropped = true;
    if (this.stage !== "downloading") this.scrap();
  }

  /** Begin, on the app's own initiative. A copy that cannot install downloads
   *  nothing, and neither does a second call while one is already going. */
  async start(): Promise<void> {
    if (this.blocked || this.stage !== "idle" || this.dropped) return;
    this.stage = "downloading";
    this.failure = null;
    this.total = this.found.file.size;
    this.announce();
    for (let attempt = 0; ; attempt++) {
      try {
        await this.attempt();
        if (this.gone()) return;
        this.stage = "ready";
        break;
      } catch (e) {
        if (this.gone()) return;
        const failure = failureOf(e);
        if (retriable(failure) && attempt < RETRY_WAITS.length) {
          // Still `downloading` as far as anyone outside can see: the wait is
          // part of this download, and a chip that flickered red between
          // attempts would be reporting a failure the app has not had yet.
          this.scrap();
          await this.hooks.wait(RETRY_WAITS[attempt] ?? 0);
          if (this.gone()) return;
          continue;
        }
        // Nothing was written into place, so the running app is untouched.
        this.stage = "idle";
        this.failure = failure;
        this.scrap();
        break;
      }
    }
    this.announce();
  }

  private async attempt(): Promise<void> {
    this.received = 0;
    this.percent = -1;
    this.downloaded = null;
    const into = this.hooks.stage(path.basename(this.found.file.url));
    await this.hooks.download(this.found.assetUrl, into, this.found.file.sha512, (received, total) => {
      this.received = received;
      if (total) this.total = total;
      // One message per whole percent. The bytes arrive far faster than
      // anything watching could use.
      const percent = this.total ? Math.floor((received / this.total) * 100) : -1;
      if (percent === this.percent) return;
      this.percent = percent;
      this.announce();
    });
    await this.hooks.prepare(into);
    this.downloaded = into;
  }

  /** True once a higher release has taken over: clean up and say nothing more. */
  private gone(): boolean {
    if (!this.dropped) return false;
    this.scrap();
    return true;
  }

  private scrap(): void {
    this.downloaded = null;
    try {
      this.hooks.discard();
    } catch {
      // A staging folder that will not delete is litter, not a failure the user
      // has anything to do about.
    }
  }

  private announce(): void {
    if (!this.dropped) this.hooks.changed();
  }

  /**
   * Install it. True when the app should now quit; false when there is nothing
   * to install, when `version` is not what this session holds, or when starting
   * the swap failed.
   *
   * The version is the guard on a stale click: the chip names the version it
   * shows, and between the press and the message arriving a higher release can
   * have superseded it. A request for a version this session is not holding is
   * refused rather than quietly installing something else.
   */
  install(version: string): boolean {
    if (this.stage !== "ready" || !this.downloaded) return false;
    if (version !== this.found.version) return false;
    try {
      this.hooks.apply(this.downloaded);
    } catch (e) {
      // The swap never started, so the app must stay up and say so.
      this.stage = "idle";
      this.downloaded = null;
      this.failure = failureOf(e);
      this.scrap();
      this.announce();
      return false;
    }
    return true;
  }
}

/**
 * What a fresh check means for the session already in hand.
 *
 * Its own function because it is the whole of how two versions meeting is
 * settled, and the rest of that path needs an app to run:
 *
 * - `keep` — nothing newer, or the check did not get through. What is in hand
 *   stands, download and all: asking must never throw one away.
 * - `retry` — the same version, given up on earlier. A fresh session is the
 *   reset, which is how a user who has fixed their network gets the update
 *   without restarting the app.
 * - `supersede` — a higher release. The one in hand is abandoned, and the chip
 *   names the version that will actually be installed.
 * - `clear` — this copy is up to date after all.
 */
export type Verdict = "keep" | "retry" | "supersede" | "clear";

export function verdictOn(
  held: Pick<UpdateSession, "version" | "stage" | "failure"> | null,
  found: { version: string } | null,
): Verdict {
  if (!found) {
    if (!held) return "clear";
    return held.stage !== "idle" || held.failure ? "keep" : "clear";
  }
  if (!held || isNewer(found.version, held.version)) return "supersede";
  // The same version, or an older one a changed feed now offers. A download
  // going or done stands; one that gave up starts over.
  if (held.stage !== "idle") return "keep";
  return held.version === found.version ? "retry" : "keep";
}
