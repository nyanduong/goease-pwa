import { catalogToday, type VisitInfo } from '@goease/contracts';
type Price = NonNullable<VisitInfo['price']>;
type Terms = NonNullable<Price['terms']>;
export function AdminPriceTerms({
  price,
  venueType,
  onChange,
}: {
  price: Price;
  venueType: string;
  onChange: (patch: Partial<Terms>) => void;
}) {
  const t = price.terms;
  return (
    <div className="visit-price-terms">
      <h3>Điều kiện áp dụng của giá này</h3>
      <p>
        Hệ thống dùng cùng giá này tính chi phí khi đối tượng, dịch vụ và thời
        hạn áp dụng đủ rõ.
      </p>
      <label>
        Đối tượng của giá
        <select
          aria-label="Đối tượng của giá"
          value={t?.audience ?? 'unknown'}
          onChange={(e) =>
            onChange({ audience: e.target.value as Terms['audience'] })
          }
        >
          <option value="unknown">Chưa xác định rõ</option>
          <option value="standard">
            Giá thông thường cho người lớn / suất ăn tiêu chuẩn
          </option>
          <option value="restricted">
            Trẻ em, đối tượng ưu đãi hoặc điều kiện đặc biệt
          </option>
        </select>
      </label>
      <div className="visit-editor-fields">
        <label>
          Đã bao gồm
          <input
            maxLength={500}
            value={t?.inclusions ?? ''}
            placeholder="Ví dụ: Vé vào cửa và tham quan"
            onChange={(e) => onChange({ inclusions: e.target.value })}
          />
        </label>
        <label>
          Chưa bao gồm
          <input
            maxLength={500}
            value={t?.exclusions ?? ''}
            placeholder="Ví dụ: Hướng dẫn viên; hoặc Không có"
            onChange={(e) => onChange({ exclusions: e.target.value })}
          />
        </label>
      </div>
      <label>
        Kiểm tra giá lại vào ngày
        <input
          aria-label="Kiểm tra giá lại vào ngày"
          type="date"
          min={catalogToday()}
          value={t?.reviewAfter ?? catalogToday()}
          onInput={(e) => onChange({ reviewAfter: e.currentTarget.value })}
          onChange={(e) => onChange({ reviewAfter: e.target.value })}
        />
      </label>
      {t?.checkedAt && (
        <small>
          Đã xác nhận ngày {t.checkedAt.split('-').reverse().join('/')}. Thay
          đổi giá hoặc điều kiện cần xác nhận lại.
        </small>
      )}
      <details
        className="visit-price-special"
        open={price.unit === 'group' || !!t?.bundle}
      >
        <summary>Giới hạn số người & vé gói (nếu có)</summary>
        <div className="visit-editor-fields">
          <label>
            Số người tối thiểu
            <input
              type="number"
              min={1}
              max={1000}
              value={t?.minTravelers ?? 1}
              onChange={(e) =>
                onChange({
                  minTravelers:
                    e.target.value === '' ? undefined : e.target.valueAsNumber,
                })
              }
            />
          </label>
          <label>
            Số người tối đa
            <input
              type="number"
              min={1}
              max={1000}
              value={t?.maxTravelers ?? (price.unit === 'person' ? 1000 : '')}
              placeholder="Cần điền khi giá theo nhóm"
              onChange={(e) =>
                onChange({
                  maxTravelers:
                    e.target.value === '' ? undefined : e.target.valueAsNumber,
                })
              }
            />
          </label>
        </div>
        <label>
          Tên vé / khoản chi (tùy chọn)
          <input
            maxLength={120}
            value={t?.label ?? ''}
            onChange={(e) => onChange({ label: e.target.value })}
          />
        </label>
        <label className="visit-inline-check">
          <input
            type="checkbox"
            disabled={venueType !== 'place' && !t?.bundle}
            checked={!!t?.bundle}
            onChange={(e) =>
              onChange({
                bundle: e.target.checked
                  ? { code: '', validDays: 1, maxEntries: 1 }
                  : undefined,
              })
            }
          />
          Đây là vé gói dùng chung cho nhiều điểm
        </label>
        {t?.bundle && (
          <div className="visit-bundle-fields">
            <label>
              Mã vé gói
              <input
                maxLength={80}
                value={t.bundle.code}
                placeholder="Ví dụ: ve-tham-quan-chung"
                onChange={(e) =>
                  onChange({ bundle: { ...t.bundle!, code: e.target.value } })
                }
              />
            </label>
            <label>
              Số ngày hiệu lực
              <input
                type="number"
                min={1}
                max={31}
                value={t.bundle.validDays}
                onChange={(e) =>
                  onChange({
                    bundle: { ...t.bundle!, validDays: e.target.valueAsNumber },
                  })
                }
              />
            </label>
            <label>
              Số lượt vào cửa
              <input
                type="number"
                min={1}
                max={300}
                value={t.bundle.maxEntries}
                onChange={(e) =>
                  onChange({
                    bundle: {
                      ...t.bundle!,
                      maxEntries: e.target.valueAsNumber,
                    },
                  })
                }
              />
            </label>
          </div>
        )}
      </details>
    </div>
  );
}
