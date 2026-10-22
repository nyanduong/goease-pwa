import { useEffect, useState } from 'react';
import type { PlaceDto } from '@goease/contracts';
import { api } from '../api';
import { moneyText } from '../trip-draft';

type Price = NonNullable<PlaceDto['planning']>['priceOptions'][number];
export function PlacePlanning({
  place,
  onPick,
}: {
  place: PlaceDto;
  onPick?: (price: Price) => void;
}) {
  const planning = place.planning;
  if (!planning) return null;
  return (
    <section className="place-planning">
      <strong>Thông tin để xếp lịch</strong>
      <p>
        Gợi ý dành {planning.durationMinutes} phút · Thời lượng do GoEase biên
        tập.
      </p>
      <a
        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(planning.locationQuery)}`}
        target="_blank"
        rel="noreferrer"
      >
        Tìm vị trí trên bản đồ ↗
      </a>
      <p>{planning.costNote}</p>
      {planning.priceOptions.map((price) => (
        <div className="place-reference-price" key={price.label}>
          <b>
            {price.label} · {moneyText(price.amountMinor)} /{' '}
            {price.basis === 'per_person' ? 'người' : 'nhóm'}
          </b>
          <small>
            Đối chiếu {price.checkedAt} · Giá tham khảo, kiểm tra điều kiện
            trước khi mua.
          </small>
          <a href={price.sourceUrl} target="_blank" rel="noreferrer">
            Nguồn công bố ↗
          </a>
          {onPick && (
            <button
              type="button"
              className="journey-outline"
              onClick={() => onPick(price)}
            >
              Dùng {price.label.toLowerCase()}
            </button>
          )}
        </div>
      ))}
      {!planning.priceOptions.length && (
        <small>Chi phí: Chưa rõ. Bạn có thể nhập dự kiến bên dưới.</small>
      )}
    </section>
  );
}

export function ActivityCatalogInfo({
  placeId,
  onPick,
}: {
  placeId: string;
  onPick: (price: Price) => void;
}) {
  const [place, setPlace] = useState<PlaceDto | null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    void api<{ place: PlaceDto }>(`/places/${placeId}`)
      .then((r) => {
        if (active) setPlace(r.place);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [placeId, retry]);
  if (error)
    return (
      <p className="journey-sheet-note">
        Chưa tải được thông tin tham khảo. Nội dung điểm dừng vẫn được giữ.{' '}
        <button
          type="button"
          onClick={() => {
            setError(false);
            setRetry((v) => v + 1);
          }}
        >
          Thử lại
        </button>
      </p>
    );
  if (!place) return <p role="status">Đang tải thông tin địa điểm…</p>;
  return <PlacePlanning place={place} onPick={onPick} />;
}
