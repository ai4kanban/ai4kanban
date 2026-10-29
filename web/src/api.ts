// Stands in for legacy kanban-ui/app/actions.ts: every read and write is a call to the cloud's
// public `/v1` API with the sign-in. A 401 refreshes the sign-in once and asks again.

import { ApiError, type SharedComponent } from "@review/api";
import { freshSession } from "@review/auth";
import { API_URL } from "@review/config";

export { ApiError };

export type TaskStatus = "queued" | "running" | "waiting_review" | "done" | "failed" | "cancelled" | "stopped";

export interface Task {
  id: string;
  workspace: string;
  key: string;
  project: string;
  workflow: { id: string; name: string; version?: number };
  title: string;
  request: string;
  status: TaskStatus;
  created_at: string;
  updated_at: string;
  card_version: number | null;
  created_by?: string;
  /** `machine` is the computer the step runs on; `stopping` once asked to stop (#2128); `runner_removed` when
   *  a queued step's computer was removed from the workspace (#2143). */
  run?: { state: "queued" | "running"; runner_connected: boolean; machine?: string | null; stopping?: boolean; runner_removed?: boolean; job: string } | null;
  result?: string | null;
  failure?: string | null;
  last_job?: string | null;
  /** The idea conversation it was started from. */
  discussion?: string | null;
  /** A Workflow builder task's: the workflow it changes, then the one it saved. */
  context?: { workflow?: string; created?: boolean };
  cancel_reason?: string | null;
  review?: Review;
  /** Where a built task's commit landed (#2109); null when nothing was committed. */
  landing?: { commit: string; branch: string; machine: string } | null;
  /** Set while a stopped or failed task can resume on the computer holding its work (#2128). */
  resume?: { machine: string } | null;
}

/** A landed commit's changes, read from the computer it landed on; `truncated` leaves out every `patch`. */
export interface TaskDiff {
  commit: string;
  files: { path: string; status: "added" | "modified" | "deleted"; added: number; removed: number; binary?: boolean; patch?: string }[];
  truncated: boolean;
}

/** A follow-up waiting to be sorted (#2067); `task` is the one made of it. */
export interface TriageItem {
  id: string;
  workspace: string;
  project: string;
  title: string;
  text: string;
  source_task: string | null;
  /** The workflow that does its work; null on an item filed before it was asked for. */
  workflow: string | null;
  state: "open" | "dismissed" | "carded";
  dismissed_reason: string | null;
  dismissed_at: string | null;
  task: string | null;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  workspace: string;
  name: string;
  path: string;
  prefix: string;
  /** The workspace's built-in project, where a task created without one goes. */
  general: boolean;
  /** Whether it has a folder on your Runner's computer; set in lists. */
  placed?: boolean;
}

export interface Workspace {
  id: string;
  name: string;
  personal: boolean;
  role: "owner" | "member";
}

export interface Member {
  account: string;
  handle: string;
  name: string | null;
  avatar_url: string | null;
  email: string | null;
  role: "owner" | "member";
}

export interface Workflow {
  id: string;
  builtin: boolean;
  name: string;
  description: string;
  /** The zh/en display names the cloud adds to a built-in. */
  names?: { zh?: string; en?: string };
  name_zh?: string;
  name_en?: string;
}

/** A task's review: `status` null until a draft is submitted; `phase` the approval under review. */
export interface Review {
  status: "ready" | "approved" | "changes_requested" | null;
  phase: number | null;
  revision: number;
  question: string;
  options: { label: string; approve?: boolean }[] | null;
  /** Set when the review asks the card's open question (its 1-based place); answering requests changes. */
  card_question?: number | null;
}

export interface Card {
  task: string;
  version: number;
  body: string;
  metadata: { phase?: number; [k: string]: unknown };
  assets: Record<string, { artifact: string; version?: number }>;
  updated_at: string;
}

export interface Alert {
  id: string;
  kind: "review" | "done" | "failed" | "comment";
  task: string;
  task_title: string;
  project: string | null;
  phase: number | null;
  comment: { id: string; author: { email?: string; handle?: string | null; kind?: string }; body: string } | null;
  read: boolean;
  created_at?: string;
}

type ChatState = "replying" | "waiting_you" | "idle";

