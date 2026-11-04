import { useState } from 'react';
import { Bell } from '../customer-icons';
import { ScreenHeader } from './customer-shell';

// Presentation only until a notification feed is available from the API.
export function CustomerNotifications() {
  const [tab, setTab] = useState('Tất cả');
  return (
    <section className="customer-notifications">
      <ScreenHeader title="Thông báo" />
      <div
        className="customer-notification-tabs"
        role="group"
        aria-label="Loại thông báo"
      >
        {['Tất cả', 'Chuyến đi', 'Hệ thống'].map((label) => (
          <button
            key={label}
            aria-pressed={tab === label}
            onClick={() => setTab(label)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="customer-notification-empty">
        <Bell size={28} />
        <h2>Chưa có thông báo</h2>
        <p>Tính năng thông báo đang được chuẩn bị.</p>
      </div>
    </section>
  );
}
