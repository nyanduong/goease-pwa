import { images } from '@goease/media';
import { useState, type ReactNode } from 'react';

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
  const src = illustrated ? adminIllustration(place) : place.imageUrl;
  return (
    <span
      className={`admin-place-photo${large ? ' is-large' : ''}`}
      title={
        illustrated
          ? 'Ảnh minh họa AI — không phải ảnh xác minh của cơ sở'
          : place.imageCredit
      }
    >
      <img
        src={src}
        alt={
          illustrated
            ? `Minh họa AI cho nhóm ${place.category === 'food' ? 'ăn uống' : place.category === 'nature' ? 'thiên nhiên' : 'văn hóa'}`
            : place.name
        }
        loading="lazy"
        onError={() => setFailed(src ?? '')}
      />
      {illustrated && <small className="admin-ai-label">AI</small>}
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
