// What an agent page is.
//
// One page is one `.mdx` file in `web/content/agents/`, and the filename is the
// slug — `web/content/agents/kanban-for-codex.mdx` is `/agents/kanban-for-codex`.
// It is the long-form answer to "what does AI4Kanban add to <coding agent>",
// and it is a file in the repo for the same reason a post is: it reviews like
// code and ships with the deploy that built it.
//
// The frontmatter a page carries:
//
//   ---
//   title: "Kanban for Codex: planning before parallel execution"  # the H1
//   title_tag: "Kanban for Codex: Plan Before Execution"  # optional SERP title
//   nav: "Kanban for Codex"               # the footer link label
//   description: "..."                    # meta description
//   lead: "One sentence under the headline."
//   eyebrow: "Codex workflow guide"       # optional; the read time is appended
//   social_image_alt: "..."               # optional
//   schema:
//     description: "..."                  # optional; falls back to description
//   ---

export type AgentPage = {
  slug: string;
  /** The on-page H1. */
  title: string;
  /** The SERP `<title>`, for a headline that is wrong outside its page. */
  titleTag?: string;
  /** The short name the footer links the page by. */
  navLabel: string;
  description: string;
  /** The sentence under the headline. */
  lead: string;
  /** The kicker above the headline; the read time is appended to it. */
  eyebrow?: string;
  socialImageAlt?: string;
  /** The prose the structured data describes the product with. */
  schemaDescription: string;
  readMinutes: number;
  body: string;
};
