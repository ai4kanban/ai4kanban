/**
 * Generated video covers (#1114). The OpenRouter key stays here; a machine sends a prompt, the
 * video's aspect ratio and a few real screenshots, and gets the image back.
 *
 * Pro only, at a flat price per image from the month's AI credits (#1113). A failure costs
 * nothing: credits are spent only once the image is in hand.
 */

import { billingOf, type SubscriptionRow } from './billing.ts'
import { creditsUsed, MONTHLY_CREDITS, spendCredits } from './credits.ts'
import { call } from './db.ts'
import type { Env } from './env.ts'
import { badRequest, creditsUsedUp, imageFailed, imageUnavailable, proRequired } from './errors.ts'

export const IMAGE_MODEL = 'openai/gpt-image-2.5-sunburst'
/** What the model accepts. */
export const ASPECTS = ['16:9', '9:16', '1:1', '4:3', '3:4', '3:2', '2:3', '21:9'] as const
export const MAX_PROMPT_CHARS = 4000
/** Each reference costs input tokens, so their number caps what one image costs. */
export const MAX_REFERENCES = 3
export const MAX_REFERENCE_BYTES = 8 * 1024 * 1024
const REFERENCE = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/

export async function generateImage(env: Env, user: string, body: unknown): Promise<Response> {
  const { prompt, aspect, references = [] } = (body ?? {}) as {
    prompt?: unknown
    aspect?: unknown
    references?: unknown
  }
  if (typeof prompt !== 'string' || !prompt.trim()) throw badRequest('Give the prompt for the image.')
  if (prompt.length > MAX_PROMPT_CHARS) {
    throw badRequest(`That prompt is too long. Keep it to ${MAX_PROMPT_CHARS} characters or fewer.`)
  }
  if (!ASPECTS.includes(aspect as (typeof ASPECTS)[number])) {
    throw badRequest(`Unknown aspect ratio. Pick one of: ${ASPECTS.join(', ')}.`)
  }
  if (!Array.isArray(references) || references.length > MAX_REFERENCES) {
    throw badRequest(`Give at most ${MAX_REFERENCES} reference images.`)
  }
  for (const reference of references) {
    if (typeof reference !== 'string' || !REFERENCE.test(reference)) {
      throw badRequest('Each reference must be a PNG, JPEG or WebP image as a base64 data URL.')
    }
    if (reference.length > (MAX_REFERENCE_BYTES * 4) / 3 + 64) {
      throw badRequest(`Each reference image must be ${MAX_REFERENCE_BYTES / 1024 / 1024} MB or smaller.`)
    }
  }
  const [rows, used] = await Promise.all([
    call<SubscriptionRow[]>(env, 'subscriptions_for', { p_user_id: user }),
    creditsUsed(env, user),
  ])
  if (billingOf(rows).plan !== 'pro') throw proRequired()
  if (used >= MONTHLY_CREDITS) throw creditsUsedUp()
  if (!env.OPENROUTER_API_KEY) throw imageUnavailable()

  let answer: Response
  try {
    answer = await fetch('https://openrouter.ai/api/v1/images', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
        'content-type': 'application/json',
        'x-title': 'AI4Kanban Cloud',
      },
      body: JSON.stringify({
        model: IMAGE_MODEL,
        prompt,
        aspect_ratio: aspect,
        quality: 'medium',
        ...(references.length > 0 && {
          input_references: references.map((url) => ({ type: 'image_url', image_url: { url } })),
        }),
      }),
    })
  } catch (e) {
    console.error('cloud: image unreachable', e)
    throw imageFailed()
  }
  if (!answer.ok) {
    console.error('cloud: image refused', answer.status, await answer.text().catch(() => ''))
    throw imageFailed()
  }
  const out = (await answer.json().catch(() => null)) as {
    data?: { b64_json?: string; media_type?: string }[]
  } | null
  const image = out?.data?.[0]
  if (!image?.b64_json) {
    console.error('cloud: image missing from the answer')
    throw imageFailed()
  }
  const bytes = Uint8Array.from(atob(image.b64_json), (c) => c.charCodeAt(0))
  await spendCredits(env, user, 'image', 1)
  return new Response(bytes, {
    headers: { 'content-type': image.media_type ?? 'image/png', 'x-model': IMAGE_MODEL },
  })
}
