"use client";

import { useRouter } from "next/navigation";
import { MakeBoardHere, PickAnotherProject } from "./desktop";
import { useOnTabFocus } from "./sessions";

// Shown as the whole page when the walk up finds no `docs/kanban/todo/`. It
// takes over the screen the way "this task is not on the board" does: no header,
// no buttons, no Configuration dialog — every one of those reads a board, and
// there isn't one.
//
// In a browser it is a message, not an offer: the UI says what to run and gets
// out of the way, because there is a terminal right there to run it in. In the
// app there isn't one, so both ways out are buttons — make a board here, or open
// a different folder. A folder with no board is a normal thing to pick in the
// app, and it has to lead somewhere.
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
      <div className="nb-panel w-full max-w-[560px] px-7 py-6">
        <h1 className="text-[17px] font-[700]">There is no board here.</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-nb-ink-soft">
          Looked for <Code>docs/kanban/todo/</Code> in{" "}
          <Code>{searchedFrom}</Code> and in every folder above it. Two things it could be:
        </p>

        {desktop ? (
          <section className="mt-5">
            <h2 className="text-[14px] font-[700]">This project has no board yet.</h2>
            <p className="mt-1 text-[13px] leading-relaxed text-nb-ink-soft">
              Make one here and setup starts in this window — the board, the skill your
              coding agent reads, and a checklist that walks you through the rest.
            </p>
            <MakeBoardHere desktop />
          </section>
        ) : (
          <Cause
            title="This repo has no board yet."
            what="Make one — run this in the repo root:"
            command="npx ai4kanban install"
          />
        )}
        {desktop ? (
          <section className="mt-5">
            <h2 className="text-[14px] font-[700]">This is not the project you meant.</h2>
            <p className="mt-1 text-[13px] leading-relaxed text-nb-ink-soft">
              Pick another folder — the app opens it in this window. Everything you have
              opened before is behind the folder name at the top of the board.
            </p>
            <PickAnotherProject desktop />
          </section>
        ) : (
          <Cause
            title="This is not the repo you meant."
            what="Stop the UI and start it from your repo root, or point it at the repo:"
            command="npx ai4kanban-ui --board /path/to/repo"
          />
        )}

        {!desktop && (
          <p className="mt-5 text-[12px] leading-relaxed text-nb-ink-soft">
            Install a board in a terminal, then switch back to this tab — it shows up on its
            own.
          </p>
        )}
      </div>
    </main>
  );
}

function Cause({ title, what, command }: { title: string; what: string; command: string }) {
  return (
    <section className="mt-5">
      <h2 className="text-[14px] font-[700]">{title}</h2>
      <p className="mt-1 text-[13px] leading-relaxed text-nb-ink-soft">{what}</p>
      <pre className="mt-2 overflow-x-auto rounded-[8px] border-[1.5px] border-nb-ink bg-nb-wash px-3 py-2 font-mono text-[13px] text-nb-ink">
        {command}
      </pre>
    </section>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return <code className="font-mono text-[12px] text-nb-ink">{children}</code>;
}
