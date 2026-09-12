// The Workers runtime types this service uses. Declared here so a checkout typechecks with
// TypeScript alone; everything else comes from the `WebWorker` lib.

declare interface ScheduledController {
  readonly scheduledTime: number
  readonly cron: string
  noRetry(): void
}

declare interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void
  passThroughOnException(): void
}

declare interface D1Meta {
  rows_read: number
  rows_written: number
  changes: number
}

declare interface D1Result<T = Record<string, unknown>> {
  results: T[]
  success: boolean
  meta: D1Meta
}

declare interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement
  run<T = Record<string, unknown>>(): Promise<D1Result<T>>
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>
  first<T = unknown>(column?: string): Promise<T | null>
}

declare interface D1Database {
  prepare(query: string): D1PreparedStatement
  batch<T = Record<string, unknown>>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>
}

declare interface R2Object {
  key: string
  size: number
}

declare interface R2Objects {
  objects: R2Object[]
  truncated: boolean
  cursor?: string
}

declare interface R2Bucket {
  put(
    key: string,
    value: string,
    options?: { httpMetadata?: { contentType?: string }; customMetadata?: Record<string, string> },
  ): Promise<R2Object>
  list(options?: { prefix?: string; limit?: number; cursor?: string }): Promise<R2Objects>
}

declare interface DurableObjectStub {
  fetch(input: string, init?: RequestInit): Promise<Response>
}

declare interface DurableObjectId {
  toString(): string
}

declare interface DurableObjectNamespace {
  idFromName(name: string): DurableObjectId
  get(id: DurableObjectId): DurableObjectStub
}

declare interface AnalyticsEngineDataset {
  writeDataPoint(event: { blobs?: string[]; doubles?: number[]; indexes?: string[] }): void
}

/** The one thing we read off an incoming request that the fetch standard has no room for. */
declare interface CloudflareRequest extends Request {
  readonly cf?: { country?: string }
}
