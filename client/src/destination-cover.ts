import { destinationCovers, images } from '@goease/media';

// A known slug is authoritative; never substitute an area mentioned in a name.
export function destinationCover(name: string, slug?: string): string | null {
  const key =
    slug ??
    name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/gi, 'd')
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-');
  if (Object.hasOwn(destinationCovers, key)) return destinationCovers[key]!;
  if (key === 'hoi-an') return images.destinationHoian;
  if (key === 'sa-pa') return images.destinationSapa;
  return null;
}
