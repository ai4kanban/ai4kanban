// `/templates/<category>/<name>` (#1711). A template published since the build has no page,
// so it gets the shell, which asks Cloud itself. Only a name Cloud answers 404 for gets a
// 404 status (#1894); anything else keeps 200 so a new template is never marked gone.

interface Context {
  request: Request;
  next: () => Promise<Response>;
  env: { ASSETS: { fetch: (input: URL) => Promise<Response> } };
}

async function isGone(name: string): Promise<boolean> {
  try {
    const res = await fetch(`https://api.ai4kanban.dev/v1/catalog/${name}`, { signal: AbortSignal.timeout(3000) });
    return res.status === 404;
  } catch {
    return false;
  }
}

export async function onRequestGet({ request, next, env }: Context): Promise<Response> {
  const page = await next();
  if (page.status !== 404) return page;
  const url = new URL(request.url);
  const shell = await env.ASSETS.fetch(new URL(url.pathname.replace(/\/templates\/[^/]+\/[^/]+\/?$/, "/templates/_/_"), url));
  if (!shell.ok) return page;
  const name = url.pathname.match(/\/templates\/[^/]+\/([^/]+)\/?$/)?.[1] ?? "";
  return new Response(shell.body, { status: (await isGone(name)) ? 404 : 200, headers: shell.headers });
}
