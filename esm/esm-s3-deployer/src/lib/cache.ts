import { MapWithMutex } from './mutex.ts';

/**
 * Cache-Control directive types according to RFC 9111
 */
export interface CacheControlDirectives {
  // Response directives
  /** Maximum age in seconds (response/request) */
  maxAge?: number;
  /** Shared max-age in seconds (response only) */
  sMaxAge?: number;
  /** Response must not be used without validation (response) */
  noCache?: boolean | string[];
  /** Response must not be stored */
  noStore?: boolean;
  /** Response is for a single user (response) */
  private?: boolean | string[];
  /** Response may be cached by shared caches (response) */
  public?: boolean;
  /** Stale responses must be revalidated (response) */
  mustRevalidate?: boolean;
  /** Stale responses must be revalidated by shared caches (response) */
  proxyRevalidate?: boolean;
  /** Only cache if status code is understood (response) */
  mustUnderstand?: boolean;
  /** No transformation of response body */
  noTransform?: boolean;
  /** Response will never change (response only) */
  immutable?: boolean;
  // Request directives
  /** Accept stale responses up to N seconds */
  maxStale?: number | true;
  /** Want response fresh for at least N seconds */
  minFresh?: number;
  /** Only return cached response or 504 */
  onlyIfCached?: boolean;
  // Extension directives
  /** Custom extension directives */
  extensions?: Record<string, string | boolean>;
}

/**
 * Generates a Cache-Control header value according to RFC 9111.
 *
 * @see https://www.rfc-editor.org/rfc/rfc9111#section-5.2
 *
 * @param directives - Cache control directives
 * @returns Formatted Cache-Control header value
 *
 * @example
 * ```ts
 * generateCacheControl({ maxAge: 3600, public: true });
 * // Returns: "max-age=3600, public"
 *
 * generateCacheControl({ noCache: true });
 * // Returns: "no-cache"
 *
 * generateCacheControl({ noCache: ["Authorization", "Cookie"] });
 * // Returns: 'no-cache="Authorization, Cookie"'
 *
 * generateCacheControl({ private: true });
 * // Returns: "private"
 * ```
 */
export function generateCacheControl(directives: CacheControlDirectives): string {
  const parts: string[] = [];

  // Response directives with numeric values (token form, no quotes)
  if (directives.maxAge !== undefined) {
    parts.push(`max-age=${Math.floor(directives.maxAge)}`);
  }

  if (directives.sMaxAge !== undefined) {
    parts.push(`s-maxage=${Math.floor(directives.sMaxAge)}`);
  }

  // max-stale can have a value or be standalone
  if (directives.maxStale !== undefined) {
    if (directives.maxStale === true) {
      parts.push('max-stale');
    } else {
      parts.push(`max-stale=${Math.floor(directives.maxStale)}`);
    }
  }

  if (directives.minFresh !== undefined) {
    parts.push(`min-fresh=${Math.floor(directives.minFresh)}`);
  }

  // Directives with optional field-name arguments (quoted-string form)
  if (directives.noCache !== undefined) {
    if (directives.noCache === true) {
      parts.push('no-cache');
    } else if (Array.isArray(directives.noCache)) {
      parts.push(`no-cache="${directives.noCache.join(', ')}"`);
    }
  }

  if (directives.private !== undefined) {
    if (directives.private === true) {
      parts.push('private');
    } else if (Array.isArray(directives.private)) {
      parts.push(`private="${directives.private.join(', ')}"`);
    }
  }

  // Boolean-only directives (no arguments)
  if (directives.noStore) {
    parts.push('no-store');
  }

  if (directives.public) {
    parts.push('public');
  }

  if (directives.mustRevalidate) {
    parts.push('must-revalidate');
  }

  if (directives.proxyRevalidate) {
    parts.push('proxy-revalidate');
  }

  if (directives.mustUnderstand) {
    parts.push('must-understand');
  }

  if (directives.noTransform) {
    parts.push('no-transform');
  }

  if (directives.immutable) {
    parts.push('immutable');
  }

  if (directives.onlyIfCached) {
    parts.push('only-if-cached');
  }

  // Extension directives
  if (directives.extensions) {
    for (const [name, value] of Object.entries(directives.extensions)) {
      if (value === true) {
        parts.push(name);
      } else if (typeof value === 'string') {
        // Check if value contains special characters requiring quotes
        const needsQuotes = /[^a-zA-Z0-9!#$%&'*+\-.^_`|~]/.test(value);
        if (needsQuotes) {
          // Escape backslashes and quotes within the value
          const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
          parts.push(`${name}="${escaped}"`);
        } else {
          parts.push(`${name}=${value}`);
        }
      }
    }
  }

  return parts.join(', ');
}

export class CacheMap<K, V> {
  #map = new MapWithMutex<K, V>();

  async getOrSet(key: K, setter: () => Promise<V>) {
    // Блокируем асинхронные запросы к одному и тому же ресурсу
    using resource = await this.acquire(key);

    const cache = resource.get();
    if (cache !== undefined) {
      return cache;
    }

    const response = await setter();
    resource.set(response);

    return response;
  }

  async acquire(key: K) {
    return await this.#map.acquire(key);
  }
}
