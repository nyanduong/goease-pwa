import { isDeepStrictEqual } from 'node:util';
import { Types, type ClientSession, type Connection } from 'mongoose';
import {
  catalogCost,
  referencePriceSchema,
  type TripInput,
} from '@goease/contracts';
import { HttpError } from '../../http-error.js';

export async function validateCatalogCosts(
  connection: Connection,
  value: TripInput,
  saved: TripInput | undefined,
  proposal: TripInput | undefined,
  session: ClientSession,
) {
  const previous = [saved, proposal].flatMap(
    (t) => t?.days.flatMap((d) => d.activities) ?? [],
  );
  const incoming = value.days
    .flatMap((d) => d.activities)
    .filter((a) => a.estimatedCost.confidence === 'catalog_reference');
  const unchecked = incoming.filter(
    (a) =>
      !previous.some(
        (old) =>
          old.activityId === a.activityId &&
          old.placeId === a.placeId &&
          isDeepStrictEqual(old.estimatedCost, a.estimatedCost),
      ),
  );
  if (!unchecked.length) return;
  const places = await connection
    .collection('places')
    .find(
      {
        _id: {
          $in: unchecked
            .filter((a) => a.placeId)
            .map((a) => new Types.ObjectId(a.placeId)),
        },
        publicationStatus: 'published',
        deletedAt: null,
      },
      { session },
    )
    .toArray();
  for (const activity of unchecked) {
    const place = places.find((p) => String(p._id) === activity.placeId);
    const parsed = referencePriceSchema.safeParse(place?.referencePrice);
    if (
      !place ||
      !parsed.success ||
      !isDeepStrictEqual(
        activity.estimatedCost,
        catalogCost({
          referencePrice: parsed.data,
          revision: place.revision ?? 0,
        }),
      )
    )
      throw new HttpError(
        409,
        'CATALOG_PRICE_CHANGED',
        'Giá tham khảo đã thay đổi hoặc không còn áp dụng. Mở điểm dừng, chọn Cập nhật giá tham khảo rồi lưu lại; bản đang nhập vẫn giữ.',
      );
  }
}
