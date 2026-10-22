/* global document, localStorage, navigator, fetch, AbortSignal, addEventListener */
// Versioned contract shared with src/offline.ts. No credentials or expenses stored.
const OWNER = 'goease:offline:owner:v1';
const DATA = 'goease:offline:data:v1';
const LOGOUT = 'goease:offline:logout:v1';
const content = document.getElementById('content');
const status = document.getElementById('status');
const error = document.getElementById('error');
let selected = null;
let apiBase = '';
let run = 0;
function clear() {
  localStorage.removeItem(OWNER);
  localStorage.removeItem(DATA);
  selected = null;
  content.replaceChildren();
}
function stored() {
  if (localStorage.getItem(LOGOUT)) return null;
  const value = JSON.parse(localStorage.getItem(DATA) ?? 'null');
  if (
    !value ||
    value.version !== 1 ||
    JSON.stringify(value.owner) !== localStorage.getItem(OWNER) ||
    !Array.isArray(value.items) ||
    value.items.length > 10
  )
    return null;
  return value;
}
function node(tag, text, parent, className) {
  const element = document.createElement(tag);
  element.textContent = String(text ?? '');
  if (className) element.className = className;
  parent.append(element);
  return element;
}
function button(label, parent, action, primary = false) {
  const element = node('button', label, parent, primary ? 'primary' : '');
  element.onclick = action;
}
const money = (value) =>
  value == null ? 'Chưa rõ' : Number(value).toLocaleString('vi-VN') + 'đ';
