import Modal from '../ui/Modal';
import { parseYmd, fmtLong, fmtWhen } from '../../lib/date';
import { displayName } from '../../lib/format';

/** Read-only view of one think log, colour-coded by what became of the note. */
export default function LogViewModal({ log, onClose }) {
  if (!log) return null;

  return (
    <Modal
      open={!!log}
      title={`Think Log — ${fmtLong(parseYmd(log.date))}`}
      subtitle={`${displayName(log.owner, log.ownerRole)} · ${fmtWhen(log.at || log.date)}`}
      onClose={onClose}
      labelledBy="lvTitle"
      footer={<button className="btn-muted" onClick={onClose}>Close</button>}
    >
      <div className="lv-list">
        {log.points.map((p, i) => {
          /* A note can be more than one thing — sent to Tasks and to Ideas
             both — so it is written once, in the colour of the first of them,
             and tagged with each. */
          const states = p.states || [];
          const tone = states.includes('task') ? 'task' : states.includes('idea') ? 'idea' : 'plain';
          return (
            <div key={i} className={`lv ${tone}`}>
              {/* The note as it was written, line breaks and all. */}
              {p.text}
              {states.length > 0 && (
                <span className="lv-tags">
                  {states.includes('task') && <em className="lv-tag task">Task</em>}
                  {states.includes('idea') && <em className="lv-tag idea">Idea</em>}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div className="lv-legend">
        <span><i style={{ background: 'var(--blue)' }} />Added to Tasks</span>
        <span><i style={{ background: '#f0932b' }} />Added to Ideas</span>
        <span><i style={{ background: '#cbd5e5' }} />Not actioned</span>
      </div>
    </Modal>
  );
}
