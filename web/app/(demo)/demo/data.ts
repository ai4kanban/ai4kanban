// The demo's one board: Notely, a fictional notes app, with its 2.0 launch under way.
import type { MockupSet } from "ai4kanban-ui/lib/mockup-tag";
import type {
  ArchivedCardFile,
  BoardScreen,
  Card,
  CardScreen,
  ChatMessage,
  Column,
  DeliveryDiff,
  SessionView,
} from "ai4kanban-ui/lib/types";
import { LOCAL_STANDING } from "ai4kanban-ui/lib/types";
import { syncSettings } from "./notely";

export const PROJECT_ROOT = "~/projects/notely";

const card = (c: Partial<Card> & Pick<Card, "id" | "title" | "modules">): Card => ({
  revision: "1",
  relPath: `docs/kanban/todo/${c.id}.md`,
  priority: "med",
  roi: "med",
  status: "todo",
  blocked_by: [],
  related: [],
  questions: [],
  workflow: "coding",
  schedule: null,
  body: "",
  todos: { done: 0, total: 0 },
  isGroup: false,
  openBlockers: [],
  ...c,
});

const BEFORE: Card[] = [
  card({ id: 53, title: "Add dark mode to the settings page", modules: ["editor"], status: "ready", roi: "high", todos: { done: 0, total: 4 } }),
  card({ id: 51, title: "Fix the crash when pasting a large image", modules: ["editor"], status: "implementing", priority: "high", roi: "high", todos: { done: 1, total: 3 } }),
  card({ id: 62, title: "Add keyboard shortcuts for search", modules: ["editor"], status: "ready", priority: "low", todos: { done: 0, total: 3 } }),
  card({ id: 66, title: "Speed up search on large notebooks", modules: ["editor"], todos: { done: 0, total: 3 } }),
  card({ id: 49, title: "Export notes as Markdown and PDF", modules: ["export"], status: "implementing", roi: "high", todos: { done: 2, total: 5 } }),
  card({ id: 55, title: "Write the 2.0 launch blog post", modules: ["marketing"], workflow: "blog-post", status: "implementing", priority: "high", todos: { done: 2, total: 3 } }),
  card({
    id: 58,
    title: "Record a 60-second product video",
    modules: ["marketing"],
    priority: "high",
    roi: "high",
    todos: { done: 0, total: 4 },
    questions: [{ text: "[user] Which three features should the video show?" }],
  }),
  card({
    id: 60,
    title: "Make a launch carousel for social media",
    modules: ["marketing"],
    blocked_by: [55],
    openBlockers: [{ id: 55, title: "Write the 2.0 launch blog post" }],
    todos: { done: 0, total: 3 },
  }),
  card({
    id: 64,
    title: "Redesign the onboarding emails",
    modules: ["marketing"],
    priority: "low",
    todos: { done: 0, total: 2 },
    questions: [{ text: "Should the welcome email link to the template gallery?" }],
  }),
];

const GROUP_BODY = `A note written on one device shows up on every other device within seconds, including a phone that was offline for a day. Notes are encrypted on the device, so the server stores them but can never read them.

Encrypted storage comes first (#39), then background upload (#40). Conflicts, sync status, attachments and the opt-out (#41–#44) build on those two.

## Worth noting

- **Free plan limit**: sync covers 1 GB per account; larger libraries need Pro.
- **First sync**: every existing note is uploaded once, which can take a few minutes on a large notebook.

<!-- agent -->

Encryption keys stay in the system keychain on each device.
`;

export const GROUP: Card = card({
  id: 38,
  title: "Sync notes across devices",
  modules: ["sync"],
  priority: "high",
  roi: "high",
  isGroup: true,
  related: [66],
  body: GROUP_BODY,
  todos: { done: 0, total: 6 },
  subtaskLines: { total: 6, resolved: 0 },
  subtasks: [
    { id: 39, title: "Store notes in the cloud with end-to-end encryption", blocked_by: [], todos: { done: 0, total: 5 }, status: "todo" },
    { id: 40, title: "Upload and download changes in the background", blocked_by: [39], todos: { done: 0, total: 4 }, status: "todo" },
    { id: 41, title: "Resolve edits made on two devices at once", blocked_by: [40], todos: { done: 0, total: 5 }, status: "todo" },
    { id: 42, title: "Show sync status in the sidebar", blocked_by: [40], todos: { done: 0, total: 3 }, status: "todo" },
    { id: 43, title: "Sync attachments and images", blocked_by: [40], todos: { done: 0, total: 4 }, status: "todo" },
    { id: 44, title: "Let users turn sync off and keep a local copy", blocked_by: [40], todos: { done: 0, total: 4 }, status: "todo" },
  ],
});

const SYNC_SETTINGS = ".assets/39/sync-settings.html";

