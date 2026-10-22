import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  shiftTripDays,
  tripLifecycle,
  tripActionSchema,
  type TripInput,
} from '@goease/contracts';

test('trip lifecycle includes start/end days and actions accept initial revision zero', () => {
  assert.equal(
    tripLifecycle(
      { startDate: '2026-11-12', endDate: '2026-11-14' },
      '2026-11-11',
    ),
    'upcoming',
  );
  for (const today of ['2026-11-12', '2026-11-13', '2026-11-14'])
    assert.equal(
      tripLifecycle({ startDate: '2026-11-12', endDate: '2026-11-14' }, today),
      'ongoing',
    );
  assert.equal(
    tripLifecycle(
      { startDate: '2026-11-12', endDate: '2026-11-14' },
      '2026-11-15',
    ),
    'completed',
  );
  assert.equal(
    tripActionSchema.safeParse({ expectedRevision: 0 }).success,
    true,
  );
  assert.equal(
    tripActionSchema.safeParse({ expectedRevision: -1 }).success,
    false,
  );
});
test('date shifting preserves ordinal days across overlap leap day and extension', () => {
  const id = '000000000000000000000004';
  const input: TripInput = {
    title: 'Dates',
    destinations: [{ destinationId: id, order: 0 }],
    startDate: '2028-02-28',
    endDate: '2028-02-29',
    timezone: 'Asia/Ho_Chi_Minh',
    travelers: { totalCount: 1 },
    budget: {
      amountMinor: null,
      currency: 'VND',
      scope: 'group_total',
      includedCategories: [],
    },
    preferences: { interestCodes: [], pace: 'relaxed', transportModes: [] },
    generationMode: 'manual',
    notes: '',
    days: ['2028-02-28', '2028-02-29'].map((date) => ({
      dayId: randomUUID(),
      date,
      destinationId: id,
      activities: [],
    })),
  };
  const shifted = shiftTripDays(input, '2028-02-29', '2028-03-02', randomUUID);
  assert.deepEqual(
    shifted.days.map((d) => d.date),
    ['2028-02-29', '2028-03-01', '2028-03-02'],
  );
  assert.equal(shifted.days[0]!.dayId, input.days[0]!.dayId);
  assert.equal(shifted.days[1]!.dayId, input.days[1]!.dayId);
  assert.deepEqual(shifted.days[2]!.activities, []);
  assert.equal(
    shiftTripDays(input, '2028-03-01', '2028-03-01', randomUUID).days.length,
    1,
  );
  assert.throws(() =>
    shiftTripDays(input, '2027-02-29', '2027-03-01', randomUUID),
  );
  assert.throws(() =>
    shiftTripDays(input, '2028-03-02', '2028-03-01', randomUUID),
  );
});
