/** What the Worker is given. Only the two credentials are secret. */
export interface Env {
  /** The events and their daily summaries. */
  DB: D1Database
  /** The per-address hourly limit. It holds a number in memory and writes nothing. */
  LIMITER: DurableObjectNamespace
  /**
   * The day's own requests and rows written. Kept here rather than in D1 because a row per
   * request would spend the whole day's allowance measuring itself; the daily job reads a
   * day back and writes it into that day's summary as one number.
   */
  USAGE?: AnalyticsEngineDataset
  /** Which copy of the service this is. The development copy also answers `localhost`. */
  COPY: 'production' | 'development'
  /**
   * What the daily job reads the usage dataset back with — an account id and a token with
   * Account Analytics Read. Deliberately optional: without them every request is still taken
   * and every summary is still written, with that day's usage recorded as unknown rather
   * than the whole job failing.
   */
  CF_ACCOUNT_ID?: string
  CF_API_TOKEN?: string
}

export const development = (env: Env): boolean => env.COPY === 'development'
