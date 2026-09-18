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
 * **It is an arrow, on every screen.** The words used to be spelled out on a
 * laptop and folded to an arrow on a phone. They said nothing the arrow does
 * not — an arrow at the top left of a page is the way back, everywhere — and
 * spending a whole row above the heading to say it pushed the page itself
 * down. The arrow now sits on the heading's own line, immediately before the
 * title, so where you are and the way back are read together: ← Ideas.
 *
 * The label lives on as the button's accessible name and its tooltip, so a
 * screen reader still hears "Back to Dashboard" rather than "button", and
 * hovering still says where the arrow goes.
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
