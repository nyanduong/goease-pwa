import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  sourceRetryAfter,
  SourceRateLimit,
} from '../src/features/explore/source-rate-limit.js';
import { wikipediaDescriptions } from '../src/features/explore/wikipedia-descriptions.js';
test('source cooldown honors seconds, dates and repeated calls without contacting a limited provider', async () => {
  assert.equal(sourceRetryAfter('600', 0), 600000);
  assert.equal(sourceRetryAfter('Thu, 01 Jan 1970 00:10:00 GMT', 0), 600000);
  assert.equal(sourceRetryAfter(null, 0), 300000);
  let calls = 0;
  const find = wikipediaDescriptions(async () => {
    calls++;
    return new Response('', { status: 429, headers: { 'Retry-After': '600' } });
  });
  const query = {
    name: 'Fixture',
    destinationName: 'Fixture province',
    sourceUrl: 'https://example.com/fixture',
    wikipedia: 'vi:Fixture',
  };
  await assert.rejects(find(query), SourceRateLimit);
  await assert.rejects(find(query), SourceRateLimit);
  assert.equal(calls, 1);
});
