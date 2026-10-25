import { useEffect, useRef, useState } from 'react';
import { Check, ChevronRight, Search } from 'lucide-react';
import type { DestinationDto } from '@goease/contracts';
import { Sheet } from './journey-sheet';
import { DestinationRegions, matchesRegion } from './destination-regions';

const fold = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .trim();

export function DestinationPicker({
  destinations,
  selectedId,
  initialQuery = '',
  initialRegion = '',
  initialSubregion = '',
  onSelect,
  onClose,
}: {
  destinations: DestinationDto[];
  selectedId?: string | undefined;
  initialQuery?: string;
  initialRegion?: string;
  initialSubregion?: string;
  onSelect: (destination: DestinationDto) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [region, setRegion] = useState(initialRegion);
  const [subregion, setSubregion] = useState(initialSubregion);
  const search = useRef<HTMLInputElement>(null);
  useEffect(() => {
    search.current?.focus();
  }, []);
  const visible = destinations.filter(
    (d) =>
      matchesRegion(d, region, subregion) &&
      fold([d.name, ...(d.tourismAreas ?? [])].join(' ')).includes(fold(query)),
  );
  return (
    <Sheet
      title="Chọn tỉnh/thành"
      className="destination-picker"
      onClose={onClose}
    >
      <label className="destination-picker-search">
        <Search size={19} aria-hidden="true" />
        <input
          ref={search}
          type="search"
          aria-label="Tìm tỉnh/thành"
          placeholder="Tìm tỉnh/thành hoặc khu vực"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      <DestinationRegions
        region={region}
        subregion={subregion}
        onChange={(r, s) => {
          setRegion(r);
          setSubregion(s);
        }}
      />
      <p className="destination-picker-count" role="status">
        {visible.length} tỉnh/thành
      </p>
      <div className="destination-picker-results">
        {visible.length ? (
          <ul aria-label="Danh sách tỉnh/thành">
            {visible.map((d) => (
              <li key={d.id}>
                <button
                  type="button"
                  aria-pressed={selectedId === d.id}
                  onClick={() => {
                    onClose();
                    onSelect(d);
                  }}
                >
                  <span>
                    <strong>{d.name}</strong>
                    {!!d.tourismAreas?.length && (
                      <small>{d.tourismAreas.join(' · ')}</small>
                    )}
                  </span>
                  {selectedId === d.id ? (
                    <Check size={19} aria-hidden="true" />
                  ) : (
                    <ChevronRight size={18} aria-hidden="true" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="destination-picker-empty">
            <p>
              {destinations.length
                ? 'Không tìm thấy tỉnh/thành phù hợp.'
                : 'Chưa có tỉnh/thành được bật để chọn.'}
            </p>
            {!!destinations.length && (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setRegion('');
                  setSubregion('');
                }}
              >
                Xóa tìm kiếm và bộ lọc
              </button>
            )}
          </div>
        )}
      </div>
    </Sheet>
  );
}
