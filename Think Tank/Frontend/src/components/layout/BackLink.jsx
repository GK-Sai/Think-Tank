import { useNavigate } from 'react-router-dom';
import { ArrowLeftIcon } from '../../lib/icons';
import useCompact from '../../lib/useCompact';

/**
 * The back control every page above the dashboard carries.
 *
 * It goes where its label says it goes. Stepping back through history instead
 * meant "Back to Dashboard" landed on whatever page you happened to come from
 * — an idea, a filtered list, the same page again after a reload — which is
 * not what the words on the button promise.
 *
 * **On a phone or tablet it is an arrow.** "← Back to Dashboard" took a whole
 * row of a phone screen to say what an arrow says on its own, and pushed the
 * heading — the thing that tells you where you are — below the fold. The arrow
 * sits beside the heading instead, so the place you are and the way back are
 * read together on one line. The label is still the button's accessible name
 * and its tooltip, so a screen reader hears "Back to Dashboard", not "button".
 *
 * **On a laptop it is the labelled button it always was.** There is room for
 * the words there, and the page was not asking for the change.
 */
export default function BackLink({ to = '/', label = 'Back', className = '' }) {
  const navigate = useNavigate();
  const compact = useCompact();

  return (
    <button
      type="button"
      className={`back-link${compact ? ' back-arrow' : ''}${className ? ` ${className}` : ''}`}
      onClick={() => navigate(to)}
      title={label}
      aria-label={compact ? label : undefined}
    >
      <ArrowLeftIcon />
      {!compact && label}
    </button>
  );
}