const BODY_39 = `<Asset src="${SYNC_SETTINGS}" label="Sync settings" device="desktop" />

Each note is encrypted on the device before it leaves, so the cloud only ever stores what it can't read.

<!-- agent -->

Keys are derived on the device and kept in the system keychain; the server sees ciphertext only.
`;

const SUBTASK: Card = card({
  id: 39,
  title: "Store notes in the cloud with end-to-end encryption",
  modules: ["sync"],
  priority: "high",
  roi: "high",
  body: BODY_39,
  todos: { done: 0, total: 5 },
  parent: { id: 38, title: "Sync notes across devices" },
  questions: [
    {
      text: "[user] How does someone get their notes back after losing every device?",
      mode: "single",
      options: [
        "A recovery key they save when they turn sync on",
        "Their sync password — forget it and the notes are gone",
        "A reset email — but then our server could read the notes",
      ],
      recommend: [1],
    },
  ],
});

/** #39 as the revision leaves it: the question answered, the draft redrawn, ready to build. */
const REVISED: Card = { ...SUBTASK, revision: "2", status: "ready", questions: [] };

export const IDEA =
  "Sync my notes between my laptop and my phone. Encrypt them end to end, so even our server can't read them.";

export const OPENER = "Change this card:\n";
export const REVISION =
  "Drop the sync password. Give people a recovery key to save when they turn sync on — nothing to invent or forget.";

export const REPLY =
  "Done. Sync settings now hands out a 24-word recovery key with **Download key** and **Copy**, and sync turns on once it's saved — no password anywhere. That also answers the open question, so #39 is ready to build.";

export const MOCKUPS: Record<1 | 2, MockupSet> = {
  1: { [SYNC_SETTINGS]: { src: SYNC_SETTINGS, doc: syncSettings(1) } },
  2: { [SYNC_SETTINGS]: { src: SYNC_SETTINGS, doc: syncSettings(2) } },
};

const MODULES = [
  { module: "sync", title: "Sync" },
  { module: "editor", title: "Editor" },
  { module: "export", title: "Export" },
  { module: "marketing", title: "Marketing" },
];

const columnsOf = (cards: Card[]): Column[] =>
  MODULES.map((m) => ({ ...m, cards: cards.filter((c) => c.modules[0] === m.module) })).filter((c) => c.cards.length);

const SUBTASK_IDS = GROUP.subtasks!.map((s) => s.id);

const screen = (cards: Card[], openIds: number[]): BoardScreen => ({
  id: PROJECT_ROOT,
  standing: LOCAL_STANDING,
  error: null,
  board: { columns: columnsOf(cards), archive: [], openIds, memoryOwners: [], setup: null },
});

export const BOARD_BEFORE = screen(BEFORE, BEFORE.map((c) => c.id));
const OPEN_IDS = [38, ...SUBTASK_IDS, ...BEFORE.map((c) => c.id)];
export const BOARD_AFTER = screen([GROUP, ...BEFORE], OPEN_IDS);
/** What is still open once #39 has landed. */
export const OPEN_AFTER_LANDING = OPEN_IDS.filter((id) => id !== 39);

const cardScreen = (c: Card): CardScreen => ({
  id: PROJECT_ROOT,
  standing: LOCAL_STANDING,
  card: c,
  openIds: OPEN_IDS,
  memoryOwners: [],
  plan: { commitMode: "auto", branch: "main" },
  diff: null,
  hold: null,
});

export const GROUP_PAGE = cardScreen(GROUP);
export const SUBTASK_PAGE = cardScreen(SUBTASK);
export const REVISED_PAGE = cardScreen(REVISED);
export const DISCUSSING_PAGE = cardScreen({ ...SUBTASK, discussing: true });

export const ARCHIVED_39: ArchivedCardFile = {
  id: 39,
  title: SUBTASK.title,
  relPath: "docs/kanban/.archive/39-store-notes-in-the-cloud-with-end-to-end-encryption.md",
  archived: "2026-10-14",
  rejected: false,
  body: BODY_39,
  landed: { id: "39-1", commit: "4e1c9a2", targetBranch: "main" },
};

export const AT = Date.UTC(2026, 9, 14, 9, 30);

export const CHAT_SENT: ChatMessage = { role: "you", text: OPENER + REVISION, at: AT };
export const CHAT_REPLY: ChatMessage = { role: "agent", text: REPLY, at: AT + 52_000, ms: 52_000, costUsd: 0.21 };

const run = (cardId: number, action: SessionView["action"]): SessionView => ({
  sessionId: `demo-${cardId}-${action}`,
  cardId,
  action,
  status: "running",
  startedAt: AT,
});

/** What is running on the board all along, and what a step adds while its agent works. */
export const RUNS = [run(51, "implement"), run(49, "implement"), run(55, "review")];
export const PLANNING = run(38, "clarify");
export const BUILDING = run(39, "implement");

