import { createHash } from 'node:crypto';
import { posix } from 'node:path';
import { z } from 'zod';

const credentialsSchema = z.object({
  CLOUDINARY_CLOUD_NAME: z.string().regex(/^[a-z0-9_-]+$/),
  CLOUDINARY_API_KEY: z.string().regex(/^\d+$/),
  CLOUDINARY_API_SECRET: z.string().min(16).regex(/^\S+$/),
});
export function mediaCredentials(env: NodeJS.ProcessEnv) {
  const result = credentialsSchema.safeParse(env);
  if (!result.success)
    throw new Error('Missing or invalid server Cloudinary configuration');
  return result.data;
}

export function mediaTarget(sourcePath: string) {
  if (
    !/^(client\/public\/images|docs)\/[a-zA-Z0-9_./-]+\.(png|webp|jpe?g|gif|avif|ico|svg)$/.test(
      sourcePath,
    ) ||
    sourcePath.split('/').some((part) => part === '..' || part === '.')
  ) {
    throw new Error(
      'Only repository images under client/public/images or docs are allowed',
    );
  }
  const relative = sourcePath.replace(/^client\/public\/images\//, 'app/');
  // Include the source format in the ID so PNG masters and WebP copies cannot collide.
  const publicId = `goease/${relative.replace(/\.([a-z]+)$/, '-$1')}`;
  return { publicId, assetFolder: posix.dirname(publicId) };
}

export function uploadSignature(
  params: Record<string, string>,
  secret: string,
) {
  return createHash('sha1')
    .update(
      Object.keys(params)
        .sort()
        .map((key) => `${key}=${params[key]}`)
        .join('&') + secret,
    )
    .digest('hex');
}

export const mediaAssetSchema = z.object({
  sourcePath: z.string(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  bytes: z.number().int().positive(),
  publicId: z.string().startsWith('goease/'),
  assetFolder: z.string().startsWith('goease/'),
  assetId: z.string().min(1),
  version: z.number().int().positive(),
  url: z.url(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});
export type MediaAsset = z.infer<typeof mediaAssetSchema>;

export function assertDeliveryUrl(value: string, cloudName: string) {
  const url = new URL(value);
  if (
    url.origin !== 'https://res.cloudinary.com' ||
    url.username ||
    url.password ||
    !url.pathname.startsWith(`/${cloudName}/image/upload/`) ||
    !url.pathname.includes('/goease/') ||
    url.search ||
    url.hash
  ) {
    throw new Error('Unexpected Cloudinary delivery URL');
  }
}

export async function uploadMedia(
  credentials: ReturnType<typeof mediaCredentials>,
  sourcePath: string,
  bytes: Uint8Array<ArrayBuffer>,
): Promise<MediaAsset> {
  const target = mediaTarget(sourcePath);
  const params = {
    asset_folder: target.assetFolder,
    display_name: posix.basename(sourcePath),
    overwrite: 'false',
    public_id: target.publicId,
    tags: 'goease,repository-media',
    timestamp: String(Math.floor(Date.now() / 1000)),
  };
  const form = new FormData();
  for (const [name, value] of Object.entries(params)) form.set(name, value);
  form.set('api_key', credentials.CLOUDINARY_API_KEY);
  form.set(
    'signature',
    uploadSignature(params, credentials.CLOUDINARY_API_SECRET),
  );
  form.set('file', new Blob([bytes]), posix.basename(sourcePath));
  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${credentials.CLOUDINARY_CLOUD_NAME}/image/upload`,
    {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(120000),
    },
  );
  // Provider bodies can contain signed parameters; never log them.
  if (!response.ok)
    throw new Error(`Cloudinary upload failed (HTTP ${response.status})`);
  const result = z
    .object({
      public_id: z.string(),
      asset_folder: z.string(),
      asset_id: z.string(),
      version: z.number(),
      secure_url: z.string(),
      bytes: z.number(),
      width: z.number(),
      height: z.number(),
    })
    .parse(await response.json());
  if (
    result.public_id !== target.publicId ||
    result.asset_folder !== target.assetFolder ||
    result.bytes !== bytes.length
  )
    throw new Error('Cloudinary returned unexpected asset metadata');
  assertDeliveryUrl(result.secure_url, credentials.CLOUDINARY_CLOUD_NAME);
  return mediaAssetSchema.parse({
    sourcePath,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    bytes: result.bytes,
    ...target,
    assetId: result.asset_id,
    version: result.version,
    url: result.secure_url,
    width: result.width,
    height: result.height,
  });
}

export async function verifyMedia(asset: MediaAsset, cloudName: string) {
  assertDeliveryUrl(asset.url, cloudName);
  const response = await fetch(asset.url, {
    signal: AbortSignal.timeout(60000),
    redirect: 'error',
  });
  if (
    !response.ok ||
    !response.headers.get('content-type')?.startsWith('image/')
  )
    throw new Error(`Media delivery failed (HTTP ${response.status})`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (
    bytes.length !== asset.bytes ||
    createHash('sha256').update(bytes).digest('hex') !== asset.sha256
  )
    throw new Error('Delivered image does not match its original checksum');
}
