// The Workers runtime types this service uses. Declared here so a checkout typechecks with
// TypeScript alone; everything else comes from the `WebWorker` lib.

declare interface ScheduledController {
  readonly scheduledTime: number
  readonly cron: string
  noRetry(): void
}

declare interface ExecutionContext {
  /** Keep the isolate alive for work the response does not wait on — the invitation mail. */
  waitUntil(promise: Promise<unknown>): void
  passThroughOnException(): void
}

declare interface R2ObjectBody {
  readonly size: number
  readonly httpMetadata?: { contentType?: string }
  readonly body: ReadableStream
  /** Set when the read asked for a range (#1711). */
  readonly range?: { offset?: number; length?: number; suffix?: number }
  arrayBuffer(): Promise<ArrayBuffer>
  json<T = unknown>(): Promise<T>
}

/** The parts of an R2 binding the template catalog uses (#1708). */
declare interface R2Bucket {
  get(key: string, options?: { range?: Headers }): Promise<R2ObjectBody | null>
  put(
    key: string,
    value: ArrayBuffer | Uint8Array | string,
    options?: { httpMetadata?: { contentType?: string } },
  ): Promise<unknown>
  delete(keys: string | string[]): Promise<void>
  createMultipartUpload(key: string, options?: { httpMetadata?: { contentType?: string } }): Promise<R2MultipartUpload>
  resumeMultipartUpload(key: string, uploadId: string): R2MultipartUpload
  list(options?: { prefix?: string; cursor?: string }): Promise<{
    objects: { key: string }[]
    truncated: boolean
    cursor?: string
  }>
}

/** A large artifact file on its way into R2 (#2017). */
declare interface R2MultipartUpload {
  readonly key: string
  readonly uploadId: string
  uploadPart(partNumber: number, value: ArrayBuffer | Uint8Array): Promise<R2UploadedPart>
  complete(parts: R2UploadedPart[]): Promise<unknown>
  abort(): Promise<void>
}

declare interface R2UploadedPart {
  partNumber: number
  etag: string
}

/** The parts of a Durable Object namespace and its state that hosted music uses (#1828). */
declare interface DurableObjectNamespace {
  newUniqueId(): unknown
  idFromName(name: string): unknown
  get(id: unknown): { fetch(input: string, init?: RequestInit): Promise<Response> }
}

declare interface DurableObjectState {
  /** Hibernatable WebSockets (#2085). */
  acceptWebSocket(ws: WebSocket, tags?: string[]): void
  getWebSockets(tag?: string): WebSocket[]
  getTags(ws: WebSocket): string[]
  /** Pings answered without waking the object (#2163). */
  setWebSocketAutoResponse(pair: WebSocketRequestResponsePair): void
  getWebSocketAutoResponseTimestamp(ws: WebSocket): Date | null
  waitUntil(promise: Promise<unknown>): void
  readonly storage: {
    getAlarm(): Promise<number | null>
    setAlarm(at: number): Promise<void>
    deleteAlarm(): Promise<void>
    /** A SQLite-backed object's tables (#2081). */
    readonly sql: SqlStorage
    transactionSync<T>(fn: () => T): T
    deleteAll(): Promise<void>
  }
}

declare interface SqlStorage {
  exec<T = Record<string, unknown>>(query: string, ...bindings: unknown[]): { toArray(): T[] }
}

declare class WebSocketRequestResponsePair {
  constructor(request: string, response: string)
}

declare class WebSocketPair {
  0: WebSocket
  1: WebSocket
}

interface ResponseInit {
  webSocket?: WebSocket | null
}

interface Response {
  readonly webSocket: WebSocket | null
}
