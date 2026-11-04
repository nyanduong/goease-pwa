import { Settings } from '../customer-icons';
import { useMascot } from './context';

export function MascotSettings() {
  const { preferences, update } = useMascot();
  return (
    <details className="mascot-settings">
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
}
