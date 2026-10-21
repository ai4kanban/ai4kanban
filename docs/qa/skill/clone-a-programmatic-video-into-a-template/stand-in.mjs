// Stand-in for Claude Code on a video clone card. Speaks claude's stream-json, records each
// run's argv and prompt under $STANDIN_LOG, and does what video-cloner's AGENT.md asks for the
// card's current stage: drafts when the card has no stages yet, the template on stage 2.
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'

const LOG = process.env.STANDIN_LOG || '/tmp/qa-skill/vc/standin'
const MEDIA = process.env.STANDIN_MEDIA || '/tmp/qa-skill/vc/media'
fs.mkdirSync(LOG, { recursive: true })
const n = fs.readdirSync(LOG).filter((f) => f.endsWith('.argv')).length + 1
const argv = process.argv.slice(2)
fs.writeFileSync(path.join(LOG, `${n}.argv`), argv.join(' ') + '\n')
const at = (flag) => (argv.includes(flag) ? argv[argv.indexOf(flag) + 1] : undefined)
const session = at('--session-id') || at('--resume') || randomUUID()
const out = (ev) => process.stdout.write(JSON.stringify(ev) + '\n')

let buf = ''
process.stdin.setEncoding('utf8')
process.stdin.on('data', (d) => {
  buf += d
  const nl = buf.indexOf('\n')
  if (nl < 0) return
  const prompt = JSON.parse(buf.slice(0, nl)).message.content
  fs.writeFileSync(path.join(LOG, `${n}.prompt`), typeof prompt === 'string' ? prompt : JSON.stringify(prompt))
  out({ type: 'system', subtype: 'init', session_id: session, model: 'stand-in' })
  let said
  try { said = act(prompt) } catch (e) { said = `stand-in failed: ${e.message}` }
  out({ type: 'assistant', message: { content: [{ type: 'text', text: said }] }, session_id: session })
  out({ type: 'result', subtype: 'success', is_error: false, result: said, session_id: session })
  process.exit(0)
})

const akb = (...a) => execFileSync('akb', a, { encoding: 'utf8' })
function cardFile() {
  const dir = 'docs/kanban/todo'
  const f = fs.readdirSync(dir).find((f) => /^2-/.test(f))
  return path.join(dir, f)
}
const assets = '.akb/boards/docs/kanban/assets/2'
const shot = (id, start, end, action, captions, details, frames = []) => ({ id, start, end, voiceover: { mode: 'none' }, action, captions, details, frames })

