import { confirmAction } from '../confirmation';
import { PlacePhoto } from './place-photo';
import { images } from '@goease/media';
import { DestinationPhoto } from './destination-photo';
import { TripManagement } from './trip-management';
import { TripOffline } from './trip-offline';
import { Sheet } from './journey-sheet';
import { TripExpenses } from './trip-expenses';
import { TripBudget } from './budget-screen';
import { AiPlanner } from './ai-planner';
import { QuickTripSetup } from './quick-trip-setup';
import { ActionMenu, ScreenHeader } from './customer-shell';
import { ActivityCatalogInfo } from './place-planning';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  CalendarDays,
  Check,
  ChevronRight,
  MapPin,
  UsersRound,
  Wallet,
  Utensils,
  Landmark,
  Mountain,
  TreePalm,
  Compass,
  Plus,
  SlidersHorizontal,
  Pencil,
  Trash2,
  Map,
  Sparkles,
} from '../icons';
import {
  shiftTripDays,
  tripLifecycle,
  activityInputSchema,
  tripInputSchema,
  type RescheduleResult,
  type ActivityInput,
  type DestinationDto,
  type PlaceDto,
  type TripDto,
  type TripInput,
} from '@goease/contracts';
import { api } from '../api';
import { moneyText, withDays } from '../trip-draft';
import { placeActivity } from './explore';
import { priceFitsGroup } from '@goease/contracts';

const TripMap = lazy(() =>
  import('./trip-map').then((m) => ({ default: m.TripMap })),
);

const shortDate = (date: string) =>
  date.slice(5).split('-').reverse().join('/');
const tastes = [
  { code: 'food', label: 'Ẩm thực', Icon: Utensils },
  { code: 'culture', label: 'Văn hóa', Icon: Landmark },
  { code: 'nature', label: 'Thiên nhiên', Icon: Mountain },
  { code: 'relaxation', label: 'Nghỉ dưỡng', Icon: TreePalm },
  { code: 'adventure', label: 'Khám phá', Icon: Compass },
] as const;
const paces = [
  { code: 'relaxed', label: 'Thư thả' },
  { code: 'balanced', label: 'Vừa phải' },
  { code: 'active', label: 'Khám phá nhiều' },
] as const;

