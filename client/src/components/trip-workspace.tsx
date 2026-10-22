import { TripManagement } from './trip-management';
import { Sheet } from './journey-sheet';
import { TripExpenses } from './trip-expenses';
import { TripBudget } from './budget-screen';
import { AiPlanner } from './ai-planner';
import { ActivityCatalogInfo } from './place-planning';
import {
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
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
} from 'lucide-react';
import {
  shiftTripDays,
  tripLifecycle,
  activityInputSchema,
  tripInputSchema,
  type ActivityInput,
  type DestinationDto,
  type PlaceDto,
  type TripDto,
  type TripInput,
} from '@goease/contracts';
import { api } from '../api';
import { moneyText, withDays } from '../trip-draft';
import { placeActivity } from './explore';

const TripMap = lazy(() =>
  import('./trip-map').then((m) => ({ default: m.TripMap })),
);

const shortDate = (date: string) =>
  date.slice(5).split('-').reverse().join('/');
const travelImage = (name: string) =>
  /hội an/i.test(name)
    ? '/images/explore-hoian.png'
    : /sa pa/i.test(name)
      ? '/images/destination-sapa.png'
      : '/images/welcome-halong-bay.png';
const activityImage = (a: ActivityInput, destination: string) =>
  /cơm gà/i.test(a.title)
    ? '/images/explore-rice.png'
    : /trà quế/i.test(a.title)
      ? '/images/explore-traque.png'
      : travelImage(destination);
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

function Companion({ children }: { children: ReactNode }) {
  return (
    <aside className="journey-companion">
      <img src="/images/goe-mascot-cutout.png" alt="Goe" />
      <p>{children}</p>
    </aside>
  );
}

