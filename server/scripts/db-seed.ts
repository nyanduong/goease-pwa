import { exploreService } from '../src/features/explore/explore.service.js';
import { seedPlaces } from '../src/features/explore/explore.seed.js';
import mongoose from 'mongoose';
import { parseConfig } from '../src/config.js';
import { tripModels } from '../src/features/trips/trip.models.js';
import { seedDestinations } from '../src/features/trips/destination-seed.js';
const connection = mongoose.createConnection();
try {
  const config = parseConfig(process.env);
  if (
    config.NODE_ENV !== 'development' ||
    !/^mongodb:\/\/(127\.0\.0\.1|localhost):27019\/goease\?replicaSet=rs0$/.test(
      config.MONGODB_URI,
    )
  )
    throw new Error('Only the local GoEase development target is allowed');
  await connection.openUri(config.MONGODB_URI, {
    serverSelectionTimeoutMS: 3000,
    autoIndex: false,
    autoCreate: false,
  });
  const { Destination } = tripModels(connection);
  await Destination.createCollection();
  await Destination.createIndexes();
  await seedDestinations(Destination);
  const { Place } = exploreService(connection).models;
  await Place.createCollection();
  await Place.createIndexes();
  await seedPlaces(Place);
  console.info(
    'PASS: GoEase-authored destination and place catalogs ready; existing records preserved.',
  );
} catch {
  console.error(
    'FAIL: destination seed. Only development GoEase on loopback 27019/rs0 is allowed; check database availability.',
  );
  process.exitCode = 1;
} finally {
  await connection.close();
}