/** A task's chat, or an idea conversation (`discussion`). */
export type ChatRow =
  | { task: string; key: string; discussion?: undefined; title: string; project: string | null; last_message_at: string; state: ChatState; host?: undefined }
  | { discussion: string; task?: undefined; title: string; project: string | null; last_message_at: string; state: ChatState; host?: Host };

/** The app an external discussion is held in. */
export type Host = "claude-code" | "codex";
export const HOST_NAMES: Record<Host, string> = { "claude-code": "Claude Code", codex: "Codex" };

export interface Idea {
  id: string;
  title: string;
  outcome: string;
  acceptance: string[];
  workflow: string;
  task: { id: string; key: string } | null;
}

/** An idea conversation: a task chat's shape plus the ideas drafted in it. */
export type Discussion = import("@review/api").Chat & {
  object: "discussion";
  id: string;
  workspace: string;
  project: string | null;
  title: string;
  ideas: Idea[];
  version: number;
  /** Held in a Claude Code or Codex session: no messages here, and a start names `version`. */
  external?: boolean;
  host?: Host | null;
  created_at: string;
  updated_at: string;
};

export interface ShareLink {
  id: string;
  access: "invited" | "link";
  expires_at: string;
  active?: boolean;
  revoked?: boolean;
  url?: string;
}

export interface Me {
  email?: string;
  handle: string | null;
  name: string | null;
  admitted: boolean;
  accountId: string | null;
}

export interface Billing {
  plan: "free" | "pro";
  state: "free" | "active" | "canceled" | "pastDue" | "expired";
  /** The renewal date while `active` or `pastDue`, the end date otherwise. */
  periodEnd: string | null;
  grantEnd: string | null;
  trialEnd: string | null;
}

/** AI credits, Pro's alone; `resetsAt` is null for the trial's pool. */
export interface Credits {
  total: number;
  left: number;
  resetsAt: string | null;
}

export interface Quota {
  limits: { tasks: number; storage: number };
  used: { tasks: number; storage: number };
}

export interface BillingRead {
  billing: Billing;
  credits: Credits | null;
  quota: Quota;
}

export const PRICING_URL = "https://wildcrane.ai/pricing";

export interface Usage {
  input: number;
  cacheCreation: number;
  cacheRead: number;
  output: number;
}

/** One event of a run's log (#2059): `log` text, or ACP-shaped `data` for the rest. */
export interface JobEvent {
  seq: number;
  text: string;
  kind?: "message" | "tool_call" | "tool_call_update" | "plan" | "error" | "log";
  data?: Record<string, unknown> | null;
  at?: string;
}

export interface JobLog {
  job: {
    id: string;
    state: string;
    outcome: string | null;
    createdAt: string;
    finishedAt: string | null;
    reply?: string | null;
    usage?: Usage | null;
    costUsd?: number | null;
  } | null;
}

/** One day of `GET /v1/workspaces/{id}/stats` (#2066); `rejected` is cancelled tasks. */
export interface StatsDay {
  date: string;
  created: number;
  completed: number;
  rejected: number;
  usage: Usage;
  costUsd: number;
}

export type Connector = "claude-code" | "codex" | "cursor" | "opencode" | "kimi" | "dsh" | "zcode" | "grok";

/** One setting a connector declares, as its Runner reported it; `apiKey` is the only secret. */
export interface SettingDecl {
  key: string;
  label: string;
  kind: "text" | "select" | "secret" | "provider";
  help?: string;
  placeholder?: string;
  choices?: { value: string; label: string }[];
  providers?: { id: string; label: string; blurb: string; needs: string[] }[];
  defaultProvider?: string;
}

/** `runner` null, or one no longer in the list, leaves the runtime unusable until another is picked. */
export interface Runtime {
  id: string;
  name: string;
  connector: Connector;
  model: string | null;
  runner: string | null;
  settings: Record<string, string>;
  secretsSet: string[];
  default: boolean;
}

export interface RunnerInfo {
  id: string;
  name: string;
  online: boolean;
}

export interface RuntimeList {
  data: Runtime[];
  connectors: Partial<Record<Connector, "ready" | "not_installed" | "signed_out">>;
  /** What each connector offers on the Runner's computer, as it last reported them. */
  models: Partial<Record<Connector, { id: string; name: string }[]>>;
  connector_settings: Partial<Record<Connector, SettingDecl[]>>;
  runners: RunnerInfo[];
  runner_connected: boolean;
}

