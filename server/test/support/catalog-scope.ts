import type { Connection } from 'mongoose';
import { adminOperationsModels } from '../../src/features/explore/admin-operations.models.js';

export const fixtureDestinationId = '000000000000000000000004';
/** Explicit test configuration, never invoked by a catalog read. */
export async function configureFixtureScope(connection: Connection) {
  await adminOperationsModels(connection).Settings.updateOne(
    { scope: 'global' },
    {
      $set: {
        regions: [
          {
            destinationId: fixtureDestinationId,
            latitude: 15.88,
            longitude: 108.328,
            radiusMeters: 5000,
            enabled: true,
          },
        ],
      },
    },
    { upsert: true },
  );
}
