// Explicit, dev-only visual fixture. Not imported by the production entry point.
// No backend, auth provider, AI, database or mutation is used by this preview.
import { createRoot } from 'react-dom/client';
import { App } from '../src/App';
import { initialDraft, withDays } from '../src/trip-draft';
import { images } from '@goease/media';
import type { DestinationDto, TripDto, BudgetSummary } from '@goease/contracts';
import '../src/styles.css';
import '../src/admin.css';
import '../src/brand-theme.css';

if (!import.meta.env.DEV || location.port !== '5185') {
  throw new Error(
    'UI fixtures are available only on the dedicated dev port 5185.',
  );
}
const params = new URLSearchParams(location.search);
const screen = params.get('screen') ?? '/';
const guest = params.get('guest') === '1';
const longText = params.get('long') === '1';
const user = {
  id: 'ffffffffffffffffffffff01',
  displayName: longText
    ? 'Minh Anh cùng những người bạn yêu khám phá Việt Nam'
    : 'Minh Anh',
  email: 'ui-preview@example.invalid',
  emailVerified: false,
  isAdmin: params.get('admin') === '1',
};
const destinations: DestinationDto[] = [
  {
    id: '000000000000000000000004',
    name: 'Hội An',
    timezone: 'Asia/Ho_Chi_Minh',
    summary: 'Phố cổ, hương vị và những khoảng xanh.',
    region: 'central',
    tourismRegion: 'south-central-coast',
  },
  {
    id: '000000000000000000000003',
    name: 'Sa Pa',
    timezone: 'Asia/Ho_Chi_Minh',
    summary: 'Núi rừng và mây trời.',
  },
];
const trip: TripDto = {
  ...withDays({
    ...initialDraft(),
    title: longText
      ? 'Hành trình khám phá Hội An cùng đại gia đình và những người bạn qua những miền di sản Việt Nam'
      : 'Hội An · Những ngày thong thả',
    startDate: '2026-11-10',
    endDate: '2026-11-12',
    destinations: [{ destinationId: destinations[0]!.id, order: 0 }],
    travelers: { totalCount: 4 },
    budget: { ...initialDraft().budget, amountMinor: 10000000 },
  }),
  id: 'ffffffffffffffffffffff02',
  revision: 1,
  destinationName: 'Hội An',
  updatedAt: '2026-10-24T00:00:00.000Z',
  summaryTotals: {
    knownEstimatedMinor: 600000,
    missingCostCount: 2,
    currency: 'VND',
  },
};
trip.days.forEach((day, i) => {
  day.activities = [
    {
      activityId: crypto.randomUUID(),
      order: 0,
      kind: 'visit',
      source: 'manual',
      timezone: 'Asia/Ho_Chi_Minh',
      title: i ? 'Làng rau Trà Quế' : 'Dạo phố cổ Hội An',
      startLocalTime: '09:00',
      endLocalTime: '10:30',
      estimatedCost: {
        amountMinor: i ? null : 600000,
        currency: 'VND',
        basis: 'group_total',
        quantity: 1,
        confidence: 'user_entered',
      },
      notes:
        'Dữ liệu kiểm thử giao diện. Không phải lịch trình hoặc báo giá thật.',
    },
    {
      activityId: crypto.randomUUID(),
      order: 1,
      kind: 'meal',
      source: 'manual',
      timezone: 'Asia/Ho_Chi_Minh',
      title: 'Thưởng thức hương vị địa phương',
      startLocalTime: '12:00',
      endLocalTime: '13:00',
      estimatedCost: {
        amountMinor: null,
        currency: 'VND',
        basis: 'group_total',
        quantity: 1,
        confidence: 'user_entered',
      },
      notes: 'Giá chưa được xác minh.',
    },
  ];
});
const place = {
  id: '100000000000000000000001',
  name: 'Phố cổ Hội An',
  destinationId: destinations[0]!.id,
  destinationName: 'Hội An',
  category: 'culture',
  imageUrl: images.exploreHoian,
  imageCredit: 'Ảnh minh họa tạo bằng AI',
  images: [],
  description:
    'Những mái ngói cũ, sắc đèn lồng và nhịp sống chậm bên dòng Hoài.',
  durationLabel: '2–3 giờ',
  bestTimeLabel: 'Chiều muộn',
  travelLabel: 'Dạo phố',
  tip: 'Đi bộ thong thả và dành thời gian ngắm phố lên đèn.',
  highlights: [],
  price: null,
  referencePrice: null,
  sourceUrl: 'https://hoianworldheritage.org.vn',
};
const budget: BudgetSummary = {
  currency: 'VND',
  knownEstimatedMinor: 600000,
  missingCostCount: 5,
  activityCount: 6,
  perPersonMinor: 150000,
  budgetMinor: 10000000,
  remainingMinor: 9400000,
  usedPercent: 6,
  categories: ['transport', 'lodging', 'meal', 'visit', 'other'].map((key) => ({
    key: key as BudgetSummary['categories'][number]['key'],
    amountMinor: key === 'visit' ? 600000 : 0,
    missingCostCount: key === 'meal' ? 3 : 0,
  })),
};
const response = (data: unknown) =>
  Promise.resolve(Response.json({ ok: true, data }));
