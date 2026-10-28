// Signing in against Supabase Auth by hand: GitHub with PKCE as runner/src/signin.ts does it,
// and the emailed 6-digit code. The session lives in localStorage and is refreshed near expiry.

import { SUPABASE_KEY, SUPABASE_URL } from "./config";
import { LANG } from "./i18n";

export type Session = { access_token: string; refresh_token: string; expires_at: number; email: string | null };

const KEY = "wildcrane.review.session";
const PKCE = "wildcrane.review.pkce";
const EARLY_MS = 60_000;

export class AuthError extends Error {
  constructor(
    readonly kind: "bad_code" | "rate_limited" | "offline" | "failed",
    message: string = kind,
  ) {
    super(message);
  }
}

const listeners = new Set<() => void>();
export const onSession = (fn: () => void) => {
  listeners.add(fn);
  return () => void listeners.delete(fn);
};

export function readSession(): Session | null {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? "null") as Session | null;
    return s?.access_token && s.refresh_token ? s : null;
  } catch {
    return null;
  }
}

function writeSession(s: Session | null) {
  if (s) localStorage.setItem(KEY, JSON.stringify(s));
  else localStorage.removeItem(KEY);
  for (const fn of listeners) fn();
}

export const signOut = () => writeSession(null);

type TokenAnswer = { access_token?: string; refresh_token?: string; expires_in?: number; expires_at?: number; user?: { email?: string | null } };

function sessionFrom(t: TokenAnswer): Session | null {
  if (!t.access_token || !t.refresh_token) return null;
  const expires_at = t.expires_at ? t.expires_at * 1000 : Date.now() + (t.expires_in ?? 3600) * 1000;
  return { access_token: t.access_token, refresh_token: t.refresh_token, expires_at, email: t.user?.email ?? null };
}

async function auth(path: string, body: unknown): Promise<TokenAnswer> {
  let r: Response;
  try {
    r = await fetch(`${SUPABASE_URL}/auth/v1/${path}`, {
      method: "POST",
      headers: { apikey: SUPABASE_KEY, "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new AuthError("offline");
  }
  const data = (await r.json().catch(() => ({}))) as TokenAnswer & { error_code?: string; code?: string | number; msg?: string };
  if (r.ok) return data;
  if (r.status === 429) throw new AuthError("rate_limited");
  const code = String(data.error_code ?? data.code ?? "");
  if (r.status === 403 || /otp|expired|invalid/i.test(code)) throw new AuthError("bad_code");
  throw new AuthError("failed", code || String(r.status));
}

export async function sendCode(email: string): Promise<void> {
  await auth("otp", { email, create_user: true, data: { lang: LANG } });
}

export async function verifyCode(email: string, code: string): Promise<void> {
  const s = sessionFrom(await auth("verify", { type: "email", email, token: code }));
  if (!s) throw new AuthError("bad_code");
  writeSession(s);
}

let refreshing: Promise<Session | null> | null = null;

/** A fresh session, refreshed first when near expiry or `force`d after a 401. Null when signed
 *  out, or when the refresh token no longer works. */
export async function freshSession(force = false): Promise<Session | null> {
  const s = readSession();
  if (!s) return null;
  if (!force && s.expires_at - Date.now() > EARLY_MS) return s;
  refreshing ??= auth("token?grant_type=refresh_token", { refresh_token: s.refresh_token })
    .then((t) => {
      const next = sessionFrom(t);
      writeSession(next ? { ...next, email: next.email ?? s.email } : null);
      return next;
    })
    .catch((e: unknown) => {
      // Offline keeps the session for the next try; anything else ends it.
      if (!(e instanceof AuthError && e.kind === "offline")) writeSession(null);
      return null;
    })
    .finally(() => (refreshing = null));
  return refreshing;
}

const base64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

export async function signInWithGitHub(back: string): Promise<void> {
  const verifier = base64url(crypto.getRandomValues(new Uint8Array(32)));
  const challenge = base64url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))));
  sessionStorage.setItem(PKCE, JSON.stringify({ verifier, back }));
  const url = new URL(`${SUPABASE_URL}/auth/v1/authorize`);
  url.searchParams.set("provider", "github");
  url.searchParams.set("redirect_to", `${location.origin}/auth/callback`);
  url.searchParams.set("scopes", "user:email");
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "s256");
  location.assign(url.toString());
}

/** Finishes a GitHub sign-in on `/auth/callback`; answers the path to go back to. */
export async function finishGitHub(): Promise<string> {
  const params = new URLSearchParams(location.search);
  const saved = JSON.parse(sessionStorage.getItem(PKCE) ?? "null") as { verifier: string; back: string } | null;
  sessionStorage.removeItem(PKCE);
  const code = params.get("code");
  if (!code || !saved) throw new AuthError("failed");
  const s = sessionFrom(await auth("token?grant_type=pkce", { auth_code: code, code_verifier: saved.verifier }));
  if (!s) throw new AuthError("failed");
  writeSession(s);
  return saved.back;
}

export const pendingGitHubBack = (): string | null => {
  try {
    return (JSON.parse(sessionStorage.getItem(PKCE) ?? "null") as { back: string } | null)?.back ?? null;
  } catch {
    return null;
  }
};
