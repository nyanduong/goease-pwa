import {
  travelRegions,
  tourismRegions,
  travelRegionOf,
  type DestinationDto,
} from '@goease/contracts';
export function matchesRegion(
  d: DestinationDto,
  region: string,
  subregion: string,
) {
  return (
    (!region || travelRegionOf(d.tourismRegion) === region) &&
    (!subregion || d.tourismRegion === subregion)
  );
}
export function DestinationRegions({
  region,
  subregion,
  onChange,
}: {
  region: string;
  subregion: string;
  onChange: (region: string, subregion: string) => void;
}) {
  return (
    <div className="destination-region-filters">
      <label>
        Miền du lịch
        <select
          aria-label="Miền du lịch"
          value={region}
          onChange={(e) => onChange(e.target.value, '')}
        >
          <option value="">Cả Việt Nam</option>
          {travelRegions.map((r) => (
            <option key={r.code} value={r.code}>
              {r.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Vùng du lịch
        <select
          aria-label="Vùng du lịch"
          value={subregion}
          onChange={(e) => onChange(region, e.target.value)}
        >
          <option value="">Tất cả vùng</option>
          {tourismRegions
            .filter((r) => !region || r.region === region)
            .map((r) => (
              <option key={r.code} value={r.code}>
                {r.name}
              </option>
            ))}
        </select>
      </label>
    </div>
  );
}
