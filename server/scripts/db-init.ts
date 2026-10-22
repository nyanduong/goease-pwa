import mongoose from 'mongoose';

// Explicit opt-in command for the dedicated loopback development instance only.
const connection = mongoose.createConnection();
try {
  await connection.openUri(
    'mongodb://127.0.0.1:27019/admin?directConnection=true',
    { serverSelectionTimeoutMS: 3000 },
  );
  const admin = connection.db!.admin();
  try {
    const status = await admin.command({ replSetGetStatus: 1 });
    if (status.set !== 'rs0')
      throw new Error('Existing replica set is not rs0');
    console.info('Replica set rs0 already initialized');
  } catch (error) {
    if (
      !(error instanceof mongoose.mongo.MongoServerError) ||
      error.code !== 94
    )
      throw error;
    await admin.command({
      replSetInitiate: {
        _id: 'rs0',
        members: [{ _id: 0, host: '127.0.0.1:27019' }],
      },
    });
    console.info(
      'Replica set rs0 initialized; allow a few seconds for primary election',
    );
  }
} catch {
  console.error(
    'Cannot initialize local rs0. Start the dedicated mongod with --replSet rs0; existing configurations are never overwritten.',
  );
  process.exitCode = 1;
} finally {
  await connection.close();
}
