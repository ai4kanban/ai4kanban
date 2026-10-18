// Stands in for Claude Code as the video cloner: no account, no model. One turn from stdin
// (`--input-format stream-json`), then it does what video-cloner's AGENT.md asks at that point:
//   - asked to plan a card: reads its AGENT.md, writes `breakdown.json` (one shot per source
//     beat, with a source frame) and `clone.json` (the user's content beat by beat), checks
//     both with scriptwriter's validator, shows them on the card as `<Storyboard>` with an
//     unticked checkpoint todo, and asks one `[user]` question;
//   - asked to apply the answers: drops the answered question and ticks the checkpoint;
//   - asked to plan a card whose checkpoint is ticked: drops `clone.json` and both storyboards, shows the clone
//     against the source as a `<Compare>` whose shots come from the breakdown, ticks the
//     adds a ticked todo with the template folder and its render command, and marks it ready.
// The rendered clone is a prepared file (`$STAND_IN_MEDIA/clone-render.mp4`); the template
// folder only holds a `template.md`.
// Use: the board's agent command is `node <this file> <path to cli/bin/ai4kanban.mjs>`.
import { execFileSync } from 'node:child_process'
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const media = process.env.STAND_IN_MEDIA
const akb = (...args) => execFileSync(process.execPath, [process.argv[2], ...args], { encoding: 'utf8' })
const out = (ev) => process.stdout.write(JSON.stringify(ev) + '\n')
const say = (text) => out({ type: 'assistant', message: { content: [{ type: 'text', text }] } })
const end = (result) => {
  out({ type: 'result', subtype: 'success', is_error: false, result, total_cost_usd: 0, usage: { input_tokens: 1, output_tokens: 1 } })
  process.exit(0)
}

const line = await new Promise((ok) => {
  let buf = ''
  process.stdin.on('data', (d) => {
    buf += d
    if (buf.includes('\n')) ok(buf.slice(0, buf.indexOf('\n')))
  })
})
const said = JSON.parse(line).message.content
const prompt = typeof said === 'string' ? said : said.map((c) => c.text ?? '').join('\n')
out({ type: 'system', subtype: 'init', model: 'stand-in' })

const plan = prompt.match(/Plan task (\d+)/)?.[1]
const answers = prompt.match(/Apply my answers to the open questions on task (\d+)/)?.[1]
const id = plan ?? answers
if (!id) end('Nothing to do here.')

const list = JSON.parse(akb('raw', 'list', '--json'))
const root = resolve(list.board, '../..')
const cardPath = join(root, list.cards.find((c) => String(c.id) === id).file)
const files = join(root, '.akb/boards/docs/kanban/assets', id)
const rel = (f) => `.assets/${id}/${f}`
mkdirSync(files, { recursive: true })

const beats = [
  { id: 'S1', start: 0, end: 1.6, name: 'Logo 静置', at: 0.8 },
  { id: 'S2', start: 1.6, end: 3.5, name: '色块推入 + 浏览器窗口升起', at: 2.8 },
  { id: 'S3', start: 3.5, end: 6, name: '叠化到标语', at: 5 },
]

const approved = readFileSync(cardPath, 'utf8').includes('- [x] 原片拆解和复刻脚本已确认')

if (answers) {
  akb('raw', 'update-questions', id, '--drop', '1')
  writeFileSync(cardPath, readFileSync(cardPath, 'utf8').replace('- [ ] 原片拆解和复刻脚本已确认', '- [x] 原片拆解和复刻脚本已确认'))
  say(`Applied your approval on #${id}.`)
  end('已记下：两份草稿已确认。')
}

