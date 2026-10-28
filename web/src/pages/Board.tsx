// `/projects/<id>`: the project's board (legacy Board.tsx around Queue.tsx).

import { useEffect } from "react";
import { T } from "../i18n";
import { useNarrow } from "../lib/narrow";
import { useStore } from "../store";
import { BoardCheer } from "../components/Cheer";
import { Queue } from "../components/Queue";
import { Skeleton } from "../components/Skeleton";
import { Window } from "../components/Window";
import { Gone } from "./Gone";

export function Board({ projectId }: { projectId: string }) {
  const store = useStore();
  const phone = useNarrow();
  const project = store.projects.find((p) => p.id === projectId);
  useEffect(() => {
    document.title = `${project ? project.name : T.projects} · WildCrane`;
  }, [project?.name]);
  if (!store.tasks)
    return (
      <Window>
        <Skeleton className="max-w-[420px] p-6" />
      </Window>
    );
  if (!project) return <Gone text={T.notFoundProject} />;
  const tasks = store.tasks.filter((t) => t.project === project.id);
  return (
    <Window project={project}>
      <Queue tasks={tasks} phone={phone} />
      <BoardCheer tasks={tasks} />
    </Window>
  );
}
