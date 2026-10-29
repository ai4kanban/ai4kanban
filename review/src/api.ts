// The cloud Worker's shared-review routes. Every call carries the sign-in when there is one;
// a 401 `unauthenticated` refreshes it once and asks again.

import { freshSession } from "./auth";
import { API_URL } from "./config";
import { LANG, type Lang } from "./i18n";

export type Author = { kind: "reviewer"; email: string; handle?: string | null } | { kind: "user"; handle: string } | { kind: "api_key"; id: string; name: string };

export type ArtifactVersion = {
  version: number;
  content: unknown | null;
  file: { size: number; content_type: string; url: string } | null;
  /** The developer component pinned to draw it (#2006). */
  component?: { name: string; version: string } | null;
  created_at: string;
};

export type Artifact = { id: string; type: string; name: string; latest_version: number | null; versions: ArtifactVersion[] };

export type Decision = {
  id: string;
  /** The phase it was made in. */
  phase: number;
  decision: "approve" | "request_changes";
  comment: string;
  decided_by: Author;
  review_revision: number | null;
  created_at: string;
};

export type Comment = { id: string; phase: number; body: string; author: Author; created_at: string };

export type Link = { id: string; access: "invited" | "link"; expires_at: string };

export type Guest = { email: string; created_at: string };

export type Connector = "claude-code" | "codex" | "cursor" | "opencode" | "kimi" | "dsh" | "zcode" | "grok";

/** A runtime the chat can run on; `id: "task"` is the task's, `name` null when it isn't yours. */
export type ChatRuntime = {
  id: string;
  name: string | null;
  default: boolean;
  connector: Connector;
  model: string | null;
  status: "ready" | "not_installed" | "signed_out";
};

/** Tokens: fresh input, cache writes, cache reads, output. */
export type Usage = { input: number; cacheCreation: number; cacheRead: number; output: number };

/** A reply's `usage`, `cost_usd` and `duration_ms` come from the job that wrote it; null on an older one. */
export type ChatMessage = {
  id: string;
  role: "user" | "agent";
  body: string;
  created_at: string;
  image_names?: string[];
  stopped?: boolean;
  usage?: Usage | null;
  cost_usd?: number | null;
  duration_ms?: number | null;
};

/** A picture sent with a message, its bytes in base64. */
export type ChatImage = { name: string; type: string; content: string };

export interface Chat {
  messages: ChatMessage[];
  status: "idle" | "queued" | "replying" | "failed" | "conflict";
  /** The replying run's job, null when idle. */
  job: string | null;
  /** A runtime id, or `task` while following the task's. */
  runtime: string;
  runtimes: ChatRuntime[];
  runner: { connected: boolean };
  context: { used: number; limit: number } | null;
}

export interface Shared {
  object: "shared_review";
  /** `null`: opened by the link alone, read only. */
  role: "owner" | "member" | "guest" | null;
  me: { email: string | null; handle: string | null } | null;
  link: Link;
  owner: { handle: string; name: string | null; avatar_url: string | null };
  task: { id: string; title: string; status: string; workflow: string; project: string | null };
  /** The task's review; `status` null until a draft is submitted, absent for a visitor. */
  review: {
    status?: "ready" | "approved" | "changes_requested" | null;
    phase: number | null;
    revision: number;
    question: string;
    options: { label: string; approve: boolean }[] | null;
    /** Set when the review asks the card's open question: no option approves, and any answer requests changes. */
    card_question?: number | null;
  };
  card: {
    version: number;
    body: string;
    metadata: Record<string, unknown>;
    assets: Record<string, { artifact: string; version?: number }>;
  } | null;
  /** Each preview the body draws, named by agent id. */
  names?: Record<string, { en?: string; zh?: string }>;
  artifacts: Artifact[];
  decisions?: Decision[];
  comments?: Comment[];
  revisions?: { revision: number; phase: number; created_at: string }[];
  guests?: Guest[];
}

/** What went wrong, by the Worker's own code; `offline` when the request never landed. */
export class ApiError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    /** The refusal's own fields, such as `connector` and `reason` on `runtime_unavailable`. */
    readonly info: Record<string, unknown> = {},
  ) {
    super(code);
  }
}

