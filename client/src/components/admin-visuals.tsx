import { images } from '@goease/media';
import { useState, type ReactNode } from 'react';
import type { AdminPlaceDto } from '@goease/contracts';

export function PhotoSearchStatus({ place }: { place: AdminPlaceDto }) {
  const status = place.photoSearch;
  if (!status) return null;
  return (
    <small>
      {status.count > 0
        ? `${status.count}/6 ảnh gợi ý · Mở địa điểm để chọn ảnh bìa`
        : status.state === 'empty'
          ? 'Chưa tìm thấy ảnh phù hợp'
          : status.state === 'failed'
            ? 'Lấy/lưu ảnh lỗi · Mở địa điểm để thử lại'
            : 'Đang tìm và lưu ảnh · Mở địa điểm xem tiến trình'}
    </small>
  );
}

// Cloudinary illustrations are presentation assets, never catalog evidence.
export const adminAssets = {
  hero: images.adminHoianWatercolor,
  food: images.adminFood,
  vegetarian: images.adminVegetarian,
  coffee: images.adminCoffee,
  heritage: images.adminHeritage,
  lanterns: images.adminLanterns,
  nature: images.exploreRice,
};
type PlaceImage = {
  name: string;
  category: string;
  imageUrl?: string | undefined;
  imageCredit?: string | undefined;
};
export function adminIllustration(
  place: Pick<PlaceImage, 'name' | 'category'>,
) {
  if (/coffee|café|cafe|cà phê/i.test(place.name)) return adminAssets.coffee;
  if (/chay|vegetarian|vegan/i.test(place.name)) return adminAssets.vegetarian;
  if (place.category === 'food') return adminAssets.food;
  if (/chợ|đêm|phố cổ|sông hoài/i.test(place.name)) return adminAssets.lanterns;
  return place.category === 'nature'
    ? adminAssets.nature
    : adminAssets.heritage;
}
export function AdminPlaceImage({
  place,
  large = false,
}: {
  place: PlaceImage;
  large?: boolean;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  const illustrated =
    !place.imageUrl ||
    /minh họa|\bAI\b/i.test(place.imageCredit ?? '') ||
    place.imageUrl === images.exploreHoian ||
    failed === place.imageUrl;
  return (
    <span
      className={`admin-place-photo${large ? ' is-large' : ''}`}
      title={illustrated ? 'Chưa có ảnh thật được duyệt' : place.imageCredit}
    >
      {illustrated ? (
        <span role="img" aria-label="Chưa có ảnh thật">
          Chưa có ảnh
        </span>
      ) : (
        <img
          src={place.imageUrl}
          alt={place.name}
          loading="lazy"
          onError={() => setFailed(place.imageUrl ?? '')}
        />
      )}
    </span>
  );
}
export function AdminPageHeader({
  title,
  description,
  region = 'Việt Nam',
  illustrated = true,
  greeting = false,
  actions,
}: {
  title: string;
  description: string;
  region?: string;
  illustrated?: boolean;
  greeting?: boolean;
  actions?: ReactNode;
}) {
  void illustrated;
  void greeting;
  return (
    <header className="admin-page-heading admin-reference-heading">
      <div className="admin-heading-copy">
        <span className="admin-eyebrow">VẬN HÀNH DỮ LIỆU · {region}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {actions}
    </header>
  );
}
