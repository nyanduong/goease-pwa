import { images, destinationCovers } from '@goease/media';
import { useState } from 'react';
import {
  ArrowRight,
  Bookmark,
  ChevronRight,
  Map,
  Search,
  Compass,
  Wallet,
  MapPin,
} from '../icons';
import { LoadingSkeleton } from './customer-shell';
import type { DestinationDto, TripDto, UserDto } from '@goease/contracts';
import { DestinationRegions, matchesRegion } from './destination-regions';
import { DestinationPicker } from './destination-picker';

const suggestions = [
  {
    slug: 'hoi-an',
    name: 'Hội An',
    subtitle: 'Phố cổ & ánh đèn',
    category: 'Văn hóa',
    image: images.destinationHoian,
  },
  {
    slug: 'sa-pa',
    name: 'Sa Pa',
    subtitle: 'Núi rừng & mây trời',
    category: 'Thiên nhiên',
    image: images.destinationSapa,
  },
];
const fold = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .toLowerCase();
type Props = {
  mode: 'home' | 'explore' | 'saved' | 'goe';
  user: UserDto | null;
  destinations: DestinationDto[];
  trips: TripDto[];
  tripsStatus: 'idle' | 'loading' | 'ready' | 'error';
  onRetry: () => void;
  onStart: (destinationId?: string) => void;
  onNavigate: (path: string) => void;
};

