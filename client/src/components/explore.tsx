import { useEffect, useRef, useState } from 'react';
import { catalogCost } from '@goease/contracts';
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  ChevronRight,
  Clock,
  Footprints,
  Landmark,
  Leaf,
  List,
  Map,
  MapPin,
  Pencil,
  Search,
  Sparkles,
  Sun,
  Utensils,
  X,
} from 'lucide-react';
import type {
  PlaceDto,
  SavedPlacesDto,
  PlaceStateDto,
  TripDto,
  TripInput,
} from '@goease/contracts';
import { api, ApiFailure } from '../api';
import { inputFromTrip } from '../trip-draft';
import { PlacePlanning } from './place-planning';
import { SourceCredit } from './source-credit';
const labels = { food: 'Ẩm thực', culture: 'Văn hóa', nature: 'Thiên nhiên' };
const icons = { food: Utensils, culture: Landmark, nature: Leaf };
const message = (e: unknown) =>
  e instanceof Error ? e.message : 'Chưa kết nối được. Vui lòng thử lại.';
const mapUrl = (query: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
type NavProps = { signedIn: boolean; onNavigate: (path: string) => void };

export function ExplorePage({
  signedIn,
  onNavigate,
  savedOnly = false,
}: NavProps & { savedOnly?: boolean }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [view, setView] = useState<'list' | 'map'>('list');
  const [items, setItems] = useState<PlaceDto[]>([]);
  const [states, setStates] = useState<Record<string, PlaceStateDto>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [saving, setSaving] = useState('');
  const [unavailable, setUnavailable] = useState<SavedPlacesDto['unavailable']>(
    [],
  );
  useEffect(() => {
    let active = true;
    if (savedOnly && !signedIn) {
      setLoading(false);
      return;
    }
    const timer = setTimeout(() => {
      setLoading(true);
      setError('');
      const params = new URLSearchParams({
        q: query,
        ...(category ? { category } : {}),
      });
      const request = savedOnly
        ? api<SavedPlacesDto>('/me/places').then((r) => {
            if (active) {
              setUnavailable(r.unavailable ?? []);
              setStates(
                Object.fromEntries(r.items.map((v) => [v.place.id, v.state])),
              );
            }
            const normalize = (v: string) =>
              v
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/đ/g, 'd');
            return r.items
              .map((v) => v.place)
              .filter(
                (p) =>
                  (!category || p.category === category) &&
                  normalize(p.name).includes(normalize(query)),
              );
          })
        : api<{ items: PlaceDto[] }>(`/places?${params}`).then((r) => r.items);
      void request
        .then((data) => {
          if (active) setItems(data);
        })
        .catch((e) => {
          if (active) setError(message(e));
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 200);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, category, retry, savedOnly, signedIn]);
  useEffect(() => {
    let active = true;
    if (signedIn && !savedOnly)
      void api<{ items: { place: PlaceDto; state: PlaceStateDto }[] }>(
        '/me/places',
      )
        .then((r) => {
          if (active)
            setStates(
              Object.fromEntries(r.items.map((v) => [v.place.id, v.state])),
            );
        })
        .catch(() => {});
    return () => {
      active = false;
    };
  }, [signedIn, savedOnly]);
  async function toggle(place: PlaceDto) {
    if (!signedIn) {
      onNavigate('/login');
      return;
    }
    setSaving(place.id);
    setError('');
    try {
      const current = await api<{ state: PlaceStateDto }>(
        `/me/places/${place.id}`,
      );
      const value = await api<{ state: PlaceStateDto }>(
        `/me/places/${place.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            expectedRevision: current.state.revision,
            saved: !current.state.saved,
          }),
        },
      );
      setStates((s) => ({ ...s, [place.id]: value.state }));
      if (savedOnly) setRetry((v) => v + 1);
    } catch (e) {
      setError(message(e));
    } finally {
      setSaving('');
    }
  }
  async function removeUnavailable(
    value: SavedPlacesDto['unavailable'][number],
  ) {
    setSaving(value.placeId);
    setError('');
    try {
      await api(`/me/places/${value.placeId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          expectedRevision: value.state.revision,
          saved: false,
        }),
      });
      setRetry((v) => v + 1);
    } catch (e) {
      setError(message(e));
    } finally {
      setSaving('');
    }
  }
  if (savedOnly && !signedIn)
    return (
      <section className="explore-page">
        <h1>Những nơi đã lưu.</h1>
        <p>Đăng nhập để xem những địa điểm của bạn.</p>
        <button
          className="button button-primary"
          onClick={() => onNavigate('/login')}
        >
          Đăng nhập
        </button>
      </section>
    );
  return (
    <div className={`explore-page ${savedOnly ? 'saved-places-page' : ''}`}>
      {!savedOnly && (
        <button className="explore-back" onClick={() => onNavigate('/')}>
          <ArrowLeft size={20} />
          Khám phá
        </button>
      )}
      <header className="explore-heading">
        <h1>
          {savedOnly ? (
            'Những nơi đã lưu.'
          ) : (
            <>
              Một Hội An
              <br />
              của riêng bạn.
            </>
          )}
        </h1>
        <p>
          {savedOnly
            ? 'Chọn nơi đã lưu và thêm vào hành trình của bạn.'
            : 'Tìm nơi hợp gu, lưu cho chuyến tới.'}
        </p>
      </header>
      <label className="explore-search">
        <Search size={20} />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Tìm quán, nơi chơi, trải nghiệm"
          aria-label="Tìm quán, nơi chơi, trải nghiệm"
        />
      </label>
      <div className="explore-filters" aria-label="Danh mục địa điểm">
        {[
          ['', 'Tất cả'],
          ['food', 'Ẩm thực'],
          ['culture', 'Văn hóa'],
          ['nature', 'Thiên nhiên'],
        ].map(([value, label]) => (
          <button
            key={value}
            aria-pressed={category === value}
            onClick={() => setCategory(value ?? '')}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="explore-view" aria-label="Cách hiển thị">
        <button aria-pressed={view === 'list'} onClick={() => setView('list')}>
          <List size={17} />
          Danh sách
        </button>
        <button aria-pressed={view === 'map'} onClick={() => setView('map')}>
          <Map size={17} />
          Bản đồ
        </button>
      </div>
      {error && (
        <div className="explore-status" role="alert">
          {error}{' '}
          <button onClick={() => setRetry((v) => v + 1)}>Thử lại</button>
        </div>
      )}
      {savedOnly && !loading && unavailable.length > 0 && (
        <section
          className="explore-status"
          aria-label="Địa điểm không còn khả dụng"
        >
          <h2>Địa điểm không còn khả dụng</h2>
          <p>
            {unavailable.length} nơi đã lưu đang ẩn hoặc đã ngừng cung cấp.
            Không thể thêm vào chuyến đi.
          </p>
          {unavailable.map((v, i) => (
            <div key={v.placeId}>
              <span>Địa điểm đã lưu {i + 1}</span>
              <button
                disabled={Boolean(saving)}
                onClick={() => void removeUnavailable(v)}
              >
                Bỏ lưu địa điểm không khả dụng {i + 1}
              </button>
            </div>
          ))}
        </section>
      )}
      {loading ? (
        <p className="explore-status" role="status">
          Đang tìm những nơi thú vị…
        </p>
      ) : !items.length ? (
        <p className="explore-status">
          {savedOnly
            ? query || category
              ? 'Không có nơi đã lưu khớp bộ lọc.'
              : 'Bạn chưa lưu địa điểm nào đang khả dụng.'
            : 'Chưa có địa điểm phù hợp với tìm kiếm này.'}
        </p>
      ) : view === 'map' ? (
        <section className="explore-map">
          <iframe
            title="Bản đồ khu vực Hội An"
            src="https://www.openstreetmap.org/export/embed.html?bbox=108.30%2C15.86%2C108.35%2C15.91&layer=mapnik"
            loading="lazy"
          />
          <p>Bản đồ khu vực Hội An · OpenStreetMap</p>
          <p>Chọn một nơi để xem vị trí trên Google Maps.</p>
          {items.map((p) => (
            <a
              key={p.id}
              href={mapUrl(`${p.name} Hội An`)}
              target="_blank"
              rel="noreferrer"
            >
              <MapPin size={16} />
              {p.name}
              <ArrowRight size={16} />
            </a>
          ))}
        </section>
      ) : (
        <div className="explore-grid">
          {items.map((p, i) => {
            const Icon = icons[p.category];
            return (
              <article
                className={`explore-card ${i === 0 && !category && !query ? 'featured' : ''}`}
                key={p.id}
              >
                <button
                  className="explore-card-open"
                  onClick={() =>
                    onNavigate(
                      `/places/${p.id}${savedOnly ? '?from=saved' : ''}`,
                    )
                  }
                >
                  <img src={p.imageUrl} alt={`${p.name} — ${p.imageCredit}`} />
                  <span className="explore-category">
                    <Icon size={13} />
                    {labels[p.category]}
                  </span>
                  <span className="explore-card-copy">
                    <strong>{p.name}</strong>
                    {i === 0 && !category && !query && (
                      <small>{p.subtitle}</small>
                    )}
                  </span>
                </button>
                <button
                  className="explore-save"
                  aria-label={`${states[p.id]?.saved ? 'Bỏ lưu' : 'Lưu'} ${p.name}`}
                  aria-pressed={Boolean(states[p.id]?.saved)}
                  disabled={Boolean(saving)}
                  onClick={() => void toggle(p)}
                >
                  <Bookmark
                    size={18}
                    fill={states[p.id]?.saved ? 'currentColor' : 'none'}
                  />
                </button>
                {savedOnly && (
                  <button
                    className="saved-add-trip"
                    onClick={() =>
                      onNavigate(`/places/${p.id}?from=saved&add=1`)
                    }
                    aria-label={`Thêm ${p.name} vào chuyến đi`}
                  >
                    Thêm vào chuyến đi <ArrowRight size={16} />
                  </button>
                )}
              </article>
            );
          })}
        </div>
      )}
      {savedOnly && !loading && !items.length && (
        <button
          className="button button-outline"
          onClick={() => onNavigate('/explore')}
        >
          Khám phá địa điểm để lưu →
        </button>
      )}
      <p className="explore-image-credit">Ảnh minh họa được tạo bằng AI.</p>
      {items.some((p) => p.source) && <SourceCredit />}
    </div>
  );
}

export function PlaceDetail({
  id,
  signedIn,
  onNavigate,
  onNewTrip,
}: NavProps & {
  id: string;
  onNewTrip: (place: PlaceDto, note: string) => void;
}) {
  const fromSaved =
    new URLSearchParams(location.search).get('from') === 'saved';
  const autoAdd = new URLSearchParams(location.search).get('add') === '1';
  const openedAuto = useRef(false);
  const [addedPath, setAddedPath] = useState('');
  const [place, setPlace] = useState<PlaceDto | null>(null);
  const [state, setState] = useState<PlaceStateDto | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [retry, setRetry] = useState(0);
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [trips, setTrips] = useState<TripDto[]>([]);
  const [tripId, setTripId] = useState('');
  const [dayId, setDayId] = useState('');
  const [tripsLoading, setTripsLoading] = useState(false);
  const pickerRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!sheet) return;
    const previous = document.activeElement as HTMLElement | null;
    const picker = pickerRef.current;
    picker?.focus();
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) setSheet(false);
      if (event.key !== 'Tab' || !picker) return;
      const controls = Array.from(
        picker.querySelectorAll<HTMLElement>(
          'button:not(:disabled), select:not(:disabled), [href]',
        ),
      );
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (
        event.shiftKey &&
        (document.activeElement === first || document.activeElement === picker)
      ) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener('keydown', keyboard);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', keyboard);
      document.body.style.overflow = previousOverflow;
      previous?.focus();
    };
  }, [sheet, busy]);
  const dirty = note !== (state?.note ?? '');
  useEffect(() => {
    let active = true;
    setError('');
    void api<{ place: PlaceDto }>(`/places/${id}`)
      .then((v) => {
        if (active) setPlace(v.place);
      })
      .catch((e) => {
        if (active) setError(message(e));
      });
    if (signedIn)
      void api<{ state: PlaceStateDto }>(`/me/places/${id}`)
        .then((v) => {
          if (active) {
            setState(v.state);
            setNote(v.state.note);
          }
        })
        .catch((e) => {
          if (active) setError(message(e));
        });
    return () => {
      active = false;
    };
  }, [id, signedIn, retry]);
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);
  function back() {
    if (dirty && !confirm('Ghi chú chưa lưu. Bạn muốn rời trang?')) return;
    onNavigate(fromSaved ? '/saved' : '/explore');
  }
  async function update(saved?: boolean) {
    if (!signedIn) {
      onNavigate('/login');
      return;
    }
    if (!state) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const r = await api<{ state: PlaceStateDto }>(`/me/places/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          expectedRevision: state.revision,
          ...(saved === undefined ? { note } : { saved }),
        }),
      });
      setState(r.state);
      if (saved === undefined) setNote(r.state.note);
      setNotice(
        saved === undefined
          ? 'Đã lưu ghi chú.'
          : saved
            ? 'Đã lưu địa điểm.'
            : 'Đã bỏ lưu địa điểm.',
      );
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  async function openTrips() {
    if (!signedIn) {
      onNavigate('/login');
      return;
    }
    setSheet(true);
    setError('');
    setTripsLoading(true);
    setTrips([]);
    try {
      const r = await api<{ items: TripDto[] }>('/trips');
      setTrips(
        r.items.filter((t) =>
          t.destinations.some((d) => d.destinationId === place?.destinationId),
        ),
      );
    } catch (e) {
      setError(message(e));
    } finally {
      setTripsLoading(false);
    }
  }
  useEffect(() => {
    if (!autoAdd || !place || !state || openedAuto.current) return;
    const timer = setTimeout(() => {
      if (!openedAuto.current) {
        openedAuto.current = true;
        void openTrips();
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [autoAdd, place, state]);
  const pendingAdd = useRef<{
    signature: string;
    key: string;
    body: string;
  } | null>(null);
  async function add() {
    if (!place || !tripId || !dayId || busy) return;
    setBusy(true);
    setError('');
    try {
      const signature = JSON.stringify([place.id, tripId, dayId, note]);
      if (pendingAdd.current?.signature !== signature) {
        const { trip } = await api<{ trip: TripDto }>(`/trips/${tripId}`);
        const day = trip.days.find(
          (d) => d.dayId === dayId && d.destinationId === place.destinationId,
        );
        if (!day)
          throw new Error(
            'Ngày đã thay đổi hoặc không thuộc Hội An. Chọn lại chuyến đi.',
          );
        if (
          day.activities.some((a) => a.placeId === place.id) &&
          !confirm(
            'Địa điểm này đã có trong ngày đã chọn. Bạn vẫn muốn thêm một lần nữa?',
          )
        )
          return;
        const input = inputFromTrip(trip);
        input.days = input.days.map((d) =>
          d.dayId === dayId
            ? {
                ...d,
                activities: [
                  ...d.activities,
                  placeActivity(place, note, d.activities.length),
                ],
              }
            : d,
        );
        pendingAdd.current = {
          signature,
          key: crypto.randomUUID(),
          body: JSON.stringify({
            trip: input,
            expectedRevision: trip.revision,
          }),
        };
      }
      const saved = await api<{ trip: TripDto }>(`/trips/${tripId}`, {
        method: 'PATCH',
        body: pendingAdd.current.body,
        headers: { 'Idempotency-Key': pendingAdd.current.key },
      });
      pendingAdd.current = null;
      setAddedPath(
        `/trips/${saved.trip.id}?day=${Math.max(
          0,
          saved.trip.days.findIndex((d) => d.dayId === dayId),
        )}`,
      );
      setSheet(false);
      setNotice('Đã thêm vào chuyến đi.');
    } catch (e) {
      if (e instanceof ApiFailure && e.status === 409)
        pendingAdd.current = null;
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  const selected = trips.find((t) => t.id === tripId);
  if (!place)
    return (
      <div className="explore-status">
        <button onClick={back}>{fromSaved ? '← Đã lưu' : '← Khám phá'}</button>
        <p>{error || 'Đang mở địa điểm…'}</p>
        {error && (
          <button onClick={() => setRetry((v) => v + 1)}>Thử lại</button>
        )}
      </div>
    );
  return (
    <article className="place-detail">
      <div className="place-hero">
        <img
          src={place.imageUrl}
          alt={`${place.name} — ${place.imageCredit}`}
        />
        <button
          className="place-back"
          aria-label={fromSaved ? 'Về Đã lưu' : 'Về Khám phá'}
          onClick={back}
        >
          <ArrowLeft size={23} />
        </button>
        <button
          className="place-hero-save"
          aria-label={state?.saved ? 'Bỏ lưu địa điểm' : 'Lưu địa điểm'}
          disabled={busy || (signedIn && !state)}
          onClick={() => void update(!state?.saved)}
        >
          <Bookmark size={22} fill={state?.saved ? 'currentColor' : 'none'} />
        </button>
      </div>
      <div className="place-body">
        <p className="place-eyebrow">
          {place.destinationName} · {labels[place.category]}
        </p>
        <h1>{place.name}</h1>
        {!!place.images?.length && (
          <div className="place-source-gallery">
            {place.images.map((image, i) => (
              <figure key={image.url + i}>
                <img
                  src={image.url}
                  alt={`${place.name} · ảnh ${i + 1}`}
                  loading="lazy"
                />
                <figcaption>
                  <a href={image.sourceUrl} target="_blank" rel="noreferrer">
                    {image.credit} · {image.license}
                  </a>
                </figcaption>
              </figure>
            ))}
          </div>
        )}
        <div className="place-meta">
          <span>
            <Footprints size={16} />
            {place.travelLabel}
          </span>
          <span title="Thời lượng gợi ý, không phải lịch cố định">
            <Clock size={16} />
            {place.durationLabel}
          </span>
          <span>
            <Sun size={17} />
            {place.bestTimeLabel}
          </span>
        </div>
        <p className="place-description">{place.description}</p>
        <aside className="place-tip">
          <img src="/images/goe-mascot-cutout.png" alt="Goe" />
          <div>
            <h2>
              <Sparkles size={16} />
              Goe gợi ý
            </h2>
            <p>{place.tip}</p>
          </div>
        </aside>
        <section className="place-highlights">
          <h2>Một vòng ghé thăm</h2>
          {place.highlights.map((h) => (
            <a
              href={mapUrl(h.query)}
              target="_blank"
              rel="noreferrer"
              key={h.name}
            >
              <MapPin size={16} />
              {h.name}
              <ChevronRight size={16} />
            </a>
          ))}
        </section>
        <PlacePlanning place={place} />
        <section className="place-notes">
          <h2>Ghi chú của bạn</h2>
          <label>
            <Pencil size={17} />
            <textarea
              maxLength={2000}
              aria-label="Ghi chú của bạn"
              placeholder={
                signedIn
                  ? 'Điều muốn nhớ về nơi này…'
                  : 'Đăng nhập để viết ghi chú'
              }
              value={note}
              disabled={!signedIn || !state || busy}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
          {signedIn ? (
            <div className="place-note-actions">
              <small>{note.length}/2000</small>
              <button
                disabled={!dirty || busy || !state}
                onClick={() => void update()}
              >
                Lưu ghi chú
              </button>
            </div>
          ) : (
            <button
              className="text-button"
              onClick={() => onNavigate('/login')}
            >
              Đăng nhập để ghi chú
            </button>
          )}
        </section>
        {error && (
          <div className="explore-status" role="alert">
            {error}
            <button
              onClick={() => {
                if (
                  !dirty ||
                  confirm(
                    'Tải lại sẽ thay phần ghi chú đang nhập bằng bản trên tài khoản. Tiếp tục?',
                  )
                )
                  setRetry((v) => v + 1);
              }}
            >
              Tải lại dữ liệu
            </button>
          </div>
        )}
        {notice && (
          <p className="place-notice" role="status">
            {notice}
            {notice === 'Đã thêm vào chuyến đi.' && (
              <button
                className="text-button"
                onClick={() => onNavigate(addedPath)}
              >
                Mở chuyến đi →
              </button>
            )}
          </p>
        )}
        <p className="place-source">
          {place.imageCredit} · Thời lượng và gợi ý do GoEase biên tập.{' '}
        </p>
      </div>
      <div className="place-bottom">
        <button
          className="button button-primary"
          onClick={() => void openTrips()}
        >
          Thêm vào chuyến đi <ArrowRight size={19} />
        </button>
        <button
          className="place-bottom-save"
          aria-label={state?.saved ? 'Bỏ lưu địa điểm' : 'Lưu địa điểm'}
          disabled={busy || (signedIn && !state)}
          onClick={() => void update(!state?.saved)}
        >
          <Bookmark size={23} fill={state?.saved ? 'currentColor' : 'none'} />
        </button>
      </div>
      {sheet && (
        <div className="trip-picker-backdrop">
          <section
            ref={pickerRef}
            tabIndex={-1}
            className="trip-picker"
            role="dialog"
            aria-modal="true"
            aria-labelledby="trip-picker-title"
          >
            <button
              className="trip-picker-close"
              aria-label="Đóng"
              disabled={busy}
              onClick={() => setSheet(false)}
            >
              <X />
            </button>
            <h2 id="trip-picker-title">Thêm vào hành trình</h2>
            {tripsLoading ? (
              <p>Đang tải chuyến đi…</p>
            ) : (
              <>
                <label>
                  Chuyến đi tại {place.destinationName}
                  <select
                    value={tripId}
                    disabled={busy}
                    onChange={(e) => {
                      setTripId(e.target.value);
                      setDayId('');
                    }}
                  >
                    <option value="">Chọn chuyến đi</option>
                    {trips.map((t) => (
                      <option value={t.id} key={t.id}>
                        {t.title}
                      </option>
                    ))}
                  </select>
                </label>
                {selected && (
                  <label>
                    Ngày ghé thăm
                    <select
                      value={dayId}
                      disabled={busy}
                      onChange={(e) => setDayId(e.target.value)}
                    >
                      <option value="">Chọn ngày</option>
                      {selected.days
                        .filter((d) => d.destinationId === place.destinationId)
                        .map((d) => (
                          <option key={d.dayId} value={d.dayId}>
                            {d.date}
                          </option>
                        ))}
                    </select>
                  </label>
                )}
                <button
                  className="button button-primary"
                  disabled={busy || !selected || !dayId || tripsLoading}
                  onClick={() => void add()}
                >
                  {busy ? 'Đang thêm…' : 'Thêm vào chuyến đi'}
                </button>
                <button
                  className="button button-outline"
                  disabled={busy}
                  onClick={() => onNewTrip(place, note)}
                >
                  Tạo bản nháp chuyến đi mới
                </button>
              </>
            )}
            {!tripsLoading && !trips.length && !error && (
              <p>
                Chưa có chuyến đi phù hợp. Bạn có thể tạo bản nháp mới bên trên.
              </p>
            )}
            {error && (
              <p role="alert">
                {error}{' '}
                <button disabled={busy} onClick={() => void openTrips()}>
                  Tải lại chuyến đi
                </button>
              </p>
            )}
            <p className="place-source">
              Chỉ hiện chuyến đi của bạn tại {place.destinationName}. Bản nháp
              mới cần được lưu trong màn chỉnh sửa.
            </p>
          </section>
        </div>
      )}
    </article>
  );
}
export function placeActivity(
  place: PlaceDto,
  note: string,
  order: number,
): TripInput['days'][number]['activities'][number] {
  return {
    activityId: crypto.randomUUID(),
    placeId: place.id,
    kind: place.category === 'food' ? 'meal' : 'visit',
    title: place.name,
    timezone: 'Asia/Ho_Chi_Minh',
    order,
    notes: note,
    estimatedCost: catalogCost(place),
    source: 'manual',
  };
}
