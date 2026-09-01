import { CROP, HAIR, Inset, MONO, NB, Shot, Tag, em } from "./nb";

// Step 04 记录决策 — the diff a run leaves on the module's memory file.
//
// Unlike the other three shots this one mirrors no screen: the memory is a
// directory of Markdown files and the board deliberately never renders it
// (`docs/kanban/memory/local-ui/decisions.md` — "Memory files are read-only in
// the UI"). What the user sees after a run is the diff, so that is what this
// draws, in the skin the board's own diff pane gives one: a file header with the
// path and its ± stat, a hunk header carrying the section the change sits in,
// and one signed line per source line — added on mint, removed on peach,
// everything else untouched context.
//
// The added lines are that file's, verbatim. They are the settled answer to the
// questions step 02 shows on #48 — that shot asks whether a run may commit
// inside its own worktree, this is where the "no" ended up. The removed line is
// the only invention here: a diff needs a before, and the file only keeps the
// after. Context lines are cut back to their first sentence so the change lands
// mid-frame rather than under the fade; the last one runs off the bottom on
// purpose, the way the other three shots carry on past the crop.

/** The board's own diff skins (kanban-ui/components/Diff.tsx `TONE`), which is
 *  where a diff is really read now: mint says added, peach says removed, sky
 *  heads a hunk, and the sign column is its band's hue a step darker — the
 *  seating every diff view gives a gutter. */
const ROW = {
  add: { band: NB.mintSoft, gutter: "#cae8d6", sign: NB.mintInk, mark: "+" },
  del: { band: NB.peachSoft, gutter: "#f7d4c1", sign: NB.peachInk, mark: "−" },
} as const;

type Line = { sign?: "+" | "-"; text: string };

// Two hunks, so the run reads as having written wherever the topic sat rather
// than appending to the end of a file.
const HUNKS: { header: string; lines: Line[] }[] = [
  {
    header: "@@ -8,6 +8,8 @@ ## What the UI is and isn't",
    lines: [
      { text: "- The UI offers what the script offers. No action stays terminal-only." },
      { sign: "-", text: "- A run leaves its changes in the working tree." },
      {
        sign: "+",
        text: "- A run never commits. Its changes stay in the working tree and the user reads `git diff` and commits. No branches, no worktrees, no pull requests.",
      },
      {
        text: "- Memory files are read-only in the UI. You read a wrong line there and fix it in your own editor.",
      },
    ],
  },
  {
    header: "@@ -21,3 +23,5 @@ ## Propose and add-task",
    lines: [
      {
        text: "- Propose runs on one module at a time; the picker is a single-module dropdown, never a multi-select.",
      },
      {
        sign: "+",
        text: "- Picking a module is optional for both propose and add-task — with none picked, the agent chooses the focus itself.",
      },
    ],
  },
];

export function ShotDecisions() {
  return (
    <Shot crop={CROP}>
      <div style={{ padding: em(20) }}>
        <Inset style={{ overflow: "hidden" }}>
          {/* The file header: what changed and by how much. Set like the diff
              pane's own header — chrome parted from its listing by a hairline,
              with no fill of its own. */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: em(10),
              padding: `${em(10)} ${em(16)}`,
              borderBottom: `1px solid ${HAIR}`,
            }}
          >
            <Tag mark={<span style={{ color: NB.accent }}>●</span>}>
              module memory
            </Tag>
            <span
              style={{
                marginLeft: "auto",
                display: "flex",
                alignItems: "baseline",
                gap: em(8),
                fontFamily: MONO,
                fontSize: em(11),
                color: NB.inkSoft,
              }}
            >
              local-ui/decisions.md
              <span style={{ fontWeight: 700, color: NB.mintInk }}>+5</span>
              <span style={{ fontWeight: 700, color: NB.peachInk }}>−1</span>
            </span>
          </div>

          {/* The hunks. Rows run edge to edge and stack with no gap or corner of
              their own — a diff is one continuous listing, and a row that floats
              stops reading as one. */}
          <div style={{ fontFamily: MONO, fontSize: em(12), lineHeight: 1.6 }}>
            {HUNKS.map((hunk) => (
              <div key={hunk.header}>
                <div
                  style={{
                    padding: `${em(5)} ${em(12)}`,
                    background: NB.wash,
                    borderBlock: `1px solid ${HAIR}`,
                    color: NB.skyInk,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {hunk.header}
                </div>

                {hunk.lines.map((line) => {
                  const tone = line.sign
                    ? ROW[line.sign === "+" ? "add" : "del"]
                    : null;
                  return (
                    <div
                      key={line.text}
                      style={{
                        display: "flex",
                        alignItems: "stretch",
                        background: tone ? tone.band : NB.paper,
                      }}
                    >
                      <span
                        aria-hidden
                        style={{
                          width: em(20),
                          flex: "0 0 auto",
                          padding: `${em(3)} 0`,
                          textAlign: "center",
                          fontWeight: 700,
                          background: tone ? tone.gutter : undefined,
                          color: tone ? tone.sign : "transparent",
                        }}
                      >
                        {tone?.mark ?? "+"}
                      </span>
                      {/* Wrapped rather than clipped: the mat is far narrower
                          than a terminal, and a decision cut off at the right
                          edge is worth less than one that reads. The hanging
                          indent puts the wrap under the bullet's text, not
                          under its dash. */}
                      <span
                        style={{
                          minWidth: 0,
                          flex: 1,
                          padding: `${em(3)} ${em(10)} ${em(3)} ${em(24)}`,
                          textIndent: em(-14),
                          color: NB.ink,
                        }}
                      >
                        {line.text}
                      </span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </Inset>
      </div>
    </Shot>
  );
}
