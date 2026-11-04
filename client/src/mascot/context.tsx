import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { MascotController, behaviorDelay } from './controller';

export type MascotPreferences = {
  hidden: boolean;
  autonomous: boolean;
  reducedMotion: boolean;
};
const defaults: MascotPreferences = {
  hidden: false,
  autonomous: true,
  reducedMotion: false,
};
const key = 'goease:mascot-preferences:v1';
function loadPreferences(): MascotPreferences {
  try {
    const saved = JSON.parse(localStorage.getItem(key) ?? 'null');
    if (!saved || typeof saved !== 'object') return defaults;
    return {
      hidden: saved.hidden === true,
      autonomous: saved.autonomous !== false,
      reducedMotion: saved.reducedMotion === true,
    };
  } catch {
    return defaults;
  }
}
const Context = createContext<{
  controller: MascotController;
  preferences: MascotPreferences;
  update: (patch: Partial<MascotPreferences>) => void;
  motionAllowed: boolean;
  pageVisible: boolean;
} | null>(null);

export function MascotProvider({ children }: { children: ReactNode }) {
  const ref = useRef<MascotController | null>(null);
  if (!ref.current) ref.current = new MascotController();
  const controller = ref.current;
  const [preferences, setPreferences] = useState(loadPreferences);
  const [systemReduced, setSystemReduced] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const [pageVisible, setPageVisible] = useState(!document.hidden);
  const update = useCallback((patch: Partial<MascotPreferences>) => {
    setPreferences((current) => {
      const next = { ...current, ...patch };
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {
        /* Optional settings storage. */
      }
      return next;
    });
  }, []);
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const motion = () => setSystemReduced(query.matches);
    const visibility = () => setPageVisible(!document.hidden);
    query.addEventListener('change', motion);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      query.removeEventListener('change', motion);
      document.removeEventListener('visibilitychange', visibility);
      controller.stop();
    };
  }, [controller]);
  return (
    <Context.Provider
      value={{
        controller,
        preferences,
        update,
        pageVisible,
        motionAllowed:
          !systemReduced && !preferences.reducedMotion && pageVisible,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useMascot() {
  const value = useContext(Context);
  if (!value) throw new Error('MascotProvider is required');
  return value;
}
export function useMascotBehavior() {
  const [lastAutomaticAction, setLastAutomaticAction] = useState<string | null>(
    null,
  );
  const { controller, preferences, motionAllowed } = useMascot();
  useEffect(() => {
    if (!motionAllowed || !preferences.autonomous || preferences.hidden) return;
    let timer: ReturnType<typeof setTimeout>;
    let active = true;
    const schedule = () => {
      timer = setTimeout(() => {
        if (!active) return;
        const action = controller.random();
        if (action) setLastAutomaticAction(action);
        schedule();
      }, behaviorDelay());
    };
    schedule();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [controller, motionAllowed, preferences.autonomous, preferences.hidden]);
  return lastAutomaticAction;
}
