import { useEffect, useState } from 'react';
import Modal from '../ui/Modal';
import { ALL_DEPARTMENTS } from '../../data/seed';
import { useToast } from '../../store/ToastContext';
import { displayName } from '../../lib/format';

export default function EditRoleModal({ member, onClose, onSave }) {
  const toast = useToast();
  const [role, setRole] = useState('');
  const [dept, setDept] = useState('');

  useEffect(() => {
    if (member) { setRole(member.role); setDept(member.dept); }
  }, [member]);

  const save = async () => {
    if (!role.trim()) return toast('Please enter a role');
    try {
      await onSave(member.id, { role: role.trim(), dept: dept || member.dept });
      onClose();
      toast('Role updated');
    } catch { /* AppContext toasted the server's message */ }
  };

  return (
    <Modal
      open={!!member}
      title="Edit Department & Role"
      subtitle={displayName(member?.name, member?.accountRole)}
      onClose={onClose}
      labelledBy="roleTitle"
      footer={
        <>
          <button className="btn-muted" onClick={onClose}>Cancel</button>
          <button className="btn-solid" onClick={save}>Save changes</button>
        </>
      }
    >
      <div className="stack">
        <div className="two-up">
          <label className="mini-field">
            <span>Department</span>
            <select className="soft-in" value={dept} onChange={(e) => setDept(e.target.value)}>
              <option value="">Select Department</option>
              {ALL_DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </label>

          <label className="mini-field">
            <span>Role</span>
            <input className="soft-in" placeholder="Enter Role" value={role} onChange={(e) => setRole(e.target.value)} />
          </label>
        </div>
      </div>
    </Modal>
  );
}
