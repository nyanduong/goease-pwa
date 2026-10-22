import { spawn, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { createServer } from 'node:net';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import mongoose from 'mongoose';

const port = 27021;
export function validateIntegrationUri(
  uri: string,
  environment: string | undefined,
  applicationUri?: string,
) {
  if (
    environment === 'production' ||
    !/^mongodb:\/\/127\.0\.0\.1:27021\/goease_f1b_test_[0-9a-f]{32}\?replicaSet=f1b_[0-9a-f]{32}$/.test(
      uri,
    )
  ) {
    throw new Error(
      'Integration requires an owned loopback F1-B test target outside production',
    );
  }
  const parsed = new URL(uri);
  if (
    parsed.pathname.slice('/goease_f1b_test_'.length) !==
    parsed.searchParams.get('replicaSet')?.slice(4)
  )
    throw new Error('Integration target identifiers do not match');
  if (applicationUri) {
    let database: string;
    try {
      database = new URL(applicationUri).pathname;
    } catch {
      throw new Error('Invalid application target');
    }
    if (database === parsed.pathname)
      throw new Error('Refusing application database as test target');
  }
  return uri;
}

async function waitFor<T>(operation: () => Promise<T>, child: ChildProcess) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null)
      throw new Error('Owned test mongod exited before readiness');
    try {
      return await operation();
    } catch {
      await delay(100);
    }
  }
  throw new Error('Owned test replica set readiness timed out');
}

export async function startTestReplicaSet() {
  const binary = process.env.MONGOD_BINARY;
  if (!binary)
    throw new Error('MONGOD_BINARY is required; integration is not skipped');
  const id = randomUUID().replaceAll('-', '');
  const setName = `f1b_${id}`;
  const uri = validateIntegrationUri(
    `mongodb://127.0.0.1:${port}/goease_f1b_test_${id}?replicaSet=${setName}`,
    process.env.NODE_ENV,
    process.env.MONGODB_URI,
  );
  // Refuse occupied ports without stopping the owning process.
  await new Promise<void>((resolveReady, reject) => {
    const probe = createServer();
    probe.once('error', () =>
      reject(new Error('Integration port 27021 is occupied')),
    );
    probe.listen(port, '127.0.0.1', () =>
      probe.close((error) => (error ? reject(error) : resolveReady())),
    );
  });
  const localRoot = fileURLToPath(new URL('../../../.local/', import.meta.url));
  await mkdir(localRoot, { recursive: true });
  const dbPath = await mkdtemp(resolve(localRoot, 'f1b-mongo-'));
  const child = spawn(
    binary,
    [
      '--dbpath',
      dbPath,
      '--bind_ip',
      '127.0.0.1',
      '--port',
      String(port),
      '--replSet',
      setName,
    ],
    { stdio: 'ignore', windowsHide: true },
  );
  const direct = mongoose.createConnection();
  const connection = mongoose.createConnection();
  let stopped = false;
  async function stop() {
    if (stopped) return;
    stopped = true;
    await connection.close(true);
    await direct.close(true);
    if (child.exitCode === null && child.signalCode === null && child.pid) {
      await new Promise<void>((resolveExit) => {
        child.once('exit', () => resolveExit());
        child.kill();
      });
    }
    // Keep only the test-owned directory for inspection; no recursive delete or database drop.
  }
  try {
    await new Promise<void>((resolveSpawn, reject) => {
      child.once('spawn', resolveSpawn);
      child.once('error', () =>
        reject(new Error('Cannot spawn MONGOD_BINARY')),
      );
    });
    await waitFor(async () => {
      await direct.openUri(
        `mongodb://127.0.0.1:${port}/admin?directConnection=true`,
        { serverSelectionTimeoutMS: 500, autoIndex: false },
      );
      return true;
    }, child);
    const options = await direct.db!.admin().command({ getCmdLineOpts: 1 });
    if (
      resolve(options.parsed?.storage?.dbPath ?? '') !== dbPath ||
      (options.parsed?.replication?.replSet ??
        options.parsed?.replication?.replSetName) !== setName
    )
      throw new Error('Refusing a mongod not owned by this test');
    await direct.db!.admin().command({
      replSetInitiate: {
        _id: setName,
        members: [{ _id: 0, host: `127.0.0.1:${port}` }],
      },
    });
    await waitFor(async () => {
      const hello = await direct.db!.admin().command({ hello: 1 });
      if (!hello.isWritablePrimary || hello.setName !== setName)
        throw new Error('Not primary yet');
      return true;
    }, child);
    await connection.openUri(uri, {
      serverSelectionTimeoutMS: 3000,
      bufferCommands: false,
      autoIndex: false,
      autoCreate: false,
    });
    return { connection, stop, dbPath, setName };
  } catch (error) {
    await stop();
    throw error;
  }
}
