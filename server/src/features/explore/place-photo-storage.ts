import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { z } from 'zod';
import type { ImageCandidate } from '@goease/contracts';
import type { Config } from '../../config.js';
import { HttpError } from '../../http-error.js';
import type { FindImages } from './wikimedia.js';

async function limitedBody(response: Response, max: number) {
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error('Provider unavailable');
  }
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Empty response');
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel();
      throw new Error('Response too large');
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

export function storedWikimediaImages(
  config: Pick<
    Config,
    'CLOUDINARY_CLOUD_NAME' | 'CLOUDINARY_API_KEY' | 'CLOUDINARY_API_SECRET'
  >,
  find: FindImages,
  request: typeof fetch = fetch,
): FindImages {
  async function store(candidate: ImageCandidate): Promise<ImageCandidate> {
    const source = new URL(candidate.image.url);
    if (
      source.protocol !== 'https:' ||
      !['upload.wikimedia.org', 'thumb.wikimedia.org'].includes(
        source.hostname,
      ) ||
      source.username ||
      source.password ||
      source.port
    )
      throw new Error('Invalid image source');
    const bytes = await limitedBody(
      await request(source, {
        redirect: 'error',
        signal: AbortSignal.timeout(15000),
        headers: {
          'User-Agent': 'GoEase/1.0 (Wikimedia catalog photo caching)',
        },
      }),
      8 * 1024 * 1024,
    );
    const raster = sharp(bytes, {
      limitInputPixels: 36_000_000,
      failOn: 'warning',
    });
    const metadata = await raster.metadata();
    if (
      !['jpeg', 'png', 'webp'].includes(metadata.format) ||
      (metadata.pages ?? 1) > 1
    )
      throw new Error('Invalid photo');
    const encoded = await raster
      .rotate()
      .webp({ lossless: true, effort: 6 })
      .toBuffer();
    // Content identity avoids duplicate assets on retry or across places.
    const digest = createHash('sha256').update(encoded).digest('hex');
    const id = `goease/places/wikimedia/${digest}`;
    const params = {
      asset_folder: 'goease/places/wikimedia',
      overwrite: 'false',
      public_id: id,
      timestamp: String(Math.floor(Date.now() / 1000)),
    };
    const form = new FormData();
    for (const [key, value] of Object.entries(params)) form.set(key, value);
    form.set('api_key', config.CLOUDINARY_API_KEY!);
    form.set(
      'signature',
      createHash('sha1')
        .update(
          Object.entries(params)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => `${k}=${v}`)
            .join('&') + config.CLOUDINARY_API_SECRET,
        )
        .digest('hex'),
    );
    form.set('file', new Blob([new Uint8Array(encoded)]), 'place.webp');
    const response = await request(
      `https://api.cloudinary.com/v1_1/${config.CLOUDINARY_CLOUD_NAME}/image/upload`,
      {
        method: 'POST',
        body: form,
        redirect: 'error',
        signal: AbortSignal.timeout(30000),
      },
    );
    const result = z
      .object({
        public_id: z.literal(id),
        format: z.literal('webp'),
        secure_url: z.url(),
      })
      .parse(JSON.parse((await limitedBody(response, 32768)).toString('utf8')));
    const url = new URL(result.secure_url);
    if (
      url.origin !== 'https://res.cloudinary.com' ||
      !url.pathname.startsWith(
        `/${config.CLOUDINARY_CLOUD_NAME}/image/upload/`,
      ) ||
      !url.pathname.endsWith(`/${id}.webp`) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      throw new Error('Invalid stored image');
    return {
      ...candidate,
      image: { ...candidate.image, url: url.href, reviewed: false },
    };
  }
  return async (query) => {
    if (
      !config.CLOUDINARY_CLOUD_NAME ||
      !config.CLOUDINARY_API_KEY ||
      !config.CLOUDINARY_API_SECRET
    )
      throw new HttpError(
        503,
        'PLACE_PHOTO_STORAGE_UNAVAILABLE',
        'Chưa cấu hình Cloudinary cho ảnh địa điểm.',
      );
    const candidates = (await find(query)).slice(0, 6);
    const results = await Promise.allSettled(candidates.map(store));
    const stored = results.flatMap((result) =>
      result.status === 'fulfilled' ? [result.value] : [],
    );
    if (candidates.length && !stored.length)
      throw new HttpError(
        502,
        'PLACE_PHOTO_STORAGE_FAILED',
        'Chưa lưu được ảnh Wikimedia vào Cloudinary. Hãy thử lại.',
      );
    return stored;
  };
}