export type RuntimeFields = { name: string; runner: string; connector: Connector; model: string | null; settings: Record<string, string> };
/** A body with `secrets` waits until the Runner holds the key; `apiKey: null` clears it. */
export type RuntimePatch = Partial<RuntimeFields> & { secrets?: { apiKey: string | null } };

export interface RuntimeTest {
  result: "passed" | "not_installed" | "signed_out" | "timeout" | "failed";
  connector: Connector;
  elapsed_ms: number | null;
  message: string | null;
}

/** One agent of a project (#2106): its title, rule and, when it runs on its own, its schedule. */
export interface ProjectAgent {
  agent: string;
  title: { en?: string; zh?: string };
  description: { en?: string; zh?: string };
  /** When a preview agent is asked for; empty: on every card. */
  when: { en?: string; zh?: string };
  workflows: string[];
  rule: string;
  /** `cadence` is "auto" or e.g. "6h", "1d at 09:30"; null for an agent that runs per card. */
  schedule: { on: boolean; cadence: string; default: string; last_success: string | null } | null;
  last_run: { at: string; status: "running" | "done" | "failed" } | null;
}

export interface ProjectAgents {
  /** The workflows this project uses, built-ins first. */
  workflows: {
    id: string;
    name: string;
    names: { en?: string; zh?: string };
    builtin: boolean;
    /** Its preview agents, in order. */
    previews: string[];
    /** The approvals they make when a card chooses them all (#2154). */
    stages: string[][];
    /** What runs once the last approval is in; empty: that approval archives the card. */
    land: string[];
    scheduled: string[];
    /** The user's rule for every card on it (#2166). */
    rule: string;
  }[];
  /** The board's own scheduled agents, in order. */
  board: string[];
  data: ProjectAgent[];
}

type Page<T> = { data: T[]; next: string | null };

export async function call(path: string, init: RequestInit = {}, retried = false): Promise<Response> {
  const session = await freshSession();
  if (!session) throw new ApiError("unauthenticated", 401);
  const headers = new Headers(init.headers);
  headers.set("authorization", `Bearer ${session.access_token}`);
  if (init.body) headers.set("content-type", "application/json");
  let r: Response;
  try {
    r = await fetch(`${API_URL}${path}`, { ...init, headers });
  } catch {
    throw new ApiError("offline", 0);
  }
  if (r.ok) return r;
  const body = (await r.json().catch(() => null)) as { error?: { code?: string; quota?: string } } | null;
  const code = body?.error?.code ?? (r.status === 404 ? "not_found" : "error");
  if (code === "unauthenticated" && !retried && (await freshSession(true))) return call(path, init, true);
  const e = new ApiError(code, r.status, body?.error);
  (e as ApiError & { quota?: string }).quota = body?.error?.quota;
  throw e;
}

const json = async <T>(r: Promise<Response>) => (await (await r).json()) as T;
const enc = encodeURIComponent;
const post = (body?: unknown): RequestInit => ({ method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });

/** Every page of a list, up to `max` items. */
async function all<T>(path: string, max = 1000): Promise<T[]> {
  const out: T[] = [];
  let after: string | null = "";
  const sep = path.includes("?") ? "&" : "?";
  while (after !== null && out.length < max) {
    const page: Page<T> = await json<Page<T>>(call(`${path}${sep}limit=100${after ? `&after=${enc(after)}` : ""}`));
    out.push(...page.data);
    after = page.next;
  }
  return out;
}

export const readMe = () => json<{ session: Me }>(call("/v1/session")).then((r) => r.session);

export const listWorkspaces = () => all<Workspace>("/v1/workspaces");
export const createWorkspace = (name: string) => json<Workspace>(call("/v1/workspaces", post({ name })));
export const renameWorkspace = (id: string, name: string) => json<Workspace>(call(`/v1/workspaces/${enc(id)}`, { method: "PATCH", body: JSON.stringify({ name }) }));
export const renameProject = (id: string, name: string) => json<Project>(call(`/v1/projects/${enc(id)}`, { method: "PATCH", body: JSON.stringify({ name }) }));
export const deleteWorkspace = (id: string) => call(`/v1/workspaces/${enc(id)}`, { method: "DELETE" });
export const listMembers = (ws: string) => all<Member>(`/v1/workspaces/${enc(ws)}/members`);
export const addMember = (ws: string, email: string) => json<Member>(call(`/v1/workspaces/${enc(ws)}/members`, post({ email })));
export const setMemberRole = (ws: string, account: string, role: Member["role"]) =>
  json<Member>(call(`/v1/workspaces/${enc(ws)}/members/${enc(account)}`, { method: "PATCH", body: JSON.stringify({ role }) }));
