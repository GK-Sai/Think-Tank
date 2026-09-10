import Modal from './Modal';

/** Non-blocking replacement for window.confirm. */
export default function ConfirmDialog({ open, title, body, okLabel = 'Confirm', onConfirm, onCancel }) {
  return (
    <Modal
      open={open}
      title={title}
      subtitle={body}
      onClose={onCancel}
      labelledBy="confirmTitle"
      footer={
        <>
          <button className="btn-ghost" onClick={onCancel}>Cancel</button>
          <button className="btn-danger" onClick={onConfirm}>{okLabel}</button>
        </>
      }
    >
      <p style={{ fontSize: 13.5, color: 'var(--text-muted)' }}>This action takes effect immediately.</p>
    </Modal>
  );
}
