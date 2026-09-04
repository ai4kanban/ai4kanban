// Where Cloud is, and the reads these pages make of it (#322).
//
// None of the three values below is secret: the publishable key's whole job is to let
// Supabase Auth answer a sign-in and a refresh, and it reaches nothing — the `api` schema
// grants nothing to `anon` or `authenticated`, which `cloud/npm run check:closed` proves
// from outside. They are the same three `cli/src/lib/cloud/config.ts` carries, and the
// environment overrides each one so a deploy can be pointed at a throwaway project.

import type { BoardRead } from "@/lib/format/board/assemble";

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
