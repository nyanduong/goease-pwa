import 'dotenv/config';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import {
  geoapifyProvider,
  type GeoapifyBatch,
  type GeoapifyGroup,
} from '../src/features/explore/geoapify.js';

// Read-only provider trial: no MongoDB connection and no catalog writes.
const apiKey = process.env.GEOAPIFY_API_KEY?.trim();
try {
  const latitude = Number(process.env.GEOAPIFY_SAMPLE_LATITUDE);
  const longitude = Number(process.env.GEOAPIFY_SAMPLE_LONGITUDE);
  const radiusMeters = Number(process.env.GEOAPIFY_SAMPLE_RADIUS_METERS);
  if (
    !Number.isFinite(latitude) ||
    latitude < -90 ||
    latitude > 90 ||
    !Number.isFinite(longitude) ||
    longitude < -180 ||
    longitude > 180 ||
    !Number.isFinite(radiusMeters) ||
    radiusMeters < 500 ||
    radiusMeters > 10000 ||
    process.env.GEOAPIFY_SAMPLE_USAGE_PREFLIGHT !== 'confirmed'
  )
    throw new Error('Explicit scope and verified account quota required');
  const area = { latitude, longitude, radiusMeters };
  const get = geoapifyProvider(apiKey);
  const groups: { group: GeoapifyGroup; limit: number }[] = [
    { group: 'restaurant', limit: 20 },
  ];
  const results: GeoapifyBatch[] = [];
  for (const { group, limit } of groups)
    results.push(await get(group, limit, area));
  const items = [
    ...new Map(
      results.flatMap((r) => r.items).map((p) => [p.externalId, p]),
    ).values(),
  ];
  const flags = [...new Set(items.flatMap((p) => p.flags))];
  const summary = {
    received: results.reduce((n, r) => n + r.received, 0),
    rejected: results.reduce((n, r) => n + r.rejected, 0),
    unique: items.length,
    duplicateExternalIds:
      results.reduce((n, r) => n + r.items.length, 0) - items.length,
    flags: Object.fromEntries(
      flags.map((flag) => [
        flag,
        items.filter((p) => p.flags.includes(flag)).length,
      ]),
    ),
  };
  const directory = new URL('../../.local/', import.meta.url);
  await mkdir(directory, { recursive: true });
  const path = new URL('geoapify-scoped-sample.json', directory);
  const serialized = JSON.stringify(
    { fetchedAt: new Date().toISOString(), area, summary, results },
    null,
    2,
  );
  if (apiKey && serialized.includes(apiKey)) throw new Error('Unsafe response');
  await writeFile(path, serialized + '\n', 'utf8');
  console.log(JSON.stringify(summary));
  console.log('Mẫu chỉ đọc, chưa nhập database: ' + fileURLToPath(path));
} catch {
  // Never print fetch errors, causes, request URLs or raw provider payloads.
  console.error(
    'Chưa lấy được mẫu Geoapify. Kiểm tra GEOAPIFY_API_KEY trong server/.env, hạn mức và kết nối. Chưa nhập database.',
  );
  process.exitCode = 1;
}
