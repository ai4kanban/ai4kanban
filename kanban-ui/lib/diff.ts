// ---- reading a unified diff (#305) ------------------------------------------
//
// The server hands the card page git's own output, one string. Review needs it as
// files, hunks and numbered lines, so it is parsed here rather than shipped in a
// second shape: the CLI's `DeliveryDiff` stays what it is, and nothing else on the
// board has to know what a hunk is.
//
// Tolerant on purpose. The diff arrives capped (`view/diff.ts`), so the last file
// is routinely cut mid-hunk, and a line this does not recognise becomes context
// rather than an error — a half-read diff still reviews, a thrown one does not.

export type DiffRowKind = "add" | "del" | "ctx" | "hunk";

export interface DiffRow {
  kind: DiffRowKind;
  /** The line as git wrote it, sign stripped. A hunk row keeps its whole `@@` line. */
  text: string;
  /** Line numbers on each side. Absent on the side the row is not on. */
  old?: number;
  new?: number;
}

export type DiffStatus = "added" | "deleted" | "renamed" | "changed";

export interface DiffFile {
  /** The path after the change — where a reader would open it. */
  path: string;
  /** Where it was, when it moved. */
  from?: string;
  status: DiffStatus;
  /** Git had no text to show: an image, a binary. */
  binary?: boolean;
  added: number;
  removed: number;
  rows: DiffRow[];
}

const HUNK = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@(.*)$/;

/** Git quotes a path that needs escaping. Nothing here re-decodes the escapes —
 *  the quotes alone are what would look wrong in a file tree. */
const unquote = (path: string): string =>
  path.startsWith('"') && path.endsWith('"') ? path.slice(1, -1) : path;

/** The path off a `---`/`+++` header, or null for the /dev/null side. */
function sidePath(line: string): string | null {
  const raw = line.slice(4).replace(/\t.*$/, "");
  if (raw === "/dev/null") return null;
  const path = unquote(raw);
  return path.replace(/^[ab]\//, "");
}

/** A placeholder path from `diff --git a/x b/y`, for the file headers that carry
 *  no `+++` line at all — a binary, a pure rename, a mode change. */
function headerPath(line: string): string {
  const rest = line.slice("diff --git ".length);
  const half = rest.lastIndexOf(" b/");
  return unquote(half > 0 ? rest.slice(half + 3) : rest).replace(/^[ab]\//, "");
}

export function parseDiff(text: string): DiffFile[] {
  const files: DiffFile[] = [];
  let file: DiffFile | null = null;
  // Header lines and body lines overlap — `---` heads a file and also starts a
  // removed line — so which half of a file is being read has to be tracked.
  let inHunk = false;
  let oldNo = 0;
  let newNo = 0;
  let oldPath: string | null = null;

  for (const line of text.replace(/\n$/, "").split("\n")) {
    if (line.startsWith("diff --git ")) {
      file = { path: headerPath(line), status: "changed", added: 0, removed: 0, rows: [] };
      files.push(file);
      inHunk = false;
      oldPath = null;
      continue;
    }
    if (!file) continue;

    const hunk = HUNK.exec(line);
    if (hunk) {
      oldNo = Number(hunk[1]);
      newNo = Number(hunk[2]);
      file.rows.push({ kind: "hunk", text: line });
      inHunk = true;
      continue;
    }

    if (!inHunk) {
      if (line.startsWith("new file mode")) file.status = "added";
      else if (line.startsWith("deleted file mode")) file.status = "deleted";
      else if (line.startsWith("rename from ")) {
        file.from = unquote(line.slice("rename from ".length));
        file.status = "renamed";
      } else if (line.startsWith("rename to ")) file.path = unquote(line.slice("rename to ".length));
      else if (line.startsWith("--- ")) oldPath = sidePath(line);
      else if (line.startsWith("+++ ")) {
        const newPath = sidePath(line);
        if (newPath) {
          file.path = newPath;
          if (oldPath && oldPath !== newPath) {
            file.from = oldPath;
            file.status = "renamed";
          }
        } else if (oldPath) {
          file.path = oldPath;
          file.status = "deleted";
        }
      } else if (line.startsWith("Binary files") || line.startsWith("GIT binary patch")) file.binary = true;
      continue;
    }

    // The body. "\ No newline at end of file" annotates the line above it and is
    // not one of its own, so it is dropped rather than numbered.
    if (line.startsWith("\\")) continue;
    if (line.startsWith("+")) {
      file.rows.push({ kind: "add", text: line.slice(1), new: newNo++ });
      file.added++;
    } else if (line.startsWith("-")) {
      file.rows.push({ kind: "del", text: line.slice(1), old: oldNo++ });
      file.removed++;
    } else {
      file.rows.push({ kind: "ctx", text: line.slice(1), old: oldNo++, new: newNo++ });
    }
  }

  return files;
}

// ---- the file tree ----------------------------------------------------------

export interface DiffDir {
  kind: "dir";
  /** The segment shown. A chain of one-child directories is joined into one row,
   *  the way every file tree worth using shows `cli/src/lib`. */
  name: string;
  path: string;
  children: DiffNode[];
}

export interface DiffLeaf {
  kind: "file";
  name: string;
  /** Where the file sits in `DiffTree.files` — the listing's section index. */
  index: number;
  file: DiffFile;
}

export type DiffNode = DiffDir | DiffLeaf;

export interface DiffTree {
  nodes: DiffNode[];
  /** The same files in the order the tree lists them. The listing is drawn from
   *  this rather than from git's order, so scrolling it walks the tree downwards
   *  instead of jumping about in it. */
  files: DiffFile[];
}

/** The changed files as a tree: directories first, each side alphabetical, and
 *  single-child directory chains collapsed. */
export function fileTree(files: DiffFile[]): DiffTree {
  const root: DiffDir = { kind: "dir", name: "", path: "", children: [] };

  for (const file of files) {
    const parts = file.path.split("/");
    const name = parts.pop() ?? file.path;
    let dir = root;
    for (const part of parts) {
      const path = dir.path ? `${dir.path}/${part}` : part;
      let next = dir.children.find((n): n is DiffDir => n.kind === "dir" && n.name === part);
      if (!next) {
        next = { kind: "dir", name: part, path, children: [] };
        dir.children.push(next);
      }
      dir = next;
    }
    dir.children.push({ kind: "file", name, index: 0, file });
  }

  const nodes = tidy(root.children);
  const ordered: DiffFile[] = [];
  number(nodes, ordered);
  return { nodes, files: ordered };
}

/** Walk the sorted tree and hand each file its place in the listing. */
function number(nodes: DiffNode[], into: DiffFile[]): void {
  for (const node of nodes) {
    if (node.kind === "dir") number(node.children, into);
    else {
      node.index = into.length;
      into.push(node.file);
    }
  }
}

const tidy = (children: DiffNode[]): DiffNode[] =>
  children
    .map((child) => (child.kind === "dir" ? collapse(child) : child))
    .sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === "dir" ? -1 : 1));

function collapse(dir: DiffDir): DiffDir {
  let node = dir;
  while (node.children.length === 1 && node.children[0]!.kind === "dir") {
    const only = node.children[0] as DiffDir;
    node = { ...only, name: `${node.name}/${only.name}` };
  }
  return { ...node, children: tidy(node.children) };
}
