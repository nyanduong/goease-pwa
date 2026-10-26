import { images } from '@goease/media';
import { useState, type ReactNode } from 'react';
import { ImageOff } from 'lucide-react';
import { catalogImageCover, type AdminPlaceDto } from '@goease/contracts';

export function PhotoSearchStatus({ place }: { place: AdminPlaceDto }) {
  const status = place.photoSearch;
  if (!status) return null;
  return (
    <small>
      {status.count > 0
        ? `${status.count}/5 ảnh gợi ý · ${place.imageUrl ? 'Đã có ảnh bìa · Có thể đổi trong chi tiết' : 'Mở địa điểm để chọn ảnh bìa'}`
        : status.state === 'empty'
          ? 'Chưa tìm thấy ảnh phù hợp'
          : status.state === 'failed'
            ? 'Lấy/lưu ảnh lỗi · Mở địa điểm để thử lại'
            : status.state === 'pending'
              ? 'Đang chờ tìm ảnh'
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
  images?: AdminPlaceDto['images'];
  photoSearch?: AdminPlaceDto['photoSearch'];
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
  const cover = catalogImageCover(place.images ?? []);
  const imageUrl = cover?.url ?? place.imageUrl;
  const isAi = cover?.kind === 'ai_illustration';
  const missing =
    !imageUrl ||
    (!cover &&
      (/minh họa|\bAI\b/i.test(place.imageCredit ?? '') ||
        imageUrl === images.exploreHoian)) ||
    failed === imageUrl;
  const missingLabel =
    failed === imageUrl
      ? 'Ảnh lỗi tải'
      : ({
          pending: 'Chờ tìm ảnh',
          searching: 'Đang tìm ảnh',
          empty: 'Chưa tìm thấy ảnh',
          failed: 'Lấy ảnh lỗi',
        }[place.photoSearch?.state ?? ''] ?? 'Chưa có ảnh');
  return (
    <span
      className={`admin-place-photo${large ? ' is-large' : ''}`}
      title={
        missing
          ? missingLabel
          : `${isAi ? 'Ảnh minh họa AI · ' : ''}${cover?.credit ?? place.imageCredit ?? ''}`
      }
    >
      {missing ? (
        <span role="img" aria-label={missingLabel}>
          <ImageOff size={large ? 28 : 18} aria-hidden="true" />
          {large && <span>{missingLabel}</span>}
        </span>
      ) : (
        <img
          src={imageUrl}
          alt={isAi ? `${place.name} — ảnh minh họa AI` : place.name}
          loading="lazy"
          onError={() => setFailed(imageUrl ?? '')}
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
  meta,
}: {
  title: string;
  description?: string;
  region?: string;
  illustrated?: boolean;
  greeting?: boolean;
  actions?: ReactNode;
  meta?: ReactNode;
}) {
  void illustrated;
  void greeting;
  return (
    <header className="admin-page-heading admin-reference-heading">
      <div className="admin-heading-copy">
        {![
          'Việt Nam',
          'Tất cả khu vực',
          'tất cả khu vực',
          'Toàn hệ thống',
        ].includes(region) && (
          <span className="admin-scope-caption">{region}</span>
        )}
        <div className="admin-title-line">
          <h1>{title}</h1>
          {meta && <span className="admin-title-meta">{meta}</span>}
        </div>
        {description && <p>{description}</p>}
      </div>
      {actions}
    </header>
  );
}
