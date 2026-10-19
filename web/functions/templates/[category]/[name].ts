// `/templates/<category>/<name>` (#1711). Every template the build saw has a page of
// its own; one published since has not, so it gets the shell, which reads the name
// from the URL and asks Cloud. A name Cloud does not know then says so on the page.

interface Context {
  request: Request;
  next: () => Promise<Response>;
  env: { ASSETS: { fetch: (input: URL) => Promise<Response> } };
}

export async function onRequestGet({ request, next, env }: Context): Promise<Response> {
  const page = await next();
  if (page.status !== 404) return page;
  const url = new URL(request.url);
  const shell = await env.ASSETS.fetch(new URL(url.pathname.replace(/\/templates\/[^/]+\/[^/]+\/?$/, "/templates/_/_"), url));
  if (!shell.ok) return page;
  return new Response(shell.body, { status: 200, headers: shell.headers });
}
