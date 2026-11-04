import { useState, useSyncExternalStore } from 'react';
import { useMascot } from './context';
import { MascotRenderer } from './renderer';
import { MascotSettings } from './settings';
import { actionIds, animations } from './manifest';

/** Local development harness. Never mounted in production. No API calls. */
export function MascotPreview({ onBack }: { onBack: () => void }) {
  const { controller } = useMascot();
  const [missing, setMissing] = useState(false);
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
  );
  const definition = animations[state.action];
  return (
    <section className="mascot-preview">
      <button onClick={onBack}>← Về GoEase</button>
      <h1>Kiểm tra chuyển động Goe</h1>
      <div className="mascot-preview-stage">
        <MascotRenderer
          assetUrlOverride={
            missing ? '/__missing_mascot_atlas__.png' : undefined
          }
        />
      </div>
      <p aria-live="polite">
        {definition.name} · {definition.frameCount} frame ·{' '}
        {definition.assetStatus === 'reviewed' ? 'Sprite' : 'Ảnh dự phòng'}
      </p>
      <label className="mascot-preview-missing">
        <input
          type="checkbox"
          checked={missing}
          onChange={(e) => setMissing(e.target.checked)}
        />
        Kiểm tra ảnh bị thiếu
      </label>
      <MascotSettings />
      <div className="mascot-preview-actions">
        {actionIds.map((id) => (
          <button
            key={id}
            data-asset-status={animations[id].assetStatus}
            onClick={() => {
              controller.stop();
              controller.play(id, true);
            }}
          >
            {animations[id].name}
          </button>
        ))}
      </div>
    </section>
  );
}
