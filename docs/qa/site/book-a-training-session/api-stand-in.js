// Stands in for api.ai4kanban.dev inside the page: nothing leaves the machine. Each call is
// recorded in window.__sent; window.__answer(path) picks the reply.
(() => {
  const real = window.fetch
  window.__sent = []
  window.__replies = {}
  window.fetch = async (input, init = {}) => {
    const url = input instanceof Request ? input.url : String(input)
    if (!url.startsWith('https://api.ai4kanban.dev/')) return real(input, init)
    const path = new URL(url).pathname
    window.__sent.push({ method: init.method || 'GET', path: path + new URL(url).search, body: init.body ? JSON.parse(init.body) : null })
    const r = (window.__replies[path] || window.__replies['*'] || { status: 200, body: {} })
    const reply = typeof r === 'function' ? r(url, init) : r
    await new Promise((res) => setTimeout(res, 400))
    return new Response(JSON.stringify(reply.body), { status: reply.status, headers: { 'content-type': 'application/json' } })
  }
})()