export const removeMember = (ws: string, account: string) => call(`/v1/workspaces/${enc(ws)}/members/${enc(account)}`, { method: "DELETE" });

/** `owner` is its member's display name. */
export type WorkspaceRunner = { machine: string; name: string; owner: string; connected: boolean; last_active: string | null };
export const listRunners = (ws: string) => json<{ runners: WorkspaceRunner[] }>(call(`/v1/workspaces/${enc(ws)}/runners`)).then((r) => r.runners);
export const removeRunner = (ws: string, machine: string) => call(`/v1/workspaces/${enc(ws)}/runners/${enc(machine)}`, { method: "DELETE" });

export const listProjects = (ws: string) => all<Project>(`/v1/projects?workspace=${enc(ws)}`);
export const listTasks = (ws: string) => all<Task>(`/v1/tasks?workspace=${enc(ws)}`);
export const listWorkflows = (ws: string) => all<Workflow>(`/v1/workflows?workspace=${enc(ws)}`);
export type MarketplaceWorkflow = Workflow & { installed: boolean };
export const listMarketplace = (ws: string) => json<Page<MarketplaceWorkflow>>(call(`/v1/marketplace/workflows?workspace=${enc(ws)}`)).then((p) => p.data);
export const installWorkflow = (ws: string, id: string) => json<MarketplaceWorkflow>(call(`/v1/marketplace/workflows/${enc(id)}/install`, post({ workspace: ws })));
export const uninstallWorkflow = (ws: string, id: string) => json<MarketplaceWorkflow>(call(`/v1/marketplace/workflows/${enc(id)}/uninstall`, post({ workspace: ws })));
export const readStats = (ws: string, from: string, to: string, tz: string) =>
  json<{ data: StatsDay[] }>(call(`/v1/workspaces/${enc(ws)}/stats?from=${from}&to=${to}&tz=${enc(tz)}`)).then((r) => r.data);
export const listChats = (ws: string) => json<Page<ChatRow>>(call(`/v1/chats?workspace=${enc(ws)}&limit=50&external=1`)).then((p) => p.data);

export const readTask = (idOrKey: string) => json<Task>(call(`/v1/tasks/${enc(idOrKey)}`));
export const readCard = (task: string) => json<Card>(call(`/v1/tasks/${enc(task)}/card`));
/** Refused `machine_offline` or `commit_gone` when the computer it landed on can't answer. */
export const readDiff = (task: string) => json<TaskDiff>(call(`/v1/tasks/${enc(task)}/diff`));
/** A project's board files changed after `since` (every one without it); a deleted one has no content. */
export const readBoard = (project: string, since: number | null) =>
  json<{ head_seq: number; files: { path: string; content: string | null; seq: number }[] }>(call(`/v1/projects/${enc(project)}/board${since == null ? "" : `?since=${since}`}`));
/** `round` the approval the card is on, of `rounds`; `stages` each one's agents (#2154). */
export const readTaskWorkflow = (task: string) =>
  json<{ name?: string; round: number; rounds: number; stages: string[][]; lands: boolean }>(call(`/v1/tasks/${enc(task)}/workflow`));

export const listRuntimes = () => json<RuntimeList>(call("/v1/runtimes"));
export const createRuntime = (body: Omit<RuntimeFields, "settings"> & { settings?: Record<string, string> }) => json<Runtime>(call("/v1/runtimes", post(body)));
export const updateRuntime = (id: string, body: RuntimePatch) =>
  json<Runtime>(call(`/v1/runtimes/${enc(id)}`, { method: "PATCH", body: JSON.stringify(body) }));
export const deleteRuntime = (id: string) => call(`/v1/runtimes/${enc(id)}`, { method: "DELETE" });
export const testRuntime = (id: string) => json<RuntimeTest>(call(`/v1/runtimes/${enc(id)}/test`, post()));

