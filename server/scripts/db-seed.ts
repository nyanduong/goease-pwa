import mongoose from 'mongoose';
import { parseConfig } from '../src/config.js';
import { tripModels } from '../src/features/trips/trip.models.js';
import { syncProvinceCatalog } from '../src/features/trips/province-catalog.js';
import { businessAudit } from '../src/features/audit/business-audit.js';
const connection = mongoose.createConnection();
try {
  const config = parseConfig(process.env);
  if (
    config.NODE_ENV !== 'development' ||
    !/^mongodb:\/\/(127\.0\.0\.1|localhost):27017\/goease\?replicaSet=rs0$/.test(
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
  const audit = businessAudit(connection, 'development');
  await audit.initialize();
  const result = await syncProvinceCatalog(connection, Destination, audit);
  console.info(JSON.stringify({ status: 'Province catalog ready', ...result }));
} catch {
  console.error(
    'FAIL: destination seed. Only development GoEase on loopback 27017/rs0 is allowed; check database availability.',
  );
  process.exitCode = 1;
} finally {
  await connection.close();
}