async function call(path: string, init: RequestInit = {}, retried = false): Promise<Response> {
  const session = await freshSession();
  const headers = new Headers(init.headers);
  if (session) headers.set("authorization", `Bearer ${session.access_token}`);
  if (!path.startsWith("http")) headers.set("x-akb-lang", LANG);
  if (init.body) headers.set("content-type", "application/json");
  let r: Response;
  try {
    r = await fetch(path.startsWith("http") ? path : `${API_URL}${path}`, { ...init, headers });
  } catch {
    throw new ApiError("offline", 0);
  }
  if (r.ok) return r;
  const body = (await r.json().catch(() => null)) as { error?: { code?: string } } | null;
  const code = body?.error?.code ?? (r.status === 404 ? "not_found" : "error");
  if (code === "unauthenticated" && session && !retried && (await freshSession(true))) return call(path, init, true);
  throw new ApiError(code, r.status, body?.error);
}

const json = async <T>(r: Promise<Response>) => (await (await r).json()) as T;
const path = (token: string) => `/v1/shared/${encodeURIComponent(token)}`;

export const readShared = (token: string) => json<Shared>(call(path(token)));

export const postComment = (token: string, body: string) =>
  json<Comment>(call(`${path(token)}/comments`, { method: "POST", body: JSON.stringify({ body }) }));

export const postDecision = (token: string, answer: { picked?: number; text?: string; review_revision: number }) =>
  json<Decision>(call(`${path(token)}/decisions`, { method: "POST", body: JSON.stringify(answer) }));

/** A member's view of the approval the card is on, `round` of `rounds`. */
export const readTaskWorkflow = (task: string) =>
  json<{ round: number; rounds: number }>(call(`/v1/tasks/${encodeURIComponent(task)}/workflow`));

/** A member's 移除: the task ends and frees its place on the plan. */
export const cancelTask = (task: string, reason?: string) =>
  call(`/v1/tasks/${encodeURIComponent(task)}/cancel`, { method: "POST", ...(reason ? { body: JSON.stringify({ reason }) } : {}) });

export const updateLink = (id: string, patch: { access: Link["access"] }) =>
  json<Link & { active: boolean }>(call(`/v1/share-links/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(patch) }));

export const createLink = (task: string, body: { access: Link["access"] }) =>
  json<Link & { url: string }>(call(`/v1/tasks/${encodeURIComponent(task)}/share-links`, { method: "POST", body: JSON.stringify(body) }));

export const revokeLink = (id: string) => call(`/v1/share-links/${encodeURIComponent(id)}`, { method: "DELETE" });

const guest = (task: string, email: string) => `/v1/tasks/${encodeURIComponent(task)}/guests/${encodeURIComponent(email)}`;

/** `share_token` is the link being shared: a guest new to the task is emailed it. */
export const addGuest = (task: string, email: string, body: { share_token: string | null; lang: Lang }) =>
  json<Guest & { mail: "sent" | "failed" | null }>(call(guest(task, email), { method: "PUT", body: JSON.stringify(body) }));

export const removeGuest = (task: string, email: string) => call(guest(task, email), { method: "DELETE" });

export const readChat = (token: string) => json<Chat>(call(`${path(token)}/chat`));

export const sendChat = (token: string, body: string, runtime: string, images: ChatImage[] = []) =>
  json<Chat>(call(`${path(token)}/chat`, { method: "POST", body: JSON.stringify({ body, runtime, ...(images.length ? { images } : {}) }) }));

export const stopChat = (token: string) => json<Chat>(call(`${path(token)}/chat/stop`, { method: "POST" }));

export const clearChat = (token: string) => json<Chat>(call(`${path(token)}/chat`, { method: "DELETE" }));

export type SharedComponent = { name: string; version: string; title: { en: string; zh: string }; schema: unknown | null; url: string };

export const readComponent = (token: string, name: string, version: string) =>
  json<SharedComponent>(call(`${path(token)}/components/${encodeURIComponent(name)}/${encodeURIComponent(version)}`));

/** An owner's save from a component: the next version, the card's pins moved onto it. */
export const saveVersion = (artifact: string, content: unknown) =>
  json<ArtifactVersion>(call(`/v1/artifacts/${encodeURIComponent(artifact)}/versions`, { method: "POST", body: JSON.stringify({ content, pin: true }) }));

/** A version's file, read with the sign-in — never with a token in the address. */
export const readFile = (url: string) => call(url).then((r) => r.blob());

/** Kept on the account, so agent replies follow it even where no page asked (#47). */
export const saveLang = (lang: Lang) => call("/v1/language", { method: "PUT", body: JSON.stringify({ lang }) });
