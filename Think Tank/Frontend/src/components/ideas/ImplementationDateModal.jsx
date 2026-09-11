import { useEffect, useState } from 'react';
import Modal from '../ui/Modal';
import DatePicker, { fmtDMY } from '../ui/DatePicker';
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
      {/* Label and value at the same size — the label used to be set larger
          than the date it labels, which read as the heading of the dialog
          rather than the name of a field. */}
      <div className="field-row impl-date-row">
        <label htmlFor="implDate" className="impl-date-label">Implementation date</label>
        <output className="impl-date-value" htmlFor="implDate">
          {date ? fmtDMY(date) : 'Not set'}
        </output>
      </div>

      <DatePicker
        id="implDate"
        value={date}
        min={ymd(TODAY)}
        onChange={setDate}
      />
      <p className="modal-hint">
        Setting a date on an idea still under review also marks it Approved.
      </p>
    </Modal>
  );
}
