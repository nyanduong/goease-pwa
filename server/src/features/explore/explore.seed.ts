import { images } from '@goease/media';
import { mapLocationSchema, type MapLocation } from '@goease/contracts';
import { Types } from 'mongoose';
import { normalizeSearch, type exploreService } from './explore.service.js';
const ticketSource =
  'https://www.hoianworldheritage.org.vn/vi/news/Du-lich-Hoi-An/cap-nhat-ve-tham-quan-khu-pho-co-hoi-an-hanh-trinh-cham-ve-nguyen-ban-giua-long-di-san-3033.hwh';
// Area reference points, not verified entrances. No coordinates for generic dishes.
// OSM-derived points: © OpenStreetMap contributors, ODbL; see docs/TRIP-MAP.md.
const mapLocations: Record<string, MapLocation> = {
  '100000000000000000000001': {
    latitude: 15.8771291,
    longitude: 108.3286631,
    label: 'Khu phố cổ Hội An',
    precision: 'area',
    sourceUrl: 'https://www.openstreetmap.org/node/4601279489',
    checkedAt: '2026-10-23',
  },
  '100000000000000000000003': {
    latitude: 15.9027147,
    longitude: 108.3360222,
    label: 'Khu vực làng rau Trà Quế',
    precision: 'area',
    sourceUrl: 'https://www.openstreetmap.org/node/3079969135',
    checkedAt: '2026-10-23',
  },
  '100000000000000000000004': {
    latitude: 15.9136072,
    longitude: 108.3406489,
    label: 'Khu vực bãi biển An Bàng',
    precision: 'area',
    sourceUrl: 'https://www.beachatlas.com/an-bang-2',
    checkedAt: '2026-10-23',
  },
  '100000000000000000000005': {
    latitude: 15.8762535,
    longitude: 108.3660605,
    label: 'Khu vực Cẩm Thanh, chưa xác định đơn vị trải nghiệm',
    precision: 'area',
    sourceUrl: 'https://geokeo.com/database/suburb/vn/5/',
    checkedAt: '2026-10-23',
  },
  '100000000000000000000007': {
    latitude: 15.8764915,
    longitude: 108.3264631,
    label: 'Khu vực cầu An Hội bên sông Hoài',
    precision: 'area',
    sourceUrl: 'https://www.openstreetmap.org/way/35952574',
    checkedAt: '2026-10-23',
  },
};
export async function seedPlaces(
  Place: ReturnType<typeof exploreService>['models']['Place'],
) {
  const entries = [
    {
      id: '100000000000000000000001',
      slug: 'pho-co-hoi-an',
      name: 'Phố cổ Hội An',
      category: 'culture',
      subtitle: 'Đi bộ chậm. Ngắm phố lâu.',
      description:
        'Những mái ngói cũ, con hẻm nhỏ và một nhịp sống để bạn chậm lại.',
      imageUrl: images.exploreHoian,
      durationLabel: '2–3 giờ',
      travelLabel: 'Đi bộ',
      bestTimeLabel: 'Hợp buổi chiều',
      tip: 'Ghé phố lúc chiều muộn, rồi dạo bên sông Hoài. Dành thêm thời gian để ngắm ánh đèn khi trời tối.',
      highlights: [
        { name: 'Chùa Cầu', query: 'Chùa Cầu Hội An' },
        { name: 'Nhà cổ', query: 'Nhà cổ Tấn Ký Hội An' },
        { name: 'Sông Hoài', query: 'Sông Hoài Hội An' },
      ],
      sourceUrl: 'https://whc.unesco.org/en/list/948/',
    },
    {
      id: '100000000000000000000002',
      slug: 'com-ga-hoi-an',
      name: 'Cơm gà Hội An',
      category: 'food',
      subtitle: 'Một hương vị của phố Hội.',
      description:
        'Cơm vàng, gà xé và rau thơm — một bữa ăn giản dị để nghỉ chân giữa hành trình. Đây là gợi ý món ăn, không phải một nhà hàng cụ thể.',
      imageUrl: images.exploreRice,
      durationLabel: '45–60 phút',
      travelLabel: 'Ăn uống',
      bestTimeLabel: 'Hợp bữa trưa',
      tip: 'Chọn một quán phù hợp trên đường dạo phố; hỏi giá và thành phần món ăn trước khi gọi.',
      highlights: [{ name: 'Tìm quán cơm gà', query: 'Cơm gà Hội An' }],
      sourceUrl: 'https://vietnam.travel/things-to-do/explore-food-hoi-an',
    },
    {
      id: '100000000000000000000003',
      slug: 'lang-rau-tra-que',
      name: 'Làng rau Trà Quế',
      category: 'nature',
      subtitle: 'Một khoảng xanh yên bình.',
      description:
        'Đi giữa những luống rau xanh, ngắm nhịp làm vườn và tìm một khoảng nghỉ ngoài phố cổ.',
      imageUrl: images.exploreTraque,
      durationLabel: '1–2 giờ',
      travelLabel: 'Dạo bộ',
      bestTimeLabel: 'Hợp sáng sớm',
      tip: 'Đi lúc trời dịu, mang nước uống và hỏi người trồng rau trước khi bước vào luống hoặc chụp ảnh gần.',
      highlights: [
        { name: 'Làng rau Trà Quế', query: 'Làng rau Trà Quế Hội An' },
      ],
      sourceUrl:
        'https://hoianworldheritage.org.vn/en/news/Traditional-occupational-Village/tra-que-vegetable-village-tourist-attraction-583.hwh',
    },
    {
      id: '100000000000000000000004',
      slug: 'bien-an-bang',
      name: 'Biển An Bàng',
      category: 'nature',
      subtitle: 'Một buổi chiều bên biển.',
      description:
        'Ghé bãi biển An Bàng, dành thời gian nghỉ chân và ngắm biển. Các dịch vụ ăn uống, ghế nghỉ và gửi xe được tính riêng tùy nơi cung cấp.',
      imageUrl: images.exploreTraque,
      durationLabel: '1–2 giờ',
      travelLabel: 'Tự chọn phương tiện',
      bestTimeLabel: 'Hợp chiều dịu nắng',
      tip: 'Kiểm tra thời tiết và hướng dẫn an toàn tại bãi biển. Hỏi giá dịch vụ trước khi sử dụng.',
      highlights: [{ name: 'Biển An Bàng', query: 'An Bang Beach Hoi An' }],
      sourceUrl: 'https://vietnam.travel/node/965',
    },
    {
      id: '100000000000000000000005',
      slug: 'cam-thanh',
      name: 'Cẩm Thanh',
      category: 'nature',
      subtitle: 'Đi chậm giữa miền xanh.',
      description:
        'Khu vực Cẩm Thanh có cảnh quan nông thôn và dừa nước. Chọn hoạt động phù hợp tại địa phương; giá tour và dịch vụ phụ thuộc đơn vị tổ chức.',
      imageUrl: images.exploreTraque,
      durationLabel: '1–2 giờ',
      travelLabel: 'Tự chọn phương tiện',
      bestTimeLabel: 'Hợp buổi sáng',
      tip: 'Dành thời gian di chuyển từ phố cổ. Thống nhất nội dung và giá trước khi tham gia một trải nghiệm.',
      highlights: [{ name: 'Cẩm Thanh', query: 'Cam Thanh Hoi An' }],
      sourceUrl: 'https://vietnam.travel/node/99',
    },
    {
      id: '100000000000000000000006',
      slug: 'cao-lau-hoi-an',
      name: 'Cao lầu Hội An',
      category: 'food',
      subtitle: 'Thêm một bữa mang vị phố Hội.',
      description:
        'Cao lầu là gợi ý món ăn của Hội An, không đại diện cho một nhà hàng cụ thể. Bạn chọn quán thuận đường và phù hợp nhu cầu ăn uống.',
      imageUrl: images.exploreRice,
      durationLabel: '45–60 phút',
      travelLabel: 'Ăn uống',
      bestTimeLabel: 'Hợp bữa trưa hoặc tối',
      tip: 'Hỏi thành phần món ăn nếu có dị ứng và xem thực đơn trước khi gọi.',
      highlights: [{ name: 'Tìm quán cao lầu', query: 'Cao lau Hoi An' }],
      sourceUrl: 'https://vietnam.travel/node/99',
    },
    {
      id: '100000000000000000000007',
      slug: 'song-hoai',
      name: 'Dạo bên sông Hoài',
      category: 'culture',
      subtitle: 'Một khoảng nghỉ khi phố lên đèn.',
      description:
        'Thêm thời gian dạo ven sông vào buổi ghé phố cổ. Đây là hoạt động dạo bộ; không bao gồm đặt thuyền, vé di tích hoặc các dịch vụ khác.',
      imageUrl: images.exploreHoian,
      durationLabel: '45–60 phút',
      travelLabel: 'Đi bộ',
      bestTimeLabel: 'Hợp cuối buổi chiều',
      tip: 'Chọn lối đi phù hợp và giữ an toàn sát mép nước. Không cộng lại vé phố cổ nếu đã tính trong một hoạt động khác.',
      highlights: [{ name: 'Sông Hoài', query: 'Song Hoai Hoi An' }],
      sourceUrl: ticketSource,
    },
  ];
  for (const { id, ...entry } of entries) {
    const planning = {
      durationMinutes:
        entry.category === 'food' || id.endsWith('007')
          ? 60
          : id.endsWith('001')
            ? 180
            : 120,
      locationQuery: entry.highlights[0]!.query,
      costNote: id.endsWith('001')
        ? 'Vé 80.000đ hoặc 120.000đ với phạm vi tham quan khác nhau. Chọn loại vé phù hợp và kiểm tra điều kiện tại nơi bán. Chỉ tính một lần, không cộng lại ở các di tích đã bao gồm.'
        : 'Chưa có giá xác minh cho lựa chọn của bạn. Hỏi đơn vị cung cấp rồi nhập dự kiến; để trống nếu chưa rõ. Thời lượng là gợi ý biên tập.',
      priceOptions: id.endsWith('001')
        ? [80000, 120000].map((amount) => ({
            label:
              amount === 80000
                ? 'Vé tham quan 80.000đ'
                : 'Vé tham quan 120.000đ',
            amountMinor: amount,
            basis: 'per_person',
            sourceUrl: ticketSource,
            checkedAt: '2026-10-22',
          }))
        : [],
    };
    const mapLocation = mapLocations[id]
      ? mapLocationSchema.parse(mapLocations[id])
      : undefined;
    if (mapLocation)
      await Place.updateOne(
        { _id: id, mapLocation: { $exists: false } },
        { $set: { mapLocation } },
        { runValidators: true },
      );
    // Add metadata only when absent; preserve edited catalog text, prices and publication state.
    await Place.updateOne(
      { _id: id, planning: { $exists: false } },
      { $set: { planning } },
    );
    if (await Place.exists({ _id: id })) continue;
    await new Place({
      ...entry,
      ...(mapLocation ? { mapLocation } : {}),
      planning,
      _id: new Types.ObjectId(id),
      destinationId: new Types.ObjectId('000000000000000000000004'),
      destinationName: 'Hội An',
      searchText: normalizeSearch(
        `${entry.name} ${entry.subtitle} ${entry.description}`,
      ),
      publicationStatus: 'published',
      imageCredit: 'Ảnh minh họa tạo bằng AI',
    }).save();
  }
}