if (!approved) {
  const agent = akb('raw', 'agent-file', 'video-cloner', 'AGENT.md')
  say(`Read AGENT.md: ${agent.match(/^- \*\*Stage 1[^:]*/m)?.[0] ?? 'no stage 1'}.`)
  for (const b of beats)
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', String(b.at), '-i', join(root, 'media/launch.mp4'), '-frames:v', '1', '-vf', 'scale=640:-2', join(files, `src-${b.id.toLowerCase()}.png`)])
  const shot = (b, rest) => ({ id: b.id, start: b.start, end: b.end, voiceover: { mode: 'none' }, captions: [], ...rest })
  const breakdown = {
    version: 1,
    shots: [
      shot(beats[0], { action: '藏青底上一个白色 Logo 块静置。', details: '骨架镜。居中构图；运动：无；道具：无；内容位：Logo；转场：硬切；声音：无。', frames: [{ src: rel('src-s1.png'), alt: '藏青底中央一个白块' }] }),
      shot(beats[1], { action: '橙色色块从右擦入，浏览器窗口从底部缓出升起。', details: '骨架镜。擦入 0.4 秒，窗口 ease-out 升起 0.8 秒；道具：macOS 浏览器窗口；内容位：产品界面；转场：叠化 0.3 秒；声音：无。', frames: [{ src: rel('src-s2.png'), alt: '橙色底上升起的浏览器窗口' }] }),
      shot(beats[2], { action: '叠化到白底，藏青横条居中停住。', details: '居中横条；运动：叠化后静止；道具：无；内容位：标语；转场：结尾；声音：无。', frames: [{ src: rel('src-s3.png'), alt: '白底中央一条藏青横条' }] }),
    ],
  }
  const clone = {
    version: 1,
    shots: [
      shot(beats[0], { action: '深绿底上 `Tasko` 字标静置。', captions: ['Tasko'], details: '字标占 Logo 位。', frames: [] }),
      shot(beats[1], { action: '青绿色块擦入，浏览器窗口升起，里面是 Tasko 收件箱。', details: '窗口内是收件箱列表和本周统计。', frames: [] }),
      shot(beats[2], { action: '叠化到白底标语。', captions: ['Plan less. Ship more.'], details: '标语占横条位。', frames: [] }),
    ],
  }
  writeFileSync(join(files, 'breakdown.json'), JSON.stringify(breakdown, null, 2))
  writeFileSync(join(files, 'clone.json'), JSON.stringify(clone, null, 2))
  writeFileSync(join(files, 'recipe.md'), '# Recipe\n\n1280×720, 30 fps, 6 s, no sound.\n')
  const validator = join(files, '..', `validate-${id}.mjs`)
  writeFileSync(validator, akb('raw', 'agent-file', 'scriptwriter', 'scripts/validate-storyboard.mjs'))
  for (const f of ['breakdown.json', 'clone.json'])
    say(execFileSync(process.execPath, [validator, join(files, f)], { encoding: 'utf8' }).trim())
  rmSync(validator)
  const card = readFileSync(cardPath, 'utf8').trimEnd()
  writeFileSync(cardPath, `${card}

## Worth noting

## By \`video-cloner\` agent

<Storyboard src="${rel('breakdown.json')}" label="原片拆解" />

<Storyboard src="${rel('clone.json')}" label="复刻脚本" />

<!-- agent -->

## Scope
- **模板**：照确认后的复刻脚本逐镜渲染，内容全在一个文件里。

## Todo
- [ ] 原片拆解和复刻脚本已确认

## Decided by the agent
- **动画库**：用 HyperFrames，三个镜头都是 CSS 级的擦入、缓出和叠化。

### Overruled by the user
`)
  akb('raw', 'update-questions', id, '--append', '[user] 原片拆解和复刻脚本可以照这样做模板吗？', '--agent', 'video-cloner', '--recommended-option', '可以，按这两份稿做模板', '--option', '要改，说明哪一镜')
  say(`Wrote the breakdown and the clone script on #${id}; waiting for your approval.`)
  end('两份草稿在卡片上，确认后我再做模板。')
}

copyFileSync(join(root, 'media/launch.mp4'), join(files, 'source.mp4'))
copyFileSync(join(media, 'clone-render.mp4'), join(files, 'clone.mp4'))
const shots = JSON.parse(readFileSync(join(files, 'breakdown.json'), 'utf8')).shots.map((s, i) => ({ id: s.id, start: s.start, end: s.end, name: beats[i].name }))
writeFileSync(join(files, 'shots.json'), JSON.stringify(shots, null, 2))
rmSync(join(files, 'clone.json'))
mkdirSync(join(files, 'template'), { recursive: true })
writeFileSync(join(files, 'template/template.md'), '# Template\n\nReplace the content in `content.js` with your own; this template reproduces only the source\'s craft.\n')
const card = readFileSync(cardPath, 'utf8')
  .replace(/<Storyboard src="[^"]*breakdown\.json"[^\n]*\n\n<Storyboard src="[^"]*clone\.json"[^\n]*\n/,
    `<Compare a="${rel('source.mp4')}" b="${rel('clone.mp4')}" shots="${rel('shots.json')}" label="源片 vs 复刻" a-label="源片" b-label="复刻" />

- **S2**：窗口里的产品界面是按截图重画的，不是原图。
`)
  .replace('- [x] 原片拆解和复刻脚本已确认', `- [x] 原片拆解和复刻脚本已确认\n- [x] 模板 \`${join(files, 'template')}\`，渲染命令 \`npx --yes hyperframes render -f 30 -o ../clone.mp4\``)
writeFileSync(cardPath, card)
akb('raw', 'validate', id)
akb('raw', 'update', id, '--status', 'ready')
say(`Built the template from the approved clone script and compared it with the source on #${id}.`)
end('满意的话请把 #2 归档。')
