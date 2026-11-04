import { useEffect, useState } from 'react';
import type { PlaceDto } from '@goease/contracts';
import { api } from '../api';
import { SourceCredit } from './source-credit';
export function DataCredits() {
  const [items, setItems] = useState<PlaceDto[]>([]),
    [offset, setOffset] = useState(0),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    void api<{ items: PlaceDto[] }>(`/places?limit=20&offset=${offset}`)
      .then((r) => {
        if (active) setItems(r.items);
      })
      .catch(() => {
        if (active) setError('Chưa tải được nguồn dữ liệu.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [offset]);
  return (
    <section className="data-credits">
      <SourceCredit expanded />
      <h2>Nguồn địa điểm và hình ảnh</h2>
      {loading ? (
        <p role="status">Đang tải…</p>
      ) : error ? (
        <p role="alert">{error}</p>
      ) : (
        <ul>
          {items.map((p) => (
            <li key={p.id}>
              <strong>{p.name}</strong>
              {p.images?.map((im, i) => (
                <div key={i}>
                  <a href={im.sourceUrl} target="_blank" rel="noreferrer">
                    {im.credit}
                  </a>
                  <span> · {im.license}</span>
                  {im.licenseUrl && (
                    <a href={im.licenseUrl} target="_blank" rel="noreferrer">
                      {' '}
                      · Giấy phép
                    </a>
                  )}
                </div>
              ))}
            </li>
          ))}
        </ul>
      )}
      <div className="credits-paging">
        <button
          type="button"
          disabled={!offset || loading}
          onClick={() => setOffset((v) => Math.max(0, v - 20))}
        >
          Trước
        </button>
        <span>Trang {offset / 20 + 1}</span>
        <button
          type="button"
          disabled={items.length < 20 || loading}
          onClick={() => setOffset((v) => v + 20)}
        >
          Tiếp
        </button>
      </div>
    </section>
  );
}