function setSection(text) {
  const file = cardFile()
  let s = fs.readFileSync(file, 'utf8')
  s = s.replace(/\n## By `video-cloner` agent\n[\s\S]*?(?=\n<!-- agent -->)/, '')
  s = s.replace('\n<!-- agent -->', `\n## By \`video-cloner\` agent\n\n${text}\n\n<!-- agent -->`)
  fs.writeFileSync(file, s)
}

function act(prompt) {
  if (!/card #?2\b|#2\b/.test(prompt)) return 'Nothing for me here.'
  const s = fs.readFileSync(cardFile(), 'utf8')
  const phase = Number((s.match(/^phase:\s*(\d+)/m) || [])[1] || 0)
  fs.mkdirSync(assets, { recursive: true })
  if (!phase) {
    if (!s.includes('<!-- agent -->')) fs.writeFileSync(cardFile(), s.trimEnd() + '\n\n## Worth noting\n\n<!-- agent -->\n\n## Scope\n\n- **复刻**：按原片的三拍做一个可换内容的模板，内容换成 Tasko。\n\n## Todo\n\n- [ ] 模板做好，并与原片逐镜对比\n\n## Decided by the agent\n')
    fs.copyFileSync(path.join(MEDIA, 'launch.mp4'), path.join(assets, 'source.mp4'))
    for (const [i, t] of [[1, 1], [2, 3], [3, 5]]) execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-ss', String(t), '-i', path.join(assets, 'source.mp4'), '-frames:v', '1', '-vf', 'scale=320:-1', path.join(assets, `frame-s${i}.png`)])
    fs.writeFileSync(path.join(assets, 'breakdown.json'), JSON.stringify({ version: 1, shots: [
      shot('S1', 0, 2, '藏青底上一块白色 Logo 静置', ['Launchly'], '骨架镜。运动：无。内容位：Logo。转场：橙色从右擦入。声音：无。', [{ src: '.assets/2/frame-s1.png', alt: '藏青底上的白色 Logo' }]),
      shot('S2', 2, 4, '橙色擦入，一扇浏览器窗口从底部升起', ['Ship in minutes'], '骨架镜。运动：窗口 ease-out 上升 0.6 秒。道具：浏览器窗口。内容位：产品界面。转场：叠化。', [{ src: '.assets/2/frame-s2.png', alt: '橙底上升起的浏览器窗口' }]),
      shot('S3', 4, 6, '叠化到白底，藏青横条写行动号召', ['Try it free'], '运动：横条从左展开。内容位：标语。声音：无。', [{ src: '.assets/2/frame-s3.png', alt: '白底上的藏青横条' }]),
    ] }, null, 2))
    fs.writeFileSync(path.join(assets, 'clone.json'), JSON.stringify({ version: 1, shots: [
      shot('S1', 0, 2, 'Tasko 标志静置在藏青底上', ['Tasko'], '同原片 S1，换成 Tasko 标志。'),
      shot('S2', 2, 4, '橙色擦入，窗口升起，里面是 Tasko 的看板', ['一眼看清本周任务'], '窗口里放重画的 Tasko 看板模块。'),
      shot('S3', 4, 6, '白底藏青横条写行动号召', ['免费试用 Tasko'], '同原片 S3。'),
    ] }, null, 2))
    fs.writeFileSync(path.join(assets, 'recipe.md'), '1280×720 · 30 fps · 6 s · Inter · 藏青 #1b2a4a / 橙 #f08a24 / 白\n')
    setSection('<Compare a=".assets/2/source.mp4" b=".assets/2/clone.json" shots=".assets/2/breakdown.json" label="原片与复刻脚本" a-label="原片拆解" b-label="复刻脚本" />')
    akb('raw', 'update', '2', '--phases', '草稿,模板', '--phase', '1')
    akb('raw', 'validate', '2')
    return '原片拆解和复刻脚本写好了，卡片上并排逐镜对照。没问题就批准草稿，我接着做模板。'
  }
  if (phase === 2) {
    const tpl = path.resolve('templates/launch-clone')
    fs.mkdirSync(tpl, { recursive: true })
    fs.writeFileSync(path.join(tpl, 'template.md'), '# Launch clone\n\nReplace the content in content.js with your own; this template reproduces only the source\'s craft.\n')
    fs.writeFileSync(path.join(tpl, 'content.js'), "export default { beats: [{ id: 'S1', logo: 'Tasko' }, { id: 'S2', caption: '一眼看清本周任务' }, { id: 'S3', caption: '免费试用 Tasko' }], music: null }\n")
    fs.copyFileSync(path.join(MEDIA, 'clone.mp4'), path.join(assets, 'clone.mp4'))
    setSection('<Compare a=".assets/2/source.mp4" b=".assets/2/clone.mp4" shots=".assets/2/breakdown.json" label="原片与复刻" a-label="原片" b-label="复刻" />\n\n- S2：窗口里的产品界面是按截图重画的，不是原图。')
    const file = cardFile()
    let c = fs.readFileSync(file, 'utf8')
    c = c.replace('- [ ] 模板做好，并与原片逐镜对比', `- [x] 模板做好，并与原片逐镜对比：\`${tpl}\`，渲染命令 \`node render.mjs\``)
    fs.writeFileSync(file, c)
    akb('raw', 'validate', '2')
    return '模板做好了，卡片上是原片与复刻的逐镜对比。满意的话请把 #2 归档。'
  }
  return `#2 is on stage ${phase}; nothing to do.`
}
