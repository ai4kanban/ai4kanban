// Stands in for Cloud: says the account has Pro and answers the judge's questions. Every item is
// worth doing, needs no user, owns no open card; the workflow pick is the WORKFLOW table's, by
// item title (blog-post when the title is not in it). Each question asked is printed.
// Use: node endpoint.mjs <port>; point akb at it with AI4KANBAN_CLOUD_URL=http://127.0.0.1:<port>.
import http from 'node:http'

const WORKFLOW = {
  'Dark mode toggle does nothing': 'blog-post',
  'Settings page has no QA case': 'none',
  'Export loses card order': 'blog-post',
  'Translate the docs into French': 'none',
}
const sure = (choice) => ({ choice, confidence: 0.95 })
const port = Number(process.argv[2] ?? 4710)

http
  .createServer((req, res) => {
    let raw = ''
    req.on('data', (c) => (raw += c))
    req.on('end', () => {
      const send = (body) => {
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end(JSON.stringify(body))
      }
      if (req.url === '/v1/billing') return send({ billing: { plan: 'pro', periodEnd: '2099-01-01T00:00:00Z' } })
      if (req.url !== '/v1/judge') return send({})
      const { state, questions } = JSON.parse(raw)
      const title = String(state.item).match(/^title:\s*(.*)$/m)?.[1]?.replace(/^"|"$/g, '') ?? ''
      const fixed = { worth: 'yes', rejected: 'no', duplicate: 'none', needsUser: 'no', small: 'no', priority: 'med', roi: 'med', workflow: WORKFLOW[title] ?? 'blog-post' }
      const answers = Object.fromEntries(
        Object.entries(questions).map(([key, q]) => [key, sure(fixed[key] ?? Object.keys(q.criteria)[0])]),
      )
      console.log(`judge: "${title}" → workflow ${answers.workflow.choice}`)
      send({ answers })
    })
  })
  .listen(port, '127.0.0.1', () => console.log(`stand-in Cloud on http://127.0.0.1:${port}`))
