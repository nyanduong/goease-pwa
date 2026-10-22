import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  expenseInputSchema,
  expenseQuerySchema,
  expenseRevisionSchema,
} from '@goease/contracts';
test('expense contracts use integer group VND, real date and explicit revision', () => {
  const input = {
    description: ' Taxi ',
    category: 'transport',
    amountMinor: 100000,
    currency: 'VND',
    spentOn: '2026-11-11',
    timezone: 'Asia/Ho_Chi_Minh',
  };
  assert.equal(expenseInputSchema.parse(input).description, 'Taxi');
  for (const patch of [
    { amountMinor: 0 },
    { amountMinor: -1 },
    { amountMinor: 0.5 },
    { amountMinor: Infinity },
    { currency: 'USD' },
    { spentOn: '2026-02-30' },
    { description: ' ' },
    { ownerId: 'forged' },
  ])
    assert.equal(
      expenseInputSchema.safeParse({ ...input, ...patch }).success,
      false,
    );
  assert.equal(
    expenseRevisionSchema.safeParse({ expectedRevision: 0 }).success,
    false,
  );
  assert.equal(expenseQuerySchema.safeParse({ limit: 101 }).success, false);
  assert.deepEqual(expenseQuerySchema.parse({}), { offset: 0, limit: 25 });
});
