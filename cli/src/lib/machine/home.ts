// The folder every machine-level AI4Kanban file lives in.
//
// 机器配置放在仓库之外，由 Runner、插件和命令行共用。

import os from 'node:os'
import path from 'node:path'

/** `AI4KANBAN_HOME` moves it, which is what a test uses. */
export function machineHome(): string {
  return process.env.AI4KANBAN_HOME || path.join(os.homedir(), '.ai4kanban')
}
