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
        alt={`${name} · ảnh ${index + 1}`}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setFailed(image.url)}
      />
      {image.kind !== 'ai_illustration' && (
        <figcaption>
          <a href={image.sourceUrl} target="_blank" rel="noreferrer">
            {image.credit} · {image.license}
          </a>
        </figcaption>
      )}
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
  const imageUrl =
    cover?.url ?? (place.images === undefined ? place.imageUrl : '');
  return (
    <span className="place-real-photo">
      {imageUrl && failed !== imageUrl ? (
        <img
          src={imageUrl}
          alt={place.name}
          loading="lazy"
          onError={() => setFailed(imageUrl)}
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
      {cover && cover.kind !== 'ai_illustration' && (
        <small title={`${cover.credit} · ${cover.license}`}>
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
