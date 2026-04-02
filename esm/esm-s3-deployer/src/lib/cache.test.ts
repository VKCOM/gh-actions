import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { generateCacheControl } from './cache.ts';

describe('generateCacheControl', () => {
  describe('maxAge', () => {
    it('generates max-age directive with number', () => {
      assert.equal(generateCacheControl({ maxAge: 3600 }), 'max-age=3600');
    });

    it('floors max-age value', () => {
      assert.equal(generateCacheControl({ maxAge: 3600.9 }), 'max-age=3600');
    });

    it('handles max-age of 0', () => {
      assert.equal(generateCacheControl({ maxAge: 0 }), 'max-age=0');
    });
  });

  describe('sMaxAge', () => {
    it('generates s-maxage directive with number', () => {
      assert.equal(generateCacheControl({ sMaxAge: 600 }), 's-maxage=600');
    });

    it('floors s-maxage value', () => {
      assert.equal(generateCacheControl({ sMaxAge: 600.5 }), 's-maxage=600');
    });
  });

  describe('noCache', () => {
    it('generates no-cache without argument when true', () => {
      assert.equal(generateCacheControl({ noCache: true }), 'no-cache');
    });

    it('generates no-cache with quoted field names', () => {
      assert.equal(
        generateCacheControl({ noCache: ['Authorization'] }),
        'no-cache="Authorization"',
      );
    });

    it('generates no-cache with multiple field names', () => {
      assert.equal(
        generateCacheControl({ noCache: ['Authorization', 'Cookie'] }),
        'no-cache="Authorization, Cookie"',
      );
    });
  });

  describe('noStore', () => {
    it('generates no-store directive', () => {
      assert.equal(generateCacheControl({ noStore: true }), 'no-store');
    });

    it('does not generate no-store when false', () => {
      assert.equal(generateCacheControl({ noStore: false }), '');
    });
  });

  describe('private', () => {
    it('generates private without argument when true', () => {
      assert.equal(generateCacheControl({ private: true }), 'private');
    });

    it('generates private with quoted field names', () => {
      assert.equal(generateCacheControl({ private: ['Set-Cookie'] }), 'private="Set-Cookie"');
    });

    it('generates private with multiple field names', () => {
      assert.equal(
        generateCacheControl({ private: ['Set-Cookie', 'X-User-ID'] }),
        'private="Set-Cookie, X-User-ID"',
      );
    });
  });

  describe('public', () => {
    it('generates public directive', () => {
      assert.equal(generateCacheControl({ public: true }), 'public');
    });
  });

  describe('mustRevalidate', () => {
    it('generates must-revalidate directive', () => {
      assert.equal(generateCacheControl({ mustRevalidate: true }), 'must-revalidate');
    });
  });

  describe('proxyRevalidate', () => {
    it('generates proxy-revalidate directive', () => {
      assert.equal(generateCacheControl({ proxyRevalidate: true }), 'proxy-revalidate');
    });
  });

  describe('mustUnderstand', () => {
    it('generates must-understand directive', () => {
      assert.equal(generateCacheControl({ mustUnderstand: true }), 'must-understand');
    });
  });

  describe('noTransform', () => {
    it('generates no-transform directive', () => {
      assert.equal(generateCacheControl({ noTransform: true }), 'no-transform');
    });
  });

  describe('immutable', () => {
    it('generates immutable directive', () => {
      assert.equal(generateCacheControl({ immutable: true }), 'immutable');
    });
  });

  describe('maxStale', () => {
    it('generates max-stale without value when true', () => {
      assert.equal(generateCacheControl({ maxStale: true }), 'max-stale');
    });

    it('generates max-stale with number', () => {
      assert.equal(generateCacheControl({ maxStale: 100 }), 'max-stale=100');
    });
  });

  describe('minFresh', () => {
    it('generates min-fresh directive', () => {
      assert.equal(generateCacheControl({ minFresh: 60 }), 'min-fresh=60');
    });
  });

  describe('onlyIfCached', () => {
    it('generates only-if-cached directive', () => {
      assert.equal(generateCacheControl({ onlyIfCached: true }), 'only-if-cached');
    });
  });

  describe('extensions', () => {
    it('generates extension directive with boolean true', () => {
      assert.equal(
        generateCacheControl({
          extensions: { 'stale-while-revalidate': true },
        }),
        'stale-while-revalidate',
      );
    });

    it('generates extension directive with number value', () => {
      assert.equal(
        generateCacheControl({
          extensions: { 'stale-while-revalidate': '3600' },
        }),
        'stale-while-revalidate=3600',
      );
    });

    it('quotes extension values with special characters', () => {
      assert.equal(
        generateCacheControl({ extensions: { community: 'UCI Team' } }),
        'community="UCI Team"',
      );
    });

    it('escapes quotes in extension values', () => {
      assert.equal(
        generateCacheControl({
          extensions: { 'x-custom': 'value"with"quotes' },
        }),
        'x-custom="value\\"with\\"quotes"',
      );
    });

    it('escapes backslashes in extension values', () => {
      assert.equal(
        generateCacheControl({ extensions: { 'x-path': 'C:\\Users\\test' } }),
        'x-path="C:\\\\Users\\\\test"',
      );
    });
  });

  describe('combinations', () => {
    it('combines multiple directives', () => {
      const result = generateCacheControl({
        maxAge: 3600,
        public: true,
        mustRevalidate: true,
      });
      assert.equal(result, 'max-age=3600, public, must-revalidate');
    });

    it('combines no-cache and no-store', () => {
      const result = generateCacheControl({
        noCache: true,
        noStore: true,
      });
      assert.equal(result, 'no-cache, no-store');
    });

    it('combines s-maxage with proxy-revalidate', () => {
      const result = generateCacheControl({
        sMaxAge: 600,
        proxyRevalidate: true,
      });
      assert.equal(result, 's-maxage=600, proxy-revalidate');
    });

    it('combines private with max-age', () => {
      const result = generateCacheControl({
        private: true,
        maxAge: 300,
      });
      assert.equal(result, 'max-age=300, private');
    });

    it('generates complex cache control for CDN', () => {
      const result = generateCacheControl({
        public: true,
        maxAge: 86400,
        sMaxAge: 3600,
        mustRevalidate: true,
        extensions: { 'stale-while-revalidate': '86400' },
      });
      assert.equal(
        result,
        'max-age=86400, s-maxage=3600, public, must-revalidate, stale-while-revalidate=86400',
      );
    });

    it('generates cache control for authenticated response', () => {
      const result = generateCacheControl({
        private: true,
        noCache: ['Set-Cookie'],
        maxAge: 0,
      });
      assert.equal(result, 'max-age=0, no-cache="Set-Cookie", private');
    });
  });

  describe('edge cases', () => {
    it('returns empty string for empty directives', () => {
      assert.equal(generateCacheControl({}), '');
    });

    it('ignores undefined values', () => {
      const result = generateCacheControl({ public: true });
      assert.equal(result, 'public');
    });

    it('ignores false boolean values', () => {
      assert.equal(
        generateCacheControl({
          public: false,
          noStore: false,
          mustRevalidate: false,
        }),
        '',
      );
    });
  });
});
