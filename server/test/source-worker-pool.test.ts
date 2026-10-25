import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { sourceWorkerPool } from '../src/features/explore/source-worker-pool.js';
import { sourceOriginGate } from '../src/features/explore/source-origin-gate.js';
test('source pool overlaps bounded I/O, drains on stop and rejects unsafe concurrency', async () => {
  for (const n of [0, 9, 1.5])
    assert.throws(() => sourceWorkerPool(async () => {}, n));
  let active = 0,
    peak = 0,
    calls = 0,
    release!: () => void;
  const barrier = new Promise<void>((resolve) => {
    release = resolve;
  });
  const pool = sourceWorkerPool(async () => {
    calls++;
    active++;
    peak = Math.max(peak, active);
    await barrier;
    active--;
  }, 4);
  pool.start();
  pool.start();
  await delay(10);
  assert.equal(peak, 4);
  assert.equal(calls, 4);
  let stopped = false;
  const stopping = pool.stop().then(() => {
    stopped = true;
  });
  await delay(10);
  assert.equal(stopped, false);
  release();
  await stopping;
  assert.equal(active, 0);
  assert.equal(calls, 4);
});
test('requests to one origin wait, other origins proceed and releases are idempotent', async () => {
  const acquire = sourceOriginGate(5),
    one = await acquire('https://one.example');
  let twoStarted = false;
  const two = acquire('https://one.example').then((release) => {
    twoStarted = true;
    return release;
  });
  const other = await acquire('https://other.example');
  assert.equal(twoStarted, false);
  other();
  one();
  one();
  const release = await two;
  assert.equal(twoStarted, true);
  release();
});