export const DIFF_39: DeliveryDiff = {
  id: "39-1",
  stat: "4 files changed, 48 insertions(+), 8 deletions(-)",
  diff: [
    "diff --git a/src/settings/SyncSettings.tsx b/src/settings/SyncSettings.tsx",
    "index 3b1f0c2..9d7e4a1 100644",
    "--- a/src/settings/SyncSettings.tsx",
    "+++ b/src/settings/SyncSettings.tsx",
    "@@ -1,14 +1,19 @@",
    ' import { useState } from "react";',
    '-import { PasswordField } from "../ui/PasswordField";',
    '+import { RecoveryKey } from "./RecoveryKey";',
    '+import { createRecoveryKey } from "../sync/recovery-key";',
    ' import { turnOnSync } from "../sync/upload";',
    " ",
    " export function SyncSettings() {",
    '-  const [password, setPassword] = useState("");',
    "+  const [key] = useState(createRecoveryKey);",
    "+  const [saved, setSaved] = useState(false);",
    "   return (",
    "     <section>",
    "       <h2>Sync</h2>",
    "-      <PasswordField value={password} onChange={setPassword} />",
    "-      <button onClick={() => turnOnSync(password)}>Turn on sync</button>",
    "+      <p>Save this key. It is the only way back to your notes if you lose every device.</p>",
    "+      <RecoveryKey words={key.words} onSaved={() => setSaved(true)} />",
    "+      <button disabled={!saved} onClick={() => turnOnSync(key)}>",
    "+        Turn on sync",
    "+      </button>",
    "     </section>",
    "   );",
    " }",
    "diff --git a/src/sync/crypto.ts b/src/sync/crypto.ts",
    "new file mode 100644",
    "index 0000000..5c2e8f0",
    "--- /dev/null",
    "+++ b/src/sync/crypto.ts",
    "@@ -0,0 +1,18 @@",
    "+// Notes are sealed on the device; the server only ever stores ciphertext.",
    '+const ALGO = { name: "AES-GCM", length: 256 } as const;',
    "+",
    "+export async function seal(key: CryptoKey, text: string): Promise<Uint8Array> {",
    "+  const iv = crypto.getRandomValues(new Uint8Array(12));",
    "+  const body = new TextEncoder().encode(text);",
    "+  const sealed = await crypto.subtle.encrypt({ ...ALGO, iv }, key, body);",
    "+  return new Uint8Array([...iv, ...new Uint8Array(sealed)]);",
    "+}",
    "+",
    "+export async function open(key: CryptoKey, blob: Uint8Array): Promise<string> {",
    "+  const iv = blob.slice(0, 12);",
    "+  const plain = await crypto.subtle.decrypt({ ...ALGO, iv }, key, blob.slice(12));",
    "+  return new TextDecoder().decode(plain);",
    "+}",
    "+",
    "+export const newNoteKey = () =>",
    '+  crypto.subtle.generateKey(ALGO, false, ["encrypt", "decrypt"]);',
    "diff --git a/src/sync/recovery-key.ts b/src/sync/recovery-key.ts",
    "new file mode 100644",
    "index 0000000..a41d7b3",
    "--- /dev/null",
    "+++ b/src/sync/recovery-key.ts",
    "@@ -0,0 +1,14 @@",
    '+import { WORDS } from "./wordlist";',
    '+import { keychain } from "../platform/keychain";',
    "+",
    "+export interface RecoveryKey {",
    "+  words: string[];",
    "+}",
    "+",
    "+// 24 words: 256 bits, kept in the system keychain and nowhere else.",
    "+export function createRecoveryKey(): RecoveryKey {",
    "+  const bytes = crypto.getRandomValues(new Uint8Array(24));",
    "+  const words = [...bytes].map((b) => WORDS[b]);",
    '+  keychain.set("notely.recovery", words.join(" "));',
    "+  return { words };",
    "+}",
    "diff --git a/src/sync/upload.ts b/src/sync/upload.ts",
    "index 7f0a91e..e2b4c58 100644",
    "--- a/src/sync/upload.ts",
    "+++ b/src/sync/upload.ts",
    "@@ -1,10 +1,13 @@",
    ' import { api } from "../api";',
    '+import { seal } from "./crypto";',
    '+import { keyFrom } from "./keys";',
    '+import type { RecoveryKey } from "./recovery-key";',
    ' import type { Note } from "../notes";',
    " ",
    "-export async function turnOnSync(password: string) {",
    '-  await api.post("/sync/enable", { password });',
    "+export async function turnOnSync(recovery: RecoveryKey) {",
    '+  await api.post("/sync/enable", { device: await keyFrom(recovery).id() });',
    " }",
    " ",
    "-export async function upload(note: Note) {",
    "-  await api.put(`/notes/${note.id}`, { body: note.body });",
    "+export async function upload(note: Note, key: CryptoKey) {",
    "+  await api.put(`/notes/${note.id}`, { sealed: await seal(key, note.body) });",
    " }",
  ].join("\n"),
};
