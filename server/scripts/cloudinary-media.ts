import 'dotenv/config';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, writeFile, rename } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { z } from 'zod';
import {
  mediaCredentials,
  mediaAssetSchema,
  uploadMedia,
  verifyMedia,
  type MediaAsset,
} from './lib/cloudinary-media.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const manifestPath = resolve(root, 'packages/media/assets-manifest.json');
const manifestSchema = z.object({
  cloudName: z.string(),
  rootFolder: z.literal('goease'),
  assets: z.array(mediaAssetSchema),
});
const command = process.argv[2];
try {
  if (command !== 'upload' && command !== 'verify')
    throw new Error('Usage: media:upload or media:verify');
  const credentials =
    command === 'upload' ? mediaCredentials(process.env) : null;
  const existing = await readFile(manifestPath, 'utf8').catch(
    (error: NodeJS.ErrnoException) => {
      if (error.code !== 'ENOENT') throw error;
      return null;
    },
  );
  const manifest = existing
    ? manifestSchema.parse(JSON.parse(existing))
    : {
        cloudName: credentials?.CLOUDINARY_CLOUD_NAME ?? '',
        rootFolder: 'goease' as const,
        assets: [] as MediaAsset[],
      };
  if (credentials && credentials.CLOUDINARY_CLOUD_NAME !== manifest.cloudName)
    throw new Error('Manifest belongs to another cloud');
  if (command === 'upload') {
    const files = execFileSync('git', ['ls-files', '-z'], {
      cwd: root,
      encoding: 'utf8',
    })
      .split('\0')
      .filter((path) =>
        /^(client\/public\/images|docs)\/.*\.(png|webp|jpe?g|gif|avif|ico|svg)$/.test(
          path,
        ),
      );
    if (!files.length)
      throw new Error(
        'No tracked image sources; restore the originals from Git before uploading again',
      );
    for (const sourcePath of files) {
      const bytes = await readFile(resolve(root, sourcePath));
      const previous = manifest.assets.find((a) => a.sourcePath === sourcePath);
      if (previous) {
        if (
          previous.sha256 !== createHash('sha256').update(bytes).digest('hex')
        )
          throw new Error('Original changed; use a new versioned source name');
        continue;
      }
      const asset = await uploadMedia(credentials!, sourcePath, bytes);
      await verifyMedia(asset, manifest.cloudName);
      manifest.assets.push(asset);
      manifest.assets.sort((a, b) => a.sourcePath.localeCompare(b.sourcePath));
      await writeFile(
        `${manifestPath}.tmp`,
        JSON.stringify(manifest, null, 2) + '\n',
      );
      await rename(`${manifestPath}.tmp`, manifestPath);
      console.info(`Uploaded and checksum verified: ${sourcePath}`);
    }
  } else {
    if (!manifest.assets.length) throw new Error('No media manifest');
    // Bounded parallel reads; no credentials needed for public CDN checks.
    for (let offset = 0; offset < manifest.assets.length; offset += 4) {
      await Promise.all(
        manifest.assets
          .slice(offset, offset + 4)
          .map((asset) => verifyMedia(asset, manifest.cloudName)),
      );
    }
  }
  console.info(
    `PASS: ${manifest.assets.length} Cloudinary images ${command === 'upload' ? 'uploaded' : 'checksum verified'} under goease.`,
  );
} catch (error) {
  // Print only our fixed messages. Never serialize request/config/provider errors.
  console.error(
    error instanceof Error &&
      /^(Missing|Only repository|Unexpected Cloudinary|Cloudinary upload failed|Cloudinary returned|Media delivery failed|Delivered image|Original changed|Manifest belongs|No tracked|No media|Usage:)/.test(
        error.message,
      )
      ? error.message
      : 'Cloudinary media operation failed; check server configuration and connectivity.',
  );
  process.exitCode = 1;
}
