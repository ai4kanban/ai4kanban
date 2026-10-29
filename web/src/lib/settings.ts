// A project settings page's address: `/projects/<id>/settings`, its section in `?section=`.

export type ProjectSection = "general" | "workflows" | "board";
export const PROJECT_SECTIONS: ProjectSection[] = ["general", "workflows", "board"];

export const projectSettingsHref = (project: string, section: ProjectSection = "general") =>
  `/projects/${encodeURIComponent(project)}/settings${section === "general" ? "" : `?section=${section}`}`;

/** The section a project settings address names, or null off that page. */
export function projectSectionOf(path: string, query: URLSearchParams): ProjectSection | null {
  if (!/^\/projects\/[^/]+\/settings\/?$/.test(path)) return null;
  return PROJECT_SECTIONS.find((s) => s === query.get("section")) ?? "general";
}
