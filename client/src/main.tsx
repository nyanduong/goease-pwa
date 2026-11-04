import { SharedTripPage } from './components/shared-trip-page';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ConfirmationHost } from './confirmation';
import './styles.css';
import './admin.css';
import './brand-theme.css';
import './admin-sources.css';
import './admin-settings.css';
import './admin-topbar.css';
import './admin-schedules.css';
import './confirmation.css';
import './admin-v1.css';
import './admin-controls.css';
import './destination-picker.css';
import './customer-ui.css';
import './admin-v2.css';

if (
  import.meta.env.PROD &&
  window.isSecureContext &&
  'serviceWorker' in navigator
) {
  window.addEventListener(
    'load',
    () => {
      void navigator.serviceWorker
        .register('/sw.js', { scope: '/', updateViaCache: 'none' })
        .catch(() => {});
    },
    { once: true },
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {location.pathname === '/share' ? <SharedTripPage /> : <App />}
    <ConfirmationHost />
  </StrictMode>,
);
