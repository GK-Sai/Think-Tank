import { useNavigate } from 'react-router-dom';
import { ArrowLeftIcon } from '../../lib/icons';

/**
 * The back control every page above the dashboard carries.
 *
 * It goes where its label says it goes. Stepping back through history instead
 * meant "Back to Dashboard" landed on whatever page you happened to come from
 * — an idea, a filtered list, the same page again after a reload — which is
 * not what the words on the button promise.
 *
 * **It is an arrow, not a sentence.** "← Back to Dashboard" took a whole row
 * of a phone screen to say what an arrow says on its own, and pushed the
 * heading — the thing that tells you where you are — below the fold. The
 * arrow now sits beside the heading, so the place you are and the way back
 * are read together on one line.
 *
 * The label has not gone: it is the button's accessible name and its tooltip,
 * so a screen reader still hears "Back to Dashboard" rather than "button".
 */
export default function BackLink({ to = '/', label = 'Back', className = '' }) {
  const navigate = useNavigate();

  return (
    <button
      type="button"
      className={`back-link back-arrow${className ? ` ${className}` : ''}`}
      onClick={() => navigate(to)}
      title={label}
      aria-label={label}
    >
      <ArrowLeftIcon />
    </button>
  );
}
