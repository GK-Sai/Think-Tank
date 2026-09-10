import { useEffect, useMemo, useState } from 'react';
import Modal from '../ui/Modal';
import CandidatePicker from '../ui/CandidatePicker';
import { useApp } from '../../store/AppContext';
import { useAuth } from '../../store/AuthContext';
import { useToast } from '../../store/ToastContext';
import { TODAY, ymd, isoAt, parseYmd, fmtLong } from '../../lib/date';

const PRIORITIES = ['Low', 'Medium', 'High'];

/* Half-hour slots through the working day. A real start time is what lets the
   week calendar put the task where it belongs instead of stacking everything
   at nine in the morning. */
const SLOTS = Array.from({ length: 24 }, (_, i) => {
  const mins = 8 * 60 + i * 30;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const label = `${String(h % 12 || 12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
  return { value: `${h}:${m}`, label, h, m };
});

/**
 * "Add to Task" from the think log.
 *
 * A line from the log becomes work for named people or for a whole
 * department, and the line itself travels with the task — so wherever that
 * task turns up later, the thought it came from is still attached to it.
 */
export default function CreateTaskModal({ open, seedText, logId, onClose, onSaved }) {
  const { team, addTasksForMembers } = useApp();
  const { user } = useAuth();
  const toast = useToast();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [due, setDue] = useState(ymd(TODAY));
  const [slot, setSlot] = useState('9:0');
  const [priority, setPriority] = useState('Medium');
  const [selected, setSelected] = useState(new Set());

  useEffect(() => {
    if (open) {
      setTitle(seedText || '');
      setDescription('');
      setDue(ymd(TODAY));
      setSlot('9:0');
      setPriority('Medium');
      setSelected(new Set());
    }
  }, [open, seedText]);

  // You assign work to other people, so you are never in your own list.
  const candidates = useMemo(
    () => team.filter((m) => m.id !== user?.id),
    [team, user]
  );

  const headcount = selected.size;

  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const clean = title.trim();
    if (!clean) return toast('Give the task a title');
    if (!headcount) return toast('Pick at least one person');

    const chosen = SLOTS.find((s) => s.value === slot) || SLOTS[2];

    setBusy(true);
    try {
      await addTasksForMembers({
        title: clean,
        description: description.trim(),
        due: due || ymd(TODAY),
        priority,
        members: team.filter((m) => selected.has(m.id)),
        logId: logId || null,
        logTitle: seedText || '',
        startAt: isoAt(due || ymd(TODAY), chosen.h, chosen.m),
      });
    } catch {
      setBusy(false);
      return;
    }
    setBusy(false);
    onSaved?.();
    onClose();
    toast(`Added to the calendar of ${headcount} ${headcount === 1 ? 'person' : 'people'}`);
  };

  return (
    <Modal
      open={open}
      title={`Create Task for ${fmtLong(due ? parseYmd(due) : TODAY)}`}
      subtitle="Assign it and drop it on the calendar"
      onClose={onClose}
      labelledBy="ctTitle"
      footer={
        <>
          <button className="btn-muted" onClick={onClose}>Cancel</button>
          <button className="btn-solid" onClick={submit} disabled={busy}>
            {busy ? 'Adding…' : `Add to Calendar (${headcount})`}
          </button>
        </>
      }
    >
      <div className="stack">
        <input className="soft-in" placeholder="Task  Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <textarea
          className="soft-in"
          rows={3}
          placeholder="Enter Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <div className="two-up">
          <label className="mini-field">
            <span>Due date</span>
            <input className="soft-in" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
          </label>
          <label className="mini-field">
            <span>Start time</span>
            <select className="soft-in" value={slot} onChange={(e) => setSlot(e.target.value)}>
              {SLOTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </label>
        </div>
      </div>

      <h4 className="share-h">Assign to</h4>

      <CandidatePicker
        members={candidates}
        selected={selected}
        onChange={setSelected}
        note="The task appears in the calendar of everyone you pick."
      />

      <div className="seg" style={{ marginTop: 18 }}>
        {PRIORITIES.map((p) => (
          <button
            key={p}
            type="button"
            data-p={p}
            className={priority === p ? 'on' : undefined}
            onClick={() => setPriority(p)}
          >
            {p}
          </button>
        ))}
      </div>
    </Modal>
  );
}