export function JourneyList({
  trips,
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
      <header className="journey-top">
        <button aria-label="Về Trang chủ" onClick={() => onNavigate('/')}>
          <ArrowLeft size={22} />
        </button>
        <span>Chuyến đi của bạn</span>
        <button aria-label="Tạo chuyến đi" onClick={onStart}>
          <Plus size={23} />
        </button>
      </header>
      <div className="journey-list-heading">
        <span className="journey-eyebrow">NHỮNG NGÀY ĐÁNG MONG ĐỢI</span>
        <h1>
          Mỗi chuyến đi,
          <br />
          một câu chuyện.
        </h1>
        <p>Những nơi muốn đến. Những điều muốn nhớ.</p>
      </div>
      <button className="journey-create-card" onClick={onStart}>
        <img src="/images/goe-mascot-cutout.png" alt="" />
        <span>
          <strong>Mình đi đâu tiếp nhỉ?</strong>
          <small>Tạo một hành trình của riêng bạn</small>
        </span>
        <Plus size={24} />
      </button>
      <div className="journey-section-title">
        <h2>Hành trình của bạn</h2>
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
        {signedIn && !loading && !error && (
          <span>{trips.length} chuyến đi</span>
        )}
      </div>
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
          <h3>Giữ những kế hoạch ở bên bạn.</h3>
          <p>Đăng nhập để lưu và mở lại chuyến đi.</p>
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
              ? 'Một nơi bạn luôn muốn đến?'
              : 'Chưa có chuyến đi trong mục này.'}
          </h3>
          <p>Chuyến đi đầu tiên bắt đầu từ một ý tưởng nhỏ.</p>
          <button className="journey-primary" onClick={onStart}>
            Tạo chuyến đi đầu tiên <ArrowRight size={18} />
          </button>
        </div>
      ) : (
        <div className="journey-saved-grid">
          {trips.map((trip) => (
            <button
              key={trip.id}
              className="journey-saved-card"
              onClick={() => onNavigate(`/trips/${trip.id}`)}
            >
              <div className="journey-saved-cover">
                <img
                  src={travelImage(trip.destinationName)}
                  alt="Ảnh minh họa hành trình"
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
      <p className="journey-caption">
        Ảnh minh họa AI · Lịch trình riêng tư của bạn
      </p>
    </section>
  );
}

export function TripWorkspace({
  draft,
  onChange,
  destinations,
  loaded,
  busy,
  saveState,
  message,
  signedIn,
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
  signedIn: boolean;
  onOpenGoe: (day: number) => void;
  onNavigate: (path: string) => void;
  onReload: () => void;
  onSave: () => void;
  onBack: () => void;
}) {
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
  const isSetup = !loaded && step === 1;
  const showSettings = isSetup || settings;
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
  function applyField() {
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
          ? shiftTripDays(pending, pending.startDate, pending.endDate, () =>
              crypto.randomUUID(),
            )
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
        !confirm(
          'Thay đổi này sẽ bỏ điểm dừng của địa điểm hoặc ngày không còn trong chuyến. Tiếp tục?',
        )
      )
        return;
      if (changedDestination)
        next = {
          ...next,
          days: next.days.map((d) => ({ ...d, activities: [] })),
        };
    }
    onChange(next);
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
        'Chọn điểm đến, khoảng ngày hợp lệ, số người và ngân sách trước khi tiếp tục.',
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
  function addBlank() {
    if (!day || day.activities.length >= 50 || allActivities.length >= 300)
      return;
    setEditing({
      activityId: crypto.randomUUID(),
      kind: 'custom',
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
      value: `${shortDate(draft.startDate)} – ${shortDate(draft.endDate)}/${draft.endDate.slice(0, 4)} · ${Math.max(1, draft.days.length)} ngày`,
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
        <h2>Gu của chuyến đi</h2>
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
      </section>
    </>
  );
  return (
    <section className={`journey-workspace ${isSetup ? 'journey-setup' : ''}`}>
      <header className="journey-top">
        <button
          aria-label="Quay lại"
          onClick={() => {
            if (settings) setSettings(false);
            else if (tab === 'cost' || tab === 'summary') setTab('schedule');
            else if (!loaded && step > 1) {
              setStep(step - 1);
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
        {loaded ? (
          <button
            aria-label="Thông tin chuyến đi"
            onClick={() => setSettings((v) => !v)}
          >
            <SlidersHorizontal size={21} />
          </button>
        ) : (
          <span className="journey-step-label">Bước {step} / 3</span>
        )}
      </header>
      {!loaded && (
        <ol className="journey-progress" aria-label={`Bước ${step} trên 3`}>
          {[1, 2, 3].map((n) => (
            <li
              key={n}
              className={n <= step ? 'complete' : ''}
              aria-current={n === step ? 'step' : undefined}
            >
              <span>{n < step ? <Check size={10} /> : ''}</span>
            </li>
          ))}
        </ol>
      )}
      <fieldset className="journey-fieldset" disabled={busy}>
        {showSettings ? (
          <>
            <h1 className="journey-intro-title">
              {loaded ? (
                <>
                  Theo cách
                  <br />
                  của bạn.
                </>
              ) : (
                <>
                  Bắt đầu từ
                  <br />
                  điều bạn thích.
                </>
              )}
            </h1>
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
            {loaded && (
              <button
                className="journey-primary"
                disabled={busy || saveState === 'saved'}
                onClick={onSave}
              >
                Lưu thay đổi <Check size={18} />
              </button>
            )}
            <Companion>Bạn có thể đổi mọi thứ sau.</Companion>
            <AiPlanner
              draft={withDays({
                ...draft,
                title: draft.title.trim() || `Hành trình ${destinationName}`,
              })}
              tripId={loaded?.id}
              revision={loaded?.revision}
              onApply={(value) => {
                onChange(value);
                setSettings(false);
                setStep(2);
                setTab('schedule');
              }}
            />
            <button
              className="journey-primary"
              onClick={loaded ? () => setSettings(false) : nextStep}
            >
              {loaded ? 'Về lịch trình' : 'Gợi ý lịch trình'}
              <ArrowRight size={19} />
            </button>
            {!loaded && (
              <p className="journey-caption">
                Chọn điểm dừng từ gợi ý của GoEase, rồi tự xếp lịch.
              </p>
            )}
          </>
        ) : !loaded && step === 3 ? (
          <div className="journey-review">
            <span className="journey-eyebrow">SẴN SÀNG CHO MỘT CHUYẾN ĐI</span>
            <h1>
              Lưu lại.
              <br />
              Rồi mình đi thôi.
            </h1>
            <img
              className="journey-review-cover"
              src={travelImage(destinationName)}
              alt="Ảnh minh họa hành trình"
            />
            <label className="journey-field">
              Tên chuyến đi
              <input
                value={draft.title}
                maxLength={120}
                onChange={(e) => onChange({ ...draft, title: e.target.value })}
              />
            </label>
            <div className="journey-review-meta">
              <span>
                <MapPin size={17} />
                {destinationName}
              </span>
              <span>
                <CalendarDays size={17} />
                {draft.days.length} ngày
              </span>
              <span>
                <UsersRound size={17} />
                {draft.travelers.totalCount} người
              </span>
            </div>
            <label className="journey-field">
              Ghi chú chuyến đi
              <textarea
                aria-label="Ghi chú chuyến đi"
                value={draft.notes}
                maxLength={2000}
                placeholder="Những điều muốn nhớ…"
                onChange={(e) => onChange({ ...draft, notes: e.target.value })}
              />
            </label>
            <Companion>
              {allActivities.length} điểm dừng đã chọn. Bạn luôn có thể chỉnh
              sửa sau.
            </Companion>
            <button className="journey-primary" onClick={onSave}>
              {busy
                ? 'Đang lưu…'
                : signedIn
                  ? 'Lưu chuyến đi'
                  : 'Đăng nhập để lưu'}
              <Check size={19} />
            </button>
          </div>
        ) : (
          <>
            {tab !== 'cost' && (
              <>
                <div className="journey-cover">
                  <img
                    src={travelImage(destinationName)}
                    alt="Ảnh minh họa hành trình"
                  />
                  <span>Ảnh minh họa AI</span>
                </div>
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
                      onClick={() => setTab(code)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </>
            )}
            {tab === 'summary' && loaded ? (
              <div>
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
                <div
                  className="expense-view-tabs"
                  role="group"
                  aria-label="Loại chi phí"
                >
                  <button
                    aria-pressed={costView === 'estimate'}
                    onClick={() => setCostView('estimate')}
                  >
                    Dự toán
                  </button>
                  <button
                    aria-pressed={costView === 'actual'}
                    onClick={() => setCostView('actual')}
                  >
                    Thực chi
                  </button>
                </div>
                {costView === 'estimate' ? (
                  <TripBudget
                    draft={draft}
                    destinationName={destinationName}
                    onAdjust={() => openField('budget')}
                  />
                ) : loaded ? (
                  <TripExpenses
                    key={loaded.id}
                    tripId={loaded.id}
                    tripRevision={loaded.revision}
                    unsaved={saveState !== 'saved'}
                  />
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
                    <h1>
                      {draft.preferences.pace === 'relaxed'
                        ? 'Chậm một nhịp.'
                        : draft.preferences.pace === 'active'
                          ? 'Đi và khám phá.'
                          : 'Một ngày thật vui.'}
                    </h1>
                    <span>{day ? shortDate(day.date) : ''}</span>
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
                      <div className="journey-timeline">
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
                              <img
                                src={activityImage(a, destinationName)}
                                alt=""
                              />
                              <span>
                                <small>
                                  {a.startLocalTime ?? 'Chưa đặt giờ'}
                                </small>
                                <strong>{a.title}</strong>
                                <small>
                                  {a.notes ||
                                    (a.endLocalTime
                                      ? `Đến ${a.endLocalTime}`
                                      : 'Chạm để thêm chi tiết')}
                                </small>
                              </span>
                              <Pencil size={14} />
                            </button>
                            <div className="journey-stop-order">
                              <button
                                aria-label={`Đưa ${a.title} lên`}
                                disabled={i === 0}
                                onClick={() => move(i, -1)}
                              >
                                <ArrowUp size={13} />
                              </button>
                              <button
                                aria-label={`Đưa ${a.title} xuống`}
                                disabled={i === day.activities.length - 1}
                                onClick={() => move(i, 1)}
                              >
                                <ArrowDown size={13} />
                              </button>
                            </div>
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
                      {!day?.activities.length && (
                        <div className="journey-empty">
                          <Sparkles size={24} />
                          <h3>Một ngày còn để ngỏ.</h3>
                          <p>
                            Thêm nơi bạn muốn ghé, một bữa ăn ngon hay một
                            khoảng nghỉ.
                          </p>
                        </div>
                      )}
                      <button
                        className="journey-add-stop"
                        disabled={atLimit}
                        onClick={addBlank}
                      >
                        <Plus size={17} />
                        Thêm điểm dừng
                      </button>
                      <button
                        className="journey-companion journey-suggest-button"
                        onClick={() => {
                          setSuggestions(true);
                          setPlacesStatus('loading');
                        }}
                      >
                        <img src="/images/goe-mascot-cutout.png" alt="Goe" />
                        <span>Tìm một nơi hợp gu? Xem gợi ý nhé.</span>
                        <ChevronRight size={18} />
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
            {!loaded && (
              <button
                className="journey-primary"
                onClick={() => {
                  setStep(3);
                  window.scrollTo(0, 0);
                }}
              >
                Xem lại chuyến đi <ArrowRight size={18} />
              </button>
            )}
            {loaded && (
              <>
                {tab !== 'cost' && (
                  <button
                    className="journey-companion journey-suggest-button"
                    onClick={() => onOpenGoe(dayIndex)}
                  >
                    <img src="/images/goe-mascot-cutout.png" alt="Goe" />
                    <span>Muốn đổi nhịp? Hỏi Goe nhé.</span>
                    <ChevronRight size={18} />
                  </button>
                )}
                {tab !== 'cost' && (
                  <>
                    <label className="journey-field journey-trip-notes">
                      Ghi chú chuyến đi
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
                  </>
                )}
                <div className="journey-save-bar">
                  <span role="status" aria-label="Trạng thái lưu">
                    {saveState === 'saving'
                      ? 'Đang lưu…'
                      : saveState === 'saved'
                        ? 'Đã lưu'
                        : saveState === 'error'
                          ? 'Lưu thất bại'
                          : 'Chưa lưu thay đổi'}
                  </span>
                  <button
                    className="journey-primary"
                    onClick={onSave}
                    disabled={busy || saveState === 'saved'}
                  >
                    Lưu thay đổi <Check size={16} />
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </fieldset>
      {error && !field && !editing && (
        <p className="journey-error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p
          className={saveState === 'error' ? 'journey-error' : 'journey-notice'}
          role={saveState === 'error' ? 'alert' : 'status'}
        >
          {message}
        </p>
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
            setField(null);
            setError('');
          }}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              applyField();
            }}
          >
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
                          e.target.value === '' ? null : Number(e.target.value),
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
            <button className="journey-primary" type="submit">
              Xong <Check size={18} />
            </button>
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
                value={editing.title}
                onChange={(e) =>
                  setEditing({ ...editing, title: e.target.value })
                }
              />
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
              <ActivityCatalogInfo
                key={editing.placeId}
                placeId={editing.placeId}
                onPick={(price) =>
                  setEditing({
                    ...editing,
                    estimatedCost: {
                      ...editing.estimatedCost,
                      amountMinor: price.amountMinor,
                      basis: price.basis,
                    },
                  })
                }
              />
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
                onClick={() => {
                  if (confirm('Bỏ điểm dừng này khỏi lịch trình?')) {
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
        <Sheet title="Một vài nơi hợp gu" onClose={() => setSuggestions(false)}>
          <p className="journey-sheet-note">
            Gợi ý từ danh mục GoEase tại {destinationName}. Chọn để thêm vào
            ngày {dayIndex + 1}; giờ và chi phí do bạn quyết định.
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
          ) : candidates.length ? (
            <div className="journey-place-options">
              {candidates.map((p) => (
                <article key={p.id}>
                  <img src={p.imageUrl} alt="Ảnh minh họa AI" />
                  <div>
                    <strong>{p.name}</strong>
                    <small>{p.subtitle}</small>
                  </div>
                  <button
                    aria-label={`Thêm ${p.name}`}
                    disabled={atLimit}
                    onClick={() => {
                      if (day) {
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
              Chưa có gợi ý ở điểm đến này. Bạn có thể tự thêm những nơi muốn
              ghé.
            </p>
          )}
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
          <small className="journey-caption">
            Ảnh minh họa AI · Gợi ý biên tập, không phải lịch trình AI tự động
          </small>
        </Sheet>
      )}
    </section>
  );
}
