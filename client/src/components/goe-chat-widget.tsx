import { useEffect, useRef, useState } from 'react';
import { images } from '@goease/media';
import { GoeChat } from './goe-chat';

export function GoeChatWidget({
  signedIn,
  tripId,
  onNavigate,
  onApplied,
}: {
  signedIn: boolean;
  tripId?: string | undefined;
  onNavigate: (path: string) => void;
  onApplied: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [started, setStarted] = useState(false);
  const launcher = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open)
      panel.current?.querySelector<HTMLButtonElement>('button')?.focus();
  }, [open]);

  const close = () => {
    setOpen(false);
    launcher.current?.focus();
  };

  return (
    <>
      {started && (
        <div
          ref={panel}
          id="goe-floating-chat"
          className="goe-floating-chat"
          role="dialog"
          aria-label="Trò chuyện với Goe"
          hidden={!open}
          onKeyDown={(event) => {
            if (
              event.key === 'Escape' &&
              !event.defaultPrevented &&
              !(event.target as HTMLElement).closest('dialog')
            ) {
              event.stopPropagation();
              close();
            }
          }}
        >
          <GoeChat
            embedded
            signedIn={signedIn}
            initialTripId={tripId}
            onClose={close}
            onApplied={onApplied}
            onNavigate={(next) => {
              close();
              onNavigate(next);
            }}
          />
        </div>
      )}
      <button
        ref={launcher}
        type="button"
        className="goe-chat-launcher"
        aria-label={open ? 'Thu gọn chat Goe' : 'Trò chuyện với Goe'}
        aria-expanded={open}
        aria-controls={started ? 'goe-floating-chat' : undefined}
        onClick={() => {
          setStarted(true);
          if (open) close();
          else setOpen(true);
        }}
      >
        <img src={images.goeMascot} alt="" />
      </button>
    </>
  );
}
