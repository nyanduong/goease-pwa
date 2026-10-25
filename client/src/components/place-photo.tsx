import { useState } from 'react';
import type { PlaceDto } from '@goease/contracts';
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
          alt={place.name}
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
