"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FiCheck, FiCopy, FiTerminal } from "react-icons/fi";
import { cn } from "@/lib/utils";
import { Logo } from "./Logo";
import { MakeBoardHere, PickAnotherProject } from "./desktop";
import { useOnTabFocus } from "./sessions";

// Shown as the whole page when the walk up finds no `docs/kanban/todo/`. It
// takes over the screen the way "this task is not on the board" does: no header,
// no buttons, no Configuration dialog — every one of those reads a board, and
// there isn't one.
//
// ── One outline, and the panel owns it ──────────────────────────────────────
// The screen is a watercolour mat, a panel on it, and a button in each row —
// and that is the whole nesting. It was five deep before: mat, panel, a
// bordered card per cause, the button inside that, and an outlined tile around
// the button's own icon, all concentric, all 1.5px ink, all within 40px of each
// other. Ink outlines are how this language says "this is a block", and five
// blocks inside one another says nothing at all.
//
// So the causes are rows, not cards. What separates them is a rule that runs the
// full width of the panel — a line, not a box — and where something still has to
// be a box (a command to copy, the footnote strip) it is a fill rather than an
// outline. The one outline left inside the panel is the button's, which has to
// keep it: it is the thing you press, and pressing is what an outline plus a
// hard shadow means here.
//
// The order is the empty state's: the mark, because this is the one screen with
// no header to say which app you are in; what happened, in a line; then the two
// ways out, the likelier one first and carrying the ember.
//
// In a browser the two ways out are commands to copy, not buttons: there is a
// terminal right there to run them in, and the app's installer isn't reachable
// from a tab. In the app there is no terminal, so both rows end in a button.
export function NoBoard({
  searchedFrom,
  desktop = false,
}: {
  searchedFrom: string;
  /** Whether this is the desktop app (#175). In the app there is no terminal to
   *  send anyone to, so both causes below end in a button rather than a command
   *  to type (#178). */
  desktop?: boolean;
}) {
  const router = useRouter();
  // Install a board in a terminal, switch back to this tab, and it's there — the
  // same re-read on tab focus the board itself does. No timer, no Try again
  // button: coming back to the tab is the moment worth re-checking.
  useOnTabFocus(() => router.refresh());

  return (
    <main className="flex min-h-screen items-center justify-center bg-nb-cream p-6">
      {/* The padding is the mat's own margin — how much painting shows around
          the panel. Under `sm` it narrows, the way the site's mats do: on a
          phone a wide mat is spent on paper the panel then has to fit inside. */}
      <Mat className="w-full max-w-[664px] p-4 sm:p-8">
        {/* `overflow-hidden` so the footnote's fill takes the panel's own bottom
            radius instead of squaring off inside it. */}
        <div className="nb-panel w-full overflow-hidden">
          <header className="px-7 pt-6 pb-5">
            <Logo size="sm" />
            <h1 className="mt-4 text-[20px] leading-tight font-[700]">There is no board here.</h1>
            <p className="mt-2 text-[13px] leading-relaxed text-nb-ink-soft">
              Nothing at <Code>docs/kanban/todo/</Code> in <Code>{searchedFrom}</Code>, or in any
              folder above it.
            </p>
          </header>

          <Cause
            title="Start one here"
            stack={!desktop}
            body={
              desktop
                ? "The board and a setup checklist — in this window."
                : "Scaffolds the board under docs/kanban/. Run it in the repo root."
            }
          >
            {desktop ? <MakeBoardHere desktop /> : <CopyCommand text="npx ai4kanban install" />}
          </Cause>

          <Cause
            title="Wrong project"
            stack={!desktop}
            body={
              desktop
                ? "Open another folder in this window. Past ones are behind the name up top."
                : "Point the UI at the repo you meant, or restart it from that repo's root."
            }
          >
            {desktop ? (
              <PickAnotherProject desktop />
            ) : (
              <CopyCommand text="npx ai4kanban-ui --board /path/to/repo" />
            )}
          </Cause>

          {!desktop && (
            <p className="flex items-center gap-2 border-t-[1.5px] border-nb-ink bg-nb-wash px-7 py-3 text-[12px] text-nb-ink-soft">
              <FiTerminal size={13} className="shrink-0" />
              Run one, then come back to this tab — the board shows up on its own.
            </p>
          )}
        </div>
      </Mat>
    </main>
  );
}

