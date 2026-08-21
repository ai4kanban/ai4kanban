import { MemoryTree } from "@/components/home/MemoryTree";
import { Figure } from "./kit";

// "The board also preserves decisions in its memory."
//
// The memory is a directory of Markdown files, so the figure is the landing
// page's listing of it — the same print, one file per kind of thing the project
// has settled. The notes are written here rather than taken from the home copy:
// that copy is translated and a post is not.

const NOTES = {
  goal: "Project goal",
  module: "One per module",
  readme: "Shipped features",
  decisions: "Product decisions",
  rejected: "Reasons for rejection",
  redesign: "Design lessons",
};

export function MemoryFiles() {
  return (
    <Figure
      single
      wash="mintSky"
      caption="The memory is plain Markdown, one folder per module, sitting next to the tasks in the repository. A decision is written down where the next task will read it, and a rejected idea keeps the reason it was rejected — so the answer is already there instead of being asked again."
    >
      <div className="mdx-listing flex justify-center">
        <MemoryTree notes={NOTES} />
      </div>
    </Figure>
  );
}
