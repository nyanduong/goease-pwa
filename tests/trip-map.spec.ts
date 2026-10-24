import { images } from '@goease/media';
import { test, expect } from '@playwright/test';
import { initialDraft, withDays } from '../client/src/trip-draft';
import type { PlaceDto } from '@goease/contracts';

// Explicit fixtures exercise map rendering independently of external tiles.
test('map markers follow day order, missing places break lines, and empty days stay empty', async ({
  page,
}) => {
  const destinationId = '000000000000000000000004';
  const places = [1, 3].map(
    (n, i) =>
      ({
        id: `10000000000000000000000${n}`,
        destinationId,
        destinationName: 'Hội An',
        name: `Map fixture ${n}`,
        slug: `map-${n}`,
        category: 'culture',
        subtitle: '',
        description: '',
        imageUrl: images.exploreHoian,
        durationLabel: '',
        travelLabel: '',
        bestTimeLabel: '',
        tip: '',
        highlights: [],
        sourceUrl: 'https://www.openstreetmap.org',
        imageCredit: '',
        mapLocation: {
          latitude: 15.877 + i * 0.02,
          longitude: 108.328 + i * 0.01,
          label: 'Fixture area',
          precision: 'area',
          sourceUrl: 'https://www.openstreetmap.org',
          checkedAt: '2026-10-23',
        },
      }) satisfies PlaceDto,
  );
  const draft = withDays({
    ...initialDraft(),
    title: 'Map fixture trip',
    startDate: '2026-11-12',
    endDate: '2026-11-13',
    destinations: [{ destinationId, order: 0 }],
  });
  draft.days[0]!.activities = places.map((p, i) => ({
    activityId: crypto.randomUUID(),
    placeId: p.id,
    title: p.name,
    kind: 'visit' as const,
    timezone: 'Asia/Ho_Chi_Minh' as const,
    order: i,
    notes: '',
    source: 'manual' as const,
    estimatedCost: {
      amountMinor: null,
      currency: 'VND' as const,
      basis: 'group_total' as const,
      quantity: 1,
      confidence: 'user_entered' as const,
    },
  }));
  const trip = { ...draft, id: '200000000000000000000001', revision: 1 };
  let unavailable = false;
  await page.route('https://tile.openstreetmap.org/**', (r) =>
    r.fulfill({
      contentType: 'image/png',
      body: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a6xkAAAAASUVORK5CYII=',
        'base64',
      ),
    }),
  );
  await page.route('**/api/v1/**', (r) => {
    const path = new URL(r.request().url()).pathname.replace('/api/v1', '');
    const ok = (data: unknown) => r.fulfill({ json: { ok: true, data } });
    if (path === '/auth/me')
      return ok({
        user: {
          id: '300000000000000000000001',
          displayName: 'Fixture',
          email: 'map@example.invalid',
          emailVerified: false,
          avatarUrl: null,
        },
      });
    if (path === '/destinations')
      return ok({
        items: [
          { id: destinationId, name: 'Hội An', timezone: 'Asia/Ho_Chi_Minh' },
        ],
      });
    if (path === '/trips') return ok({ items: [trip] });
    if (path === `/trips/${trip.id}`) return ok({ trip });
    const place = places.find((p) => path === `/places/${p.id}`);
    if (place && !(unavailable && place === places[0])) return ok({ place });
    return r.fulfill({ status: 404, json: { ok: false } });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/trips/${trip.id}`);
  await page.getByRole('button', { name: 'Bản đồ', exact: true }).click();
  await expect(page.locator('.trip-map-pin')).toHaveCount(2);
  await expect(page.locator('.leaflet-overlay-pane path')).toHaveCount(1);
  await expect(page.locator('.trip-map-pin').first()).toHaveText('1');
  await page.locator('.trip-map-pin').last().click();
  await expect(page.locator('.trip-map-selected')).toContainText(
    '2. Map fixture 3',
  );
  await page.getByRole('button', { name: 'Xem / chỉnh điểm dừng' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('tab', { name: 'Ngày 2', exact: true }).click();
  await expect(page.locator('.trip-map-canvas')).toHaveCount(0);
  await expect(page.getByText(/Ngày này chưa có điểm dừng/)).toBeVisible();
  unavailable = true;
  await page.getByRole('tab', { name: 'Ngày 1', exact: true }).click();
  await expect(page.locator('.trip-map-pin')).toHaveCount(1);
  await expect(page.locator('.trip-map-pin')).toHaveText('2');
  await expect(page.locator('.leaflet-overlay-pane path')).toHaveCount(0);
  await expect(
    page.getByText('Chưa đặt giờ · Địa điểm không còn hiển thị'),
  ).toBeVisible();
});
