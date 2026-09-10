// Where Cloud is, and the calls these pages make of it (#322, #364).
//
// None of the three values below is secret: the publishable key's whole job is to let
// Supabase Auth answer a sign-in and a refresh, and it reaches nothing — the `api` schema
// grants nothing to `anon` or `authenticated`, which `cloud/npm run check:closed` proves
// from outside. They are the same three `cli/src/lib/cloud/config.ts` carries, and the
// environment overrides each one so a deploy can be pointed at a throwaway project.

import type { BoardRead } from "@/lib/format/board/assemble";
import type { CloudEvent } from "@/lib/format/cloud/events";

const SUPABASE_URL = "https://yajrbpprmdvtkvjjfpbk.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_ioUQ23BTtoj8NKqndp0Jrw_omVR3m4n";
const API_URL = "https://api.ai4kanban.dev";

const trimSlash = (url: string) => url.replace(/\/+$/, "");

export const endpoints = () => ({
  supabaseUrl: trimSlash(process.env.AI4KANBAN_SUPABASE_URL || SUPABASE_URL),
  anonKey: process.env.AI4KANBAN_SUPABASE_ANON_KEY || SUPABASE_ANON_KEY,
  api: trimSlash(process.env.AI4KANBAN_CLOUD_URL || API_URL),
});

/**
 * How a read ended, in the two ways a reader is answered.
 *
 * They are kept apart on purpose. `refused` is the one answer a signed-out visitor, an
 * account with no claim on the workspace, a deleted workspace and a made-up id all get, so
 * none of them learns anything from the difference. `unavailable` is the service having a
 * bad minute — never that refusal, so nothing ever tells a member their live board does not
 * exist.
 */
export type Read<T> = { ok: true; value: T } | { ok: false; why: "refused" | "unavailable" };

const REFUSED: Read<never> = { ok: false, why: "refused" };
const UNAVAILABLE: Read<never> = { ok: false, why: "unavailable" };

async function get<T>(path: string, token: string): Promise<Read<T>> {
  let response: Response;
  try {
    response = await fetch(`${endpoints().api}${path}`, {
      headers: { authorization: `Bearer ${token}`, accept: "application/json" },
      cache: "no-store",
    });
  } catch {
    return UNAVAILABLE;
  }
  if (response.ok) {
    try {
      return { ok: true, value: (await response.json()) as T };
    } catch {
      return UNAVAILABLE;
    }
  }
  // Anything the service says no to is the one refusal; anything it could not answer is the
  // other. A 400 is in the first group deliberately: a workspace id that is not an id at all
  // is a made-up one, and it meets what a made-up one meets.
  return response.status >= 500 ? UNAVAILABLE : REFUSED;
}

/** One workspace, as the two hosted screens draw it. */
export const readBoard = (workspaceId: string, token: string): Promise<Read<BoardRead>> =>
  get<BoardRead>(`/v1/workspaces/${encodeURIComponent(workspaceId)}/read`, token);

/** A workspace this account may reach, as the landing page lists it. */
export interface WorkspaceRef {
  id: string;
  name: string;
}

/** Every workspace this account reaches, for the page that holds no id. An account we have
 *  not admitted to the preview reaches none, which is the same screen as an admitted account
 *  with no workspace yet: there is nothing to open either way. */
export async function readWorkspaces(token: string): Promise<Read<WorkspaceRef[]>> {
  const answer = await get<{ workspaces: WorkspaceRef[] }>("/v1/workspaces", token);
  if (answer.ok) return { ok: true, value: answer.value.workspaces ?? [] };
  return answer.why === "unavailable" ? UNAVAILABLE : { ok: true, value: [] };
}

/** The decisions this workspace's board is raising (#364) — one live event per card that is
 *  waiting on somebody. A read that fails answers with none: a card page draws the card
 *  whether or not it could tell what it is waiting on, and no controls is the safe half. */
