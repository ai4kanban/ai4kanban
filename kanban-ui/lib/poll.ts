/** Read one of `app/poll/` — the timed polls, kept off the router's action queue (#1719). */
export async function poll<T>(path: string): Promise<T> {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json() as Promise<T>;
}