const originalFetch = window.fetch.bind(window);
window.fetch = (input, options) => {
  const url = new URL(
    input instanceof Request ? input.url : String(input),
    location.href,
  );
  if (!url.pathname.startsWith('/api/')) return originalFetch(input, options);
  const path = url.pathname.slice('/api/v1'.length);
  // The one POST is a read-only UI estimate fixture. All mutations/providers fail.
  if (path === '/trips/budget-preview') return response({ budget });
  if (options?.method && options.method !== 'GET')
    return Promise.resolve(
      Response.json(
        {
          ok: false,
          error: {
            code: 'UI_PREVIEW_ONLY',
            message: 'Đây là bản kiểm tra UI. Không gửi hoặc lưu dữ liệu thật.',
          },
        },
        { status: 503 },
      ),
    );
  if (path === '/auth/me') return response({ user: guest ? null : user });
  if (path === '/destinations') return response({ items: destinations });
  if (path === '/trips') return response({ items: [trip] });
  if (path === `/trips/${trip.id}`) return response({ trip });
  if (path === '/places') return response({ items: [place] });
  if (path === `/places/${place.id}`) return response({ place });
  if (path === `/me/places/${place.id}`)
    return response({ state: { saved: true, note: '', revision: 1 } });
  if (path === '/admin/catalog/overview')
    return response({
      total: 0,
      draft: 0,
      published: 0,
      archived: 0,
      needsAttention: 0,
      complete: 0,
      located: 0,
      categories: [],
      issues: [],
      places: [],
      mapTruncated: false,
      sources: {
        manual: 0,
        geoapify: 0,
        lastAttempt: null,
        lastSuccess: null,
        lastError: null,
      },
      jobs: { active: 0, succeeded: 0, failed: 0 },
    });
  if (path === '/admin/catalog/settings')
    return response({
      revision: 1,
      defaultDestinationId: null,
      freshnessDays: 30,
      showQualityAlerts: true,
      autoApplyDraftHours: false,
      regions: [],
    });
  if (path === '/admin/catalog/operations')
    return response({
      connected: false,
      schedule: {
        revision: 1,
        enabled: false,
        frequency: 'daily',
        hour: 8,
        minute: 0,
        weekday: 1,
        group: 'mixed',
        nextRunAt: null,
      },
      runs: [],
    });
  if (path.startsWith('/admin/catalog/'))
    return response({ items: [], total: 0, hasMore: false });
  if (path === '/me/profile')
    return response({ user, revision: 1, canChangePassword: true });
  if (path === '/me/places')
    return response({
      items: [{ place, state: { saved: true, note: '', revision: 1 } }],
      unavailable: [],
    });
  if (path.endsWith('/shares')) return response({ items: [] });
  if (path.endsWith('/expenses'))
    return response({
      items: [],
      totalCount: 0,
      hasMore: false,
      offset: 0,
      tripRevision: 1,
      budget,
      actual: {
        amountMinor: 0,
        perPersonMinor: 0,
        remainingMinor: 10000000,
        differenceFromEstimateMinor: -600000,
        categories: budget.categories.map((c) => ({
          key: c.key,
          amountMinor: 0,
        })),
      },
    });
  if (path === '/trips/trash')
    return response({ items: [], hasMore: false, offset: 0 });
  return Promise.resolve(
    Response.json(
      {
        ok: false,
        error: {
          code: 'UI_FIXTURE_MISSING',
          message: 'Chưa có dữ liệu kiểm thử cho màn này.',
        },
      },
      { status: 503 },
    ),
  );
};
// This separate port has no production account/session storage.
localStorage.setItem('goease:onboarding:seen:v1', 'true');
history.replaceState({}, '', screen);
const banner = document.createElement('div');
banner.textContent =
  'XEM UI · DỮ LIỆU KIỂM THỬ · KHÔNG ĐĂNG NHẬP / AI / LƯU THẬT';
banner.style.cssText =
  'padding:7px 12px;background:#123e4b;color:white;text-align:center;font:600 10px/1.5 system-ui;letter-spacing:.04em';
document.body.prepend(banner);
createRoot(document.getElementById('root')!).render(<App />);
