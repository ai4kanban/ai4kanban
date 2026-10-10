// Stands in for Claude Code (no account, no model), speaking its `--input-format stream-json
// --output-format stream-json` protocol: one turn per user message on stdin, exit when stdin closes.
// A message containing 后台 puts a task in the background that ends after 15 s (很久: 10 min),
// then takes a turn by itself with the result; any other message is answered at once.
//
// Use: set the board's agent command to `node <this file>` in
// <project>/.akb/boards/docs/kanban/ui.config.json. With STAND_IN_LOG set, it logs its argv
// and every line in and out there.
import fs from 'node:fs'

const log = (line) => process.env.STAND_IN_LOG && fs.appendFileSync(process.env.STAND_IN_LOG, `${new Date().toISOString().slice(11, 19)} [${process.pid}] ${line}\n`)
log(`start: ${process.argv.slice(2).join(' ')}`)
const out = (ev) => {
  log(`out ${JSON.stringify(ev)}`)
  process.stdout.write(JSON.stringify(ev) + '\n')
}
let cost = 0
let tasks = []
let next = 1

const turn = (text) => {
  out({ type: 'system', subtype: 'init', model: 'stand-in' })
  out({ type: 'assistant', message: { model: 'stand-in', content: [{ type: 'text', text }] } })
  cost += 0.01
  out({ type: 'result', subtype: 'success', is_error: false, result: text, total_cost_usd: cost, usage: { input_tokens: 100, output_tokens: 20 } })
}

const textOf = (content) =>
  typeof content === 'string' ? content : (content ?? []).map((b) => b.text ?? '').join('\n')

function background(seconds) {
  const task_id = `b${next++}`
  out({ type: 'system', subtype: 'task_started', task_id, is_backgrounded: true, description: 'npm test' })
  tasks.push({ task_id, description: 'npm test' })
  out({ type: 'system', subtype: 'background_tasks_changed', tasks })
  turn('已在后台开始跑 `npm test`，跑完我再告诉你结果。')
  setTimeout(() => {
    out({ type: 'system', subtype: 'task_notification', task_id, status: 'completed', summary: '后台命令 npm test 已结束' })
    turn('后台的 `npm test` 跑完了：42 项测试全部通过。')
    tasks = tasks.filter((t) => t.task_id !== task_id)
    out({ type: 'system', subtype: 'background_tasks_changed', tasks })
  }, seconds * 1000)
}

let buf = ''
process.stdin.on('data', (d) => {
  buf += d
  let end
  while ((end = buf.indexOf('\n')) >= 0) {
    const said = textOf(JSON.parse(buf.slice(0, end)).message?.content)
    log(`in  user message (…${said.slice(-40).replace(/\n/g, ' ')})`)
    buf = buf.slice(end + 1)
    if (said.includes('后台')) background(said.includes('很久') ? 600 : 15)
    else turn(tasks.length ? '可以，后台任务不影响回答：导出按钮放在列表右上角。' : '导出按钮放在列表右上角。')
  }
})
process.stdin.on('end', () => {
  log('stdin closed, exit')
  process.exit(0)
})
process.on('SIGTERM', () => {
  log('SIGTERM, exit')
  process.exit(143)
})
