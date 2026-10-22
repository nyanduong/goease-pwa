import { Types } from 'mongoose';
import { normalizeSearch, type exploreService } from './explore.service.js';
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
      imageUrl: '/images/explore-hoian.png',
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
      imageUrl: '/images/explore-rice.png',
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
      imageUrl: '/images/explore-traque.png',
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
  ];
  for (const { id, ...entry } of entries) {
    if (await Place.exists({ _id: id })) continue;
    await new Place({
      ...entry,
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
