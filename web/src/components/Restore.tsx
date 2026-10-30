// 恢复 a removed task (#94): the button and its confirm, on the archive's rows and the task page.

import { FiRotateCcw } from "react-icons/fi";
import * as api from "../api";
import { T } from "../i18n";
import { ConfirmButton } from "./Confirm";

/** Why a restore from the archive failed, for the task page it opens to say. */
const failures = new Map<string, string>();
export const takeRestoreFailure = (task: string) => {
  const why = failures.get(task) ?? null;
  failures.delete(task);
  return why;
};

/** Restores `task`; the line to show when it could not. */
export async function restore(task: api.Task, onDone: (t: api.Task) => void): Promise<string | null> {
  try {
    onDone(await api.restoreTask(task.id));
    return null;
  } catch (e) {
    const code = e instanceof api.ApiError ? e.code : "";
    return T.restoreTask.failed(code === "conflict" ? T.restoreTask.notRemoved : code === "offline" ? T.errors.offline : T.errors.generic);
  }
}

/** Keeps a failure for the task page the archive opens next. */
export const handOver = (task: string, why: string | null) => (why ? failures.set(task, why) : failures.delete(task));

export function RestoreButton({ task, busy, onRestore }: { task: api.Task; busy?: boolean; onRestore: () => void }) {
  const c = T.restoreTask;
  return (
    <ConfirmButton
      icon={<FiRotateCcw className="text-[13px]" aria-hidden />}
      label={c.label}
      ask={c.ask}
      hint={c.hint[task.restores_to ?? "stopped"]}
      busy={busy}
      onConfirm={onRestore}
    />
  );
}
