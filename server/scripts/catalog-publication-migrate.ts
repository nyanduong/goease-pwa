import mongoose from 'mongoose';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  planPublicationMigration,
  applyPublicationMigration,
  type PublicationMigrationPlan,
  validatePublicationMigrationUri,
} from '../src/features/explore/catalog-publication-migration.js';

// Usage: GOEASE_CATALOG_MIGRATION_URI=<owned local dev/test replica-set URI>
// tsx server/scripts/catalog-publication-migrate.ts plan|apply|rollback <manifest.json>
// Plan is read-only; apply/rollback require the exact saved manifest.
const [mode, file] = process.argv.slice(2);
const uri = process.env.GOEASE_CATALOG_MIGRATION_URI ?? '';
if (!['plan', 'apply', 'rollback'].includes(mode ?? '') || !file)
  throw new Error('Expected plan|apply|rollback and a manifest file path');
validatePublicationMigrationUri(uri, process.env.NODE_ENV);
const connection = await mongoose
  .createConnection(uri, { serverSelectionTimeoutMS: 5000 })
  .asPromise();
try {
  const path = resolve(file);
  if (mode === 'plan') {
    const plan = await planPublicationMigration(connection);
    await writeFile(path, JSON.stringify(plan, null, 2) + '\n', {
      flag: 'wx',
      mode: 0o600,
    });
    process.stdout.write(
      JSON.stringify({
        mode,
        database: connection.name,
        planned: plan.items.length,
        manifest: path,
      }) + '\n',
    );
  } else {
    const plan = JSON.parse(
      await readFile(path, 'utf8'),
    ) as PublicationMigrationPlan;
    const result = await applyPublicationMigration(
      connection,
      plan,
      mode === 'rollback',
    );
    process.stdout.write(
      JSON.stringify({ mode, database: connection.name, ...result }) + '\n',
    );
  }
} finally {
  await connection.close();
}
