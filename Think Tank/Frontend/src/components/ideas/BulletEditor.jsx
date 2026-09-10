import { useRef } from 'react';
import { CloseIcon } from '../../lib/icons';

/** Bullet list editor. Enter adds a row, Backspace on an empty row removes it. */
export default function BulletEditor({ value, onChange }) {
  const items = value.length ? value : [''];
  const listRef = useRef(null);

  const focusRow = (idx) => {
    requestAnimationFrame(() => {
      const inputs = listRef.current?.querySelectorAll('input');
      inputs?.[idx]?.focus();
    });
  };

  const setAt = (idx, text) => {
    const next = [...items];
    next[idx] = text;
    onChange(next);
  };

  const insertAfter = (idx) => {
    const next = [...items];
    next.splice(idx + 1, 0, '');
    onChange(next);
    focusRow(idx + 1);
  };

  const removeAt = (idx) => {
    const next = [...items];
    next.splice(idx, 1);
    onChange(next.length ? next : ['']);
    focusRow(Math.max(0, idx - 1));
  };

  return (
    <>
      <div className="bullets" ref={listRef}>
        {items.map((text, idx) => (
          <div className="bullet" key={idx}>
            <span className="dot" />
            <input
              value={text}
              placeholder={`Point ${idx + 1}`}
              onChange={(e) => setAt(idx, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); insertAfter(idx); }
                if (e.key === 'Backspace' && text === '' && items.length > 1) {
                  e.preventDefault();
                  removeAt(idx);
                }
              }}
            />
            <button
              type="button"
              className="kill"
              aria-label={`Remove point ${idx + 1}`}
              onClick={() => removeAt(idx)}
            >
              <CloseIcon strokeWidth={2.2} />
            </button>
          </div>
        ))}
      </div>
      <button type="button" className="btn-ghost-sm" onClick={() => { onChange([...items, '']); focusRow(items.length); }}>
        + Add bullet point
      </button>
    </>
  );
}