export const BUILDER = "wf_builtin_workflow_builder";
export const readWorkflow = (id: string) => json<Workflow>(call(`/v1/workflows/${enc(id)}`));
export const deleteWorkflow = (id: string) => json<unknown>(call(`/v1/workflows/${enc(id)}`, { method: "DELETE" }));
export const createTask = ({ images, ...body }: { title: string; request: string; project?: string; workspace: string; workflow: string; runtime?: string; context?: { workflow: string }; triage?: string; skip_plan?: boolean; images?: ChatImage[] }) =>
  json<Task>(call("/v1/tasks", { ...post({ ...body, ...(images?.length ? { images } : {}), source: "web", run: true }), headers: { "idempotency-key": crypto.randomUUID() } }));
export const cancelTask = (task: string, reason?: string) => json<Task>(call(`/v1/tasks/${enc(task)}/cancel`, post(reason ? { reason } : undefined)));
export const stopTask = (task: string) => json<Task>(call(`/v1/tasks/${enc(task)}/stop`, post()));
export const resumeTask = (task: string) => json<Task>(call(`/v1/tasks/${enc(task)}/resume`, post()));

export const listTriage = (ws: string, state: TriageItem["state"]) => all<TriageItem>(`/v1/triage?workspace=${enc(ws)}&state=${state}`, Infinity);
/** One page of sorted items, newest first. */
export const pageTriageHistory = (ws: string, project: string, after: string | null) =>
  json<Page<TriageItem>>(call(`/v1/triage?workspace=${enc(ws)}&project=${enc(project)}&state=dismissed,carded&order=desc&limit=50${after ? `&after=${enc(after)}` : ""}`));
export const dismissTriage = (id: string, reason?: string) => json<TriageItem>(call(`/v1/triage/${enc(id)}/dismiss`, post(reason ? { reason } : undefined)));
export const restoreTriage = (id: string) => json<TriageItem>(call(`/v1/triage/${enc(id)}/restore`, post()));

export const decide = (task: string, body: { decision: "approve" | "request_changes"; comment?: string; review_revision: number }) =>
  json<unknown>(call(`/v1/tasks/${enc(task)}/decisions`, post(body)));

export const listComments = (task: string) => all<import("@review/api").Comment>(`/v1/tasks/${enc(task)}/comments`);
export const postComment = (task: string, body: string) => json<unknown>(call(`/v1/tasks/${enc(task)}/comments`, post({ body })));
export const listDecisions = (task: string) => all<import("@review/api").Decision>(`/v1/tasks/${enc(task)}/decisions`);

export const listShareLinks = (task: string) => json<Page<ShareLink>>(call(`/v1/tasks/${enc(task)}/share-links`)).then((p) => p.data);
export const createShareLink = (task: string) => json<ShareLink & { url: string }>(call(`/v1/tasks/${enc(task)}/share-links`, post({ access: "invited" })));
export const readArtifact = (id: string) => json<{ id: string; type: string; name?: string; latest_version: number | null }>(call(`/v1/artifacts/${enc(id)}`));
export const readArtifactVersion = (id: string, version: number) =>
  json<{ version: number; content: unknown; file: { size: number; content_type: string; url: string } | null; created_at: string }>(call(`/v1/artifacts/${enc(id)}/versions/${version}`));
/** The component a version pinned, to frame on the card page. */
export const readArtifactComponent = (id: string, version: number) => json<SharedComponent>(call(`/v1/artifacts/${enc(id)}/versions/${version}/component`));
export const listGuests = (task: string) => json<Page<{ email: string; created_at: string }>>(call(`/v1/tasks/${enc(task)}/guests`)).then((p) => p.data);

/** Every unread alert, on every channel. */
export const listAlerts = () => all<Alert>("/v1/alerts", Infinity);
export const readAlert = (id: string) => call(`/v1/alerts/${enc(id)}/read`, post());

export const readRunner = () => json<{ runner: { connected: boolean; name: string | null } | null }>(call("/v1/runner")).then((r) => r.runner);
export const readBilling = () => json<BillingRead>(call("/v1/billing"));
export const openBillingPortal = () => json<{ url: string }>(call("/v1/billing/portal", post())).then((r) => r.url);
export const readJob = (id: string) => json<JobLog>(call(`/v1/runner/jobs/${enc(id)}`));

