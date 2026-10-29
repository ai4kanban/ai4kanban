// `/settings/workspace` and `/projects/<id>/settings` (#2201): the workspace's and a project's own
// settings pages, opened from the top bar's menus. At phone width each is a page of its own: back,
// its title and what it belongs to.

import { useEffect, type ReactNode } from "react";
import { FiChevronLeft, FiFolder, FiGitCommit, FiSliders, FiTool } from "react-icons/fi";
import { HAIRLINE } from "@review/components/chrome";
import { cn } from "@review/lib/utils";
import * as api from "../api";
import { F } from "../first-run-i18n";
import { T } from "../i18n";
import { useNarrow } from "../lib/narrow";
import { projectSectionOf, projectSettingsHref, type ProjectSection } from "../lib/settings";
import { navigate, useLocation } from "../router";
import { useStore } from "../store";
import { ProjectAgents } from "../components/Agents";
import { Skeleton } from "../components/Skeleton";
import { Window } from "../components/Window";
import { NameRow, WorkspacePanel } from "../components/Workspace";
import { Gone } from "./Gone";

const SECTIONS = [
  { id: "general" as const, label: () => F.general.section, icon: FiSliders },
  { id: "workflows" as const, label: () => T.agents.workflows, icon: FiGitCommit },
  { id: "board" as const, label: () => T.agents.board, icon: FiTool },
];

function Frame({ title, sub, project, children }: { title: string; sub?: ReactNode; project?: api.Project; children: ReactNode }) {
  const phone = useNarrow();
  const store = useStore();
  useEffect(() => {
    document.title = `${title} · WildCrane`;
  }, [title]);
  useEffect(() => {
    if (project) store.setCurrent(project.id);
  }, [project?.id]);
  if (!phone)
    return (
      <Window project={project}>
        <div className="relative h-full overflow-y-auto">{children}</div>
      </Window>
    );
  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-nb-paper font-sans text-nb-ink">
      <div className="box-content flex h-12 shrink-0 items-center gap-1 border-b px-2 pt-[env(safe-area-inset-top)]" style={{ borderColor: HAIRLINE }}>
        <button
          type="button"
          aria-label={T.back}
          onClick={() => (history.length > 1 ? history.back() : navigate("/"))}
          className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-[8px] text-nb-ink"
        >
          <FiChevronLeft size={20} aria-hidden />
        </button>
        <h1 className="min-w-0 flex-1 truncate text-[15px] font-[800] tracking-[-0.02em]">{title}</h1>
        {sub && <span className="flex min-w-0 shrink items-center gap-1.5 pr-2 text-[12.5px] text-nb-ink-soft">{sub}</span>}
      </div>
      <div className="relative min-h-0 flex-1 overflow-y-auto pb-[env(safe-area-inset-bottom)]">{children}</div>
    </div>
  );
}

export function WorkspaceSettings() {
  const store = useStore();
  const phone = useNarrow();
  useLocation();
  const at = location.hash === "#runners" ? "runners" : undefined;
  return (
    <Frame title={T.ws.settings}>
      <div className="mx-auto flex max-w-[720px] flex-col gap-6 px-8 py-8 max-md:px-4 max-md:py-5">
        {!phone && <h1 className="text-[18px] font-[800] tracking-[-0.02em]">{T.ws.settings}</h1>}
        <WorkspacePanel key={store.ws.id} at={at} />
      </div>
    </Frame>
  );
}

export function ProjectSettings({ projectId }: { projectId: string }) {
  const store = useStore();
  const phone = useNarrow();
  const { path, query } = useLocation();
  const section = projectSectionOf(path, query) ?? "general";
  const project = store.projects.find((p) => p.id === projectId);
  if (!store.tasks)
    return (
      <Window>
        <Skeleton className="max-w-[420px] p-6" />
      </Window>
    );
  if (!project) return <Gone text={T.notFoundProject} />;

  const pick = (id: ProjectSection) => navigate(projectSettingsHref(project.id, id), true);
  const nav = (
    <nav
      aria-label={T.projectSettings}
      className={phone ? "flex shrink-0 gap-5 border-b px-4" : "flex w-[180px] shrink-0 flex-col gap-1"}
      style={phone ? { borderColor: HAIRLINE } : undefined}
    >
      {!phone && <h1 className="mb-3 px-3 text-[18px] font-[800] tracking-[-0.02em]">{T.projectSettings}</h1>}
      {SECTIONS.map(({ id, label, icon: Icon }) => {
        const here = id === section;
        return (
          <button
            key={id}
            type="button"
            aria-current={here || undefined}
            onClick={() => pick(id)}
            className={
              phone
                ? cn("relative cursor-pointer py-2.5 text-[13px] font-[700] nb-focus", here ? "text-nb-ink" : "text-nb-ink-soft")
                : cn("flex cursor-pointer items-center gap-2 rounded-[8px] px-3 py-2 text-left text-[13px] font-[700] nb-focus", here ? "bg-nb-accent-soft text-nb-accent-deep" : "text-nb-ink-soft hover:bg-nb-ink/5 hover:text-nb-ink")
            }
          >
            {!phone && <Icon className="shrink-0 text-[15px]" aria-hidden />}
            {label()}
            {phone && here && <span aria-hidden className="absolute inset-x-0 bottom-[-1px] h-[2px] rounded-full bg-nb-ink" />}
          </button>
        );
      })}
    </nav>
  );
  const body =
    section === "general" ? (
      <NameRow value={project.name} readOnly={project.general} onSave={async (name) => (await api.renameProject(project.id, name), store.reload())} />
    ) : (
      <ProjectAgents key={project.id} project={project.id} section={section} />
    );
  return (
    <Frame
      title={T.projectSettings}
      project={project}
      sub={
        <>
          <FiFolder size={12} className="shrink-0" aria-hidden />
          <span className="truncate">{project.name}</span>
        </>
      }
    >
      {phone ? (
        <>
          {nav}
          <div key={`${project.id}:${section}`} className="a4k-reveal flex flex-col gap-6 px-4 py-5">
            {body}
          </div>
        </>
      ) : (
        <div className="mx-auto flex h-full min-h-[600px] max-w-[1040px] gap-8 px-8 py-8">
          {nav}
          <div key={`${project.id}:${section}`} className="a4k-reveal flex min-w-0 flex-1 flex-col gap-6">
            {body}
          </div>
        </div>
      )}
    </Frame>
  );
}
