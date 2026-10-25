import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { z } from 'zod';
import {
  catalogImageSchema,
  type CatalogImage,
  type ImageCandidate,
} from '@goease/contracts';
import type { Config } from '../../config.js';
import { HttpError } from '../../http-error.js';
import type { FindImages } from './wikimedia.js';

export const photoSourceCooldownMessage =
  'Nguồn ảnh đang giới hạn tốc độ. Hệ thống sẽ chờ rồi tự thử lại; ảnh đã lưu được giữ nguyên.';
export class PhotoSourceCooldown extends HttpError {
  constructor(public retryAfterMs: number) {
    super(503, 'PLACE_PHOTO_STORAGE_FAILED', photoSourceCooldownMessage);
  }
}

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

type StorageConfig = Pick<
  Config,
  'CLOUDINARY_CLOUD_NAME' | 'CLOUDINARY_API_KEY' | 'CLOUDINARY_API_SECRET'
>;
function sourceUrl(image: CatalogImage) {
  const url = new URL(image.url);
  if (
    url.protocol !== 'https:' ||
    !['upload.wikimedia.org', 'thumb.wikimedia.org'].includes(url.hostname) ||
    url.username ||
    url.password ||
    url.port
  )
    throw new Error('Invalid image source');
  return url;
}
export function catalogCoverStorage(
  config: StorageConfig,
  request: typeof fetch = fetch,
) {
  let sourceCooldownUntil = 0;
  function requireSourceReady() {
    if (Date.now() < sourceCooldownUntil)
      throw new PhotoSourceCooldown(sourceCooldownUntil - Date.now());
  }
  function requireConfig() {
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
  }
  async function store(
    candidate: ImageCandidate,
    budget?: AbortSignal,
  ): Promise<ImageCandidate> {
    requireConfig();
    requireSourceReady();
    const source = sourceUrl(candidate.image);
    const sourceResponse = await request(source, {
      redirect: 'error',
      signal: AbortSignal.any([
        AbortSignal.timeout(15000),
        ...(budget ? [budget] : []),
      ]),
      headers: {
        'User-Agent': 'GoEase/1.0 (Wikimedia catalog photo caching)',
      },
    });
    if ([429, 503].includes(sourceResponse.status)) {
      const header = sourceResponse.headers.get('retry-after') ?? '';
      const delay = /^\d+$/.test(header)
        ? Number(header) * 1000
        : Date.parse(header) - Date.now();
      const retryAfterMs = Math.max(
        60000,
        Number.isFinite(delay) ? delay : 60000,
      );
      sourceCooldownUntil = Date.now() + retryAfterMs;
      await sourceResponse.body?.cancel();
      throw new PhotoSourceCooldown(retryAfterMs);
    }
    const bytes = await limitedBody(sourceResponse, 8 * 1024 * 1024);
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
        signal: AbortSignal.any([
          AbortSignal.timeout(30000),
          ...(budget ? [budget] : []),
        ]),
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
      image: {
        ...candidate.image,
        url: url.href,
        storage: 'cloudinary',
        originalUrl: source.href,
        reviewed: false,
      },
    };
  }
  return {
    store,
    requireConfig,
    requireSourceReady,
    async prepareCover(image: CatalogImage): Promise<CatalogImage> {
      // Untagged legacy images keep their previous behavior. New external covers must be backed up.
      if (image.storage !== 'source') return image;
      try {
        const cached = await store({
          id: 'cover',
          title: 'Cover',
          match: 'name',
          image,
        });
        return {
          ...cached.image,
          reviewed: image.reviewed,
          selection: image.selection,
        };
      } catch (error) {
        if (error instanceof HttpError) throw error;
        throw new HttpError(
          502,
          'PLACE_PHOTO_STORAGE_FAILED',
          'Chưa lưu được ảnh bìa. Với ảnh ngoài Wikimedia, hãy tải ảnh lên Cloudinary và dùng URL đã lưu.',
        );
      }
    },
  };
}

export function storedWikimediaImages(
  config: StorageConfig,
  find: FindImages,
  request: typeof fetch = fetch,
): FindImages {
  const storage = catalogCoverStorage(config, request);
  return async (query) => {
    storage.requireConfig();
    storage.requireSourceReady();
    const received = (await find(query)).slice(0, 5);
    const candidates = received.flatMap((candidate) => {
      try {
        const image = catalogImageSchema.parse(candidate.image);
        sourceUrl(image);
        return [
          {
            ...candidate,
            image: {
              ...image,
              storage: 'source' as const,
              originalUrl: image.url,
              reviewed: false,
            },
          },
        ];
      } catch {
        return [];
      }
    });
    // Stop after the first successful backup. Supplemental photos stay at their source URLs.
    const budget = AbortSignal.timeout(90000);
    for (const candidate of candidates) {
      if (budget.aborted) break;
      try {
        const cover = await storage.store(candidate, budget);
        return [
          cover,
          ...candidates.filter((c) => c.image.url !== candidate.image.url),
        ].slice(0, 5);
      } catch (error) {
        if (error instanceof PhotoSourceCooldown) throw error;
        /* Try another candidate as cover; never report an uncached cover as ready. */
      }
    }
    if (received.length)
      throw new HttpError(
        502,
        'PLACE_PHOTO_STORAGE_FAILED',
        'Chưa lưu được ảnh bìa Wikimedia vào Cloudinary. Hãy thử lại.',
      );
    return [];
  };
}
