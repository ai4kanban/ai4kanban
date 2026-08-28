import { copy } from "@/i18n";
import { boardRules } from "./cli";
import type { CloudAccount, CloudMove } from "./types";

// --- the Cloud sign-in (#326) ------------------------------------------------
// Which account this MACHINE acts as. Not a board setting: one sign-in covers every project
// the app has open and every terminal on the machine, because a relay carries one person's
// decisions.
//
// Nothing here knows what a sign-in is made of, where the session is held, or how it is
// refreshed. That is the board's own rules, so the flow can change — a different provider,
// a different file — with nothing in this app touched.

/** What the section shows when the rules loaded here predate Cloud. It draws the not
 *  signed-in state and says why the button cannot help. */
const TOO_OLD = copy.messages.rules.tooOldForCloud;

const UNKNOWN: CloudAccount = {
  state: "signed-out",
  handle: null,
  name: null,
  avatarUrl: null,
  avatarData: null,
  email: null,
  message: TOO_OLD,
  inviteRequestedAt: null,
  sessionFile: "",
  configured: false,
};

/** Who this machine is signed in as, asked of Cloud itself. */
export async function cloudAccount(): Promise<CloudAccount> {
  const rules = await boardRules();
  return rules.readCloudAccount ? rules.readCloudAccount() : UNKNOWN;
}

/** The consent screen to open in the user's own browser. The secret half of the sign-in
 *  stays on this machine; the answer comes back to the app over its URL scheme. */
export async function startCloudSignIn(): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const rules = await boardRules();
  if (!rules.startCloudSignIn) return { ok: false, error: TOO_OLD };
  return rules.startCloudSignIn();
}

/** The answer the app caught, turned into a sign-in this machine holds. */
export async function finishCloudSignIn(callback: string): Promise<{ ok: boolean; error?: string }> {
  const rules = await boardRules();
  if (!rules.finishCloudSignIn) return { ok: false, error: TOO_OLD };
  return rules.finishCloudSignIn(callback);
}

/** Stop this machine reaching Cloud. Nothing already on the board is touched. */
export async function signOutOfCloud(): Promise<{ ok: boolean; error?: string }> {
  const rules = await boardRules();
  if (!rules.signOutOfCloud) return { ok: false, error: TOO_OLD };
  return rules.signOutOfCloud();
}

// --- the two doors out of the not-admitted state (#327) ----------------------

/** Ask us for an invite. Pressing again records no second request and sends no second email. */
export async function requestCloudInvite(): Promise<CloudMove> {
  const rules = await boardRules();
  if (!rules.requestCloudInvite) return { ok: false, error: TOO_OLD };
  return rules.requestCloudInvite();
}

/** Spend a code on this account. The service's own words come back on a refusal. */
export async function redeemCloudInvitation(code: string): Promise<CloudMove> {
  const rules = await boardRules();
  if (!rules.redeemCloudInvitation) return { ok: false, error: TOO_OLD };
  return rules.redeemCloudInvitation(code);
}
