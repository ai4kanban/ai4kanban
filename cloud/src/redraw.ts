/**
 * Every connector's message for one event, brought up to date (#351).
 *
 * An account may have Slack and Lark connected at once, and a press in either settles the
 * event exactly once. So a decision taken anywhere redraws EVERY connector at once, from
 * whichever one the press came from — otherwise a Slack message would go on offering a
 * decision until the hourly run noticed a Lark press had already settled it.
 *
 * Each connector's own pass answers `{ due: 0 }` when it is owed nothing, so an account that
 * connected one of them costs exactly one query for the other. And one connector failing
 * never costs the other its message: each already retries from the hourly run.
 */

import type { DeliveryRun } from './deliver.ts'
import type { Env } from './env.ts'
import { deliverLark } from './lark-deliver.ts'
import { deliverSlack } from './slack-deliver.ts'

const NOTHING: DeliveryRun = { due: 0, sent: 0, failed: 0 }

/** With an event named, only that one — which is what a route and a press both call. */
export async function redrawEverywhere(
  env: Env,
  eventId?: string,
): Promise<Record<string, DeliveryRun>> {
  const written = await Promise.allSettled([deliverSlack(env, eventId), deliverLark(env, eventId)])
  const named = ['slack', 'lark']
  const runs: Record<string, DeliveryRun> = {}
  written.forEach((one, at) => {
    const connector = named[at] ?? String(at)
    if (one.status === 'rejected') {
      console.error(`cloud: ${connector} delivery failed`, one.reason)
      runs[connector] = NOTHING
      return
    }
    runs[connector] = one.value
  })
  return runs
}
