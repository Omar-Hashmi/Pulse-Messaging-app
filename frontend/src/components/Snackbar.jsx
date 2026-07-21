import { useEffect } from 'react';
import { createPortal } from 'react-dom';

/**
 * Bottom-of-screen toast for one-off success/error feedback. Render
 * conditionally by passing a `toast` object ({ type: 'success' | 'error',
 * message }) — falsy hides it. Auto-dismisses after `duration` ms, or can
 * be dismissed early via the close button.
 */
export default function Snackbar({ toast, onDismiss, duration = 3500 }) {
  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => onDismiss?.(), duration);
    return () => clearTimeout(timer);
  }, [toast, onDismiss, duration]);

  if (!toast) return null;

  return createPortal(
    <div className={`toast-snackbar toast-snackbar-${toast.type}`} role="status" aria-live="polite">
      <span className="toast-snackbar-icon" aria-hidden="true">
        {toast.type === 'error' ? '⚠' : '✓'}
      </span>
      <span className="toast-snackbar-message">{toast.message}</span>
      <button type="button" className="toast-snackbar-close" onClick={onDismiss} aria-label="Dismiss">
        ×
      </button>
    </div>,
    document.body
  );
}
