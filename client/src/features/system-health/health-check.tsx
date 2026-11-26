import {
  ArrowClockwiseIcon,
  CheckCircleIcon,
  PlugsConnectedIcon,
  SpinnerGapIcon,
  WarningCircleIcon,
} from '@phosphor-icons/react';
import { healthSchema } from '@goease/contracts';
import { useEffect, useState } from 'react';
import { apiBasePath, apiTimeoutMs } from '../../config/api';
import { ApiRequestError, getApi } from '../../shared/api/client';
import { Surface } from '../../shared/ui/surface';

const healthPath = '/health';
type HealthState =
  | { status: 'loading' }
  | { status: 'success' }
  | { status: 'error'; message: string };

export function HealthCheck() {
  const [health, setHealth] = useState<HealthState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const lifetime = new AbortController();
    const timeout = AbortSignal.timeout(apiTimeoutMs);
    const signal = AbortSignal.any([lifetime.signal, timeout]);
    void getApi(healthPath, healthSchema.parse, signal)
      .then(() => {
        if (!lifetime.signal.aborted) setHealth({ status: 'success' });
      })
      .catch((error: unknown) => {
        if (lifetime.signal.aborted) return;
        let message = 'Không kết nối được với API. Hãy thử lại.';
        if (timeout.aborted) message = 'API chưa phản hồi kịp. Hãy thử lại.';
        else if (
          error instanceof ApiRequestError &&
          error.code === 'INVALID_RESPONSE'
        )
          message = 'API trả về phản hồi không hợp lệ. Hãy thử lại.';
        setHealth({ status: 'error', message });
      });
    return () => lifetime.abort();
  }, [attempt]);

  const loading = health.status === 'loading';
  const failed = health.status === 'error';
  const StatusIcon = loading
    ? SpinnerGapIcon
    : failed
      ? WarningCircleIcon
      : CheckCircleIcon;
  const statusLabel = loading
    ? 'Đang kiểm tra'
    : failed
      ? 'Kiểm tra thất bại'
      : 'Đã kết nối';

  return (
    <Surface aria-labelledby="health-title" className="health-card">
      <div className="flex items-center gap-3">
        <span className="icon-tile">
          <PlugsConnectedIcon size={22} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 id="health-title" className="section-title">
            Kết nối API
          </h2>
          <code className="endpoint">
            GET {apiBasePath}
            {healthPath}
          </code>
        </div>
      </div>
      <div className="health-result">
        <div role="status">
          <p
            className={`status-label ${failed ? 'text-warm-ink' : 'text-primary'}`}
          >
            <StatusIcon
              size={20}
              className={loading ? 'motion-safe:animate-spin' : undefined}
              aria-hidden="true"
            />
            {statusLabel}
          </p>
          {failed && (
            <p className="mt-1 text-ink-secondary">{health.message}</p>
          )}
          {health.status === 'success' && (
            <p className="mt-1 text-ink-secondary">
              Dịch vụ GoEase API đang phản hồi.
            </p>
          )}
        </div>
        <button
          type="button"
          className="action-button"
          aria-disabled={loading}
          onClick={() => {
            if (loading) return;
            setHealth({ status: 'loading' });
            setAttempt((current) => current + 1);
          }}
        >
          <ArrowClockwiseIcon size={18} aria-hidden="true" />
          {failed ? 'Thử lại' : 'Kiểm tra lại'}
        </button>
      </div>
    </Surface>
  );
}
