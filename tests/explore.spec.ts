import { test, expect, type Page } from '@playwright/test';
import type { PlaceDto, PlaceStateDto } from '@goease/contracts';
import { initialDraft, withDays } from '../client/src/trip-draft';

// Browser flows use explicit fixtures; persistence/ownership use explore.integration.ts.
const place: PlaceDto = {
  id: '100000000000000000000001',
  destinationId: '000000000000000000000004',
  destinationName: 'Hội An',
  name: 'Phố cổ Hội An',
  slug: 'pho-co-hoi-an',
  category: 'culture',
  subtitle: 'Đi bộ chậm. Ngắm phố lâu.',
  description:
    'Những mái ngói cũ, con hẻm nhỏ và một nhịp sống để bạn chậm lại.',
  imageUrl: '/images/explore-hoian.png',
  durationLabel: '2–3 giờ',
  travelLabel: 'Đi bộ',
  bestTimeLabel: 'Hợp buổi chiều',
  tip: 'Ghé phố lúc chiều muộn, rồi dạo bên sông Hoài.',
  highlights: [{ name: 'Chùa Cầu', query: 'Chùa Cầu Hội An' }],
  sourceUrl: 'https://whc.unesco.org/en/list/948/',
  imageCredit: 'Ảnh minh họa tạo bằng AI',
};
async function setup(page: Page, signedIn: boolean) {
  let state: PlaceStateDto = {
    placeId: place.id,
    saved: false,
    note: '',
    revision: 0,
  };
  let conflict = false;
  let tripFailure = false;
  const patches: { key: string | undefined; body: string | null }[] = [];
  const trip = {
    ...withDays({
      ...initialDraft(),
      title: 'Hội An cuối tuần',
      destinations: [{ destinationId: place.destinationId, order: 0 }],
    }),
    id: '200000000000000000000001',
    revision: 1,
  };
  await page.route('**/api/v1/**', async (r) => {
    const path = new URL(r.request().url()).pathname.replace('/api/v1', '');
    const fulfill = (data: unknown) => r.fulfill({ json: { ok: true, data } });
    if (path === '/auth/me')
      return fulfill({
        user: signedIn
          ? {
              id: '300000000000000000000001',
              displayName: 'Traveler',
              email: 'traveler@example.invalid',
              emailVerified: false,
              avatarUrl: null,
            }
          : null,
      });
    if (path === '/destinations')
      return fulfill({
        items: [
          {
            id: place.destinationId,
            name: 'Hội An',
            timezone: 'Asia/Ho_Chi_Minh',
          },
        ],
      });
    if (path === '/places') {
      const q = new URL(r.request().url()).searchParams;
      return fulfill({
        items:
          q.get('category') === 'food' || q.get('q') === 'no-match'
            ? []
            : [place],
        hasMore: false,
      });
    }
    if (path === `/places/${place.id}`) return fulfill({ place });
    if (path === '/me/places')
      return fulfill({ items: state.saved ? [{ place, state }] : [] });
    if (path === `/me/places/${place.id}`) {
      if (r.request().method() === 'PATCH') {
        if (conflict)
          return r.fulfill({
            status: 409,
            json: {
              ok: false,
              error: { message: 'Ghi chú đã thay đổi ở nơi khác.' },
            },
          });
        const body = r.request().postDataJSON() as {
          note?: string;
          saved?: boolean;
          expectedRevision: number;
        };
        expect(body.expectedRevision).toBe(state.revision);
        state = {
          ...state,
          ...(body.note === undefined ? {} : { note: body.note }),
          ...(body.saved === undefined ? {} : { saved: body.saved }),
          revision: state.revision + 1,
        };
      }
      return fulfill({ state });
    }
    if (path === '/trips') return fulfill({ items: [trip] });
    if (path === `/trips/${trip.id}`) {
      if (r.request().method() === 'PATCH') {
        patches.push({
          key: r.request().headers()['idempotency-key'],
          body: r.request().postData(),
        });
        if (tripFailure) {
          tripFailure = false;
          return r.abort();
        }
      }
      return fulfill({ trip });
    }
    return r.fulfill({ status: 404, json: { ok: false } });
  });
  return {
    trip,
    patches,
    conflict: () => {
      conflict = true;
    },
    failNextTrip: () => {
      tripFailure = true;
    },
  };
}

