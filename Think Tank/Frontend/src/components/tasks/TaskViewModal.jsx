import { useState } from 'react';
import Modal from '../ui/Modal';
import DueTag from '../ui/DueTag';
import { parseYmd, fmtLong, fmtWhen, fmtTime } from '../../lib/date';
import { effStatus, displayName } from '../../lib/format';
import { useApp } from '../../store/AppContext';
import { useAuth } from '../../store/AuthContext';
import { useToast } from '../../store/ToastContext';

/* The four words a task can be in. "Overdue" is not one of them — it is worked
   out from the due date, so it cannot be chosen here. */
const STATUSES = ['In Progress', 'Completed', 'On Hold', 'Re Assign'];

export default function TaskViewModal({ task, onClose }) {
  const { updateTask } = useApp();
  const { user, isChair } = useAuth();
  const toast = useToast();
  const [saving, setSaving] = useState(false);

  if (!task) return null;

  /* An implementation milestone is derived from an idea's date, not a task
     row, so there is nothing here to move — the date is changed on the idea. */
  const canMove = !task.milestone && (isChair || task.ownerId === user?.id);

  const move = async (next) => {
    if (next === task.status || saving) return;
    setSaving(true);
    try {
      await updateTask(task.id, { status: next });
      toast(next === 'Completed' ? 'Task marked complete' : `Task moved to ${next}`);
      onClose();
    } catch {
      /* the store has already shown the server's message */
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={!!task}
      title={task.title}
      subtitle={task.milestone
        ? `Implementation milestone · ${task.dept || '—'}`
        : `Task #${task.id} · ${task.dept}`}
      onClose={onClose}
      labelledBy="taskViewTitle"
      footer={
        <>
          {canMove && task.status !== 'Completed' && (
            <button
              type="button"
              className="btn-solid"
              disabled={saving}
              onClick={() => move('Completed')}
            >
              {saving ? 'Saving…' : 'Mark as completed'}
            </button>
          )}
          {canMove && task.status === 'Completed' && (
            <button
              type="button"
              className="btn-muted"
              disabled={saving}
              onClick={() => move('In Progress')}
            >
              {saving ? 'Saving…' : 'Reopen'}
            </button>
          )}
          <button className="btn-ghost" onClick={onClose}>Close</button>
        </>
      }
    >
      <dl className="kv">
        <dt>Task</dt><dd>{task.title}</dd>
        <dt>Assigned to</dt><dd>{displayName(task.owner, task.ownerRole)}</dd>
        <dt>Department</dt><dd>{task.dept}</dd>
        <dt>Scheduled</dt><dd>{fmtLong(parseYmd(task.date))} at {fmtTime(task.start || task.date)}</dd>
        <dt>Assigned</dt>
        <dd>
          {task.assignedBy ? `${displayName(task.assignedBy, task.assignedByRole)} · ` : ''}
          {fmtWhen(task.at)}
        </dd>
        <dt>Due</dt><dd>{fmtLong(parseYmd(task.due))} <DueTag due={task.due} /></dd>
        <dt>Priority</dt><dd>{task.priority || 'Medium'}</dd>
        <dt>Status</dt>
        <dd>
          {/* Your own work is yours to move, and the chairman can move
              anybody's — the same rule the API enforces. */}
          {canMove ? (
            <span className="status-select">
              <select
                aria-label="Task status"
                value={task.status}
                disabled={saving}
                onChange={(e) => move(e.target.value)}
              >
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </span>
          ) : (
            <span className="tag amber">{effStatus(task)}</span>
          )}
          {canMove && effStatus(task) === 'Overdue' && (
            <span className="tag amber" style={{ marginLeft: 8 }}>Overdue</span>
          )}
        </dd>
        {task.description && <><dt>Notes</dt><dd>{task.description}</dd></>}
        {task.logTitle && <><dt>From the think log</dt><dd>{task.logTitle}</dd></>}
      </dl>
    </Modal>
  );
}
