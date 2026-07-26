import { CodeBlock } from "../CodeBlock";
import { SectionHeading } from "../SectionHeading";

export function Install() {
  return (
    <section id="install" className="mt-24 scroll-mt-20">
      <SectionHeading num="01" eyebrow="Setup" title="Install in one prompt" />
      <p className="text-ink">
        From your project root, tell Claude Code (or any agent that can run shell
        commands):
      </p>
      <CodeBlock>{`Set up the kanban skill for this project. Read
https://ai4kanban.dev/INSTALL_PROMPT.txt
and follow it.`}</CodeBlock>
      <p className="text-muted">
        The agent copies the skill into{" "}
        <code className="rounded bg-accent/10 px-1.5 py-0.5 font-mono text-[0.9em] text-ink">
          .claude/skills/kanban/
        </code>
        , reads your codebase to fill in the configuration, scaffolds the board, and
        proposes your first three tasks.
      </p>
    </section>
  );
}
