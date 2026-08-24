// What a run cost, worked out from its tokens.
//
// Claude Code prices its own runs and prints the number. Codex prices nothing and is not
// going to: the upstream ask for cost tracking was closed without shipping, and the event
// stream carries token counts and nothing else. So the board does that arithmetic itself —
// the run's tokens at the model's published rate, which is the same kind of number Claude
// Code prints and the same estimate the runs panel already labels it as.
//
// A model this table doesn't name gets NO price rather than a guessed one. Codex runs on
// whatever a user points it at — a local model through ollama, a gateway, a provider that
// publishes no rates — and a made-up figure is worse than a blank. The caller is what
// decides a price may be worked out at all; this file only knows list rates.
//
// Keeping it current is a hand edit against the provider's own pricing page. A rate that
// goes stale makes an estimate drift, so the table stays short: the models these agents
// actually offer, and nothing kept around for completeness.

import type { TokenUsage } from './types'

/** US dollars per million tokens. `cachedInput` is the rate a cache hit bills at. */
interface Price {
  input: number
  cachedInput: number
  output: number
}

// OpenAI's list rates, from developers.openai.com/api/docs/pricing (checked 2026-08-24).
// The models Codex offers, plus the API-only ids a user can name in the Model box. Where a
// model has no cache discount, a cache hit bills as fresh input.
const OPENAI: Record<string, Price> = {
  'gpt-5.6-sol': { input: 4, cachedInput: 0.4, output: 20 },
  'gpt-5.6-terra': { input: 2, cachedInput: 0.2, output: 12 },
  'gpt-5.6-luna': { input: 0.2, cachedInput: 0.02, output: 1.2 },
  'gpt-5.5': { input: 5, cachedInput: 0.5, output: 30 },
  'gpt-5.5-pro': { input: 30, cachedInput: 30, output: 180 },
  'gpt-5.4': { input: 2.5, cachedInput: 0.25, output: 15 },
  'gpt-5.4-mini': { input: 0.75, cachedInput: 0.075, output: 4.5 },
  'gpt-5.4-nano': { input: 0.2, cachedInput: 0.02, output: 1.25 },
  'gpt-5.4-pro': { input: 30, cachedInput: 30, output: 180 },
  'gpt-5.3-codex': { input: 1.75, cachedInput: 0.175, output: 14 },
  'gpt-5.2': { input: 1.75, cachedInput: 0.175, output: 14 },
  'gpt-5.2-pro': { input: 21, cachedInput: 21, output: 168 },
  'gpt-5.1': { input: 1.25, cachedInput: 0.125, output: 10 },
  'gpt-5': { input: 1.25, cachedInput: 0.125, output: 10 },
  'gpt-5-mini': { input: 0.25, cachedInput: 0.025, output: 2 },
  'gpt-5-nano': { input: 0.05, cachedInput: 0.005, output: 0.4 },
  'gpt-5-pro': { input: 15, cachedInput: 15, output: 120 },
}

// One table per provider, because a model id only means a price alongside the provider that
// served it: a gateway can answer to `gpt-5.6-sol` at its own rates, and an id nobody
// publishes rates for belongs to no table at all.
const PRICES: Record<string, Record<string, Price>> = { openai: OPENAI }

// `gpt-5.6-sol` is what the agent reports; `gpt-5.6-sol-2026-07-09` is the same model pinned
// to a snapshot, and `openai/gpt-5.6-sol` is the same model written provider-first. All three
// price alike.
function lookUp(table: Record<string, Price>, model: string): Price | undefined {
  const id = model.trim().toLowerCase().replace(/^[^/]+\//, '')
  return table[id] ?? table[id.replace(/-\d{4}-\d{2}-\d{2}$/, '')]
}

/** What this run's tokens cost at list rates, or nothing at all for a model whose rates the
 *  board doesn't know. A cache write bills as fresh input; a cache hit at its own rate. */
export function priceUsd(
  provider: string | undefined,
  model: string | undefined,
  usage: TokenUsage | undefined,
): number | undefined {
  if (!provider || !model || !usage) return undefined
  const table = PRICES[provider.trim().toLowerCase()]
  const price = table && lookUp(table, model)
  if (!price) return undefined
  const usd =
    ((usage.input + usage.cacheCreation) * price.input +
      usage.cacheRead * price.cachedInput +
      usage.output * price.output) /
    1_000_000
  return usd > 0 ? usd : undefined
}
