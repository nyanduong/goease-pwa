import { useState } from 'react';
import { destinationCover } from '../destination-cover';

export function DestinationPhoto({
  name,
  slug,
}: {
  name: string;
  slug?: string | undefined;
}) {
  const [failed, setFailed] = useState('');
  const url = destinationCover(name, slug);
  if (!url || failed === url)
    return (
      <div
        className="destination-photo-empty"
        role="img"
        aria-label={`Chưa có ảnh điểm đến ${name}`}
      >
        Chưa có ảnh điểm đến
      </div>
    );
  return <img src={url} alt={name} onError={() => setFailed(url)} />;
}
