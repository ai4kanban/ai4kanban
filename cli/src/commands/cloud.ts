// `akb cloud` — which account this machine acts as.
//
// It reports and it signs out. A sign-in is started from the desktop app's Configuration dialog and nowhere
// else (#326): the consent screen opens in the user's own browser and comes back to the app
// over its URL scheme, so a terminal has no address to be answered at. What a terminal does
// have is the file the app wrote, which is why an `akb` here acts as the same account with
// nothing else set up.
//
// `image`, `tts` and `music` generate through Cloud on the user's Pro credits (#1119). Their messages
// are bilingual because an agent relays them to the user as they are; exit 2 is a usage error.

import fs from 'node:fs'
import path from 'node:path'

import { readCloudAccount, signOutOfCloud } from '../lib/cloud/account'
import { cloudEndpoints } from '../lib/cloud/config'
import { accessToken } from '../lib/cloud/session'
import { die } from '../lib/paths'
import { say } from '../lib/io'
import type { MoveResult } from '../lib/types'

export async function cmdCloud(args: string[], program: string): Promise<MoveResult> {
  const [sub] = args
  if (sub === 'sign-out') {
    signOutOfCloud()
    say('Signed out. This machine no longer reaches Cloud; nothing on any board changed.')
    return { signedOut: true }
  }
  if (sub !== undefined) {
    die(
      `unknown \`cloud\` command "${sub}". Try \`${program} cloud\` or \`${program} cloud sign-out\`.`,
      { kind: 'unknown-move' },
    )
  }

  const account = await readCloudAccount()
  for (const line of report(account, program)) say(line)
  return { cloud: account }
}

function report(account: Awaited<ReturnType<typeof readCloudAccount>>, program: string): string[] {
  const who = account.handle
    ? `@${account.handle}${account.name ? ` (${account.name})` : ''}`
    : 'this account'
  const lines: string[] = []
  switch (account.state) {
    case 'signed-out':
      lines.push('Not signed in to Cloud. Nothing on this machine reaches it.')
      lines.push(
        account.configured
          ? 'Sign in from the WildCrane app, under Configuration → Cloud. It is once per machine.'
          : account.message ?? '',
      )
      break
    case 'signed-in':
      lines.push(`Signed in to Cloud as ${who}.`)
      lines.push(`Held at ${account.sessionFile}, for this whole machine.`)
      lines.push(`Sign out with \`${program} cloud sign-out\`.`)
      break
    case 'not-admitted':
      lines.push(`Signed in as ${who}, and not admitted.`)
      if (account.message) lines.push(account.message)
      // Asking is a button in the app (#327). A terminal has none, so it says where it is.
      lines.push(
        account.inviteRequestedAt
          ? `You asked for an invite on ${account.inviteRequestedAt.slice(0, 10)}. We answer by email.`
          : 'Request an invite in the WildCrane app, under Configuration → Cloud.',
      )
      lines.push(`Sign out with \`${program} cloud sign-out\`.`)
      break
    case 'expired':
      lines.push(`Your Cloud sign-in as ${who} has expired.`)
      lines.push('Sign in again from the WildCrane app, under Configuration → Cloud.')
      break
  }
  if (account.error) lines.push(`Cloud could not be reached: ${account.error}`)
  return lines.filter(Boolean)
}

// ---- generation ---------------------------------------------------------------------

export type Said = { zh: string; en: string }

export const SAID = {
  'signed-out': {
    zh: '未登录 WildCrane Cloud。请在 WildCrane 应用的“配置 → Cloud”中登录后重试。',
    en: 'Not signed in to WildCrane Cloud. Sign in from Configuration → Cloud in the WildCrane app, then try again.',
  },
  expired: {
    zh: 'WildCrane Cloud 登录已过期。请在 WildCrane 应用的“配置 → Cloud”中重新登录后重试。',
    en: 'Your WildCrane Cloud sign-in has expired. Sign in again from Configuration → Cloud in the WildCrane app, then try again.',
  },
  unreachable: {
    zh: '无法连接 WildCrane Cloud。请检查网络后重试。',
    en: 'Could not reach WildCrane Cloud. Check your connection and try again.',
  },
  credits_used_up: {
    zh: '本月积分已用完，下月 1 日（UTC）重置；可在桌面应用的 Billing 页查看余额。',
    en: 'This month’s AI credits are used up. They reset on the 1st of next month (UTC); check your balance on the Billing page in the desktop app.',
  },
  trial_credits_used_up: {
    zh: '试用期的 AI 积分已用完。试用结束后可在桌面应用的 Billing 页购买 Pro。',
    en: 'Your trial’s AI credits are used up. Get Pro from the Billing page in the desktop app once the trial ends.',
  },
} satisfies Record<string, Said>

