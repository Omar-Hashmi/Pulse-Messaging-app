import { createPortal } from 'react-dom';

/**
 * Bottom-of-screen confirmation snackbar. Render conditionally — pass a
 * truthy `message` to show it. Used to gate destructive actions (block,
 * remove friend, delete) behind an explicit "are you sure?" step.
 */
export default function ConfirmSnackbar({ message, confirmLabel = 'Confirm', onConfirm, onCancel }) {
  if (!message) return null;

  return createPortal(
    <div className="confirm-snackbar" role="alertdialog" aria-live="assertive">
      <span className="confirm-snackbar-message">{message}</span>
      <div className="confirm-snackbar-actions">
        <button type="button" className="confirm-snackbar-cancel" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className="confirm-snackbar-confirm" onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </div>,
    document.body
  );
}