import { useState } from 'react';
import type { CatalogImage, PlaceDto } from '@goease/contracts';
export function PlaceGalleryPhoto({
  image,
  name,
  index,
}: {
  image: CatalogImage;
  name: string;
  index: number;
}) {
  const [failed, setFailed] = useState('');
  if (failed === image.url) return null;
  return (
    <figure>
      <img
        src={image.url}
        alt={`${name} · ảnh ${index + 1}${image.kind === 'ai_illustration' ? ' — ảnh minh họa AI' : ''}`}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setFailed(image.url)}
      />
      <figcaption>
        {image.kind === 'ai_illustration' && (
          <strong>Ảnh minh họa AI · </strong>
        )}
        <a href={image.sourceUrl} target="_blank" rel="noreferrer">
          {image.credit} · {image.license}
        </a>
      </figcaption>
    </figure>
  );
}
export function PlacePhoto({
  place,
  compact = false,
}: {
  place: Pick<PlaceDto, 'name' | 'imageUrl' | 'images'>;
  compact?: boolean;
}) {
  const [failed, setFailed] = useState('');
  const cover = place.images?.[0];
  return (
    <span className="place-real-photo">
      {place.imageUrl && failed !== place.imageUrl ? (
        <img
          src={place.imageUrl}
          alt={
            cover?.kind === 'ai_illustration'
              ? `${place.name} — ảnh minh họa AI`
              : place.name
          }
          loading="lazy"
          onError={() => setFailed(place.imageUrl)}
        />
      ) : (
        <span
          className="place-photo-empty"
          role="img"
          aria-label="Chưa có ảnh thật"
        >
          Chưa có ảnh thật
        </span>
      )}
      {cover && (
        <small>
          {cover.kind === 'ai_illustration' && (
            <strong className="place-ai-label">Ảnh minh họa AI · </strong>
          )}
          {compact ? (
            <>
              {cover.credit} · {cover.license}
            </>
          ) : (
            <>
              <a href={cover.sourceUrl} target="_blank" rel="noreferrer">
                {cover.credit} · {cover.license}
              </a>
              {cover.licenseUrl && (
                <>
                  {' '}
                  ·{' '}
                  <a href={cover.licenseUrl} target="_blank" rel="noreferrer">
                    Giấy phép
                  </a>
                </>
              )}
            </>
          )}
        </small>
      )}
    </span>
  );
}