export async function readEvents(workspaceId: string, token: string): Promise<CloudEvent[]> {
  const answer = await get<{ events: CloudEvent[] }>(
    `/v1/workspaces/${encodeURIComponent(workspaceId)}/events`,
    token,
  );
  return answer.ok ? (answer.value.events ?? []) : [];
}

// ---- the one write these pages make (#364) ----------------------------------
//
// A member approves a delivery for review, or answers a card's open questions. Both are the
// same durable action on the card's live event that the app, Slack and Lark record, so this
// is a fourth caller of a shape three surfaces already share.
//
// It leaves the browser through this app's own server: the session is an `httpOnly` cookie a
// script cannot read, so a route handler holds the token and nothing on the page ever carries
// one.

/** One answer to one of an event's questions, in the event's own order. */
export interface EventAnswer {
  picked: number[];
  text: string;
}

/**
 * How a press ended.
 *
 * A refusal and an outage are kept apart, which is the whole reason this is not `Read<T>`: a
 * press the service refuses says why in the service's own words — the event was answered
 * elsewhere, the card has moved, this account is not in the workspace — and a press it could
 * not answer says so and leaves the decision unmade. Reading the second as the first would
 * tell somebody their decision was rejected when nothing ever reached the service.
 */
export type Press =
  | { ok: true; state: string }
  | { ok: false; why: "refused" | "unavailable"; error: string };

/** What every outage says. Never the service's own words, because there were none. */
export const UNREACHABLE = "unreachable";

/** Record the one action a card's live event carries. */
export async function pressEvent(
  eventId: string,
  token: string,
  body: { opId: string; decision: "implement" | "answer"; revision: string; answers: EventAnswer[] },
): Promise<Press> {
  let response: Response;
  try {
    response = await fetch(`${endpoints().api}/v1/events/${encodeURIComponent(eventId)}/action`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        accept: "application/json",
        "content-type": "application/json",
      },
      // A browser decision waits for a machine: nothing runs until one of the workspace's own
      // machines claims it, and the card says so until one does.
      body: JSON.stringify({ ...body, state: "waiting_for_server" }),
      cache: "no-store",
    });
  } catch {
    return { ok: false, why: "unavailable", error: UNREACHABLE };
  }

  const said = (await response.json().catch(() => null)) as
    | { event?: { state?: string }; error?: { message?: string } }
    | null;
  if (response.ok) return { ok: true, state: said?.event?.state ?? "accepted" };
  if (response.status >= 500) return { ok: false, why: "unavailable", error: UNREACHABLE };
  return { ok: false, why: "refused", error: said?.error?.message ?? "" };
}

// ---- who the reader is (#575) -----------------------------------------------

/** The account the header names — `GET /v1/session`'s own fields, narrowed to the four a
 *  menu draws. The route is open to a sign-in Cloud has not admitted, so a refused account
 *  still sees which one it is signed in as. */
export interface HostedAccount {
  handle: string | null;
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
}

/**
 * Who this browser is signed in as, or null.
 *
 * Null on every failure. The header is not the page: a member whose board reads fine gets
 * the neutral avatar when this one call does not answer, rather than a board that refuses to
 * draw because the name to put on it could not be fetched.
 */
export async function readAccount(token: string): Promise<HostedAccount | null> {
  const answer = await get<{ session?: Partial<HostedAccount> }>("/v1/session", token);
  if (!answer.ok || !answer.value.session) return null;
  const { handle, name, email, avatarUrl } = answer.value.session;
  return {
    handle: handle ?? null,
    name: name ?? null,
    email: email ?? null,
    avatarUrl: avatarUrl ?? null,
  };
}

/** What to call this account on screen: the name it gave, else the handle the provider
 *  attests, else the address. Empty when it has none of the three, and the menu drops the
 *  line rather than drawing a blank one. */
export const accountName = (account: HostedAccount): string =>
  account.name || account.handle || account.email || "";

/** The address to draw under that name, or null when the name IS the address — an account
 *  with neither a name nor a handle would otherwise be drawn its email twice. */
export const accountAddress = (account: HostedAccount): string | null =>
  account.email && account.email !== accountName(account) ? account.email : null;
