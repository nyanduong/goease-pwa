import { useEffect, useId, useRef, useState } from 'react';
import {
  travelRegions,
  travelRegionOf,
  type DestinationDto,
  type TravelRegion,
} from '@goease/contracts';
import { Check, ChevronDown, MapPin, Search, X } from '../icons';

const regionOf = (destination: DestinationDto) =>
  destination.region ?? travelRegionOf(destination.tourismRegion);
const fold = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .trim();

export function AdminAreaPicker({
  destinations,
  value,
  onChange,
}: {
  destinations: DestinationDto[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const selected = destinations.find((d) => d.id === value);
  const close = () => {
    setOpen(false);
    requestAnimationFrame(() => trigger.current?.focus());
  };
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="admin-area-trigger"
        aria-label={`Khu vực quản lý: ${selected?.name ?? 'Tất cả khu vực'}`}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        <MapPin size={17} aria-hidden="true" />
        <span>{selected?.name ?? 'Tất cả khu vực'}</span>
        <ChevronDown size={15} aria-hidden="true" />
      </button>
      {open && (
        <AreaDialog
          destinations={destinations}
          value={value}
          onChange={onChange}
          onClose={close}
        />
      )}
    </>
  );
}
function AreaDialog({
  destinations,
  value,
  onChange,
  onClose,
}: {
  destinations: DestinationDto[];
  value: string;
  onChange: (id: string) => void;
  onClose: () => void;
}) {
  const [region, setRegion] = useState<TravelRegion | null>(null);
  const [query, setQuery] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const results = destinations
    .filter(
      (d) =>
        (!region || regionOf(d) === region) &&
        fold(d.name).includes(fold(query)),
    )
    .sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    input.current?.focus();
    return () => element?.close();
  }, []);
  const choose = (id: string) => {
    dialog.current?.close();
    onChange(id);
    onClose();
  };
  return (
    <dialog
      ref={dialog}
      className="admin-area-dialog"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <header>
        <h2 id={titleId}>Chọn khu vực</h2>
        <button
          type="button"
          className="admin-area-close"
          aria-label="Đóng chọn khu vực"
          onClick={onClose}
        >
          <X size={18} />
        </button>
      </header>
      <div className="admin-area-controls">
        <div className="admin-area-regions" role="group" aria-label="Chọn miền">
          {travelRegions.map((item) => (
            <button
              type="button"
              key={item.code}
              aria-pressed={region === item.code}
              onClick={() => setRegion(region === item.code ? null : item.code)}
            >
              {item.name}
            </button>
          ))}
        </div>
        <label className="admin-area-search">
          <Search size={18} aria-hidden="true" />
          <input
            ref={input}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Tìm tên tỉnh/thành…"
            aria-label="Tìm tỉnh theo tên"
            maxLength={100}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && results.length === 1) {
                event.preventDefault();
                choose(results[0]!.id);
              }
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                dialog.current
                  ?.querySelector<HTMLButtonElement>('[data-area-option]')
                  ?.focus();
              }
            }}
          />
          {query && (
            <button
              type="button"
              aria-label="Xóa tìm tỉnh"
              onClick={() => {
                setQuery('');
                input.current?.focus();
              }}
            >
              <X size={16} />
            </button>
          )}
        </label>
        <button
          type="button"
          className="admin-area-all"
          onClick={() => choose('')}
        >
          <span>Tất cả khu vực</span>
          {!value && <Check size={16} aria-hidden="true" />}
        </button>
      </div>
      <div
        className="admin-area-results"
        aria-label="Tỉnh thành"
        onKeyDown={(event) => {
          if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key))
            return;
          const options = [
            ...(dialog.current?.querySelectorAll<HTMLButtonElement>(
              '[data-area-option]',
            ) ?? []),
          ];
          const index = options.indexOf(
            document.activeElement as HTMLButtonElement,
          );
          if (index < 0) return;
          event.preventDefault();
          if (event.key === 'Home') options[0]?.focus();
          else if (event.key === 'End') options.at(-1)?.focus();
          else if (event.key === 'ArrowUp' && index === 0)
            input.current?.focus();
          else
            options[
              Math.min(
                options.length - 1,
                index + (event.key === 'ArrowDown' ? 1 : -1),
              )
            ]?.focus();
        }}
      >
        <p className="sr-only" role="status">
          {results.length} tỉnh thành phù hợp
        </p>
        {results.map((d) => (
          <button
            key={d.id}
            type="button"
            data-area-option
            aria-pressed={value === d.id}
            onClick={() => choose(d.id)}
          >
            <span>
              <strong>{d.name}</strong>
              <small>
                {travelRegions.find((r) => r.code === regionOf(d))?.name ??
                  'Chưa phân miền'}
              </small>
            </span>
            {value === d.id && (
              <Check
                size={17}
                className="admin-area-selected"
                aria-hidden="true"
              />
            )}
          </button>
        ))}
        {!results.length && (
          <div className="admin-area-empty">
            <p>Không tìm thấy tỉnh phù hợp.</p>
            {region && (
              <button type="button" onClick={() => setRegion(null)}>
                Tìm trong cả nước
              </button>
            )}
          </div>
        )}
      </div>
    </dialog>
  );
}
