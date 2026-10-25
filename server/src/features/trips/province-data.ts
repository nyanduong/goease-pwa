import type { TourismRegion } from '@goease/contracts';

// Administrative names/codes: Appendix I, Decision 19/2025/QD-TTg.
// Tourism regions are GoEase editorial groupings, not administrative boundaries.
export const provinceCatalogVersion = 'vn-19-2025-07-01-v1';
export const provinceCatalogSource =
  'https://datafiles.chinhphu.vn/cpp/files/vbpq/2025/7/19ttg.signed.pdf';
export const provinceCatalogEffectiveFrom = '2025-07-01';
type Province = {
  code: string;
  name: string;
  slug: string;
  region: TourismRegion;
  areas: string[];
};
const rows: [string, string, string, TourismRegion][] = [
  ['01', 'Hà Nội', 'ha-noi', 'northern-delta'],
  ['04', 'Cao Bằng', 'cao-bang', 'northeast'],
  ['08', 'Tuyên Quang', 'tuyen-quang', 'northeast'],
  ['11', 'Điện Biên', 'dien-bien', 'northwest'],
  ['12', 'Lai Châu', 'lai-chau', 'northwest'],
  ['14', 'Sơn La', 'son-la', 'northwest'],
  ['15', 'Lào Cai', 'lao-cai', 'northwest'],
  ['19', 'Thái Nguyên', 'thai-nguyen', 'northeast'],
  ['20', 'Lạng Sơn', 'lang-son', 'northeast'],
  ['22', 'Quảng Ninh', 'quang-ninh', 'northeast'],
  ['24', 'Bắc Ninh', 'bac-ninh', 'northern-delta'],
  ['25', 'Phú Thọ', 'phu-tho', 'northern-delta'],
  ['31', 'Hải Phòng', 'hai-phong', 'northern-delta'],
  ['33', 'Hưng Yên', 'hung-yen', 'northern-delta'],
  ['37', 'Ninh Bình', 'ninh-binh', 'northern-delta'],
  ['38', 'Thanh Hóa', 'thanh-hoa', 'north-central'],
  ['40', 'Nghệ An', 'nghe-an', 'north-central'],
  ['42', 'Hà Tĩnh', 'ha-tinh', 'north-central'],
  ['44', 'Quảng Trị', 'quang-tri', 'north-central'],
  ['46', 'Huế', 'hue', 'north-central'],
  ['48', 'Đà Nẵng', 'da-nang', 'south-central-coast'],
  ['51', 'Quảng Ngãi', 'quang-ngai', 'south-central-coast'],
  ['52', 'Gia Lai', 'gia-lai', 'central-highlands'],
  ['56', 'Khánh Hòa', 'khanh-hoa', 'south-central-coast'],
  ['66', 'Đắk Lắk', 'dak-lak', 'central-highlands'],
  ['68', 'Lâm Đồng', 'lam-dong', 'central-highlands'],
  ['75', 'Đồng Nai', 'dong-nai', 'southeast'],
  ['79', 'Hồ Chí Minh', 'ho-chi-minh', 'southeast'],
  ['80', 'Tây Ninh', 'tay-ninh', 'southeast'],
  ['82', 'Đồng Tháp', 'dong-thap', 'mekong-delta'],
  ['86', 'Vĩnh Long', 'vinh-long', 'mekong-delta'],
  ['91', 'An Giang', 'an-giang', 'mekong-delta'],
  ['92', 'Cần Thơ', 'can-tho', 'mekong-delta'],
  ['96', 'Cà Mau', 'ca-mau', 'mekong-delta'],
];
// Bounded editorial travel-area aliases. Not an exhaustive ward/commune registry.
// https://hoian.danang.gov.vn/gioi-thieu-chung.html
// https://www.doingoailaocai.vn/vi/bai-viet/25109
export const provinces: readonly Province[] = rows.map(
  ([code, name, slug, region]) => ({
    code,
    name,
    slug,
    region,
    areas: code === '48' ? ['Hội An'] : code === '15' ? ['Sa Pa'] : [],
  }),
);

export const foldDestination = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase();

// Deterministic bootstrap IDs. Existing province IDs take priority; occupied legacy IDs are never overwritten.
export function provinceSeedId(code: string) {
  const retained: Record<string, string> = {
    '48': '000000000000000000000004',
    '46': '000000000000000000000001',
    '68': '000000000000000000000002',
    '01': '000000000000000000000003',
  };
  return retained[code] ?? `0000000000000000000001${code}`;
}
