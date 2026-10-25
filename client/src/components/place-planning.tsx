import {
  visitPriceLabel,
  visitInfoForEditor,
  sharedPriceBudget,
  priceReady,
} from '@goease/contracts';
import { useEffect, useState } from 'react';
import {
  catalogCost,
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
  const priceInfo =
    place.visitInfo?.pricingVersion === 1
      ? place.visitInfo
      : place.referencePrice
        ? visitInfoForEditor(null, place.referencePrice)
        : place.visitInfo;
  const displayedPrice = priceInfo?.price;

  if (!planning) return null;
  const alternativePrices =
    place.visitInfo?.pricingVersion === 1 ? [] : planning.priceOptions;
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
      {displayedPrice?.reviewed && (
        <section className="place-price-reference">
          <strong>{visitPriceLabel(displayedPrice!)}</strong>
          <p>{displayedPrice!.conditions}</p>
          <small>
            Giá tham khảo · kiểm tra lại với cơ sở trước khi đi.{' '}
            <a
              href={displayedPrice!.sourceUrl}
              target="_blank"
              rel="noreferrer"
            >
              Nguồn giá ↗
            </a>
          </small>
          {place.referencePrice &&
          priceReady(
            place.referencePrice,
            place.referencePrice.minTravelers ?? 1,
          ) ? (
            <small>
              Dùng giá này tính chi phí dự kiến cho{' '}
              {place.referencePrice.minTravelers ?? 1}–
              {place.referencePrice.maxTravelers} người.
            </small>
          ) : (
            <small>
              {sharedPriceBudget(displayedPrice, place.venueType ?? 'place')
                .reasons[0] ?? 'Chưa đủ điều kiện tính chi phí tự động.'}
            </small>
          )}
        </section>
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
      {alternativePrices.map((price) => (
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
      {!alternativePrices.length &&
        !place.referencePrice &&
        !displayedPrice?.reviewed && (
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