/** A running job's log, pushed as it arrives (#2085). The token goes as a subprotocol: a WebSocket carries no headers. */
export async function openJobLog(id: string, after: number): Promise<WebSocket | null> {
  const session = await freshSession();
  if (!session) return null;
  return new WebSocket(`${API_URL.replace(/^http/, "ws")}/v1/runner/jobs/${enc(id)}/stream?after=${after}`, ["bearer", session.access_token]);
}

export const createDiscussion = ({ images, ...body }: { workspace: string; project?: string; body: string; runtime?: string; images?: ChatImage[] }) =>
  json<Discussion>(call("/v1/discussions", { ...post({ ...body, ...(images?.length ? { images } : {}) }), headers: { "idempotency-key": crypto.randomUUID() } }));
export const readDiscussion = (id: string) => json<Discussion>(call(`/v1/discussions/${enc(id)}`));
export const deleteIdea = (id: string, idea: string) => json<Discussion>(call(`/v1/discussions/${enc(id)}/ideas/${enc(idea)}`, { method: "DELETE" }));
export const setIdeaWorkflow = (id: string, idea: string, workflow: string) =>
  json<Discussion>(call(`/v1/discussions/${enc(id)}/ideas/${enc(idea)}`, { method: "PATCH", body: JSON.stringify({ workflow }) }));
export const startIdea = (id: string, idea: string, project?: string, expectedVersion?: number) =>
  json<Task>(call(`/v1/discussions/${enc(id)}/ideas/${enc(idea)}/start`, post({ ...(project ? { project } : {}), ...(expectedVersion != null ? { expectedVersion } : {}) })));
type ChatImage = import("@review/api").ChatImage;
const chatBody = (body: string, runtime: string, images: ChatImage[]) => post({ body, runtime, ...(images.length ? { images } : {}) });

export const discussionChat = (id: string) => ({
  send: (body: string, runtime: string, images: ChatImage[] = []) => json<Discussion>(call(`/v1/discussions/${enc(id)}/chat`, chatBody(body, runtime, images))),
  clear: () => json<Discussion>(call(`/v1/discussions/${enc(id)}/chat`, { method: "DELETE" })),
  stop: () => json<Discussion>(call(`/v1/discussions/${enc(id)}/chat/stop`, post())),
});

export const taskChat = (task: string) => ({
  read: () => json<import("@review/api").Chat>(call(`/v1/tasks/${enc(task)}/chat`)),
  send: (body: string, runtime: string, images: ChatImage[] = []) =>
    json<import("@review/api").Chat>(call(`/v1/tasks/${enc(task)}/chat`, chatBody(body, runtime, images))),
  clear: () => json<import("@review/api").Chat>(call(`/v1/tasks/${enc(task)}/chat`, { method: "DELETE" })),
  stop: () => json<import("@review/api").Chat>(call(`/v1/tasks/${enc(task)}/chat/stop`, post())),
});

/** Stops a reply still running, then deletes an idea conversation or empties a task's chat. */
export async function closeChat(c: ChatRow) {
  if (c.discussion === undefined) {
    if (c.state === "replying") await taskChat(c.task).stop();
    await taskChat(c.task).clear();
    return;
  }
  if (c.state === "replying") await discussionChat(c.discussion).stop();
  await call(`/v1/discussions/${enc(c.discussion)}`, { method: "DELETE" });
}

export const readProjectAgents = (project: string) => json<ProjectAgents>(call(`/v1/projects/${enc(project)}/agents`));
export const updateProjectAgent = (project: string, agent: string, body: { rule?: string; schedule?: { on: boolean; cadence: string } }) =>
  json<ProjectAgent>(call(`/v1/projects/${enc(project)}/agents/${enc(agent)}`, { method: "PUT", body: JSON.stringify(body) }));
export const updateWorkflowRule = (project: string, workflow: string, rule: string) =>
  json<ProjectAgents["workflows"][number]>(call(`/v1/projects/${enc(project)}/workflows/${enc(workflow)}/rule`, { method: "PUT", body: JSON.stringify({ rule }) }));
/** `queued` false: one is already waiting or running. */
export const runProjectAgent = (project: string, agent: string) => json<{ agent: string; queued: boolean }>(call(`/v1/projects/${enc(project)}/agents/${enc(agent)}/run`, post()));