export function JourneyList({
  trips,
  destinations,
  loading,
  error,
  signedIn,
  onRetry,
  onStart,
  phase,
  onPhase,
  hasMore,
  onMore,
  offset,
  onPrevious,
  onNavigate,
}: {
  trips: TripDto[];
  destinations: DestinationDto[];
  loading: boolean;
  error: string;
  signedIn: boolean;
  onRetry: () => void;
  onStart: () => void;
  phase: string;
  onPhase: (phase: string) => void;
  hasMore: boolean;
  onMore: () => void;
  offset: number;
  onPrevious: () => void;
  onNavigate: (path: string) => void;
}) {
  return (
    <section className="journey-list">
      <ScreenHeader title="Chuyến đi">
        <button
          className="journey-primary screen-create"
          aria-label="Tạo chuyến đi"
          onClick={onStart}
        >
          <Plus size={18} /> Tạo mới
        </button>
        <ActionMenu label="Quản lý danh sách chuyến đi">
          <a className="trip-trash-link" href="/offline.html">
            Bản offline
          </a>
          {signedIn && (
            <button
              className="trip-trash-link"
              onClick={() => onNavigate('/trips/trash')}
            >
              <Trash2 size={17} /> Thùng rác
            </button>
          )}
        </ActionMenu>
      </ScreenHeader>
      {signedIn && (
        <div className="trip-phase-tabs" aria-label="Lọc chuyến đi">
          {Object.entries({
            all: 'Tất cả',
            upcoming: 'Sắp đi',
            ongoing: 'Đang đi',
            completed: 'Đã kết thúc',
          }).map(([value, label]) => (
            <button
              key={value}
              aria-pressed={phase === value}
              onClick={() => onPhase(value)}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      {loading ? (
        <p className="journey-empty" role="status">
          Đang mở những chuyến đi…
        </p>
      ) : error ? (
        <div className="journey-empty" role="alert">
          <p>{error}</p>
          <button onClick={onRetry}>Thử lại</button>
        </div>
      ) : !signedIn ? (
        <div className="journey-empty">
          <h3>Đăng nhập để xem chuyến đi</h3>
          <button
            className="journey-primary"
            onClick={() => onNavigate('/login')}
          >
            Đăng nhập <ArrowRight size={18} />
          </button>
        </div>
      ) : !trips.length ? (
        <div className="journey-empty">
          <Map size={30} />
          <h3>
            {phase === 'all'
              ? 'Chưa có chuyến đi'
              : 'Chưa có chuyến đi trong mục này.'}
          </h3>
          <button className="journey-primary" onClick={onStart}>
            Tạo chuyến đi đầu tiên <ArrowRight size={18} />
          </button>
        </div>
      ) : (
        <>
          <p className="trip-list-count">
            {trips.length} chuyến đi{hasMore ? ' trong trang này' : ''}
          </p>
          <div className="journey-saved-grid">
            {trips.map((trip) => (
              <button
                key={trip.id}
                className="journey-saved-card"
                onClick={() => onNavigate(`/trips/${trip.id}`)}
              >
                <div className="journey-saved-cover">
                  <DestinationPhoto
                    name={trip.destinationName}
                    slug={
                      destinations.find(
                        (d) => d.id === trip.destinations[0]?.destinationId,
                      )?.slug
                    }
                  />
                  <span>
                    <MapPin size={12} />
                    {trip.destinationName}
                  </span>
                </div>
                <div className="journey-saved-copy">
                  <small>
                    {
                      {
                        upcoming: 'Sắp đi',
                        ongoing: 'Đang đi',
                        completed: 'Đã kết thúc',
                      }[tripLifecycle(trip)]
                    }
                  </small>
                  <h3>{trip.title}</h3>
                  <p>
                    <CalendarDays size={14} />
                    {shortDate(trip.startDate)} – {shortDate(trip.endDate)}
                    <span>·</span>
                    {trip.travelers.totalCount} người
                  </p>
                  <footer>
                    <span>
                      {trip.days.length} ngày ·{' '}
                      {trip.days.reduce((n, d) => n + d.activities.length, 0)}{' '}
                      điểm dừng
                    </span>
                    <ArrowRight size={18} />
                  </footer>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
      {offset > 0 && (
        <button
          className="journey-outline"
          disabled={loading}
          onClick={onPrevious}
        >
          Trang trước
        </button>
      )}
      {hasMore && !loading && !error && (
        <button className="journey-outline" onClick={onMore}>
          Trang tiếp theo
        </button>
      )}
    </section>
  );
}

export function TripWorkspace({
  draft,
  onChange,
  destinations,
  loaded,
  busy: savingBusy,
  saveState,
  message,
  onSave,
  onBack,
  onOpenGoe,
  onNavigate,
  onReload,
}: {
  draft: TripInput;
  onChange: (value: TripInput) => void;
  destinations: DestinationDto[];
  loaded: TripDto | null;
  busy: boolean;
  saveState: 'dirty' | 'saving' | 'saved' | 'error';
  message: string;
  onOpenGoe: (day: number) => void;
  onNavigate: (path: string) => void;
  onReload: () => void;
  onSave: (value?: TripInput) => void;
  onBack: () => void;
}) {
  const [rescheduling, setRescheduling] = useState(false);
  const busy = savingBusy || rescheduling;
  const [dateNotice, setDateNotice] = useState('');
  const latestDraft = useRef(draft);
  latestDraft.current = draft;
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  async function changeDates(startDate: string, endDate: string) {
    if (rescheduling) throw new Error('Goe đang kiểm tra lịch.');
    if (!draft.days.some((d) => d.activities.length))
      return shiftTripDays(draft, startDate, endDate, () =>
        crypto.randomUUID(),
      );
    const snapshot = JSON.stringify(draft);
    setRescheduling(true);
    try {
      const result = await api<RescheduleResult>('/trips/reschedule-dates', {
        method: 'POST',
        body: JSON.stringify({
          trip: draft,
          startDate,
          endDate,
          ...(loaded
            ? { tripId: loaded.id, expectedRevision: loaded.revision }
            : {}),
        }),
        signal: AbortSignal.timeout(20000),
      });
      if (!mounted.current || JSON.stringify(latestDraft.current) !== snapshot)
        throw new Error('Lịch đã thay đổi trong lúc kiểm tra. Hãy thử lại.');
      setDateNotice(
        result.changes.length
          ? `Goe đã xếp lại lịch: ${result.changes.join('; ')}. Giờ chưa xác minh vẫn chưa thể xác nhận.`
          : 'Đã đổi ngày và kiểm tra giờ hoạt động hiện có. Giờ chưa xác minh vẫn chưa thể xác nhận.',
      );
      return result.trip;
    } finally {
      if (mounted.current) setRescheduling(false);
    }
  }
  const [costView, setCostView] = useState<'estimate' | 'actual'>('estimate');
  const [step, setStep] = useState(
    draft.days.some((d) => d.activities.length) ? 2 : 1,
  );
  const [tab, setTab] = useState<'schedule' | 'map' | 'cost' | 'summary'>(
    new URLSearchParams(location.search).get('view') === 'cost'
      ? 'cost'
      : 'schedule',
  );
  const [selectedDay, setSelectedDay] = useState(
    Math.max(
      0,
      Math.min(
        30,
        Number(new URLSearchParams(location.search).get('day')) || 0,
      ),
    ),
  );
  const [settings, setSettings] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [datesConfirmed, setDatesConfirmed] = useState(Boolean(loaded));
  const [keeping, setKeeping] = useState(false);
  const [departure, setDeparture] = useState('');
  const [replacing, setReplacing] = useState<ActivityInput | null>(null);
  const [undoDay, setUndoDay] = useState<TripInput['days'][number] | null>(
    null,
  );
  const [field, setField] = useState<
    'destination' | 'dates' | 'travelers' | 'budget' | null
  >(null);
  const [pending, setPending] = useState(draft);
  const [editing, setEditing] = useState<ActivityInput | null>(null);
  const [adding, setAdding] = useState(false);
  const [suggestions, setSuggestions] = useState(false);
  const [places, setPlaces] = useState<PlaceDto[]>([]);
  const [placesStatus, setPlacesStatus] = useState<
    'idle' | 'loading' | 'ready' | 'error'
  >('idle');
  const [placesRetry, setPlacesRetry] = useState(0);
  const [error, setError] = useState('');
  const destination = destinations.find(
    (d) => d.id === draft.destinations[0]?.destinationId,
  );
  const destinationName =
    destination?.name ?? loaded?.destinationName ?? 'Chuyến đi của bạn';
  const dayIndex = Math.min(selectedDay, Math.max(0, draft.days.length - 1));
  const day = draft.days[dayIndex];
  const [stopPhotos, setStopPhotos] = useState<Record<string, PlaceDto>>({});
  const [stopPhotosFailed, setStopPhotosFailed] = useState(false);
  const [stopPhotosLoading, setStopPhotosLoading] = useState(false);
  const [stopPhotosRetry, setStopPhotosRetry] = useState(0);
  const stopPhotoIds = JSON.stringify([
    ...new Set(
      day?.activities.flatMap((a) => (a.placeId ? [a.placeId] : [])) ?? [],
    ),
  ]);
  const stopDestinationId = day?.destinationId;
  useEffect(() => {
    let active = true;
    setStopPhotos({});
    setStopPhotosFailed(false);
    setStopPhotosLoading(true);
    void Promise.all(
      (JSON.parse(stopPhotoIds) as string[]).map(async (id) => {
        try {
          const { place } = await api<{ place: PlaceDto }>(`/places/${id}`);
          return {
            id,
            place: place.destinationId === stopDestinationId ? place : null,
          };
        } catch {
          return { id, place: null };
        }
      }),
    ).then((results) => {
      if (!active) return;
      setStopPhotos(
        Object.fromEntries(
          results.flatMap(({ id, place }) => (place ? [[id, place]] : [])),
        ),
      );
      setStopPhotosFailed(results.some(({ place }) => !place));
      setStopPhotosLoading(false);
    });
    return () => {
      active = false;
    };
  }, [stopPhotoIds, stopDestinationId, stopPhotosRetry]);
  const isSetup = !loaded && step === 1;
  const showSettings = settings;
  const allActivities = draft.days.flatMap((d) => d.activities);
  const dayRefs = useRef<(HTMLButtonElement | null)[]>([]);
  useEffect(() => {
    if (!suggestions) return;
    let active = true;
    void api<{ items: PlaceDto[] }>(
      `/places?limit=30&destinationId=${draft.destinations[0]?.destinationId ?? ''}`,
    )
      .then((r) => {
        if (active) {
          setPlaces(r.items);
          setPlacesStatus('ready');
        }
      })
      .catch(() => {
        if (active) setPlacesStatus('error');
      });
    return () => {
      active = false;
    };
  }, [suggestions, placesRetry, draft.destinations]);
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (saveState !== 'saved' && (draft.title || allActivities.length))
        e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [saveState, draft.title, allActivities.length]);
  function changeActivities(activities: ActivityInput[]) {
    if (!day) return;
    setUndoDay(null);
    onChange({
      ...draft,
      days: draft.days.map((d) =>
        d.dayId === day.dayId
          ? { ...d, activities: activities.map((a, i) => ({ ...a, order: i })) }
          : d,
      ),
    });
  }
  function openField(value: NonNullable<typeof field>) {
    setPending(structuredClone(draft));
    setError('');
    setField(value);
  }
  async function applyField() {
    if (busy) return;
    const count =
      (Date.parse(pending.endDate) - Date.parse(pending.startDate)) / 86400000 +
      1;
    if (!pending.destinations.length && field === 'destination') {
      setError('Chọn điểm đến cho chuyến đi.');
      return;
    }
    if (
      field === 'dates' &&
      (!Number.isInteger(count) || count < 1 || count > 31)
    ) {
      setError('Chọn khoảng thời gian hợp lệ, từ 1 đến 31 ngày.');
      return;
    }
    if (
      field === 'travelers' &&
      (!Number.isInteger(pending.travelers.totalCount) ||
        pending.travelers.totalCount < 1 ||
        pending.travelers.totalCount > 1000)
    ) {
      setError('Số người từ 1 đến 1.000.');
      return;
    }
    if (
      field === 'budget' &&
      pending.budget.amountMinor !== null &&
      (!Number.isSafeInteger(pending.budget.amountMinor) ||
        pending.budget.amountMinor < 0 ||
        pending.budget.amountMinor > 1e12)
    ) {
      setError('Ngân sách phải là số nguyên từ 0 đến 1.000.000.000.000 ₫.');
      return;
    }
    let next: TripInput;
    try {
      next =
        field === 'dates'
          ? await changeDates(pending.startDate, pending.endDate)
          : withDays(pending);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không thể đổi ngày.');
      return;
    }
    const changedDestination =
      draft.destinations[0]?.destinationId !==
      next.destinations[0]?.destinationId;
    if (
      allActivities.length &&
      (changedDestination ||
        draft.days.some(
          (d) =>
            d.activities.length && !next.days.some((n) => n.dayId === d.dayId),
        ))
    ) {
      if (
        !(await confirmAction(
          'Thay đổi này sẽ bỏ điểm dừng của địa điểm hoặc ngày không còn trong chuyến. Tiếp tục?',
          {
            title: 'Thay đổi lịch trình?',
            confirmLabel: 'Áp dụng thay đổi',
            cancelLabel: 'Giữ lịch hiện tại',
            tone: 'warning',
          },
        ))
      )
        return;
      if (changedDestination)
        next = {
          ...next,
          days: next.days.map((d) => ({ ...d, activities: [] })),
        };
    }
    onChange(next);
    setUndoDay(null);
    if (field === 'dates') setDatesConfirmed(true);
    setField(null);
    setError('');
  }
  function nextStep() {
    const next = withDays({
      ...draft,
      title: draft.title.trim() || `Hành trình ${destinationName}`,
    });
    if (!tripInputSchema.safeParse(next).success) {
      setError(
        'Kiểm tra điểm đến, ngày đi và số người. Ngân sách có thể để trống.',
      );
      return;
    }
    onChange(next);
    setError('');
    setStep(2);
    setSuggestions(true);
    setPlacesStatus('loading');
    window.scrollTo(0, 0);
  }
  function addBlank(kind: ActivityInput['kind'] = 'custom') {
    if (!day || day.activities.length >= 50 || allActivities.length >= 300)
      return;
    setEditing({
      activityId: crypto.randomUUID(),
      kind,
      title: '',
      timezone: 'Asia/Ho_Chi_Minh',
      order: day.activities.length,
      notes: '',
      estimatedCost: {
        amountMinor: null,
        currency: 'VND',
        basis: 'group_total',
        quantity: 1,
        confidence: 'user_entered',
      },
      source: 'manual',
    });
    setAdding(true);
    setError('');
  }
  function submitActivity() {
    const parsed = activityInputSchema.safeParse(editing);
    if (!parsed.success || !day) {
      setError(
        'Nhập tên hoạt động; nếu có giờ, nhập cả giờ bắt đầu và kết thúc hợp lệ. Chi phí là số nguyên không âm.',
      );
      return;
    }
    changeActivities(
      adding
        ? [...day.activities, parsed.data]
        : day.activities.map((a) =>
            a.activityId === parsed.data.activityId ? parsed.data : a,
          ),
    );
    setEditing(null);
    setError('');
  }
  function move(index: number, direction: number) {
    if (!day) return;
    const values = [...day.activities];
    const target = index + direction;
    if (target < 0 || target >= values.length) return;
    [values[index], values[target]] = [values[target]!, values[index]!];
    changeActivities(values);
  }
  const atLimit =
    !day || day.activities.length >= 50 || allActivities.length >= 300;
  const candidates = places
    .filter((p) => p.destinationId === destination?.id)
    .sort(
      (a, b) =>
        Number(draft.preferences.interestCodes.includes(b.category)) -
        Number(draft.preferences.interestCodes.includes(a.category)),
    );
  // A quick swap keeps the existing time slot and all other stops unchanged.
  // Longer visits are excluded, not silently squeezed into an impossible slot.
  const replacements = candidates.filter(
    (p) =>
      p.id !== replacing?.placeId &&
      !allActivities.some((a) => a.placeId === p.id) &&
      (!replacing?.startLocalTime ||
        !replacing.endLocalTime ||
        (p.planning &&
          p.planning.durationMinutes <=
            Number(replacing.endLocalTime.slice(0, 2)) * 60 +
              Number(replacing.endLocalTime.slice(3)) -
              (Number(replacing.startLocalTime.slice(0, 2)) * 60 +
                Number(replacing.startLocalTime.slice(3))))),
  );
  function keepTrip() {
    setDeparture(datesConfirmed ? draft.startDate : '');
    setKeeping(true);
    setError('');
  }
  const summaryRows = [
    {
      code: 'destination',
      label: 'Điểm đến',
      value: destination?.name ?? 'Chọn nơi bạn muốn đến',
      Icon: MapPin,
    },
    {
      code: 'dates',
      label: 'Thời gian',
      value: datesConfirmed
        ? `${shortDate(draft.startDate)} – ${shortDate(draft.endDate)}/${draft.endDate.slice(0, 4)} · ${Math.max(1, draft.days.length)} ngày`
        : `Chưa chốt ngày đi · ${draft.days.length} ngày`,
      Icon: CalendarDays,
    },
    {
      code: 'travelers',
      label: 'Đi cùng',
      value: `${draft.travelers.totalCount} người`,
      Icon: UsersRound,
    },
    {
      code: 'budget',
      label: 'Ngân sách cả nhóm',
      value:
        draft.budget.amountMinor === null
          ? 'Chưa xác định'
          : moneyText(draft.budget.amountMinor),
      Icon: Wallet,
    },
  ] as const;
  const settingsContent = (
    <>
      <div className="journey-summary-fields">
        {summaryRows.map(({ code, label, value, Icon }) => (
          <button key={code} onClick={() => openField(code)}>
            <Icon size={24} />
            <span>
              <small>{label}</small>
              <strong>{value}</strong>
            </span>
            <ChevronRight size={17} />
          </button>
        ))}
      </div>
      <section className="journey-tastes">
        <h2>Sở thích</h2>
        <div>
          {tastes
            .filter(
              ({ code }) =>
                code !== 'adventure' ||
                settings ||
                draft.preferences.interestCodes.includes('adventure'),
            )
            .map(({ code, label, Icon }) => (
              <button
                key={code}
                aria-pressed={draft.preferences.interestCodes.includes(code)}
                onClick={() =>
                  onChange({
                    ...draft,
                    preferences: {
                      ...draft.preferences,
                      interestCodes: draft.preferences.interestCodes.includes(
                        code,
                      )
                        ? draft.preferences.interestCodes.filter(
                            (c) => c !== code,
                          )
                        : [...draft.preferences.interestCodes, code],
                    },
                  })
                }
              >
                <Icon size={21} />
                <span>{label}</span>
                {draft.preferences.interestCodes.includes(code) && (
                  <Check size={17} />
                )}
              </button>
            ))}
        </div>
      </section>
      <section className="journey-pace">
        <h2>Nhịp độ</h2>
        <div className="journey-segment">
          {paces.map(({ code, label }) => (
            <button
              key={code}
              aria-pressed={draft.preferences.pace === code}
              onClick={() =>
                onChange({
                  ...draft,
                  preferences: { ...draft.preferences, pace: code },
                })
              }
            >
              {label}
            </button>
          ))}
        </div>
        <p className="journey-sheet-note">
          Goe gợi ý tối đa{' '}
          {{ relaxed: 4, balanced: 5, active: 6 }[draft.preferences.pace]} điểm
          mỗi ngày theo nhịp này. Bạn vẫn có thể tự thêm điểm sau.
        </p>
      </section>
    </>
  );
  return (
    <section className={`journey-workspace ${isSetup ? 'journey-setup' : ''}`}>
      <header className="journey-top">
        <button
          aria-label="Quay lại"
          disabled={generating || busy}
          onClick={() => {
            if (settings) setSettings(false);
            else if (tab === 'cost' || tab === 'summary') setTab('schedule');
            else if (!loaded && step > 1) {
              setSettings(true);
              setError('');
            } else onBack();
          }}
        >
          <ArrowLeft size={22} />
        </button>
        <div>
          <strong>
            {tab === 'summary' && !showSettings
              ? 'Tổng kết chuyến đi'
              : tab === 'cost' && !showSettings
                ? 'Chi phí chuyến đi'
                : loaded
                  ? destinationName
                  : 'Tạo chuyến đi'}
          </strong>
          {loaded && tab !== 'cost' && (
            <small>
              {shortDate(draft.startDate)}–{shortDate(draft.endDate)} ·{' '}
              {draft.travelers.totalCount} người
            </small>
          )}
        </div>
        {!isSetup ? (
          <button
            aria-label="Thông tin chuyến đi"
            onClick={() => setSettings((v) => !v)}
          >
            <SlidersHorizontal size={21} />
          </button>
        ) : (
          <span className="quick-header-note">Cùng Goe</span>
        )}
      </header>
      <fieldset className="journey-fieldset" disabled={busy}>
        {!loaded && !showSettings && (
          <ol className="planning-steps" aria-label="Tiến trình tạo chuyến">
            {['Thông tin', 'Lịch trình', 'Lưu chuyến'].map((label, index) => (
              <li
                key={label}
                aria-current={
                  (isSetup ? 0 : keeping ? 2 : 1) === index ? 'step' : undefined
                }
                className={
                  (isSetup ? 0 : keeping ? 2 : 1) > index ? 'is-complete' : ''
                }
              >
                <span>{index + 1}</span>
                <strong>{label}</strong>
              </li>
            ))}
          </ol>
        )}
        {isSetup && !settings ? (
          <QuickTripSetup
            draft={draft}
            destinations={destinations}
            onChange={onChange}
            onBusyChange={setGenerating}
            onManual={nextStep}
            onPreview={(value) => {
              onChange(value);
              setStep(2);
              setTab('schedule');
              window.scrollTo(0, 0);
            }}
          />
        ) : showSettings ? (
          <>
            <h1 className="journey-intro-title">Thông tin chuyến đi</h1>
            {settingsContent}
            {loaded && (
              <label className="journey-field">
                Tên chuyến đi
                <input
                  value={draft.title}
                  maxLength={120}
                  onChange={(e) =>
                    onChange({ ...draft, title: e.target.value })
                  }
                />
              </label>
            )}
            {loaded && (
              <TripManagement
                trip={loaded}
                unsaved={saveState !== 'saved'}
                onNavigate={onNavigate}
                onReload={onReload}
              />
            )}
            {loaded && saveState !== 'saved' && (
              <button
                className="journey-primary"
                disabled={busy}
                onClick={() => onSave()}
              >
                Lưu thay đổi <Check size={18} />
              </button>
            )}

            <details className="journey-ai-options">
              <summary>Lập lại lịch với Goe</summary>
              <AiPlanner
                draft={withDays({
                  ...draft,
                  title: draft.title.trim() || `Hành trình ${destinationName}`,
                })}
                tripId={loaded?.id}
                revision={loaded?.revision}
                onApply={(value) => {
                  onChange(value);
                  setUndoDay(null);
                  setSettings(false);
                  setStep(2);
                  setTab('schedule');
                }}
              />
            </details>
            <button
              className="journey-outline journey-manual-choice"
              onClick={() => setSettings(false)}
            >
              Về lịch trình
              <ArrowRight size={19} />
            </button>
            {!loaded && (
              <p className="journey-caption">
                Chọn điểm dừng từ gợi ý của GoEase, rồi tự xếp lịch.
              </p>
            )}
          </>
        ) : (
          <>
            {!loaded && (
              <div className="quick-result-intro">
                <span className="journey-eyebrow">
                  {draft.generationMode === 'ai'
                    ? 'Lịch gợi ý của Goe'
                    : 'Bản nháp'}
                </span>
                <h1>
                  {destinationName} · {draft.days.length} ngày
                </h1>
                <p>
                  {draft.travelers.totalCount} người ·{' '}
                  {datesConfirmed
                    ? `${shortDate(draft.startDate)}–${shortDate(draft.endDate)}`
                    : 'Chưa chốt ngày đi'}
                </p>
                <details>
                  <summary>Lưu ý về lịch trình</summary>
                  <p>
                    Lịch dành cho ngày trọn vẹn; bạn có thể đổi giờ theo lúc đến
                    và về. Thời gian đi đường là ước tính. Giá chưa có được giữ
                    là “Chưa rõ”; chỗ ở và di chuyển chưa thêm không nằm trong
                    chi phí dự kiến. Lịch này chưa được lưu vào tài khoản.
                  </p>
                </details>
              </div>
            )}
            <>
              {loaded && tab !== 'cost' && tab !== 'summary' && (
                <div className="journey-overview">
                  <h1>{loaded.title}</h1>
                  <p>
                    {draft.days.length} ngày · {allActivities.length} điểm dừng{' '}
                    {saveState === 'saved' && (
                      <span className="trip-saved-label">
                        <Check size={13} /> Đã lưu
                      </span>
                    )}
                  </p>
                  <div className="journey-cover">
                    <DestinationPhoto
                      name={destinationName}
                      slug={destination?.slug}
                    />
                  </div>
                </div>
              )}
              <div
                className="journey-segment journey-view-tabs"
                aria-label="Xem hành trình"
              >
                {(
                  [
                    { code: 'schedule', label: 'Lịch trình' },
                    { code: 'map', label: 'Bản đồ' },
                    { code: 'cost', label: 'Chi phí' },
                    ...(loaded
                      ? [{ code: 'summary' as const, label: 'Tổng kết' }]
                      : []),
                  ] as const
                ).map(({ code, label }) => (
                  <button
                    key={code}
                    aria-pressed={tab === code}
                    onClick={() => {
                      if (code === 'cost') setCostView('estimate');
                      setTab(code);
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </>
            {tab === 'summary' && loaded ? (
              <div className="journey-summary">
                <h1>Tổng kết hành trình</h1>
                <p>
                  {loaded.title} · {loaded.days.length} ngày ·{' '}
                  {loaded.travelers.totalCount} người ·{' '}
                  {loaded.days.reduce((n, d) => n + d.activities.length, 0)}{' '}
                  điểm dừng
                </p>
                <p>
                  {tripLifecycle(loaded) === 'completed'
                    ? 'Chuyến đi đã kết thúc theo ngày đã lưu.'
                    : 'Tổng kết tạm thời theo dữ liệu đã lưu.'}
                </p>
                <TripExpenses
                  tripId={loaded.id}
                  tripRevision={loaded.revision}
                  unsaved={saveState !== 'saved'}
                  summaryOnly
                />
              </div>
            ) : tab === 'cost' ? (
              <div className="journey-budget-view">
                {loaded && (
                  <div
                    className="cost-view-switch"
                    role="group"
                    aria-label="Loại chi phí"
                  >
                    <button
                      aria-pressed={costView === 'estimate'}
                      onClick={() => setCostView('estimate')}
                    >
                      Dự kiến
                    </button>
                    <button
                      aria-pressed={costView === 'actual'}
                      onClick={() => setCostView('actual')}
                    >
                      Đã chi
                    </button>
                  </div>
                )}
                {costView === 'estimate' || !loaded ? (
                  <TripBudget
                    destinationSlug={destination?.slug}
                    draft={draft}
                    destinationName={destinationName}
                    onAdjust={() => openField('budget')}
                    onReview={() => {
                      const index = draft.days.findIndex((d) =>
                        d.activities.some(
                          (a) =>
                            a.estimatedCost.amountMinor === null ||
                            !priceFitsGroup(
                              a.estimatedCost,
                              draft.travelers.totalCount,
                            ),
                        ),
                      );
                      setTab('schedule');
                      if (index >= 0) {
                        setSelectedDay(index);
                        setEditing(
                          structuredClone(
                            draft.days[index]!.activities.find(
                              (a) =>
                                a.estimatedCost.amountMinor === null ||
                                !priceFitsGroup(
                                  a.estimatedCost,
                                  draft.travelers.totalCount,
                                ),
                            )!,
                          ),
                        );
                        setAdding(false);
                      } else {
                        setSuggestions(true);
                        setPlacesStatus('loading');
                      }
                    }}
                  />
                ) : loaded ? (
                  <section aria-label="Ghi lại chi tiêu">
                    <details className="expense-help">
                      <summary>Ghi chi tiêu là tùy chọn</summary>
                      <p>
                        Tùy chọn: ghi những khoản bạn đã trả để tiện xem lại.
                        Bạn không cần ghi chi tiêu để tiếp tục chuyến đi.
                      </p>
                    </details>
                    <TripExpenses
                      key={loaded.id}
                      tripId={loaded.id}
                      tripRevision={loaded.revision}
                      unsaved={saveState !== 'saved'}
                    />
                  </section>
                ) : (
                  <p className="expense-empty">
                    Lưu chuyến đi trước để ghi nhận chi tiêu thực tế.
                  </p>
                )}
              </div>
            ) : (
              <>
                <div
                  className="journey-day-tabs"
                  role="tablist"
                  aria-label="Ngày trong chuyến"
                >
                  {draft.days.map((d, i) => (
                    <button
                      key={d.dayId}
                      ref={(el) => {
                        dayRefs.current[i] = el;
                      }}
                      role="tab"
                      id={`journey-tab-${i}`}
                      aria-controls="journey-day-panel"
                      aria-selected={dayIndex === i}
                      tabIndex={dayIndex === i ? 0 : -1}
                      onClick={() => setSelectedDay(i)}
                      onKeyDown={(e) => {
                        let next: number;
                        if (e.key === 'ArrowRight')
                          next = (i + 1) % draft.days.length;
                        else if (e.key === 'ArrowLeft')
                          next =
                            (i - 1 + draft.days.length) % draft.days.length;
                        else if (e.key === 'Home') next = 0;
                        else if (e.key === 'End') next = draft.days.length - 1;
                        else return;
                        e.preventDefault();
                        setSelectedDay(next);
                        dayRefs.current[next]?.focus();
                      }}
                    >
                      Ngày {i + 1}
                    </button>
                  ))}
                </div>
                <div
                  id="journey-day-panel"
                  role="tabpanel"
                  aria-labelledby={`journey-tab-${dayIndex}`}
                >
                  <div className="journey-day-heading">
                    <h2>{day?.activities.length ?? 0} điểm dừng</h2>
                    <span>
                      {day && datesConfirmed ? shortDate(day.date) : ''}
                    </span>
                  </div>
                  {tab === 'map' ? (
                    <Suspense fallback={<p role="status">Đang mở bản đồ…</p>}>
                      <TripMap
                        key={day?.dayId ?? 'empty'}
                        activities={day?.activities ?? []}
                        destinationName={destinationName}
                        destinationId={day?.destinationId}
                        onEdit={(a) => {
                          const original = day?.activities.find(
                            (v) => v.activityId === a.activityId,
                          );
                          if (original) setEditing(structuredClone(original));
                        }}
                      />
                    </Suspense>
                  ) : (
                    <>
                      <div className="journey-timeline" key={day?.dayId}>
                        {stopPhotosFailed && (
                          <p role="status">
                            Chưa tải được ảnh của một số địa điểm.{' '}
                            <button
                              type="button"
                              onClick={() => setStopPhotosRetry((v) => v + 1)}
                            >
                              Thử tải lại ảnh
                            </button>
                          </p>
                        )}
                        {day?.activities.map((a, i) => (
                          <article className="journey-stop" key={a.activityId}>
                            <span className="journey-stop-dot" />
                            <button
                              className="journey-stop-open"
                              onClick={() => {
                                setEditing(structuredClone(a));
                                setAdding(false);
                                setError('');
                              }}
                            >
                              <span className="journey-stop-photo">
                                {a.placeId && stopPhotos[a.placeId] ? (
                                  <PlacePhoto
                                    place={stopPhotos[a.placeId]!}
                                    compact
                                  />
                                ) : (
                                  <span className="journey-stop-photo-empty">
                                    {a.placeId && stopPhotosLoading
                                      ? 'Đang tải ảnh…'
                                      : 'Chưa có ảnh'}
                                  </span>
                                )}
                              </span>
                              <span>
                                <small>
                                  {a.startLocalTime ?? 'Chưa đặt giờ'}
                                </small>
                                <strong>{a.title}</strong>
                                {a.estimatedCost.reference && (
                                  <small>
                                    {!priceFitsGroup(
                                      a.estimatedCost,
                                      draft.travelers.totalCount,
                                    )
                                      ? 'Giá chưa áp dụng cho số người này'
                                      : `${a.estimatedCost.reference.bundle ? 'Vé gói: ' : ''}${moneyText(a.estimatedCost.amountMinor!)} / ${a.estimatedCost.basis === 'per_person' ? 'người' : 'nhóm'} · Tham khảo`}
                                  </small>
                                )}
                                <small>
                                  {(a.source === 'ai'
                                    ? a.notes.split('\n')[0]
                                    : a.notes) ||
                                    (a.endLocalTime
                                      ? `Đến ${a.endLocalTime}`
                                      : 'Chạm để thêm chi tiết')}
                                </small>
                              </span>
                            </button>
                            <ActionMenu label={`Thao tác với ${a.title}`}>
                              <div className="quick-stop-actions">
                                <button
                                  aria-label={`Đổi ${a.title}`}
                                  onClick={() => {
                                    setReplacing(a);
                                    setSuggestions(true);
                                    setPlacesStatus('loading');
                                  }}
                                >
                                  Đổi địa điểm
                                </button>
                                <button
                                  aria-label={`Bỏ ${a.title}`}
                                  onClick={() => {
                                    changeActivities(
                                      day.activities.filter(
                                        (v) => v.activityId !== a.activityId,
                                      ),
                                    );
                                    setUndoDay(structuredClone(day));
                                  }}
                                >
                                  Bỏ khỏi ngày này
                                </button>
                              </div>
                              <div className="journey-stop-order">
                                <button
                                  aria-label={`Đưa ${a.title} lên`}
                                  disabled={i === 0}
                                  onClick={() => move(i, -1)}
                                >
                                  <ArrowUp size={16} /> Đưa lên
                                </button>
                                <button
                                  aria-label={`Đưa ${a.title} xuống`}
                                  disabled={i === day.activities.length - 1}
                                  onClick={() => move(i, 1)}
                                >
                                  <ArrowDown size={16} /> Đưa xuống
                                </button>
                              </div>
                            </ActionMenu>
                            {a.startLocalTime &&
                              day.activities.some(
                                (other, j) =>
                                  j !== i &&
                                  other.startLocalTime &&
                                  other.endLocalTime &&
                                  a.endLocalTime &&
                                  a.startLocalTime! < other.endLocalTime &&
                                  a.endLocalTime > other.startLocalTime,
                              ) && (
                                <p className="journey-overlap">
                                  Giờ đang trùng với một điểm dừng khác.
                                </p>
                              )}
                          </article>
                        ))}
                      </div>
                      {undoDay && undoDay.dayId === day?.dayId && (
                        <div className="quick-undo" role="status">
                          Đã chỉnh lịch.{' '}
                          <button
                            onClick={() => {
                              changeActivities(undoDay.activities);
                            }}
                          >
                            Hoàn tác
                          </button>
                        </div>
                      )}
                      {!day?.activities.length && (
                        <div className="journey-empty">
                          <Sparkles size={24} />
                          <h3>Chưa có điểm dừng</h3>
                        </div>
                      )}
                      <button
                        className="journey-add-stop"
                        disabled={atLimit}
                        onClick={() => {
                          setReplacing(null);
                          setSuggestions(true);
                          setPlacesStatus('loading');
                        }}
                      >
                        <Plus size={17} />
                        Thêm điểm dừng
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
            {!loaded && (
              <div className="quick-keep-bar">
                <button className="journey-primary" onClick={keepTrip}>
                  Giữ lịch này <Check size={18} />
                </button>
                <small>Bạn luôn có thể sửa tiếp sau khi lưu.</small>
              </div>
            )}
            {loaded && (
              <>
                {tab !== 'cost' && (
                  <button
                    className="journey-chat-link"
                    onClick={() => onOpenGoe(dayIndex)}
                  >
                    <img src={images.goeMascot} alt="Goe" />
                    <span>Hỏi Goe về chuyến này</span>
                    <ChevronRight size={18} />
                  </button>
                )}
                {tab !== 'cost' && (
                  <>
                    <details className="journey-note-disclosure">
                      <summary>
                        <Pencil size={17} /> Ghi chú chuyến đi
                      </summary>
                      <label className="journey-field journey-trip-notes">
                        <span className="sr-only">Ghi chú chuyến đi</span>
                        <textarea
                          aria-label="Ghi chú chuyến đi"
                          value={draft.notes}
                          maxLength={2000}
                          placeholder="Điều bạn muốn nhớ cho chuyến đi này…"
                          onChange={(e) =>
                            onChange({ ...draft, notes: e.target.value })
                          }
                        />
                      </label>
                    </details>
                  </>
                )}
                {saveState !== 'saved' && (
                  <div className="journey-save-bar">
                    <span role="status" aria-label="Trạng thái lưu">
                      {saveState === 'saving'
                        ? 'Đang lưu…'
                        : saveState === 'error'
                          ? 'Lưu thất bại'
                          : 'Chưa lưu thay đổi'}
                    </span>
                    <button
                      className="journey-primary"
                      onClick={() => onSave()}
                      disabled={busy}
                    >
                      Lưu thay đổi <Check size={16} />
                    </button>
                  </div>
                )}
                {tab === 'schedule' && (
                  <details className="journey-preparation">
                    <summary>Chuẩn bị trước khi đi</summary>
                    <p>
                      Lịch đã lưu chưa có nghĩa là đã đặt dịch vụ. Kiểm tra từng
                      việc trước ngày khởi hành.
                    </p>
                    <div className="journey-preparation-actions">
                      <button onClick={() => setTab('cost')}>
                        Kiểm tra các khoản chi phí
                      </button>
                      {!allActivities.some((a) => a.kind === 'lodging') && (
                        <button onClick={() => addBlank('lodging')}>
                          Bổ sung chỗ ở vào ngày {dayIndex + 1}
                        </button>
                      )}
                      {!allActivities.some((a) => a.kind === 'transport') && (
                        <button onClick={() => addBlank('transport')}>
                          Bổ sung di chuyển vào ngày {dayIndex + 1}
                        </button>
                      )}
                      <button onClick={() => setTab('map')}>
                        Kiểm tra vị trí và đường đi
                      </button>
                    </div>
                    <p>
                      Chạm từng điểm dừng để ghi quán cụ thể, địa chỉ và giá.
                      Giờ mở cửa, thời tiết và thời gian đi đường cần kiểm tra
                      lại.
                    </p>
                    <TripOffline
                      id={loaded.id}
                      unsaved={saveState !== 'saved'}
                    />
                  </details>
                )}
              </>
            )}
          </>
        )}
      </fieldset>
      {rescheduling && (
        <p role="status">Goe đang kiểm tra giờ mở cửa và xếp lại lịch…</p>
      )}
      {dateNotice && (
        <p className="journey-notice" role="status">
          {dateNotice}
        </p>
      )}
      {error && !field && !editing && (
        <p className="journey-error" role="alert">
          {error}
        </p>
      )}
      {message && !keeping && (
        <p
          className={saveState === 'error' ? 'journey-error' : 'journey-notice'}
          role={saveState === 'error' ? 'alert' : 'status'}
        >
          {message}
        </p>
      )}
      {keeping && (
        <Sheet
          title="Giữ chuyến đi của bạn"
          onClose={() => {
            if (!busy) setKeeping(false);
          }}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (busy) return;
              try {
                if (!departure) {
                  setError('Chọn ngày khởi hành để lưu lịch theo ngày.');
                  return;
                }
                const end = new Date(
                  Date.parse(departure) + (draft.days.length - 1) * 86400000,
                )
                  .toISOString()
                  .slice(0, 10);
                const next = await changeDates(departure, end);
                onChange(next);
                setDatesConfirmed(true);
                setError('');
                onSave(next);
              } catch (e) {
                setError(
                  e instanceof Error
                    ? e.message
                    : 'Chưa kiểm tra được lịch. Lịch cũ vẫn được giữ.',
                );
              }
            }}
          >
            <fieldset className="journey-fieldset" disabled={busy}>
              <p>
                {draft.days.length} ngày ở {destinationName}. Chỉ còn ngày khởi
                hành để lưu lịch của bạn.
              </p>
              <label className="journey-field">
                Ngày khởi hành
                <input
                  autoFocus
                  type="date"
                  required
                  value={departure}
                  onInput={(e) => {
                    setDeparture(e.currentTarget.value);
                    setError('');
                  }}
                  onChange={(e) => {
                    setDeparture(e.target.value);
                    setError('');
                  }}
                />
              </label>
              <details className="quick-preferences">
                <summary>
                  Đổi tên hoặc thêm ghi chú <span>Tùy chọn</span>
                </summary>
                <label className="journey-field">
                  Tên chuyến đi
                  <input
                    maxLength={120}
                    value={draft.title}
                    onChange={(e) =>
                      onChange({ ...draft, title: e.target.value })
                    }
                  />
                </label>
                <label className="journey-field">
                  Ghi chú chuyến đi
                  <textarea
                    aria-label="Ghi chú chuyến đi"
                    maxLength={2000}
                    value={draft.notes}
                    onChange={(e) =>
                      onChange({ ...draft, notes: e.target.value })
                    }
                  />
                </label>
              </details>
              <p className="journey-sheet-note">
                Lưu kế hoạch riêng vào tài khoản. Chưa đặt phòng, vé hoặc dịch
                vụ.
              </p>
              {error && (
                <p role="alert" className="journey-error">
                  {error}
                </p>
              )}
              {saveState === 'error' && (
                <p role="alert" className="journey-error">
                  {message}
                </p>
              )}
              <button className="journey-primary" type="submit">
                {busy ? 'Đang lưu…' : 'Lưu chuyến đi'}
              </button>
            </fieldset>
          </form>
        </Sheet>
      )}
      {field && (
        <Sheet
          title={
            {
              destination: 'Chọn điểm đến',
              dates: 'Thời gian chuyến đi',
              travelers: 'Bạn đi cùng ai?',
              budget: 'Ngân sách cả nhóm',
            }[field]
          }
          onClose={() => {
            if (busy) return;
            setField(null);
            setError('');
          }}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void applyField();
            }}
          >
            <fieldset className="journey-fieldset" disabled={busy}>
              {field === 'destination' && (
                <label className="journey-field">
                  Điểm đến
                  <select
                    aria-label="Điểm đến"
                    autoFocus
                    value={pending.destinations[0]?.destinationId ?? ''}
                    onChange={(e) =>
                      setPending({
                        ...pending,
                        destinations: e.target.value
                          ? [{ destinationId: e.target.value, order: 0 }]
                          : [],
                      })
                    }
                  >
                    <option value="">Chọn điểm đến</option>
                    {destinations.map((d) => (
                      <option value={d.id} key={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {field === 'dates' && (
                <div className="journey-fields-row">
                  <label className="journey-field">
                    Ngày đi
                    <input
                      autoFocus
                      type="date"
                      required
                      value={pending.startDate}
                      onInput={(e) =>
                        setPending({
                          ...pending,
                          startDate: e.currentTarget.value,
                        })
                      }
                      onChange={(e) =>
                        setPending({ ...pending, startDate: e.target.value })
                      }
                    />
                  </label>
                  <label className="journey-field">
                    Ngày về
                    <input
                      type="date"
                      required
                      value={pending.endDate}
                      onInput={(e) =>
                        setPending({
                          ...pending,
                          endDate: e.currentTarget.value,
                        })
                      }
                      min={pending.startDate}
                      onChange={(e) =>
                        setPending({ ...pending, endDate: e.target.value })
                      }
                    />
                  </label>
                </div>
              )}
              {field === 'travelers' && (
                <label className="journey-field">
                  Số người
                  <input
                    autoFocus
                    type="number"
                    required
                    min={1}
                    max={1000}
                    value={pending.travelers.totalCount || ''}
                    onChange={(e) =>
                      setPending({
                        ...pending,
                        travelers: { totalCount: Number(e.target.value) },
                      })
                    }
                  />
                </label>
              )}
              {field === 'budget' && (
                <label className="journey-field">
                  Ngân sách tổng nhóm (VND)
                  <input
                    autoFocus
                    type="number"
                    min={0}
                    max={1e12}
                    step={1}
                    placeholder="Chưa xác định"
                    aria-label="Ngân sách tổng nhóm (VND)"
                    value={pending.budget.amountMinor ?? ''}
                    onChange={(e) =>
                      setPending({
                        ...pending,
                        budget: {
                          ...pending.budget,
                          amountMinor:
                            e.target.value === ''
                              ? null
                              : Number(e.target.value),
                        },
                      })
                    }
                  />
                  <small>Để trống nếu bạn chưa quyết định.</small>
                </label>
              )}
              {error && (
                <p className="journey-error" role="alert">
                  {error}
                </p>
              )}
              <button className="journey-primary" type="submit" disabled={busy}>
                {rescheduling ? 'Goe đang kiểm tra giờ mở cửa…' : 'Xong'}{' '}
                <Check size={18} />
              </button>
            </fieldset>
          </form>
        </Sheet>
      )}
      {editing && (
        <Sheet
          title={adding ? 'Thêm điểm dừng' : 'Chỉnh điểm dừng'}
          onClose={() => {
            setEditing(null);
            setError('');
          }}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitActivity();
            }}
          >
            <label className="journey-field">
              Tên hoạt động
              <input
                autoFocus
                required
                maxLength={120}
                placeholder="Bạn muốn ghé đâu?"
                aria-label="Tên hoạt động"
                value={editing.title}
                onChange={(e) =>
                  setEditing({ ...editing, title: e.target.value })
                }
              />
              {editing.kind === 'meal' && (
                <small>
                  Nếu đã chọn quán, ghi tên quán ở đây; thêm địa chỉ và thông
                  tin cần nhớ vào ghi chú.
                </small>
              )}
            </label>
            <div className="journey-fields-row">
              <label className="journey-field">
                Bắt đầu
                <input
                  type="time"
                  value={editing.startLocalTime ?? ''}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      startLocalTime: e.target.value || undefined,
                    })
                  }
                />
              </label>
              <label className="journey-field">
                Kết thúc
                <input
                  type="time"
                  value={editing.endLocalTime ?? ''}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      endLocalTime: e.target.value || undefined,
                    })
                  }
                />
              </label>
            </div>
            <label className="journey-field">
              Nhóm chi phí
              <select
                aria-label="Nhóm chi phí"
                value={editing.kind}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    kind: e.target.value as ActivityInput['kind'],
                  })
                }
              >
                <option value="visit">Trải nghiệm / Tham quan</option>
                <option value="meal">Ăn uống</option>
                <option value="transport">Di chuyển</option>
                <option value="lodging">Lưu trú</option>
                <option value="free_time">Nghỉ tự do</option>
                <option value="custom">Khác</option>
              </select>
            </label>
            {editing.placeId && (
              <details className="activity-reference">
                <summary>Giá và giờ mở cửa tham khảo</summary>
                <ActivityCatalogInfo
                  key={editing.placeId}
                  placeId={editing.placeId}
                  onAutomatic={(estimatedCost) =>
                    setEditing({ ...editing, estimatedCost })
                  }
                  onPick={(price) =>
                    setEditing({
                      ...editing,
                      estimatedCost: {
                        ...editing.estimatedCost,
                        confidence: 'user_entered',
                        reference: undefined,
                        amountMinor: price.amountMinor,
                        basis: price.basis,
                      },
                    })
                  }
                />
              </details>
            )}
            <label className="journey-field">
              Cách tính chi phí
              <select
                aria-label="Cách tính chi phí"
                value={editing.estimatedCost.basis}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    estimatedCost: {
                      ...editing.estimatedCost,
                      confidence: 'user_entered',
                      reference: undefined,
                      basis: e.target.value as 'group_total' | 'per_person',
                    },
                  })
                }
              >
                <option value="group_total">Tổng cho cả nhóm</option>
                <option value="per_person">
                  Mỗi người (nhân số người của chuyến)
                </option>
              </select>
            </label>
            <label className="journey-field">
              {editing.estimatedCost.basis === 'per_person'
                ? 'Chi phí mỗi người (VND)'
                : 'Chi phí nhóm (VND)'}
              <input
                type="number"
                min={0}
                max={1e12}
                step={1}
                placeholder="Chưa rõ"
                value={editing.estimatedCost.amountMinor ?? ''}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    estimatedCost: {
                      ...editing.estimatedCost,
                      confidence: 'user_entered',
                      reference: undefined,
                      amountMinor:
                        e.target.value === '' ? null : Number(e.target.value),
                    },
                  })
                }
              />
            </label>
            <label className="journey-field">
              Ghi chú hoạt động
              <textarea
                aria-label="Ghi chú hoạt động"
                rows={2}
                maxLength={2000}
                value={editing.notes}
                onChange={(e) =>
                  setEditing({ ...editing, notes: e.target.value })
                }
              />
            </label>
            {error && (
              <p className="journey-error" role="alert">
                {error}
              </p>
            )}
            <button type="submit" className="journey-primary">
              {adding ? 'Thêm vào lịch trình' : 'Áp dụng thay đổi'}
              <Check size={18} />
            </button>
            {!adding && (
              <button
                type="button"
                className="journey-delete"
                onClick={async () => {
                  if (
                    await confirmAction('Bỏ điểm dừng này khỏi lịch trình?', {
                      title: 'Xóa điểm dừng?',
                      confirmLabel: 'Xóa điểm dừng',
                      tone: 'danger',
                    })
                  ) {
                    changeActivities(
                      day!.activities.filter(
                        (a) => a.activityId !== editing.activityId,
                      ),
                    );
                    setEditing(null);
                    setError('');
                  }
                }}
              >
                <Trash2 size={16} />
                Xóa điểm dừng
              </button>
            )}
          </form>
        </Sheet>
      )}
      {suggestions && (
        <Sheet
          title={replacing ? 'Đổi địa điểm' : 'Thêm điểm dừng'}
          onClose={() => {
            setSuggestions(false);
            setReplacing(null);
          }}
        >
          <p className="journey-sheet-note">
            {replacing
              ? `Thay ${replacing.title}, giữ khung giờ hiện tại. Dùng giá tham khảo mới nếu có.`
              : `${destinationName} · Ngày ${dayIndex + 1}. Giá tham khảo có thể chỉnh sửa.`}
          </p>
          {placesStatus === 'loading' ? (
            <p role="status">Đang tìm gợi ý…</p>
          ) : placesStatus === 'error' ? (
            <div role="alert">
              <p>Chưa tải được gợi ý.</p>
              <button
                className="journey-outline"
                onClick={() => {
                  setPlacesStatus('loading');
                  setPlacesRetry((v) => v + 1);
                }}
              >
                Thử lại
              </button>
            </div>
          ) : (replacing ? replacements : candidates).length ? (
            <div className="journey-place-options">
              {(replacing ? replacements : candidates).map((p) => (
                <article key={p.id}>
                  <PlacePhoto place={p} compact />
                  <div>
                    <strong>{p.name}</strong>
                    {p.subtitle && (
                      <details className="journey-suggestion-description">
                        <summary>Giới thiệu địa điểm</summary>
                        <p>{p.subtitle}</p>
                      </details>
                    )}
                  </div>
                  <button
                    aria-label={`${replacing ? 'Đổi sang' : 'Thêm'} ${p.name}`}
                    disabled={!replacing && atLimit}
                    onClick={() => {
                      if (day) {
                        if (replacing) {
                          const replacement = {
                            ...placeActivity(p, '', replacing.order),
                            ...(replacing.startLocalTime
                              ? {
                                  startLocalTime: replacing.startLocalTime,
                                  endLocalTime: replacing.endLocalTime,
                                }
                              : {}),
                          };
                          changeActivities(
                            day.activities.map((a) =>
                              a.activityId === replacing.activityId
                                ? replacement
                                : a,
                            ),
                          );
                          setUndoDay(structuredClone(day));
                          setReplacing(null);
                        } else
                          changeActivities([
                            ...day.activities,
                            placeActivity(p, '', day.activities.length),
                          ]);
                        setSuggestions(false);
                      }
                    }}
                  >
                    <Plus size={22} />
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <p className="journey-empty">
              {replacing
                ? 'Chưa có điểm khác phù hợp với khung giờ này. Giữ lịch hiện tại hoặc bỏ điểm để có thêm thời gian nghỉ.'
                : 'Chưa có gợi ý ở điểm đến này. Bạn có thể tự thêm những nơi muốn ghé.'}
            </p>
          )}
          {!replacing && (
            <button
              className="journey-outline"
              disabled={atLimit}
              onClick={() => {
                setSuggestions(false);
                addBlank();
              }}
            >
              Tự thêm điểm dừng <Plus size={17} />
            </button>
          )}
          <small className="journey-caption">
            Gợi ý biên tập, không phải lịch trình AI tự động
          </small>
        </Sheet>
      )}
    </section>
  );
}
