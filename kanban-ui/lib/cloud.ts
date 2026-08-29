import { getCopy } from "@/i18n";
import { boardRules } from "./cli";
import { DEFAULT_LANGUAGE, type CloudAccount, type CloudMove, type SlackConversation, type SlackState } from "./types";

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
// Read at load, so English: rules that predate Cloud may predate the language setting too.
const TOO_OLD = getCopy(DEFAULT_LANGUAGE).messages.rules.tooOldForCloud;

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

// --- the one way out of the not-admitted state (#327, #350) ------------------

/** Ask us for an invite. Pressing again records no second request and sends no second email. */
export async function requestCloudInvite(): Promise<CloudMove> {
  const rules = await boardRules();
  if (!rules.requestCloudInvite) return { ok: false, error: TOO_OLD };
  return rules.requestCloudInvite();
}

// --- the account's Slack destination (#320) ----------------------------------
// Where a task waiting on a decision arrives, and where that decision is made. One
// destination for the account, shared by every board Cloud is on for, with the board named
// on each message — so this sits with the sign-in above rather than with the board's own
// settings, for exactly the reason the silencing switch does.
//
// Nothing here holds a Slack credential. The token Cloud posts with is minted by Slack and
// handed straight to the service, which is the whole reason a connection is made through
// the browser rather than by pasting something into a box.

const NO_SLACK: SlackState = { connection: null, configured: false, error: TOO_OLD };

/** The connection this account holds, or the absence of one. */
export async function slackState(): Promise<SlackState> {
  const rules = await boardRules();
  return rules.readSlackState ? rules.readSlackState() : NO_SLACK;
}

/** The consent screen to open in the user's own browser. Slack answers the service, which
 *  hands the browser back to the app on its URL scheme. */
export async function startSlackConnect(): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const rules = await boardRules();
  if (!rules.startSlackConnect) return { ok: false, error: TOO_OLD };
  return rules.startSlackConnect();
}

/** The conversations a destination can be pointed at. */
export async function slackConversations(): Promise<
  { ok: true; conversations: SlackConversation[] } | { ok: false; error: string }
> {
  const rules = await boardRules();
  if (!rules.readSlackConversations) return { ok: false, error: TOO_OLD };
  return rules.readSlackConversations();
}

/** Point it at one. Picking again is also how a refusal Slack raised is cleared. */
export async function setSlackChannel(channelId: string, channelName: string): Promise<CloudMove> {
  const rules = await boardRules();
  if (!rules.setSlackChannel) return { ok: false, error: TOO_OLD };
  return rules.setSlackChannel(channelId, channelName);
}

/** Stop posting. No board is touched and every event goes on exactly as it was. */
export async function disconnectSlack(): Promise<CloudMove> {
  const rules = await boardRules();
  if (!rules.disconnectSlack) return { ok: false, error: TOO_OLD };
  return rules.disconnectSlack();
}

/** Where the card link in a Slack message leads. Null when the URL names no card, so the
 *  window can hand every one of the app's URLs through it. */
export async function cloudCardLink(url: string) {
  const rules = await boardRules();
  return rules.readCloudCardLink ? rules.readCloudCardLink(url) : null;
}