export function HomeDiscovery({
  mode,
  user,
  destinations,
  trips,
  tripsStatus,
  onRetry,
  onStart,
  onNavigate,
}: Props) {
  const [query, setQuery] = useState('');
  const [showAllDestinations, setShowAllDestinations] = useState(false);
  const [category, setCategory] = useState('Tất cả');
  const [region, setRegion] = useState(''),
    [subregion, setSubregion] = useState('');
  const storageKey = user ? `goease:saved-destinations:v1:${user.id}` : null;
  const [saved, setSaved] = useState<string[]>(() => {
    try {
      const value: unknown = JSON.parse(
        storageKey ? (localStorage.getItem(storageKey) ?? '[]') : '[]',
      );
      return Array.isArray(value)
        ? value.filter((v): v is string => typeof v === 'string')
        : [];
    } catch {
      return [];
    }
  });
  const [saveError, setSaveError] = useState('');
  const toggleSaved = (slug: string) => {
    if (!user) {
      onNavigate('/login');
      return;
    }
    const next = saved.includes(slug)
      ? saved.filter((v) => v !== slug)
      : [...saved, slug];
    setSaved(next);
    try {
      if (storageKey) localStorage.setItem(storageKey, JSON.stringify(next));
      setSaveError('');
    } catch {
      setSaveError(
        'Trình duyệt chưa lưu được lựa chọn. Lựa chọn chỉ giữ trong lần mở này.',
      );
    }
  };
  const cards = destinations.map((d) => {
    const known = suggestions.find(
      (s) => d.tourismAreas?.includes(s.name) || fold(s.name) === fold(d.name),
    );
    return {
      slug: d.slug ?? d.id,
      name: d.name,
      subtitle: d.summary || 'Khám phá theo cách của bạn',
      category: known?.category ?? 'Khám phá',
      image: destinationCovers[d.slug ?? ''] ?? known?.image,
      destination: d,
    };
  });
  const visible = cards.filter(
    (d) =>
      (mode !== 'saved' || saved.includes(d.slug)) &&
      (d.destination
        ? matchesRegion(d.destination, region, subregion)
        : !region && !subregion) &&
      (category === 'Tất cả' || category === d.category) &&
      fold([d.name, ...(d.destination?.tourismAreas ?? [])].join(' ')).includes(
        fold(query),
      ),
  );
  const IntroHeading = mode === 'home' ? 'h2' : 'h1';
  const displayed = mode === 'home' ? visible.slice(0, 4) : visible;

  if (mode === 'goe')
    return (
      <section className="goe-coming">
        <img src={images.goeMascot} alt="Goe" />
        <h1>Chào bạn, mình là Goe!</h1>
        <p>
          Goe đang chuẩn bị tính năng gợi ý hành trình. Hiện tại, bạn có thể tự
          tạo và lưu kế hoạch của mình.
        </p>
        <button className="button button-primary" onClick={() => onStart()}>
          Tạo chuyến đi <ArrowRight size={16} />
        </button>
      </section>
    );

  return (
    <div
      className={`discovery-page ${mode === 'home' ? 'discovery-home' : ''}`}
    >
      {mode === 'home' && (
        <section className="discovery-banner" aria-label="Tạo chuyến đi">
          <img
            className="discovery-landscape"
            src={images.welcomeHalongBay}
            alt=""
          />
          <div className="discovery-banner-copy">
            <p className="discovery-greeting">
              Xin chào{user ? `, ${user.displayName}` : ''},
            </p>
            <h1>Đi đâu hôm nay?</h1>
          </div>
          <span className="discovery-slogan">
            Just go.
            <br />
            We’ll plan.
          </span>
          <div className="discovery-start">
            <button
              data-start-trip
              className="button home-destination-search"
              onClick={() => setShowAllDestinations(true)}
            >
              <Search size={18} aria-hidden="true" /> Tìm điểm đến
              <ChevronRight size={18} aria-hidden="true" />
            </button>
          </div>
        </section>
      )}
      {mode === 'home' && (
        <section className="discovery-trips" aria-label="Chuyến đi của bạn">
          <div className="discovery-section-heading">
            <h2>Chuyến đi gần đây</h2>
            <button onClick={() => onNavigate(user ? '/trips' : '/login')}>
              Xem tất cả <ArrowRight size={14} />
            </button>
          </div>
          {!user ? (
            <button
              className="discovery-trip-empty"
              onClick={() => onNavigate('/login')}
            >
              <span className="trip-empty-icon">
                <Map size={22} />
              </span>
              <span>
                <strong>Hành trình của bạn bắt đầu từ đây</strong>
                <small>Đăng nhập để lưu chuyến đi</small>
              </span>
              <ChevronRight size={18} />
            </button>
          ) : tripsStatus === 'loading' ? (
            <LoadingSkeleton label="Đang tải chuyến đi…" rows={2} />
          ) : tripsStatus === 'error' ? (
            <div className="discovery-empty" role="alert">
              Chưa tải được chuyến đi.{' '}
              <button className="text-button" onClick={onRetry}>
                Thử lại
              </button>
            </div>
          ) : !trips.length ? (
            <button className="discovery-trip-empty" onClick={() => onStart()}>
              <span className="trip-empty-icon">
                <Map size={22} />
              </span>
              <span>
                <strong>Chưa có chuyến đi nào</strong>
                <small>Tạo lịch trình đầu tiên cùng GoEase</small>
              </span>
              <ChevronRight size={18} />
            </button>
          ) : (
            <div className="discovery-trip-list">
              {trips.slice(0, 3).map((trip) => (
                <button
                  className="discovery-trip-row"
                  key={trip.id}
                  onClick={() => onNavigate(`/trips/${trip.id}`)}
                >
                  <span className="trip-empty-icon">
                    <Map size={22} />
                  </span>
                  <span>
                    <strong>{trip.title}</strong>
                    <small>
                      {trip.destinationName} ·{' '}
                      {trip.startDate.split('-').reverse().join('/')}
                    </small>
                  </span>
                  <ChevronRight size={18} />
                </button>
              ))}
            </div>
          )}
        </section>
      )}
      {mode === 'home' && (
        <section
          className="discovery-shortcuts"
          aria-labelledby="discovery-shortcuts-title"
        >
          <h2 id="discovery-shortcuts-title" className="sr-only">
            Truy cập nhanh
          </h2>
          <div>
            <button onClick={() => onNavigate(user ? '/trips' : '/login')}>
              <Wallet aria-hidden="true" size={21} />
              <span>Chuyến đi</span>
            </button>
            <button onClick={() => onNavigate('/explore')}>
              <Compass aria-hidden="true" size={21} />
              <span>Địa điểm</span>
            </button>
            <button onClick={() => onNavigate(user ? '/goe' : '/login')}>
              <img src={images.goeMascot} alt="" width={24} height={24} />
              <span>Hỏi Goe</span>
            </button>
          </div>
        </section>
      )}
      <section
        className="discovery-destinations"
        aria-labelledby="discovery-destinations-title"
      >
        <div className="discovery-section-heading">
          <IntroHeading id="discovery-destinations-title">
            {mode === 'saved' ? 'Điểm đến đã lưu' : 'Điểm đến'}
          </IntroHeading>
          <button onClick={() => setShowAllDestinations(true)}>
            Xem tất cả <ChevronRight size={15} />
          </button>
        </div>
        <details className="home-destination-filters">
          <summary>
            <Search size={16} /> Tìm và lọc điểm đến
          </summary>
          <label className="discovery-search">
            <Search size={18} />
            <input
              type="search"
              aria-label="Tìm điểm đến ở Việt Nam"
              placeholder="Tìm tỉnh/thành"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <div className="discovery-filters" aria-label="Loại điểm đến">
            {['Tất cả', 'Thiên nhiên', 'Văn hóa'].map((c) => (
              <button
                key={c}
                aria-pressed={category === c}
                onClick={() => setCategory(c)}
              >
                {c}
              </button>
            ))}
          </div>
          <DestinationRegions
            region={region}
            subregion={subregion}
            onChange={(r, s) => {
              setRegion(r);
              setSubregion(s);
            }}
          />
        </details>
        {saveError && (
          <p role="status" className="discovery-empty">
            {saveError}
          </p>
        )}
        {visible.length ? (
          <div className="discovery-cards">
            {displayed.map((d) => {
              const destination = destinations.find(
                (v) => fold(v.name) === fold(d.name),
              );
              return (
                <article className="discovery-card" key={d.slug}>
                  <button
                    className="discovery-card-open"
                    data-start-trip
                    disabled={!destination}
                    onClick={() => destination && onStart(destination.id)}
                    aria-label={
                      destination
                        ? `Lên kế hoạch đến ${d.name}`
                        : `${d.name} · Chưa hỗ trợ lập lịch`
                    }
                  >
                    {d.image ? (
                      <img
                        src={d.image}
                        alt={`${d.name} — ảnh minh họa tạo bằng AI`}
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      <span
                        className="discovery-destination-placeholder"
                        aria-hidden="true"
                      >
                        <MapPin size={32} weight="regular" />
                      </span>
                    )}
                    <span className="discovery-card-caption">
                      <strong>{d.name}</strong>
                      <span>
                        {destination
                          ? d.destination.tourismAreas
                              ?.slice(0, 2)
                              .join(' · ') || ''
                          : 'Sắp có · Chưa hỗ trợ lập lịch'}
                      </span>
                    </span>
                  </button>
                  <button
                    className="discovery-bookmark"
                    aria-label={`${saved.includes(d.slug) ? 'Bỏ lưu' : 'Lưu'} ${d.name}`}
                    aria-pressed={saved.includes(d.slug)}
                    onClick={() => toggleSaved(d.slug)}
                  >
                    <Bookmark
                      size={18}
                      weight={saved.includes(d.slug) ? 'fill' : 'regular'}
                    />
                  </button>
                </article>
              );
            })}
          </div>
        ) : (
          <p className="discovery-empty">
            {mode === 'saved'
              ? 'Bạn chưa lưu điểm đến nào trong mục này. Chạm biểu tượng đánh dấu trên thẻ để lưu.'
              : 'Chưa tìm thấy điểm đến phù hợp.'}
          </p>
        )}
        {mode === 'saved' && (
          <p className="discovery-storage-note">
            Điểm đến được lưu trên trình duyệt này.
          </p>
        )}
      </section>
      {showAllDestinations && (
        <DestinationPicker
          destinations={cards
            .filter((c) => category === 'Tất cả' || category === c.category)
            .map((c) => c.destination)}
          initialQuery={query}
          initialRegion={region}
          initialSubregion={subregion}
          onClose={() => setShowAllDestinations(false)}
          onSelect={(d) => onStart(d.id)}
        />
      )}
    </div>
  );
}
