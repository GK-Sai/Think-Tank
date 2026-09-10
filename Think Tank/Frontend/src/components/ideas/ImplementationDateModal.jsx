import { useEffect, useState } from 'react';
import Modal from '../ui/Modal';
import { TODAY, ymd } from '../../lib/date';

/** Chairman-only: the date an approved idea is meant to go live. */
export default function ImplementationDateModal({ open, current, onClose, onSave }) {
  const [date, setDate] = useState(current || ymd(TODAY));
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) setDate(current || ymd(TODAY)); }, [open, current]);

  const submit = async () => {
    if (!date || saving) return;
    setSaving(true);
    try {
      await onSave(date);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const clear = async () => {
    setSaving(true);
    try {
      await onSave(null);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title="Set Implementation Date"
      subtitle="When this idea is expected to go live"
      onClose={onClose}
      labelledBy="implDateTitle"
      footer={
        <>
          {current && (
            <button type="button" className="btn-ghost" onClick={clear} disabled={saving}>
              Clear date
            </button>
          )}
          <button type="button" className="btn-cancel" onClick={onClose}>Cancel</button>
          <button type="button" className="btn-primary" onClick={submit} disabled={saving || !date}>
            {saving ? 'Saving…' : 'Set Date'}
          </button>
        </>
      }
    >
      <div className="field-row">
        <label htmlFor="implDate">Implementation date</label>
        <input
          id="implDate"
          type="date"
          value={date}
          min={ymd(TODAY)}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>
      <p className="modal-hint">
        Setting a date on an idea still under review also marks it Approved.
      </p>
    </Modal>
  );
}
