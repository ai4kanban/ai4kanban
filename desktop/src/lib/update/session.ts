// One newer version, and how far along installing it is.
//
// The whole of what the notice draws lives here rather than in the page: the
// download belongs to the app, so moving between the board and a card, or
// reloading either, finds the same download exactly where it was.
//
// Three states and no more. `idle` is a version offered and nothing started —
// nothing downloads before the click, and this is the only state a version can
// be waved off in. `downloading` shows progress and the app stays usable behind
// it. `ready` has the bytes on disk, checked, and installs on the restart the
// user picks and never before. A failure goes back to `idle` carrying what went
// wrong, which puts the notice back the way it was with a sentence added.
//
// Nothing here touches Electron, the network or the disk — the work arrives as
// hooks, so the states and their guards can be checked on their own.

import path from "node:path";
import type { FeedFile } from "./feed";

export type UpdateStage = "idle" | "downloading" | "ready";

/** A newer version, and the one build of it this machine takes. */
export interface Found {
  version: string;
  /** The downloads page — the fallback, and all a blocked copy is offered. */
  url: string;
  file: FeedFile;
  assetUrl: string;
}

export interface UpdateStatus {
  version: string;
  url: string;
  stage: UpdateStage;
  received: number;
  total: number;
  /** Why this copy cannot install it itself. Null when it can. */
  blocked: string | null;
  /** What went wrong last time, ready to print. */
  error: string | null;
}

export interface SessionHooks {
  /** Where a file of this name lands. */
  stage(name: string): string;
  /** Fetch it and check it against the sha512 published beside it. Rejects with
   *  a sentence the notice can print as it stands. */
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
  /** Something changed and the notice should be redrawn. */
  changed(): void;
}

export class UpdateSession {
  stage: UpdateStage = "idle";
  received = 0;
  total = 0;
  error: string | null = null;
  private downloaded: string | null = null;
  private percent = -1;

  constructor(
    readonly found: Found,
    readonly blocked: string | null,
    private readonly hooks: SessionHooks,
  ) {}

  status(): UpdateStatus {
    return {
      version: this.found.version,
      url: this.found.url,
      stage: this.stage,
      received: this.received,
      total: this.total,
      blocked: this.blocked,
      error: this.error,
    };
  }

  /** Waving a version off is offered only before a download starts. */
  canSkip(): boolean {
    return this.stage === "idle";
  }

  /** Begin, once and only when asked. A second click while one is going, and a
   *  click on a copy that cannot install, both do nothing. */
  async start(): Promise<void> {
    if (this.blocked || this.stage !== "idle") return;
    const into = this.hooks.stage(path.basename(this.found.file.url));
    this.stage = "downloading";
    this.error = null;
    this.received = 0;
    this.total = this.found.file.size;
    this.percent = -1;
    this.hooks.changed();
    try {
      await this.hooks.download(this.found.assetUrl, into, this.found.file.sha512, (received, total) => {
        this.received = received;
        if (total) this.total = total;
        // One message per whole percent. The bytes arrive far faster than a
        // progress bar can say anything about.
        const percent = this.total ? Math.floor((received / this.total) * 100) : -1;
        if (percent === this.percent) return;
        this.percent = percent;
        this.hooks.changed();
      });
      await this.hooks.prepare(into);
      this.downloaded = into;
      this.stage = "ready";
    } catch (e) {
      // Nothing has been written into place, so the running app is untouched:
      // back to the notice it had, carrying what went wrong.
      this.downloaded = null;
      this.stage = "idle";
      this.error = e instanceof Error ? e.message : String(e);
    }
    this.hooks.changed();
  }

  /** Install it. True when the app should now quit; false when there is nothing
   *  downloaded to install. */
  install(): boolean {
    if (this.stage !== "ready" || !this.downloaded) return false;
    this.hooks.apply(this.downloaded);
    return true;
  }
}
