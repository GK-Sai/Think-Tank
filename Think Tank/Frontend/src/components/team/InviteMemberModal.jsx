import { useEffect, useState } from 'react';
import Modal from '../ui/Modal';
import { Avatar, AVATAR_VARIANTS } from '../../lib/avatars';
import { ALL_DEPARTMENTS } from '../../data/seed';
import { useToast } from '../../store/ToastContext';

const EMPTY = { email: '', name: '', dept: '', role: '' };

export default function InviteMemberModal({ open, onClose, onAdd }) {
  const toast = useToast();
  const [form, setForm] = useState(EMPTY);
  const [sex, setSex] = useState('male');
  const [variant, setVariant] = useState(0);

  // Reset every time the modal opens, so a cancelled invite leaves nothing behind.
  useEffect(() => {
    if (open) { setForm(EMPTY); setSex('male'); setVariant(0); }
  }, [open]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const name = form.name.trim();
    const email = form.email.trim();
    const role = form.role.trim();
    if (!name) return toast('Please enter a name');
    if (!email || email.indexOf('@') < 1) return toast('Please enter a valid email');
    if (!form.dept) return toast('Please choose a department');
    if (!role) return toast('Please enter a role');

    setBusy(true);
    try {
      await onAdd({ name, email, role, dept: form.dept, av: [sex, variant] });
      onClose();
      toast(`Invite sent to ${name}`);
    } catch {
      // AppContext already toasted the server's message (e.g. duplicate email)
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      title="Add Team Member"
      subtitle="They join the chairman's team — give them a department and a role"
      onClose={onClose}
      labelledBy="inviteTitle"
      footer={
        <>
          <button className="btn-muted" onClick={onClose}>Cancel</button>
          <button className="btn-solid" onClick={submit} disabled={busy}>
            {busy ? 'Sending…' : 'Add Member'}
          </button>
        </>
      }
    >
      <div className="stack">
        <label className="mini-field">
          <span>Email address</span>
          <input className="soft-in" type="email" placeholder="name@thinktank.co" value={form.email} onChange={set('email')} />
        </label>

        <label className="mini-field">
          <span>Full name</span>
          <input className="soft-in" placeholder="Enter Name" value={form.name} onChange={set('name')} />
        </label>

        {/* Department and role sit side by side because they answer the same
            question together: which part of the company this person is in,
            and what they do there. */}
        <div className="two-up">
          <label className="mini-field">
            <span>Department</span>
            <select className="soft-in" value={form.dept} onChange={set('dept')}>
              <option value="">Select Department</option>
              {ALL_DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </label>

          <label className="mini-field">
            <span>Role</span>
            <input className="soft-in" placeholder="e.g. Product Manager" value={form.role} onChange={set('role')} />
          </label>
        </div>
      </div>

      <p className="cand-note" style={{ marginBottom: 6, fontWeight: 600, color: 'var(--text-dark)' }}>
        Choose a profile picture
      </p>

      <div className="av-tabs">
        {['male', 'female'].map((s) => (
          <button key={s} type="button" className={sex === s ? 'on' : undefined} onClick={() => setSex(s)}>
            {s[0].toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      <div className="av-grid">
        {AVATAR_VARIANTS.map((v) => (
          <button
            key={v}
            type="button"
            className={`av-opt${v === variant ? ' on' : ''}`}
            aria-label={`Avatar ${v + 1}`}
            onClick={() => setVariant(v)}
          >
            <Avatar sex={sex} variant={v} bare />
          </button>
        ))}
      </div>
    </Modal>
  );
}