interface Generation {
  usage: string
  endpoint: string
  body: Record<string, unknown>
  out: string
  pro_required: Said
  failed: Said
  /** The other way to get the same thing, offered with every failure. */
  fallback: Said
  /** What the success line names in brackets after the file. */
  label: (res: Response) => string
  /** Where the answer goes when its format is not the one `out` names. */
  outFor?: (res: Response, out: string) => string
}

const REF_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
}

function usage(problem: string, line: string): never {
  die(`${problem}\nusage: ${line}`, { kind: 'bad-args', bare: true, exitCode: 2 })
}

const TIERS = ['economy', 'standard', 'premium']
const SPEECH_TIERS = ['standard', 'premium']

/** `akb cloud image --aspect <ratio> [--tier <tier>] [--ref <file>]… --out <file.png> "<prompt>"` */
export async function cloudImage(
  opts: { aspect?: string; tier?: string; refs: string[]; out?: string; prompt: string },
  program: string,
): Promise<MoveResult> {
  const line = `${program} cloud image --aspect <ratio> [--tier economy|standard|premium] [--ref <file>]… --out <file.png> "<prompt>"`
  if (!opts.aspect) usage('Missing --aspect.', line)
  const tier = opts.tier ?? 'standard'
  if (!TIERS.includes(tier)) usage(`--tier ${tier}: pick one of ${TIERS.join(', ')}.`, line)
  if (!opts.out) usage('Missing --out.', line)
  const prompt = opts.prompt.trim()
  if (!prompt) usage('Missing the prompt.', line)
  const references = opts.refs.map((file) => {
    const type = REF_TYPES[path.extname(file).toLowerCase()]
    if (!type) usage(`--ref ${file}: use a PNG, JPEG or WebP file.`, line)
    try {
      return `data:${type};base64,${fs.readFileSync(file).toString('base64')}`
    } catch (e) {
      usage(`--ref ${file}: ${e instanceof Error ? e.message : String(e)}`, line)
    }
  })
  return generate({
    usage: line,
    endpoint: '/v1/image',
    body: { prompt, aspect: opts.aspect, tier, references },
    out: opts.out,
    pro_required: {
      zh: '图像生成是 Pro 功能。升级 Pro：https://wildcrane.ai/pricing',
      en: 'Image generation is a Pro feature. Upgrade at https://wildcrane.ai/pricing',
    },
    failed: { zh: '图像暂时无法生成，请稍后重试。', en: 'The image could not be generated right now. Try again later.' },
    fallback: {
      zh: '也可以改用现有图片或截图。',
      en: 'You can also use an existing image or screenshot instead.',
    },
    // A Cloud without tiers answers no `x-tier`, and generated at standard.
    label: (res) => `${res.headers.get('x-model') ?? 'unknown model'}, ${res.headers.get('x-tier') ?? 'standard'}`,
  })
}

/** `akb cloud tts --voice <name> [--tier <tier>] --out <file.wav> "<text>"` — never falls back to
 *  another voice or tier. */
