import 'dotenv/config';
import mongoose from 'mongoose';

// The shared local MongoDB service must already be a writable rs0 member.
// Never initiate or reconfigure a replica set used by other databases.
const connection = mongoose.createConnection();
try {
  if (
    !/^mongodb:\/\/(127\.0\.0\.1|localhost):27017\/goease\?replicaSet=rs0$/.test(
      process.env.MONGODB_URI ?? '',
    )
  )
    throw new Error('Unexpected MongoDB target');
  await connection.openUri(
    'mongodb://localhost:27017/admin?directConnection=true',
    { serverSelectionTimeoutMS: 3000 },
  );
  const hello = await connection.db!.admin().command({ hello: 1 });
  if (hello.setName !== 'rs0' || hello.isWritablePrimary !== true)
    throw new Error('MongoDB is not a writable rs0 primary');
  console.info('PASS: localhost:27017 is already a writable rs0 primary');
} catch {
  console.error(
    'FAIL: localhost:27017 must already be a writable rs0 primary; shared MongoDB is never reconfigured.',
  );
  process.exitCode = 1;
} finally {
  await connection.close();
}
