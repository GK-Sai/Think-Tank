import { useMemo, useState } from 'react';
import { MemberAvatar } from '../../lib/avatars';
import { SearchIcon } from '../../lib/icons';
import { displayName } from '../../lib/format';

/**
 * Search box + "select everyone" + a checkbox list of team members.
 * Shared by the Idea Sanctuary and the Create Task modal.
 *
 * `selected` is a Set of member ids; `onChange` receives the next Set.
 */
export default function CandidatePicker({
  members,
  selected,
  onChange,
  note,
  placeholder = 'Search  team members',
}) {
  const [query, setQuery] = useState('');

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return members;
    return members.filter(
      (m) => m.name.toLowerCase().includes(q) || m.dept.toLowerCase().includes(q)
    );
  }, [members, query]);

  const toggle = (id) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    onChange(next);
  };

  const allVisibleSelected = visible.length > 0 && visible.every((m) => selected.has(m.id));

  const toggleAll = () => {
    const next = new Set(selected);
    if (allVisibleSelected) visible.forEach((m) => next.delete(m.id));
    else visible.forEach((m) => next.add(m.id));
    onChange(next);
  };

  return (
    <>
      <div className="search-wrap">
        <SearchIcon />
        <input
          type="search"
          className="soft-in"
          placeholder={placeholder}
          aria-label="Search team members"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {note && <p className="cand-note">{note}</p>}

      <label className="cand" style={{ borderBottom: '1px solid var(--border)' }}>
        <span className="who">
          <strong>Select everyone</strong>
          <span>{selected.size} selected</span>
        </span>
        <input type="checkbox" checked={allVisibleSelected} onChange={toggleAll} />
      </label>

      <div className="cand-list">
        {visible.map((m) => (
          <label className="cand" key={m.id}>
            <MemberAvatar member={m} />
            <span className="who">
              <strong>{displayName(m.name, m.accountRole)}</strong>
              <span>{m.dept}</span>
            </span>
            <input
              type="checkbox"
              checked={selected.has(m.id)}
              onChange={() => toggle(m.id)}
            />
          </label>
        ))}
        {visible.length === 0 && <p className="cand-note">No one matches that search.</p>}
      </div>
    </>
  );
}
