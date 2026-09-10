import { useNavigate } from 'react-router-dom';
import { ArrowLeftIcon } from '../../lib/icons';

/**
 * The back control every page above the dashboard carries.
 *
 * It goes where its label says it goes. Stepping back through history instead
 * meant "Back to Dashboard" landed on whatever page you happened to come from
 * — an idea, a filtered list, the same page again after a reload — which is
 * not what the words on the button promise.
 */
export default function BackLink({ to = '/', label = 'Back', className = '' }) {
  const navigate = useNavigate();

  return (
    <button
      type="button"
      className={`back-link${className ? ` ${className}` : ''}`}
      onClick={() => navigate(to)}
    >
      <ArrowLeftIcon />
      {label}
    </button>
  );
}