// Shown as the whole page when there IS a board but nothing to read it with — this project
// has no copy of the board's rules, or the copy it has is too old for this board (#169).
// The board is one file, `akb` carries it, and installing it is one command; so this says
// what happened in a line and hands over that command, the same shape as the screen above.
//
// It takes over the screen for the same reason that one does: every button on a card page
// goes through the rules, so there is nothing to draw underneath a warning. The board page
// says the same thing in its own error strip instead, where the chrome is already up.
export function NoRules({ why, desktop = false }: { why: string; desktop?: boolean }) {
  const router = useRouter();
  // Install it in a terminal, come back to the tab, and the board is there — the same
  // re-read on tab focus the board itself does.
  useOnTabFocus(() => router.refresh());

  return (
    <main className="flex min-h-screen items-center justify-center bg-nb-cream p-6">
      <Mat className="w-full max-w-[664px] p-4 sm:p-8">
        <div className="nb-panel w-full overflow-hidden">
          <header className="px-7 pt-6 pb-5">
            <Logo size="sm" />
            <h1 className="mt-4 text-[20px] leading-tight font-[700]">This board can&apos;t be read.</h1>
            <p className="mt-2 text-[13px] leading-relaxed text-nb-ink-soft">{why}</p>
          </header>

          {/* Outside the app the rules come from this project's skill folder, and a
              board no longer arrives with one (#174) — so the command that fixes
              this screen is the one that adds the skill, not `update`, which only
              refreshes a folder that is already there. */}
          <Cause
            title="Install the board's rules"
            stack={!desktop}
            body={
              desktop
                ? "The app carries its own copy — reopening this project picks it up."
                : "One file, in this project. Run it in the repo root."
            }
          >
            {desktop ? (
              <PickAnotherProject desktop />
            ) : (
              <CopyCommand text="npx ai4kanban@latest skill install" />
            )}
          </Cause>

          {!desktop && (
            <p className="flex items-center gap-2 border-t-[1.5px] border-nb-ink bg-nb-wash px-7 py-3 text-[12px] text-nb-ink-soft">
              <FiTerminal size={13} className="shrink-0" />
              Run it, then come back to this tab — the board shows up on its own.
            </p>
          )}
        </div>
      </Mat>
    </main>
  );
}

// One cause and its way out, as a row across the panel.
//
// The action sits in a fixed column beside the words in the app, so the two
// buttons line up down the right edge however their copy wraps. In a browser the
// action is a command — too long for that column at any type size worth reading
// — so it goes under the words at full width instead. Both stack below `sm`.
function Cause({
  title,
  body,
  /** Put the action under the words rather than beside them — what a command
   *  needs, since it doesn't fit the side column at a readable size. */
  stack,
  children,
}: {
  title: string;
  body: string;
  stack?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "flex flex-col gap-3 border-t-[1.5px] border-nb-ink px-7 py-5",
        !stack && "sm:flex-row sm:items-center sm:gap-6",
      )}
    >
      <div className="min-w-0 flex-1">
        <h2 className="text-[14px] font-[700]">{title}</h2>
        <p className="mt-1 text-[12.5px] leading-relaxed text-nb-ink-soft">{body}</p>
      </div>
      <div className={cn("shrink-0", !stack && "sm:w-[200px]")}>{children}</div>
    </section>
  );
}

// The mat: the panel is mounted on a watercolour rather than laid straight on
// the cream, the way the site mounts its screenshots (web/components/home/
// Mat.tsx). Same painting, same rule — the mat is bare, because an ink box
// around a watercolour is a frame around a picture; what holds it is its own
// bleed to the edge and the shadow the panel casts onto it. The panel keeps its
// own hard shadow rather than taking the site's soft print shadow: on this board
// a block is a block wherever it is standing.
//
// It is the one image the board loads from the network. If the CDN can't be
// reached — the board runs on a laptop, which is sometimes on a plane — the
// ground underneath is `nb-sky-soft`, the palette's own pale blue, so a failed
// load is a tinted mat rather than a hole.
const MAT = "https://cdn.ai4kanban.dev/bloom-1.jpg";

function Mat({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={cn("overflow-hidden rounded-[22px] bg-nb-sky-soft", className)}
      style={{
        backgroundImage: `url(${MAT})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      {children}
    </div>
  );
}

// The browser's way out: the command in full, so it can be selected by hand even
// if the clipboard is unavailable, with a copy button on it.
//
// Both are fills, not outlines — the wash behind the command, a hover tint under
// the button. A bordered code block and a bordered button here would be the two
// outlines this screen just got rid of, put back one level deeper.
function CopyCommand({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(t);
  }, [copied]);

  return (
    <div className="flex items-center gap-1 rounded-[9px] bg-nb-wash py-1 pr-1 pl-3">
      <code className="min-w-0 flex-1 font-mono text-[12px] break-words text-nb-ink">{text}</code>
      <button
        type="button"
        title="Copy"
        onClick={() => {
          navigator.clipboard
            ?.writeText(text)
            .then(() => setCopied(true))
            // No clipboard permission (or no clipboard at all) — the command is
            // on screen to select by hand, so there is nothing to report.
            .catch(() => {});
        }}
        className="shrink-0 cursor-pointer rounded-[7px] p-1.5 text-nb-ink-soft transition-colors hover:bg-nb-ink/[0.07] hover:text-nb-ink"
      >
        {copied ? <FiCheck size={14} className="text-nb-mint-ink" /> : <FiCopy size={14} />}
      </button>
    </div>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return <code className="font-mono text-[12px] text-nb-ink">{children}</code>;
}
