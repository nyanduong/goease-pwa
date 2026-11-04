import { useState } from 'react';
import { Sheet } from '../components/journey-sheet';
import { Settings } from '../customer-icons';
import { useMascot } from './context';

export function MascotSettings({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const { preferences, update } = useMascot();
  const contents = (
    <details className="mascot-settings" open>
      <summary aria-label="Tùy chọn linh vật Goe">
        <Settings size={18} />
        <span>Tùy chọn Goe</span>
      </summary>
      <div className="mascot-settings-options">
        <label>
          <span>Hiện linh vật</span>
          <input
            type="checkbox"
            role="switch"
            checked={!preferences.hidden}
            onChange={(e) => update({ hidden: !e.target.checked })}
          />
        </label>
        <label>
          <span>Tự cử động</span>
          <input
            type="checkbox"
            role="switch"
            checked={preferences.autonomous}
            onChange={(e) => update({ autonomous: e.target.checked })}
          />
        </label>
        <label>
          <span>Giảm chuyển động</span>
          <input
            type="checkbox"
            role="switch"
            checked={preferences.reducedMotion}
            onChange={(e) => update({ reducedMotion: e.target.checked })}
          />
        </label>
      </div>
    </details>
  );
  return compact ? (
    <>
      <button
        type="button"
        className="goe-settings-icon"
        aria-label="Cài đặt Goe"
        onClick={() => setOpen(true)}
      >
        <Settings size={18} />
      </button>
      {open && (
        <Sheet title="Cài đặt Goe" onClose={() => setOpen(false)}>
          {contents}
        </Sheet>
      )}
    </>
  ) : (
    contents
  );
}
