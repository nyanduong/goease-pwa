import type { DestinationDto } from '@goease/contracts';
import { api } from './api';
export async function loadDestinations() {
  const items: DestinationDto[] = [];
  for (let offset = 0; offset < 2000; offset += 200) {
    const page = await api<{ items: DestinationDto[]; hasMore?: boolean }>(
      offset ? `/destinations?offset=${offset}&limit=200` : '/destinations',
    );
    items.push(...page.items);
    if (!page.hasMore) return { items };
  }
  throw new Error(
    'Danh sách điểm đến vượt giới hạn tải. Hãy tìm theo miền/vùng.',
  );
}
