// Copied from legacy kanban-ui/lib/agent-half.ts: the splitting only; the fold hooks trimmed.


/** The boundary the card format puts between the two halves — one line, on its own
 *  (`akb guide board`, "Card format"). Written as a comment so it never renders. */
const MARKER = /^[ \t]*<!--[ \t]*agent[ \t]*-->[ \t]*\r?\n?/m;

export interface CardHalves {
  /** Everything above the boundary — what a reviewer has to read. */
  human: string;
  /** Everything below it. Empty for a card that carries no boundary, or nothing
   *  under one, and then the human half is the whole body as it has always been. */
  agent: string;
}

/** A comment on a line of its own is for agents (#2004), never shown. */
const COMMENT = /^[ \t]*<!--[\s\S]*?-->[ \t]*$/;

function withoutComments(text: string): string {
  const kept: string[] = [];
  eachLine(text, (line, fenced) => {
    if (fenced || !COMMENT.test(line)) kept.push(line);
  });
  return kept.join("\n");
}

/** Split a card's body at the boundary (#262). */
export function splitCardBody(body: string): CardHalves {
  const marker = MARKER.exec(body);
  if (!marker) return { human: withoutComments(body), agent: "" };
  const human = withoutComments(body.slice(0, marker.index)).trimEnd();
  const agent = body.slice(marker.index + marker[0].length).trim();
  if (!agent) return { human, agent: "" };
  return { human, agent };
}

/** One `###` heading of an agent section and what runs under it to the next (#1019). */
export interface SubFold {
  key: string;
  /** The heading's own Markdown, `###` dropped. */
  heading: string;
  body: string;
}

/** A piece of the human half: prose, or one ``## By `<name>` agent`` section (#870). */
export type HumanPiece =
  | { kind: "text"; body: string }
  /** `key` tells apart two sections by the same agent, in the order they appear. `intro` is
   *  what comes before the first `###`; with no `###` it is the whole body. */
  | { kind: "agent"; name: string; key: string; body: string; intro: string; subs: SubFold[] };

const SECTION = /^##[ \t]+By[ \t]+`?([^`\s]+)`?[ \t]+agent[ \t]*$/;
const H2 = /^##[ \t]/;
const H3 = /^ {0,3}###[ \t]+(.*?)(?:[ \t]+#+)?[ \t]*$/;
const FENCE = /^ {0,3}(`{3,}|~{3,})/;
/** Starts every subsection key, whose default is open. */
const SUB = "sub:";

/** Calls `fn` with each line and whether it sits inside a fenced block. */
function eachLine(text: string, fn: (line: string, fenced: boolean) => void): void {
  let fence = "";
  for (const line of text.split(/\r?\n/)) {
    const f = FENCE.exec(line)?.[1];
    if (fence) {
      if (f && f[0] === fence[0] && f.length >= fence.length && !line.trim().slice(f.length).trim()) fence = "";
      fn(line, true);
    } else {
      if (f) fence = f;
      fn(line, !!f);
    }
  }
}

/** Cut an agent section at its `###` headings; deeper ones stay inside. */
function splitSubs(key: string, body: string): { intro: string; subs: SubFold[] } {
  let intro = "";
  const subs: SubFold[] = [];
  let lines: string[] = [];
  let heading: string | null = null;
  const flush = () => {
    const text = lines.join("\n").trim();
    if (heading === null) intro = text;
    else subs.push({ key: `${SUB}${key}/${subs.length}`, heading, body: text });
    lines = [];
  };
  eachLine(body, (line, fenced) => {
    const m = fenced ? null : H3.exec(line);
    if (m) {
      flush();
      heading = m[1]!;
    } else lines.push(line);
  });
  flush();
  return { intro, subs };
}

/** Cut the human half at its agent sections. A section runs to the next `##` heading or the
 *  end of the half; a `##` line inside a fenced block is not a heading. */
export function splitHuman(human: string): HumanPiece[] {
  const pieces: HumanPiece[] = [];
  const seen = new Map<string, number>();
  let lines: string[] = [];
  let agent: string | null = null;
  const flush = () => {
    const body = lines.join("\n").trim();
    if (agent) {
      const n = seen.get(agent) ?? 0;
      seen.set(agent, n + 1);
      const key = `${agent}#${n}`;
      pieces.push({ kind: "agent", name: agent, key, body, ...splitSubs(key, body) });
    } else if (body) {
      const last = pieces[pieces.length - 1];
      if (last?.kind === "text") last.body += `\n\n${body}`;
      else pieces.push({ kind: "text", body });
    }
    lines = [];
  };
  eachLine(human, (line, fenced) => {
    if (!fenced && H2.test(line)) {
      flush();
      const m = SECTION.exec(line.trim());
      agent = m ? m[1]! : null;
      if (m) return;
    }
    lines.push(line);
  });
  flush();
  return pieces;
}

