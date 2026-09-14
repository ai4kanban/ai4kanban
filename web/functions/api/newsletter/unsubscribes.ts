// What the sender reads before it mails anyone: every unsubscribe token the site has
// recorded. Tokens only — the site holds no addresses, so this leaks nothing about who is
// on the list even if the key does get out.
//
// Guarded by `NEWSLETTER_ADMIN_TOKEN`, a Pages secret. Without it set, the route answers 503
// rather than serving the list unguarded. A send that cannot read this stops rather than
// mailing someone who already left, so every failure here is an error status, never an empty
// list.

interface D1Result<T> {
  results: T[];
}

interface D1PreparedStatement {
  all<T>(): Promise<D1Result<T>>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

interface Env {
  NEWSLETTER_DB: D1Database;
  NEWSLETTER_ADMIN_TOKEN?: string;
}

interface Context {
  request: Request;
  env: Env;
}

/** Compare without letting the time taken say how much of the token was right. */
function sameSecret(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function onRequestGet(context: Context): Promise<Response> {
  const expected = context.env.NEWSLETTER_ADMIN_TOKEN;
  if (!expected) return new Response("Not configured\n", { status: 503 });

  const offered = (context.request.headers.get("authorization") ?? "").replace(/^Bearer /, "");
  if (!sameSecret(offered, expected)) return new Response("Unauthorized\n", { status: 401 });

  let tokens: string[];
  try {
    const { results } = await context.env.NEWSLETTER_DB.prepare(
      "SELECT token FROM unsubscribes",
    ).all<{ token: string }>();
    tokens = results.map((row) => row.token);
  } catch {
    return new Response("Unavailable\n", { status: 503 });
  }

  return new Response(JSON.stringify({ tokens }), {
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}
