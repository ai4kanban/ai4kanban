// Sorting what went wrong into the handful of categories the user is shown.
//
// The classification happens where the error is raised — a status code, a
// `node` error code — and travels as an `UpdateFailure`. Nothing downstream
// reads an error message to decide what happened, so the words each surface
// prints can change freely, and a reason is only ever shown when the category
// behind it is certain.
//
// Which of them are worth trying again is the same judgement: a category the
// network or the release server owns gets the backoff, one this machine owns
// (no room on the disk, a folder that cannot be written) does not — waiting
// will not change it.

import type { UpdateFailure } from "../../shared/bridge";

export type { UpdateFailure };

/** An error that already knows its category. */
export class UpdateFailed extends Error {
  constructor(
    readonly failure: UpdateFailure,
    cause?: unknown,
  ) {
    super(failure, { cause });
    this.name = "UpdateFailed";
  }
}

const RETRIED = new Set<UpdateFailure>(["network", "timeout", "server", "checksum"]);

/** Whether waiting and trying again could plausibly change the answer. */
export function retriable(failure: UpdateFailure): boolean {
  return RETRIED.has(failure);
}

/** What an HTTP status means for an update. A rate limit or a server error is
 *  the release host having a bad minute; anything else is a release we cannot
 *  read, which trying again will not fix. */
export function failureOfStatus(status: number): UpdateFailure {
  return status === 429 || status >= 500 ? "server" : "unknown";
}

const CODES: Record<string, UpdateFailure> = {
  ENOTFOUND: "network",
  EAI_AGAIN: "network",
  ECONNREFUSED: "network",
  ECONNRESET: "network",
  ENETUNREACH: "network",
  ENETDOWN: "network",
  EHOSTUNREACH: "network",
  EPIPE: "network",
  ETIMEDOUT: "timeout",
  ERR_SOCKET_CONNECTION_TIMEOUT: "timeout",
  ENOSPC: "disk",
  EDQUOT: "disk",
  EACCES: "permission",
  EPERM: "permission",
  EROFS: "permission",
};

/** The category behind any thrown thing. Everything unrecognised is `unknown`,
 *  which the user reads as "update failed" and nothing more. */
export function failureOf(e: unknown): UpdateFailure {
  if (e instanceof UpdateFailed) return e.failure;
  const code = (e as { code?: unknown })?.code;
  if (typeof code === "string" && CODES[code]) return CODES[code];
  const cause = (e as { cause?: unknown })?.cause;
  if (cause && cause !== e) return failureOf(cause);
  return "unknown";
}
