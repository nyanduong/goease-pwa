import { useCallback, useEffect, useRef, useState } from 'react';
import { FlaskConical, LockKeyhole, ShieldCheck } from 'lucide-react';
import type { CatalogPolicyDto, PolicySimulation } from '@goease/contracts';
import { api } from '../api';

export function AdminPolicies({ scope }: { scope: string }) {
  const [policies, setPolicies] = useState<CatalogPolicyDto[]>([]),
    [selected, setSelected] = useState('');
  const [name, setName] = useState(''),
    [autoApply, setAutoApply] = useState(false),
    [creating, setCreating] = useState(false);
  const [simulation, setSimulation] = useState<PolicySimulation | null>(null),
    [offset, setOffset] = useState(0);
  const [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const value = await api<{ items: CatalogPolicyDto[] }>(
        '/admin/v3/policies',
      );
      setPolicies(value.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chưa tải được quy tắc.');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    setSimulation(null);
    setOffset(0);
    setError('');
    setNotice('');
  }, [scope, selected]);
  const request = useRef({ body: '', key: '' });
  async function save() {
    const body = JSON.stringify({ name, autoApplyDraftHours: autoApply });
    if (request.current.body !== body)
      request.current = { body, key: crypto.randomUUID() };
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const policy = await api<CatalogPolicyDto>('/admin/v3/policies', {
        method: 'POST',
        headers: { 'Idempotency-Key': request.current.key },
        body,
      });
      await load();
      setSelected(policy.id);
      setCreating(false);
      request.current = { body: '', key: '' };
      setName('');
      setNotice(
        `Đã lưu quy tắc bản ${policy.version}. Đợt đang chạy giữ quy tắc đã chốt; chọn bản này khi tạo đợt mới.`,
      );
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Chưa lưu được quy tắc. Nội dung đang sửa vẫn giữ nguyên.',
      );
    } finally {
      setBusy(false);
    }
  }
  async function simulate(next = 0) {
    if (!selected || !scope) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      setSimulation(
        await api<PolicySimulation>('/admin/v3/policies/dry-run', {
          method: 'POST',
          body: JSON.stringify({
            policyId: selected,
            destinationId: scope,
            offset: next,
          }),
        }),
      );
      setOffset(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chưa chạy được mô phỏng.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      {error && (
        <p className="admin-alert" role="alert">
          {error}
          <button disabled={busy} onClick={() => void load()}>
            Tải lại quy tắc
          </button>
        </p>
      )}
      {notice && (
        <p className="admin-success" role="status">
          {notice}
        </p>
      )}
      <div className="admin-two-column">
        <section className="admin-panel">
          <div className="admin-panel-title">
            <h2>Quy tắc có phiên bản</h2>
            <button
              onClick={() => {
                setCreating((v) => !v);
                setError('');
              }}
            >
              Tạo phiên bản quy tắc
            </button>
          </div>
          {loading && <p role="status">Đang tải quy tắc…</p>}
          {!loading && !policies.length && (
            <p>
              Chưa có phiên bản quy tắc. Đợt mới mặc định đưa thay đổi vào ngoại
              lệ và không tự xuất bản.
            </p>
          )}
          <div className="admin-policy-list">
            {policies.map((p) => (
              <label className="admin-policy-card" key={p.id}>
                <span className="admin-checkbox">
                  <input
                    type="radio"
                    name="policy"
                    value={p.id}
                    checked={selected === p.id}
                    onChange={() => setSelected(p.id)}
                  />
                  <strong>{p.name}</strong>
                  <span className="admin-pill">Bản {p.version}</span>
                </span>
                <p>
                  {p.autoApplyDraftHours
                    ? 'Tự áp dụng giờ nguồn cho bản nháp đủ điều kiện'
                    : 'Đưa thay đổi vào hàng đợi ngoại lệ'}
                </p>
                <small>
                  {new Date(p.createdAt).toLocaleString('vi-VN')} · xuất bản tự
                  động tắt
                </small>
              </label>
            ))}
          </div>
          {creating && (
            <form
              className="admin-form-stack admin-policy-card"
              onSubmit={(e) => {
                e.preventDefault();
                void save();
              }}
            >
              <h3>Phiên bản mới</h3>
              <label>
                Tên quy tắc
                <input
                  required
                  maxLength={100}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ví dụ: Giờ nguồn cho bản nháp"
                />
              </label>
              <label className="admin-checkbox">
                <input
                  type="checkbox"
                  checked={autoApply}
                  onChange={(e) => setAutoApply(e.target.checked)}
                />
                Tự áp dụng giờ nguồn cho bản nháp đủ điều kiện
              </label>
              <p>
                Chỉ thay đổi giờ, nội dung hiện tại còn trùng quan sát trước,
                không khóa biên tập, không nghi trùng hoặc xung đột nguồn.
              </p>
              <button
                className="journey-primary"
                disabled={busy || !name.trim()}
              >
                Lưu phiên bản quy tắc
              </button>
            </form>
          )}
          <div className="admin-actions">
            <button
              className="journey-primary"
              disabled={busy || !selected || !scope}
              onClick={() => void simulate()}
            >
              <FlaskConical size={16} />{' '}
              {busy ? 'Đang mô phỏng…' : 'Mô phỏng tác động'}
            </button>
            <a href="#automatic">Tạo đợt với quy tắc đã chọn →</a>
          </div>
          {!scope && (
            <p>Chọn điểm đến cụ thể trên thanh phạm vi để mô phỏng.</p>
          )}
          {!selected && <p>Chọn một phiên bản quy tắc để mô phỏng.</p>}
        </section>
        <aside className="admin-panel">
          <h2>
            <ShieldCheck size={17} /> Phạm vi tự động an toàn
          </h2>
          <p>
            Quy tắc không tự xuất bản địa điểm. Thay đổi tên, vị trí, loại hình,
            dấu hiệu đóng cửa, nghi trùng và nguồn mâu thuẫn cần người quyết
            định.
          </p>
          <p>
            <LockKeyhole size={17} /> Trường đã khóa và nội dung biên tập được
            bảo vệ. Ngày nhận nguồn không thay ngày xác minh.
          </p>
          <p>
            Mỗi đợt lưu phiên bản quy tắc riêng. Lưu bản quy tắc mới không âm
            thầm đổi các đợt đã bắt đầu.
          </p>
        </aside>
      </div>
      {simulation && (
        <section className="admin-panel">
          <h2>
            Kết quả mô phỏng · {simulation.policy.name} · bản{' '}
            {simulation.policy.version}
          </h2>
          <p>
            {simulation.total} ngoại lệ thuộc phạm vi. Trang này có{' '}
            {simulation.items.filter((p) => p.eligible).length}/
            {simulation.items.length} mục đủ điều kiện tự áp dụng. Mô phỏng
            không ghi thay đổi.
          </p>
          {!simulation.items.length ? (
            <div className="admin-empty">
              <h2>Chưa có thay đổi phù hợp để mô phỏng</h2>
              <p>Thu thập nguồn trước hoặc chọn điểm đến có ngoại lệ nguồn.</p>
            </div>
          ) : (
            <div className="admin-table-scroll">
              <table className="admin-data-table">
                <thead>
                  <tr>
                    <th>Địa điểm</th>
                    <th>Revision</th>
                    <th>Quyết định dự kiến</th>
                    <th>Căn cứ</th>
                  </tr>
                </thead>
                <tbody>
                  {simulation.items.map((p) => (
                    <tr key={p.placeId}>
                      <td>{p.name}</td>
                      <td>{p.expectedRevision}</td>
                      <td>
                        <span
                          className={`admin-pill ${p.eligible ? 'is-good' : 'is-warning'}`}
                        >
                          {p.eligible ? 'Đủ điều kiện' : 'Đưa vào ngoại lệ'}
                        </span>
                      </td>
                      <td>{p.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="admin-actions">
            <button
              disabled={busy || !offset}
              onClick={() => void simulate(Math.max(0, offset - 50))}
            >
              Trang trước
            </button>
            <span>Trang {Math.floor(offset / 50) + 1}</span>
            <button
              disabled={busy || !simulation.hasMore}
              onClick={() => void simulate(offset + 50)}
            >
              Trang tiếp
            </button>
          </div>
        </section>
      )}
    </>
  );
}
