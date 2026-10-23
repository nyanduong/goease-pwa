import { useState } from 'react';
import {
  ArrowRight,
  Bookmark,
  ChevronRight,
  Map,
  Search,
  Sparkles,
} from 'lucide-react';
import type { DestinationDto, TripDto, UserDto } from '@goease/contracts';

const suggestions = [
  {
    slug: 'hoi-an',
    name: 'Hội An',
    subtitle: 'Phố cổ & ánh đèn',
    category: 'Văn hóa',
    image: '/images/destination-hoian.png',
  },
  {
    slug: 'sa-pa',
    name: 'Sa Pa',
    subtitle: 'Núi rừng & mây trời',
    category: 'Thiên nhiên',
    image: '/images/destination-sapa.png',
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
  const [category, setCategory] = useState('Tất cả');
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
  const visible = suggestions.filter(
    (d) =>
      (mode !== 'saved' || saved.includes(d.slug)) &&
      (category === 'Tất cả' || category === d.category) &&
      fold(d.name).includes(fold(query)),
  );

  if (mode === 'goe')
    return (
      <section className="goe-coming">
        <img src="/images/goe-mascot-cutout.png" alt="Goe" />
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
    <div className="discovery-page">
      <section className="discovery-intro">
        <p className="discovery-eyebrow">CHÀO BẠN, MÌNH LÀ GOE</p>
        <h1>
          {mode === 'saved' ? (
            'Những nơi bạn muốn đến.'
          ) : mode === 'explore' ? (
            'Một nơi mới, một niềm vui.'
          ) : (
            <>
              Hôm nay, mình
              <br />
              đi đâu?
            </>
          )}
        </h1>
        <label className="discovery-search">
          <Search size={20} aria-hidden="true" />
          <input
            type="search"
            aria-label="Tìm điểm đến ở Việt Nam"
            placeholder="Tìm điểm đến ở Việt Nam"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </section>
      {mode === 'home' && (
        <section className="discovery-banner" aria-label="Tạo chuyến đi">
          <div className="discovery-banner-copy">
            <h2>
              Một ý tưởng.
              <br />
              Cả một hành trình.
            </h2>
            <p>Chọn điểm đến, số ngày và số người. Goe lo phần lịch trình.</p>
            <button
              data-start-trip
              className="button button-primary"
              onClick={() => onStart()}
            >
              Tạo chuyến đi <ArrowRight size={15} />
            </button>
          </div>
          <svg
            className="banner-mountains"
            viewBox="0 0 400 90"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="m0 90 80-32 26 7 42-43 25 28 20-12 45 40 51-45 30 28 25-15 56 34"
              stroke="#a9c5a4"
              strokeWidth="1"
            />
            <path
              d="m120 90 31-49 15 20 17-8 41 37M280 90l39-44 34 44"
              stroke="#c9d1aa"
              opacity=".5"
            />
          </svg>
          <Sparkles className="banner-sparkles" size={27} aria-hidden="true" />
          <img
            className="discovery-banner-goe"
            src="/images/goe-mascot-cutout.png"
            alt="Goe, linh thú du lịch GoEase"
          />
        </section>
      )}
      <section
        className="discovery-destinations"
        aria-labelledby="discovery-destinations-title"
      >
        <h2 id="discovery-destinations-title">
          {mode === 'saved' ? 'Điểm đến đã lưu' : 'Đi gần hay đi xa?'}
        </h2>
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
        {saveError && (
          <p role="status" className="discovery-empty">
            {saveError}
          </p>
        )}
        {visible.length ? (
          <div className="discovery-cards">
            {visible.map((d) => {
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
                    <img
                      src={d.image}
                      alt={`${d.name} — ảnh minh họa tạo bằng AI`}
                    />
                    <span className="discovery-card-caption">
                      <strong>{d.name}</strong>
                      <span>
                        {destination
                          ? d.subtitle
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
                      fill={saved.includes(d.slug) ? 'currentColor' : 'none'}
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
      {mode === 'home' && (
        <section className="discovery-trips" aria-label="Chuyến đi của bạn">
          <div className="discovery-section-heading">
            <h2>Chuyến đi của bạn</h2>
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
            <p className="discovery-empty" role="status">
              Đang tải chuyến đi…
            </p>
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
                      {trip.destinationName} · {trip.travelers.totalCount} người
                    </small>
                  </span>
                  <ChevronRight size={18} />
                </button>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
