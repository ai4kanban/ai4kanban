// The release feed: which file this machine takes, and where it lives.
//
// electron-builder writes a `latest*.yml` beside every build — one per system,
// and one per architecture on Linux — and `PUBLISHING.md` already uploads them.
// Each names a version and lists the builds for that system under `files:`,
// with a sha512 and a size each. So the release the app already checks is
// already a feed: nothing extra is published to make an install possible.
//
// Nothing here touches Electron, the disk or the network. Which file, which
// build inside it, and whether it is newer are decisions on their own, so they
// can be checked on their own.

/** Point the app at another feed — a folder of `desktop/dist/` served over http
 *  is a working release. Developers only: it is read from the environment and
 *  is never a setting, so a shipped build with nothing set reads the real
 *  release and nothing else. */
export const FEED_ENV = "AI4KANBAN_UPDATE_FEED";

const REPO_URL = "https://github.com/ai4kanban/ai4kanban";

export const LATEST_RELEASE_API = "https://api.github.com/repos/ai4kanban/ai4kanban/releases/latest";

/** Where a person goes to get the newer build by hand. Still offered whenever
 *  this copy cannot install one itself, and whenever an install fails. */
export const DOWNLOADS_URL = `${REPO_URL}/releases/latest`;

/** One build on a release. */
export interface FeedFile {
  url: string;
  /** Base64, as electron-builder writes it. The only integrity check there is. */
  sha512: string;
  size: number;
}

export interface Feed {
  version: string;
  files: FeedFile[];
}

/** Compare two `1.2.3` versions. Anything after the numbers (a `-rc1`) is
 *  ignored — the app only ever asks "is the release newer than what I am". */
export function isNewer(candidate: string, current: string): boolean {
  const parts = (v: string) =>
    String(v)
      .replace(/^v/, "")
      .split(/[.\-+]/)
      .slice(0, 3)
      .map((n) => parseInt(n, 10) || 0);
  const [a, b] = [parts(candidate), parts(current)];
  for (let i = 0; i < 3; i++) {
    // A version with fewer parts than three reads as zero in the ones it is
    // missing, which is what `1.2` beating `1.1.9` means.
    const [x, y] = [a[i] ?? 0, b[i] ?? 0];
    if (x !== y) return x > y;
  }
  return false;
}

/** The feed file for this machine. Linux is the one system with a file per
 *  architecture; the other two carry every build in one. */
export function feedFileName(platform: NodeJS.Platform, arch: string): string {
  if (platform === "darwin") return "latest-mac.yml";
  if (platform === "linux") return arch === "arm64" ? "latest-linux-arm64.yml" : "latest-linux.yml";
  return "latest.yml";
}

const KEY = /^([A-Za-z0-9_]+):\s*(.*)$/;

function unquote(value: string): string {
  const trimmed = value.trim();
  const quote = trimmed[0];
  if ((quote === "'" || quote === '"') && trimmed.endsWith(quote) && trimmed.length > 1) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

/**
 * Read a `latest*.yml`. Not a YAML parser — the shape electron-builder writes is
 * top-level scalars and one `files:` list of flat maps, and a real parser is a
 * dependency for that.
 *
 * Null when the text is not a feed. A release without one is a release this app
 * can only link to, which is what an older release is.
 */
export function parseFeed(text: string): Feed | null {
  let version = "";
  const files: FeedFile[] = [];
  let entry: Record<string, string> | null = null;
  const close = () => {
    const url = entry?.url;
    if (url) files.push({ url, sha512: entry?.sha512 ?? "", size: Number(entry?.size) || 0 });
    entry = null;
  };
  for (const line of text.split(/\r?\n/)) {
    const body = line.trim();
    if (!body || body.startsWith("#")) continue;
    const top = line.length - line.trimStart().length === 0;
    if (top) {
      close();
      const m = KEY.exec(body);
      if (m && m[1] === "version") version = unquote(m[2] ?? "");
      continue;
    }
    if (body.startsWith("- ")) {
      close();
      entry = {};
    }
    const m = KEY.exec(body.startsWith("- ") ? body.slice(2).trim() : body);
    if (entry && m && m[1]) entry[m[1]] = unquote(m[2] ?? "");
  }
  close();
  return version ? { version, files } : null;
}

/**
 * The build in this feed for the machine asking, or null when it holds none.
 *
 * macOS is the one that has to choose: `latest-mac.yml` lists both zips and its
 * top-level `path:` names the x64 one, so the architecture comes from `files:`
 * and never from `path:`. The arm64 build says so in its name and the x64 build
 * does not.
 */
export function pickBuild(feed: Feed, platform: NodeJS.Platform, arch: string): FeedFile | null {
  const has = (file: FeedFile, ext: string) => file.url.toLowerCase().endsWith(ext);
  if (platform === "darwin") {
    const zips = feed.files.filter((f) => has(f, ".zip"));
    const arm = arch === "arm64";
    return zips.find((f) => /arm64/i.test(f.url) === arm) ?? null;
  }
  if (platform === "linux") return feed.files.find((f) => has(f, ".appimage")) ?? null;
  if (platform === "win32") return feed.files.find((f) => has(f, ".exe")) ?? null;
  return null;
}

/** The folder every file in a feed is named relative to. The override wins when
 *  it is set; otherwise it is the release the tag names. Null when neither is
 *  known, which is a check that could not be made. */
export function feedBase(tag: string | null, env: NodeJS.ProcessEnv = process.env): string | null {
  const override = (env[FEED_ENV] ?? "").trim();
  if (override) return override.endsWith("/") ? override : `${override}/`;
  return tag ? `${REPO_URL}/releases/download/${tag}/` : null;
}

/** Whether the app is reading a feed of someone's own rather than the release. */
export function feedIsOverridden(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean((env[FEED_ENV] ?? "").trim());
}

export function assetUrl(base: string, name: string): string {
  return `${base}${name.replace(/^\/+/, "")}`;
}
