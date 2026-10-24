import { createHash, randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { z } from 'zod';
import type { Config } from '../../config.js';
import { HttpError } from '../../http-error.js';

export async function normalizeAvatar(bytes: Buffer): Promise<Buffer> {
  const invalid = () =>
    new HttpError(
      400,
      'INVALID_AVATAR',
      'Chọn ảnh JPG, PNG hoặc WebP hợp lệ, tối đa 2 MB và 16 triệu điểm ảnh.',
    );
  if (!bytes.length || bytes.length > 2 * 1024 * 1024) throw invalid();
  const raster =
    bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255])) ||
    bytes
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ||
    (bytes.toString('ascii', 0, 4) === 'RIFF' &&
      bytes.toString('ascii', 8, 12) === 'WEBP');
  if (!raster) throw invalid();
  try {
    const image = sharp(bytes, {
      limitInputPixels: 16_000_000,
      failOn: 'warning',
    });
    const metadata = await image.metadata();
    if (
      !['jpeg', 'png', 'webp'].includes(metadata.format) ||
      (metadata.pages ?? 1) > 1
    )
      throw invalid();
    // Re-encoding strips source metadata and never stores the original file.
    return await image
      .rotate()
      .resize(512, 512, { fit: 'cover' })
      .webp({ quality: 85 })
      .toBuffer();
  } catch {
    throw invalid();
  }
}

export function avatarUploader(
  config: Pick<
    Config,
    'CLOUDINARY_CLOUD_NAME' | 'CLOUDINARY_API_KEY' | 'CLOUDINARY_API_SECRET'
  >,
  send: typeof fetch = fetch,
) {
  return async (bytes: Buffer): Promise<string> => {
    if (
      !config.CLOUDINARY_CLOUD_NAME ||
      !config.CLOUDINARY_API_KEY ||
      !config.CLOUDINARY_API_SECRET
    )
      throw new HttpError(
        503,
        'AVATAR_UNAVAILABLE',
        'Chưa cấu hình tải ảnh đại diện. Hãy thử lại sau.',
      );
    const image = await normalizeAvatar(bytes);
    const id = `goease/avatars/${randomUUID()}`;
    const params = {
      asset_folder: 'goease/avatars',
      overwrite: 'false',
      public_id: id,
      timestamp: String(Math.floor(Date.now() / 1000)),
    };
    const form = new FormData();
    for (const [name, value] of Object.entries(params)) form.set(name, value);
    form.set('api_key', config.CLOUDINARY_API_KEY);
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
    form.set('file', new Blob([new Uint8Array(image)]), 'avatar.webp');
    try {
      const response = await send(
        `https://api.cloudinary.com/v1_1/${config.CLOUDINARY_CLOUD_NAME}/image/upload`,
        {
          method: 'POST',
          body: form,
          redirect: 'error',
          signal: AbortSignal.timeout(30000),
        },
      );
      if (!response.ok) {
        await response.body?.cancel();
        throw new Error();
      }
      const reader = response.body?.getReader();
      if (!reader) throw new Error();
      const chunks: Uint8Array[] = [];
      let size = 0;
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        size += part.value.length;
        if (size > 32768) {
          await reader.cancel();
          throw new Error();
        }
        chunks.push(part.value);
      }
      const result = z
        .object({
          public_id: z.literal(id),
          width: z.literal(512),
          height: z.literal(512),
          format: z.literal('webp'),
          secure_url: z.url(),
        })
        .parse(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      const url = new URL(result.secure_url);
      if (
        url.origin !== 'https://res.cloudinary.com' ||
        !url.pathname.startsWith(
          `/${config.CLOUDINARY_CLOUD_NAME}/image/upload/`,
        ) ||
        !url.pathname.endsWith(`/${id}.webp`) ||
        url.search ||
        url.hash ||
        url.username ||
        url.password
      )
        throw new Error();
      return url.href;
    } catch {
      throw new HttpError(
        502,
        'AVATAR_UPLOAD_FAILED',
        'Chưa tải được ảnh. Ảnh cũ vẫn được giữ; hãy thử lại.',
      );
    }
  };
}
