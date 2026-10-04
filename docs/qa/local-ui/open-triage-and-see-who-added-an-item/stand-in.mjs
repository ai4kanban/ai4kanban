// Stands in for the board's agent: no account, no model. Started as the scheduled `qa-manager`,
// it does what that agent does on finding a broken step — one `akb triage add`; started for
// anything else, it changes nothing and ends cleanly.
//
// Use: set the board's agent command to `node <this file> <path to cli/bin/ai4kanban.mjs>` in
// <project>/.akb/boards/docs/kanban/ui.config.json.
import { execFileSync } from 'node:child_process'

const prompt = process.argv.at(-1) ?? ''
const say = (text) => console.log(JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text }] } }))
const end = (result) => {
  console.log(JSON.stringify({ type: 'result', subtype: 'success', is_error: false, result }))
  process.exit(0)
}

if (!/^You are the `qa-manager` agent of the /.test(prompt)) end('Nothing to do here.')
say(execFileSync(process.execPath, [process.argv[2], 'triage', 'add',
  '--title', '导出 CSV 用例第 2 步：文件没有表头',
  '--text', '按「导出」后下载的文件第一行就是数据，用例写的是第一行为列名。',
  '--source', 'QA 手册 local-ui/export-csv 第 2 步'], { encoding: 'utf8' }).trim())
end('Added one item to triage.')
