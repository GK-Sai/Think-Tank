/**
 * Rounded pagination used by the task table and the think log.
 * Shows first, last and a window around the current page.
 */
export default function Pager({ page, pages, onChange, className = 'pg' }) {
  if (pages <= 1) return null;

  const shown = [];
  for (let i = 1; i <= pages; i++) {
    if (i === 1 || i === pages || Math.abs(i - page) <= 1) shown.push(i);
    else if (shown[shown.length - 1] !== '…') shown.push('…');
  }

  return (
    <nav className={className} aria-label="Pagination">
      <button onClick={() => onChange(page - 1)} disabled={page === 1} aria-label="Previous page">‹</button>
      {shown.map((n, idx) =>
        n === '…' ? (
          <button key={`gap-${idx}`} disabled>…</button>
        ) : (
          <button
            key={n}
            className={n === page ? 'on' : undefined}
            aria-current={n === page ? 'page' : undefined}
            onClick={() => onChange(n)}
          >
            {n}
          </button>
        )
      )}
      <button onClick={() => onChange(page + 1)} disabled={page === pages} aria-label="Next page">›</button>
    </nav>
  );
}

/** The square-button variant the Ideas list uses. */
export function IdeaPager({ page, pages, onChange }) {
  if (pages <= 1) return null;

  const shown = [];
  for (let n = 1; n <= pages; n++) {
    if (n === 1 || n === pages || Math.abs(n - page) <= 1) shown.push(n);
  }

  const out = [];
  let prev = 0;
  shown.forEach((n) => {
    if (prev && n - prev > 1) out.push(<span className="ellipsis" key={`e${n}`}>…</span>);
    out.push(
      <button
        key={n}
        className={n === page ? 'current' : undefined}
        aria-current={n === page ? 'page' : undefined}
        onClick={() => onChange(n)}
      >
        {n}
      </button>
    );
    prev = n;
  });

  return (
    <nav className="pager" aria-label="Ideas pagination">
      <button onClick={() => onChange(page - 1)} disabled={page === 1} aria-label="Previous page">‹</button>
      {out}
      <button onClick={() => onChange(page + 1)} disabled={page === pages} aria-label="Next page">›</button>
    </nav>
  );
}
