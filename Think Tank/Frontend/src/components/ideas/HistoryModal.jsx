import Modal from '../ui/Modal';
import { displayName } from '../../lib/format';
import { fmtDateTime } from '../../lib/date';

/**
 * Every change made to the idea, newest first, each with its date and time.
 *
 * It lives behind the clock icon at the top of the page rather than as a
 * panel at the bottom: it is a thing you go and check when you want to know
 * who changed what, not something that needs to sit under the conversation
 * every time anybody opens the idea.
 */
export default function HistoryModal({ open, activity = [], onClose }) {
  return (
    <Modal
      open={open}
      title="Change history"
      subtitle={activity.length
        ? `${activity.length} change${activity.length === 1 ? '' : 's'} to this idea`
        : 'Nothing has changed yet'}
      onClose={onClose}
      labelledBy="historyTitle"
      footer={<button className="btn-ghost" onClick={onClose}>Close</button>}
    >
      {activity.length ? (
        <ul className="trail-list">
          {activity.map((a) => (
            <li key={a.id}>
              <span className="trail-what">
                <strong>{displayName(a.actorName, a.actorRole)}</strong> {a.what}
              </span>
              <span className="trail-at">{fmtDateTime(a.at)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="cand-note">Nothing has been changed since the idea was created.</p>
      )}
    </Modal>
  );
}
