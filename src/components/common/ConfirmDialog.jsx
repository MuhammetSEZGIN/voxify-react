import { useEffect } from 'react';

function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Onayla',
  cancelLabel = 'Vazgeç',
  loading = false,
  onConfirm,
  onCancel,
}) {
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !loading) onCancel?.();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [loading, onCancel]);

  return (
    <div
      className="modal-overlay"
      role="presentation"
      onMouseDown={() => { if (!loading) onCancel?.(); }}
    >
      <section
        className="modal confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h2 id="confirm-dialog-title" className="modal__title">{title}</h2>
        <p id="confirm-dialog-message" className="modal__subtitle">{message}</p>
        <div className="modal__actions">
          <button
            type="button"
            className="modal__btn modal__btn--cancel"
            onClick={onCancel}
            disabled={loading}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className="modal__btn modal__btn--danger"
            onClick={onConfirm}
            disabled={loading}
            autoFocus
          >
            {loading ? 'Çıkarılıyor...' : confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}

export default ConfirmDialog;