export async function cloudTts(
  opts: { voice?: string; tier?: string; out?: string; text: string },
  program: string,
): Promise<MoveResult> {
  const line = `${program} cloud tts --voice <name> [--tier standard|premium] --out <file.wav> "<text>"`
  if (!opts.voice) usage('Missing --voice.', line)
  const tier = opts.tier ?? 'standard'
  if (!SPEECH_TIERS.includes(tier)) usage(`--tier ${tier}: pick one of ${SPEECH_TIERS.join(', ')}.`, line)
  if (!opts.out) usage('Missing --out.', line)
  const text = opts.text.trim()
  if (!text) usage('Missing the text to speak.', line)
  const voice = opts.voice
  return generate({
    usage: line,
    endpoint: '/v1/speech',
    body: { voice, text, tier },
    out: opts.out,
    pro_required: {
      zh: '托管声音是 Pro 功能。升级 Pro：https://wildcrane.ai/pricing',
      en: 'Hosted voices are a Pro feature. Upgrade at https://wildcrane.ai/pricing',
    },
    failed: {
      zh: '托管声音暂时无法生成旁白，请稍后重试。',
      en: 'Hosted voices could not generate the narration right now. Try again later.',
    },
    fallback: {
      zh: '也可以改用本地声音（`npx hyperframes tts --list`）。',
      en: 'You can also use a local voice instead (`npx hyperframes tts --list`).',
    },
    label: (res) => `${res.headers.get('x-voice') ?? voice}, ${res.headers.get('x-tier') ?? 'standard'}`,
    // Chinese voices answer mp3 (#87).
    outFor: (res, out) =>
      res.headers.get('content-type') === 'audio/mpeg' && /\.wav$/i.test(out) ? out.replace(/\.wav$/i, '.mp3') : out,
  })
}

/** `akb cloud music --seconds <n> --out <file.mp3> "<prompt>"` */
export async function cloudMusic(
  opts: { seconds?: string; out?: string; prompt: string },
  program: string,
): Promise<MoveResult> {
  const line = `${program} cloud music --seconds <n> --out <file.mp3> "<prompt>"`
  if (!opts.seconds) usage('Missing --seconds.', line)
  if (!opts.out) usage('Missing --out.', line)
  const seconds = Number(opts.seconds)
  if (!Number.isFinite(seconds) || seconds <= 0) usage(`--seconds ${opts.seconds}: give a number of seconds.`, line)
  const prompt = opts.prompt.trim()
  if (!prompt) usage('Missing the prompt.', line)
  return generate({
    usage: line,
    endpoint: '/v1/music',
    body: { prompt, seconds },
    out: opts.out,
    pro_required: {
      zh: '托管配乐是 Pro 功能。升级 Pro：https://wildcrane.ai/pricing',
      en: 'Hosted music is a Pro feature. Upgrade at https://wildcrane.ai/pricing',
    },
    failed: { zh: '托管配乐暂时无法生成，请稍后重试。', en: 'Hosted music could not be generated right now. Try again later.' },
    fallback: {
      zh: '也可以先留空音乐槽位，或换成你自己的曲子。',
      en: 'You can also leave the music slot empty, or use a track of your own.',
    },
    label: () => `${seconds}s`,
  })
}

function refuse(m: Said, fallback: Said): never {
  die([m.zh, m.en, fallback.zh, fallback.en].join('\n'), { kind: 'cloud-refused', bare: true })
}

async function generate(g: Generation): Promise<MoveResult> {
  const token = await accessToken()
  if (!token.ok) refuse(SAID[token.reason], g.fallback)
  let res: Response
  try {
    res = await fetch(`${cloudEndpoints().api}${g.endpoint}`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token.token}`, 'content-type': 'application/json' },
      body: JSON.stringify(g.body),
    })
  } catch {
    refuse(SAID.unreachable, g.fallback)
  }
  if (!res.ok) {
    const { error } = (await res.json().catch(() => ({}))) as { error?: { code?: string; message?: string } }
    if (res.status === 401) refuse(SAID.expired, g.fallback)
    if (error?.code === 'pro_required') refuse(g.pro_required, g.fallback)
    // Only the month's pool resets, so only its refusal says when (#1932).
    if (error?.code === 'credits_used_up') {
      refuse(res.headers.has('retry-after') ? SAID.credits_used_up : SAID.trial_credits_used_up, g.fallback)
    }
    if (res.status === 400) usage(error?.message ?? 'The request was refused.', g.usage)
    refuse(g.failed, g.fallback)
  }
  const out = g.outFor?.(res, g.out) ?? g.out
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true })
  fs.writeFileSync(out, Buffer.from(await res.arrayBuffer()))
  say(`${out} (${g.label(res)})`)
  return { out }
}