function render() {
  content.replaceChildren();
  const data = stored();
  if (!data?.items.length) {
    node('h2', 'Chưa có lịch trình tải xuống', content);
    node(
      'p',
      'Khi có mạng, mở chuyến đi → Thông tin chuyến đi → Lưu để xem offline.',
      content,
    );
    return;
  }
  const item = data.items.find((item) => item.trip.id === selected);
  if (!item) {
    for (const item of data.items) {
      const card = node('article', '', content);
      node('h2', item.trip.title, card);
      node(
        'p',
        `${item.trip.destinationName} · ${item.trip.startDate} – ${item.trip.endDate}`,
        card,
      );
      node(
        'small',
        'Đã tải: ' + new Date(item.savedAt).toLocaleString('vi-VN'),
        card,
      );
      const actions = node('div', '', card);
      button(
        'Xem lịch trình',
        actions,
        () => {
          selected = item.trip.id;
          render();
        },
        true,
      );
      button('Xóa bản tải xuống', actions, () => {
        try {
          const current = stored();
          if (current) {
            current.items = current.items.filter(
              (value) => value.trip.id !== item.trip.id,
            );
            localStorage.setItem(DATA, JSON.stringify(current));
          }
          render();
        } catch {
          error.textContent = 'Chưa xóa được dữ liệu. Hãy thử lại.';
        }
      });
    }
    return;
  }
  const trip = item.trip;
  button('Tất cả bản tải xuống', content, () => {
    selected = null;
    render();
  });
  const heading = node('article', '', content);
  node('h2', trip.title, heading);
  node(
    'p',
    `${trip.destinationName} · ${trip.startDate} – ${trip.endDate} · ${trip.travelers.totalCount} người`,
    heading,
  );
  node(
    'small',
    'Đã tải: ' +
      new Date(item.savedAt).toLocaleString('vi-VN') +
      ' · Bản lưu chỉ xem',
    heading,
  );
  node('p', 'Ngân sách: ' + money(trip.budget.amountMinor), heading);
  node(
    'p',
    'Dự toán đã biết: ' + money(trip.summaryTotals.knownEstimatedMinor),
    heading,
  );
  if (trip.summaryTotals.missingCostCount)
    node(
      'p',
      `${trip.summaryTotals.missingCostCount} hoạt động chưa rõ chi phí.`,
      heading,
    );
  if (trip.notes) node('p', trip.notes, heading, 'note');
  trip.days.forEach((day, index) => {
    const section = node('section', '', content, 'day');
    node('h3', `Ngày ${index + 1} · ${day.date}`, section);
    if (!day.activities.length) node('p', 'Chưa có điểm dừng.', section);
    for (const activity of day.activities) {
      const row = node('div', '', section, 'activity');
      node('strong', activity.title, row);
      if (activity.startLocalTime)
        node('p', `${activity.startLocalTime} – ${activity.endLocalTime}`, row);
      if (activity.notes) node('p', activity.notes, row, 'note');
      node(
        'small',
        `Dự toán: ${money(activity.estimatedCost.amountMinor)}${activity.estimatedCost.basis === 'per_person' ? ' / người' : ' / nhóm'}`,
        row,
      );
    }
  });
}
async function request(path, method = 'GET') {
  return fetch(apiBase + '/api/v1' + path, {
    method,
    credentials: 'include',
    signal: AbortSignal.timeout(8000),
    headers: { 'X-GoEase-Client': 'web', 'Content-Type': 'application/json' },
  });
}
async function load() {
  const currentRun = ++run;
  error.textContent = '';
  try {
    const data = stored();
    apiBase = data?.apiBase ?? apiBase;
    const owner = localStorage.getItem(OWNER);
    const pending = localStorage.getItem(LOGOUT);
    if (pending) apiBase = JSON.parse(pending).apiBase ?? '';
    if (navigator.onLine) {
      content.replaceChildren();
      status.textContent = 'Đang kiểm tra quyền truy cập…';
      try {
        if (pending) {
          const result = await request('/auth/logout', 'POST');
          if (!result.ok) throw new Error('logout');
          localStorage.removeItem(LOGOUT);
        } else if (data) {
          const response = await request('/auth/me');
          if (currentRun !== run || owner !== localStorage.getItem(OWNER))
            return;
          if ([401, 403].includes(response.status)) clear();
          else if (!response.ok) throw new Error('unavailable');
          else {
            const session = await response.json();
            if (currentRun !== run || owner !== localStorage.getItem(OWNER))
              return;
            if (session.data?.user?.id !== data.owner.id) clear();
            else {
              for (const item of data.items) {
                const result = await request('/trips/' + item.trip.id);
                if (currentRun !== run || owner !== localStorage.getItem(OWNER))
                  return;
                if ([401, 403].includes(result.status)) {
                  clear();
                  break;
                }
                if (result.status === 404) {
                  const latest = stored();
                  if (latest) {
                    latest.items = latest.items.filter(
                      (value) => value.trip.id !== item.trip.id,
                    );
                    localStorage.setItem(DATA, JSON.stringify(latest));
                  }
                } else if (!result.ok) throw new Error('unavailable');
              }
            }
          }
        }
        status.textContent =
          'Bản tải xuống chỉ xem. Cập nhật bản mới trong chuyến đi online.';
      } catch {
        status.textContent = 'Chưa kết nối được máy chủ · Đang xem bản đã tải.';
      }
    } else status.textContent = 'Đang offline · Chỉ xem bản đã tải.';
    if (currentRun !== run) return;
    if (localStorage.getItem(LOGOUT))
      status.textContent =
        'Đã xóa dữ liệu trên máy. Phiên trên server sẽ được đăng xuất khi kết nối lại.';
    render();
  } catch {
    content.replaceChildren();
    error.textContent =
      'Không đọc được bộ nhớ offline. Hãy xóa dữ liệu trên máy rồi tải lại khi có mạng.';
  }
}
document.getElementById('logout').onclick = () => {
  try {
    localStorage.setItem(LOGOUT, JSON.stringify({ apiBase }));
    clear();
    void load();
  } catch {
    content.replaceChildren();
    error.textContent =
      'Trình duyệt chặn xóa bộ nhớ. Hãy xóa dữ liệu trang GoEase trong cài đặt trình duyệt.';
  }
};
document.getElementById('refresh').onclick = () => void load();
addEventListener('online', () => void load());
addEventListener('offline', () => void load());
addEventListener('pageshow', () => void load());
addEventListener('storage', () => {
  content.replaceChildren();
  void load();
});
void load();
