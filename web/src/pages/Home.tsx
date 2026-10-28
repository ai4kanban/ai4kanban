// `/`: 新想法, sent to the workspace's current project.

import { useStore } from "../store";
import { NewIdea } from "./NewIdea";

export function Home() {
  const store = useStore();
  return <NewIdea home first={store.tasks?.length === 0} />;
}
