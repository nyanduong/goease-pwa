import { useEffect, useState } from 'react';
import {
  catalogCost,
  catalogToday,
  type ActivityInput,
  type PlaceDto,
} from '@goease/contracts';
import { api } from '../api';
import { moneyText } from '../trip-draft';
import { SourceCredit } from './source-credit';

type Price = NonNullable<PlaceDto['planning']>['priceOptions'][number];
export function PlacePlanning({
  place,
  onPick,
  onAutomatic,
}: {
  place: PlaceDto;
  onPick?: (price: Price) => void;
  onAutomatic?: (cost: ActivityInput['estimatedCost']) => void;
}) {
  const planning = place.planning;
  if (!planning) return null;
  return (
    <section className="place-planning">
      <strong>Thông tin để xếp lịch</strong>
      {place.category === 'food' &&
        place.venueType !== 'restaurant' &&
        !place.mapLocation && (
          <p>
            <strong>Gợi ý món ăn, chưa chọn quán.</strong> Tìm quán phù hợp trên
            bản đồ, rồi ghi tên quán, địa chỉ và giá vào điểm dừng này.
          </p>
        )}
      <p>
        Gợi ý dành {planning.durationMinutes} phút · Thời lượng do GoEase biên
        tập.
      </p>
      <a
        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(planning.locationQuery)}`}
        target="_blank"
        rel="noreferrer"
      >
        {place.category === 'food' &&
        place.venueType !== 'restaurant' &&
        !place.mapLocation
          ? 'Tìm quán trên Google Maps ↗'
          : 'Tìm vị trí trên bản đồ ↗'}
      </a>
      <p>{planning.costNote}</p>
      {place.openingHoursNote && (
        <p>Giờ mở cửa tham khảo: {place.openingHoursNote}</p>
      )}
      {place.referencePrice && (
        <div className="place-reference-price">
          <strong>
            {place.referencePrice.label} ·{' '}
            {moneyText(place.referencePrice.amountMinor)} /{' '}
            {place.referencePrice.basis === 'per_person' ? 'người' : 'nhóm'}
          </strong>
          <p>{place.referencePrice.conditions}</p>
          <small>
            Nhóm tối đa {place.referencePrice.maxTravelers} người · Đối chiếu{' '}
            {place.referencePrice.checkedAt}
          </small>
          <a
            href={place.referencePrice.sourceUrl}
            target="_blank"
            rel="noreferrer"
          >
            Xem chi tiết giá ↗
          </a>
          {place.referencePrice.reviewAfter < catalogToday() ? (
            <small>Giá đến hạn kiểm tra, chưa dùng cho dự toán mới.</small>
          ) : (
            <small>
              Tự tính vào dự toán khi thêm điểm này. Chưa phải giá đặt dịch vụ.
            </small>
          )}
        </div>
      )}
      {onAutomatic && (
        <button
          type="button"
          className="journey-outline"
          onClick={() => onAutomatic(catalogCost(place))}
        >
          Cập nhật giá tham khảo
        </button>
      )}
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
            Xem chi tiết giá ↗
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
      {!planning.priceOptions.length && !place.referencePrice && (
        <small>Chi phí: Chưa rõ. Bạn có thể nhập dự kiến bên dưới.</small>
      )}
      {place.source && <SourceCredit />}
    </section>
  );
}

export function ActivityCatalogInfo({
  placeId,
  onPick,
  onAutomatic,
}: {
  placeId: string;
  onPick: (price: Price) => void;
  onAutomatic?: (cost: ActivityInput['estimatedCost']) => void;
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
  return (
    <PlacePlanning
      place={place}
      onPick={onPick}
      {...(onAutomatic ? { onAutomatic } : {})}
    />
  );
}