test('mocked mobile catalog filters, map links, guest gating and detail', async ({
  page,
}) => {
  await setup(page, false);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/explore');
  await expect(
    page.getByRole('heading', { name: 'Một Hội An của riêng bạn.' }),
  ).toBeVisible();
  await expect(page.locator('.explore-card')).toHaveCount(1);
  await page.getByRole('button', { name: 'Ẩm thực', exact: true }).click();
  await expect(
    page.getByText('Chưa có địa điểm phù hợp với tìm kiếm này.'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Tất cả', exact: true }).click();
  await page.getByRole('button', { name: 'Bản đồ', exact: true }).click();
  await expect(
    page.getByRole('link', { name: 'Phố cổ Hội An' }),
  ).toHaveAttribute('href', /google.com\/maps\/search/);
  await page.getByRole('button', { name: 'Danh sách', exact: true }).click();
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
  await page.locator('.explore-card-open').click();
  await expect(
    page.getByRole('heading', { name: 'Phố cổ Hội An', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Thêm vào chuyến đi', exact: true })
    .click();
  await expect(page).toHaveURL(/\/login$/);
});

test('mocked private notes persist across reload and conflict retains edits', async ({
  page,
}) => {
  const fixture = await setup(page, true);
  await page.goto(`/places/${place.id}`);
  await page
    .getByLabel('Ghi chú của bạn', { exact: true })
    .fill('Ghé lúc chiều muộn');
  await page.getByRole('button', { name: 'Lưu ghi chú', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Đã lưu ghi chú.');
  await page.reload();
  await expect(page.getByLabel('Ghi chú của bạn', { exact: true })).toHaveValue(
    'Ghé lúc chiều muộn',
  );
  await page.locator('.place-hero-save').click();
  await expect(page.getByRole('status')).toHaveText('Đã lưu địa điểm.');
  fixture.conflict();
  await page
    .getByLabel('Ghi chú của bạn', { exact: true })
    .fill('Giữ bản đang nhập');
  await page.getByRole('button', { name: 'Lưu ghi chú', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Ghi chú đã thay đổi');
  await expect(page.getByLabel('Ghi chú của bạn', { exact: true })).toHaveValue(
    'Giữ bản đang nhập',
  );
});

test('mocked add-to-trip retries reuse payload and idempotency key', async ({
  page,
}) => {
  const fixture = await setup(page, true);
  await page.goto(`/places/${place.id}`);
  await page
    .getByRole('button', { name: 'Thêm vào chuyến đi', exact: true })
    .click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await page.getByLabel('Chuyến đi tại Hội An').selectOption(fixture.trip.id);
  await page
    .getByLabel('Ngày ghé thăm')
    .selectOption(fixture.trip.days[0]!.dayId);
  fixture.failNextTrip();
  await dialog
    .getByRole('button', { name: 'Thêm vào chuyến đi', exact: true })
    .click();
  await expect(dialog.getByRole('alert')).toBeVisible();
  await dialog
    .getByRole('button', { name: 'Thêm vào chuyến đi', exact: true })
    .click();
  await expect(dialog).toBeHidden();
  expect(fixture.patches).toHaveLength(2);
  expect(fixture.patches[0]).toEqual(fixture.patches[1]);
  expect(fixture.patches[0]!.key).toBeTruthy();
  const body = JSON.parse(fixture.patches[0]!.body!) as {
    trip: { days: { activities: { title: string }[] }[] };
    expectedRevision: number;
  };
  expect(body.expectedRevision).toBe(1);
  expect(body.trip.days[0]!.activities).toHaveLength(1);
  expect(body.trip.days[0]!.activities[0]!.title).toBe(place.name);
  await page
    .getByRole('button', { name: 'Thêm vào chuyến đi', exact: true })
    .click();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});

test('saved guest gate does not fetch private places', async ({ page }) => {
  await setup(page, false);
  let privateReads = 0;
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/v1/me/places') privateReads++;
  });
  await page.goto('/saved');
  await expect(
    page.getByText('Đăng nhập để xem những địa điểm của bạn.'),
  ).toBeVisible();
  expect(privateReads).toBe(0);
});

test('saved unavailable relationship can be removed without showing hidden catalog', async ({
  page,
}) => {
  await setup(page, true);
  let removed = false;
  await page.route('**/api/v1/me/places', (r) =>
    r.fulfill({
      json: {
        ok: true,
        data: {
          items: [],
          unavailable: removed
            ? []
            : [
                {
                  placeId: place.id,
                  state: {
                    placeId: place.id,
                    saved: true,
                    note: '',
                    revision: 4,
                  },
                },
              ],
        },
      },
    }),
  );
  await page.route(`**/api/v1/me/places/${place.id}`, async (r) => {
    expect(r.request().method()).toBe('PATCH');
    expect(r.request().postDataJSON()).toEqual({
      expectedRevision: 4,
      saved: false,
    });
    removed = true;
    await r.fulfill({ json: { ok: true, data: {} } });
  });
  await page.goto('/saved');
  await expect(
    page.getByRole('heading', { name: 'Địa điểm không còn khả dụng' }),
  ).toBeVisible();
  await expect(page.locator('.explore-card')).toHaveCount(0);
  await page
    .getByRole('button', { name: 'Bỏ lưu địa điểm không khả dụng 1' })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Địa điểm không còn khả dụng' }),
  ).toHaveCount(0);
  expect(removed).toBe(true);
});
