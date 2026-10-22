import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import { validateTestUri } from './test-database.js';

const connection = mongoose.createConnection();
const id = randomUUID();
try {
  const uri = validateTestUri(
    process.env.MONGODB_TEST_URI,
    process.env.NODE_ENV,
    process.env.MONGODB_URI,
  );
  await connection.openUri(uri, {
    serverSelectionTimeoutMS: 3000,
    bufferCommands: false,
  });
  const Probe = connection.model(
    'F0Probe',
    new mongoose.Schema({ marker: { type: String, required: true } }),
  );
  await Probe.create({ marker: id });
  const found = await Probe.findOne({ marker: id }).lean();
  if (!found || found.marker !== id)
    throw new Error('Read verification failed');
  const deleted = await Probe.deleteOne({ marker: id });
  if (deleted.deletedCount !== 1 || (await Probe.exists({ marker: id })))
    throw new Error('Delete verification failed');
  console.info('PASS: MongoDB write/read/delete in goease_f0_test');
} catch {
  console.error(
    'FAIL: MongoDB smoke check. Check local MongoDB and MONGODB_TEST_URI; production/application databases are refused.',
  );
  process.exitCode = 1;
} finally {
  if (connection.readyState === 1 && connection.db) {
    await connection.db.collection('f0probes').deleteMany({ marker: id });
  }
  await connection.close();
}
