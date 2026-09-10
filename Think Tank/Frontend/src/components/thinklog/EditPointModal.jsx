import { useEffect, useRef, useState } from 'react';
import Modal from '../ui/Modal';
import { useToast } from '../../store/ToastContext';

/**
 * Reword a point that has already been saved.
 *
 * The composer saves itself a few seconds after you stop typing, so a thought
 * reaches the record in whatever shape it was in when you paused — mid-sentence
 * and misspelled as often as not. This is where it gets tidied, and it is a
 * dialog rather than an inline field because a point can run to several lines
 * and the row it sits in is one line tall.
 */
export default function EditPointModal({ open, point, onClose, onSave }) {
  const toast = useToast();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const areaRef = useRef(null);

  // Reopen on a different point and the box shows that point, not the last one.
  useEffect(() => {
    if (open) setText(point?.text || '');
  }, [open, point]);

  const save = async () => {
    const body = text.trim();
    if (!body) {
      areaRef.current?.focus();
      return toast('A point cannot be empty');
    }
    if (body === (point?.text || '').trim()) return onClose();

    setBusy(true);
    try {
      await onSave(body);
      toast('Point updated');
      onClose();
    } catch {
      /* AppContext has already shown the server's message. */
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      title="Edit point"
      subtitle="This updates the saved think log too."
      labelledBy="editPointTitle"
      onClose={onClose}
      footer={(
        <>
          <button type="button" className="btn-muted" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="btn-solid" onClick={save} disabled={busy}>
            {busy ? 'Saving…' : 'Save changes'}
          </button>
        </>
      )}
    >
      <div className="stack">
        <textarea
          ref={areaRef}
          className="soft-in"
          rows={5}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Write the point…"
          aria-label="Point text"
        />
      </div>
    </Modal>
  );
}
