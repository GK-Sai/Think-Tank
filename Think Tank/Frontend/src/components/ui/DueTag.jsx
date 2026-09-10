import { TODAY, parseYmd, daysBetween } from '../../lib/date';

/** Small coloured tag describing how close a due date is. */
export default function DueTag({ due }) {
  const diff = daysBetween(TODAY, parseYmd(due));
  if (diff < 0) return <span className="tag red">Overdue by {Math.abs(diff)}d</span>;
  if (diff === 0) return <span className="tag amber">Due today</span>;
  if (diff === 1) return <span className="tag amber">Due tomorrow</span>;
  return <span className="tag green">Due in {diff} days</span>;
}
