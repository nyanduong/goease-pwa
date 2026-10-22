import { tripInputSchema, type TripDto } from '@goease/contracts';
import { api, ApiFailure } from './api';

// Shared storage contract with the dependency-free public/offline.js reader.
export const offlineKeys = {
  owner: 'goease:offline:owner:v1',
  data: 'goease:offline:data:v1',
  logout: 'goease:offline:logout:v1',
};
type Owner = { id: string; epoch: string };
type Snapshot = { savedAt: string; trip: TripDto };
type Stored = { version: 1; owner: Owner; apiBase: string; items: Snapshot[] };

export function clearOffline() {
  // Invalidate outstanding downloads before removing their data.
  localStorage.removeItem(offlineKeys.owner);
  localStorage.removeItem(offlineKeys.data);
  window.dispatchEvent(new Event('goease-offline-change'));
}
export function offlineOwner(id: string | null) {
  if (!id) return clearOffline();
  const raw = localStorage.getItem(offlineKeys.owner);
  let previous: Owner | null = null;
  try {
    previous = raw ? (JSON.parse(raw) as Owner) : null;
  } catch {
    /* replace malformed owner */
  }
  if (previous?.id !== id || !previous.epoch) {
    clearOffline();
    localStorage.setItem(
      offlineKeys.owner,
      JSON.stringify({ id, epoch: crypto.randomUUID() }),
    );
  }
}
export function offlineItems(): Snapshot[] {
  try {
    if (localStorage.getItem(offlineKeys.logout)) return [];
    const value = JSON.parse(
      localStorage.getItem(offlineKeys.data) ?? 'null',
    ) as Stored | null;
    const owner = localStorage.getItem(offlineKeys.owner);
    return value?.version === 1 &&
      JSON.stringify(value.owner) === owner &&
      Array.isArray(value.items)
      ? value.items
      : [];
  } catch {
    return [];
  }
}
export function removeOffline(id: string) {
  const raw = localStorage.getItem(offlineKeys.data);
  if (!raw) return;
  const data = JSON.parse(raw) as Stored;
  data.items = data.items.filter((item) => item.trip.id !== id);
  localStorage.setItem(offlineKeys.data, JSON.stringify(data));
  window.dispatchEvent(new Event('goease-offline-change'));
}
export function offlineLogoutPending() {
  try {
    return Boolean(localStorage.getItem(offlineKeys.logout));
  } catch {
    return false;
  }
}
export async function finishOfflineLogout() {
  if (!offlineLogoutPending()) return;
  await api('/auth/logout', { method: 'POST' });
  localStorage.removeItem(offlineKeys.logout);
}
export function beginOfflineLogout() {
  localStorage.setItem(
    offlineKeys.logout,
    JSON.stringify({ apiBase: import.meta.env.VITE_API_BASE_URL ?? '' }),
  );
  clearOffline();
}
export async function saveOffline(id: string) {
  const ownerRaw = localStorage.getItem(offlineKeys.owner);
  if (!ownerRaw || localStorage.getItem(offlineKeys.logout))
    throw new Error('Đăng nhập lại trước khi tải chuyến đi.');
  const owner = JSON.parse(ownerRaw) as Owner;
  const session = await api<{ user: { id: string } | null }>('/auth/me');
  if (
    localStorage.getItem(offlineKeys.owner) !== ownerRaw ||
    offlineLogoutPending()
  )
    throw new Error('Phiên đã thay đổi; chuyến đi chưa được tải xuống.');
  if (session.user?.id !== owner.id) {
    clearOffline();
    throw new Error('Phiên đã đổi. Đăng nhập lại trước khi tải chuyến đi.');
  }
  let trip: TripDto;
  try {
    trip = (await api<{ trip: TripDto }>(`/trips/${id}`)).trip;
  } catch (e) {
    if (localStorage.getItem(offlineKeys.owner) === ownerRaw) {
      if (e instanceof ApiFailure && e.status === 404) removeOffline(id);
      if (e instanceof ApiFailure && [401, 403].includes(e.status))
        clearOffline();
    }
    throw e;
  }
  // Only the current saved server snapshot is exported; never a dirty React draft.
  const input = tripInputSchema.parse(
    Object.fromEntries(
      Object.keys(tripInputSchema.shape).map((key) => [
        key,
        trip[key as keyof TripDto],
      ]),
    ),
  );
  if (!('serviceWorker' in navigator))
    throw new Error('Trình duyệt chưa hỗ trợ xem offline.');
  await navigator.serviceWorker.register('/sw.js', {
    scope: '/',
    updateViaCache: 'none',
  });
  await Promise.race([
    navigator.serviceWorker.ready,
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error('Chưa tải được màn đọc offline. Hãy thử lại.')),
        15000,
      ),
    ),
  ]);
  if (!navigator.serviceWorker.controller) {
    await new Promise<void>((resolve, reject) => {
      const ready = () => {
        if (!navigator.serviceWorker.controller) return;
        clearTimeout(timer);
        navigator.serviceWorker.removeEventListener('controllerchange', ready);
        resolve();
      };
      const timer = setTimeout(() => {
        navigator.serviceWorker.removeEventListener('controllerchange', ready);
        reject(new Error('Chưa kích hoạt được xem offline. Hãy thử lại.'));
      }, 15000);
      navigator.serviceWorker.addEventListener('controllerchange', ready);
      ready();
    });
  }
  if (
    localStorage.getItem(offlineKeys.owner) !== ownerRaw ||
    localStorage.getItem(offlineKeys.logout)
  )
    throw new Error('Phiên đã thay đổi; chuyến đi chưa được tải xuống.');
  const items = offlineItems().filter((item) => item.trip.id !== id);
  if (items.length >= 10)
    throw new Error(
      'Đã lưu 10 chuyến. Xóa một bản tải xuống trước khi lưu thêm.',
    );
  const snapshot: Snapshot = {
    savedAt: new Date().toISOString(),
    trip: {
      ...input,
      id: trip.id,
      revision: trip.revision,
      destinationName: trip.destinationName,
      updatedAt: trip.updatedAt,
      summaryTotals: trip.summaryTotals,
      ...(trip.budgetSummary ? { budgetSummary: trip.budgetSummary } : {}),
    },
  };
  const encoded = JSON.stringify({
    version: 1,
    owner,
    apiBase: import.meta.env.VITE_API_BASE_URL ?? '',
    items: [snapshot, ...items],
  } satisfies Stored);
  if (encoded.length > 2000000)
    throw new Error('Bộ nhớ offline đã đầy. Xóa bớt bản tải xuống.');
  try {
    localStorage.setItem(offlineKeys.data, encoded);
  } catch {
    throw new Error(
      'Không đủ bộ nhớ hoặc trình duyệt chặn lưu trên máy. Bản cũ vẫn được giữ.',
    );
  }
  window.dispatchEvent(new Event('goease-offline-change'));
}
