// `https://ai4kanban.dev/unsubscribe?t=…` — the link at the foot of every newsletter, and
// the endpoint the reader's own one-click button posts to (RFC 8058).
//
// The token is an HMAC of the address, computed on the machine that holds the list. This
// endpoint never learns whose address it is: it writes the token down, and the next send
// reads the tokens back and works it out locally. That is why there is no address on the
// result page and nothing to look up here.
//
// GET  — record it, then send the reader to the result page. The link is meant to work with
//        no sign-in, so following it is the unsubscribe.
// POST — record it and answer 200. This is the client's own button; nobody reads the body.
//
// Both answer success only after the row is committed. A client that got a 200 shows the
// reader "unsubscribed", so a failed write has to come back as a failure or the reader is
// told a lie the next send would contradict.

interface D1Result {
  success: boolean;
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  run(): Promise<D1Result>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

interface Env {
  NEWSLETTER_DB: D1Database;
}

interface Context {
  request: Request;
  env: Env;
}

const TOKEN = /^[0-9a-f]{24}$/;

type Outcome = "done" | "unknown-token" | "failed";

async function record(env: Env, url: URL): Promise<Outcome> {
  const token = url.searchParams.get("t") ?? "";
  if (!TOKEN.test(token)) return "unknown-token";
  try {
    // A second unsubscribe is the same unsubscribe: it succeeds, and it leaves the first
    // one's timestamp alone. D1 reads and writes go to the primary instance unless a
    // session asks otherwise, so the row is there for the next read-back.
    await env.NEWSLETTER_DB.prepare(
      "INSERT INTO unsubscribes (token, at) VALUES (?, ?) ON CONFLICT(token) DO NOTHING",
    )
      .bind(token, new Date().toISOString())
      .run();
    return "done";
  } catch {
    return "failed";
  }
}

export async function onRequestGet(context: Context): Promise<Response> {
  const url = new URL(context.request.url);
  const outcome = await record(context.env, url);
  // Anything short of a recorded unsubscribe lands on the same page, which says the one
  // thing that is true either way: the subscription has not changed, here is how to reach us.
  const page = outcome === "done" ? "/unsubscribed" : "/unsubscribe-failed";
  return Response.redirect(new URL(page, url).toString(), 303);
}

export async function onRequestPost(context: Context): Promise<Response> {
  const url = new URL(context.request.url);
  const outcome = await record(context.env, url);
  const body = { done: "Unsubscribed\n", "unknown-token": "Unknown link\n", failed: "Try again later\n" }[outcome];
  const status = { done: 200, "unknown-token": 400, failed: 503 }[outcome];
  return new Response(body, {
    status,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
