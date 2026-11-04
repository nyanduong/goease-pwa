import { useState, type ReactNode } from 'react';
import { Sheet } from './journey-sheet';
export function AppInfo({
  title,
  children,
  icon,
  id,
}: {
  title: string;
  icon?: ReactNode;
  id?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        id={id}
        type="button"
        className="app-info-trigger"
        aria-label={title}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        {icon ?? <span aria-hidden="true">!</span>}
      </button>
      {open && (
        <Sheet
          title={title}
          className="app-info-sheet"
          onClose={() => setOpen(false)}
        >
          {children}
        </Sheet>
      )}
    </>
  );
}
