import { useEffect, useMemo, useState } from 'react';
import Modal from '../ui/Modal';
import CandidatePicker from '../ui/CandidatePicker';
import { useApp } from '../../store/AppContext';
import { useAuth } from '../../store/AuthContext';
import { useToast } from '../../store/ToastContext';
import { TODAY, ymd, parseYmd, fmtLong } from '../../lib/date';

/**
 * "Add to Idea" from the think log.
 *
 * The same shape as Add to Task — a title, a description, a date, and the
 * people it goes to — because they are the same gesture: a line from the log
 * becomes something the team can see. The idea opens for the whole company to
 * discuss, and the people picked here are the ones told it is theirs to carry.
 */
export default function IdeaSanctuaryModal({ open, seedText, logId, onClose, onSaved }) {
  const { team, addIdeaFromLog } = useApp();
  const { user } = useAuth();
  const toast = useToast();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(ymd(TODAY));
  const [selected, setSelected] = useState(new Set());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle(seedText || '');
      setDescription('');
      setDate(ymd(TODAY));
      setSelected(new Set());
    }
  }, [open, seedText]);

  const candidates = useMemo(
    () => team.filter((m) => m.id !== user?.id),
    [team, user]
  );

  const save = async () => {
    const clean = title.trim();
    if (!clean) return toast('Give the idea a title');

    setBusy(true);
    try {
      await addIdeaFromLog({
        title: clean,
        description: description.trim(),
        implementationDate: date || null,
        sharedWith: [...selected],
        logId: logId || null,
        logTitle: seedText || clean,
      });
    } catch {
      setBusy(false);
      return;
    }
    setBusy(false);
    onSaved?.();
    onClose();
    toast(
      selected.size
        ? `Idea shared with ${selected.size} ${selected.size === 1 ? 'person' : 'people'}`
        : 'Idea shared with the team'
    );
  };

  return (
    <Modal
      open={open}
      title={`Share Idea for ${fmtLong(date ? parseYmd(date) : TODAY)}`}
      subtitle="Put it to the team and pick who carries it"
      onClose={onClose}
      labelledBy="isTitle"
      footer={
        <>
          <button className="btn-muted" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="btn-solid" onClick={save} disabled={busy}>
            {busy ? 'Sharing…' : 'Share Idea'}
          </button>
        </>
      }
    >
      <div className="stack">
        <input
          className="soft-in"
          placeholder="Idea  Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <textarea
          className="soft-in"
          rows={4}
          placeholder="Enter Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <label className="mini-field">
          <span>Implementation date</span>
          <input
            className="soft-in"
            type="date"
            aria-label="Implementation date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
      </div>

      <h4 className="share-h">Share with</h4>

      <CandidatePicker
        members={candidates}
        selected={selected}
        onChange={setSelected}
        note="The whole team can read and discuss the idea. Whoever you pick here is told it is theirs to carry, and the date lands on their calendar."
      />
    </Modal>
  );
}
