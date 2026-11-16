// Ports: the only things the application layer knows about the outside world.
// This file holds type definitions only (JSDoc), no code.

/**
 * @typedef {Object} StructuredRequest
 * @property {string} system
 * @property {string} prompt
 * @property {string} schemaName
 * @property {object} schema            JSON Schema in the strict subset
 * @property {number} maxOutputTokens
 * @property {number} timeoutMs
 * @property {AbortSignal} [signal]     the caller's cancellation
 */

/**
 * @typedef {Object} StructuredResult
 * @property {unknown} data             parsed JSON, not yet validated against domain rules
 * @property {{inputTokens: number|null, outputTokens: number|null, totalTokens: number|null}} usage
 *           provider-reported values; null when the provider did not report them
 * @property {string} provider
 * @property {string} model
 * @property {number} latencyMs
 * @property {boolean} recovered        true when `data` was salvaged from output the provider rejected
 */

/**
 * @typedef {Object} AIProvider
 * @property {string} name
 * @property {string} model
 * @property {(req: StructuredRequest) => Promise<StructuredResult>} generateStructured throws AIProviderError
 * @property {(opts?: {signal?: AbortSignal}) => Promise<void>} checkAvailability
 *           verifies credentials and model without generating tokens; throws AIProviderError
 */

/**
 * @typedef {Object} Store
 * @property {(key: string) => Promise<string|null>} get
 * @property {(key: string, value: string, opts: {ttlSeconds: number}) => Promise<void>} set
 * @property {(key: string, opts: {ttlSeconds: number, by?: number}) => Promise<number>} incr
 *           atomic; the TTL is applied only when the key is created
 * @property {() => Promise<void>} ping
 */

/**
 * @typedef {Object} Logger
 * @property {(event: string, fields?: object) => void} info
 * @property {(event: string, fields?: object) => void} warn
 * @property {(event: string, fields?: object) => void} error
 */

export {};
