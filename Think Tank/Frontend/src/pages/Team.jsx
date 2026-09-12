import { useEffect, useMemo, useState } from 'react';
import InviteMemberModal from '../components/team/InviteMemberModal';
import EditRoleModal from '../components/team/EditRoleModal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import BackLink from '../components/layout/BackLink';
import Select from '../components/ui/Select';
import { IdeaPager } from '../components/ui/Pager';
import { MemberAvatar } from '../lib/avatars';
import { displayName, isChairRecord } from '../lib/format';
import { PlusIcon, SearchIcon, CloseIcon, ChevronDownIcon } from '../lib/icons';
import useCompact from '../lib/useCompact';
import { ALL_DEPARTMENTS } from '../data/seed';
import { useApp } from '../store/AppContext';
import { useAuth } from '../store/AuthContext';
import { useToast } from '../store/ToastContext';

const PER_PAGE = 8;
const BLANK = { query: '', dept: '', role: '', sort: 'name' };

export default function Team() {
  const { team, addMember, updateMember, removeMember } = useApp();
  const { user, isChair } = useAuth();
  const toast = useToast();
  const compact = useCompact();

  const [inviteOpen, setInviteOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [removing, setRemoving] = useState(null);
  const [f, setF] = useState(BLANK);
  const [page, setPage] = useState(1);
  /* Phone only: the search field is folded away behind the icon at the right
     of the heading, and opens on that same line rather than pushing the
     filters down a row. The desktop field in the filter bar is untouched. */
  const [searchOpen, setSearchOpen] = useState(false);

  const set = (key, value) => setF((prev) => ({ ...prev, [key]: value }));
  useEffect(() => { setPage(1); }, [f]);

  /* The chairman is not a team member on this page. He signs in, adds people
     and edits roles exactly as before — he simply is not one of the rows, and
     the count does not count him. Everything else about his account is
     untouched; this is a display rule, not a permission one. */
  const staff = useMemo(() => team.filter((m) => !isChairRecord(m)), [team]);

  /* Job titles come from the data, not a fixed list, so a title invented
     when someone is added is filterable straight away. */
  const roles = useMemo(
    () => Array.from(new Set(staff.map((m) => m.role).filter(Boolean))).sort(),
    [staff]
  );

  const rows = useMemo(() => {
    const q = f.query.trim().toLowerCase();
    const matched = staff.filter((m) => {
      if (f.dept && m.dept !== f.dept) return false;
      if (f.role && m.role !== f.role) return false;
      if (!q) return true;
      return `${m.name} ${m.dept} ${m.role} ${m.email}`.toLowerCase().includes(q);
    });

    const sorters = {
      name: (a, b) => a.name.localeCompare(b.name),
      dept: (a, b) => a.dept.localeCompare(b.dept) || a.name.localeCompare(b.name),
      role: (a, b) => a.role.localeCompare(b.role) || a.name.localeCompare(b.name),
    };
    return matched.sort(sorters[f.sort] || sorters.name);
  }, [staff, f]);

  const pages = Math.max(1, Math.ceil(rows.length / PER_PAGE));
  const current = Math.min(page, pages);
  const slice = rows.slice((current - 1) * PER_PAGE, current * PER_PAGE);

  return (
    <>
      {!compact && <BackLink to="/" label="Back to Dashboard" />}

      <div className={`sec-head${!compact && searchOpen ? ' searching' : ''}`}>
        {compact && <BackLink to="/" label="Back to Dashboard" />}
        <div className="sh-txt">
          <h2>Team Members</h2>
        </div>

        {/* Phone and tablet: the field itself, on the heading's own line and
            always there — see Ideas.jsx. Laptop: it folds behind the icon and
            the filter row carries the real field. */}
        {(compact || searchOpen) && (
          <div className={`search-box head-search${compact ? ' always' : ''}`}>
            <SearchIcon />
            <input
              type="search"
              autoFocus={!compact}
              placeholder="Search team members"
              aria-label="Search team members"
              value={f.query}
              onChange={(e) => set('query', e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Escape') { set('query', ''); setSearchOpen(false); } }}
            />
          </div>
        )}

        {isChair && (
          <button className="btn-add" onClick={() => setInviteOpen(true)}>
            <PlusIcon />
            Add Member
          </button>
        )}

        {!compact && (
          <button
            type="button"
            className={`hs-btn${searchOpen ? ' on' : ''}`}
            aria-label={searchOpen ? 'Close search' : 'Search team members'}
            aria-expanded={searchOpen}
            onClick={() => {
              if (searchOpen) set('query', '');
              setSearchOpen((v) => !v);
            }}
          >
            {searchOpen ? <CloseIcon /> : <SearchIcon />}
          </button>
        )}
      </div>

      <div className="idea-filters">
        <div className="search-box">
          <SearchIcon />
          <input
            type="search"
            placeholder="Search by name, email or role"
            aria-label="Search team members"
            value={f.query}
            onChange={(e) => set('query', e.target.value)}
          />
        </div>

        <Select
          label="Filter by department"
          value={f.dept}
          onChange={(v) => set('dept', v)}
          options={[{ value: '', label: 'All Departments' }, ...ALL_DEPARTMENTS.map((d) => ({ value: d, label: d }))]}
        />

        <Select
          label="Filter by role"
          value={f.role}
          onChange={(v) => set('role', v)}
          options={[{ value: '', label: 'All Roles' }, ...roles.map((r) => ({ value: r, label: r }))]}
        />

        <Select
          className="wide"
          label="Sort team members"
          value={f.sort}
          onChange={(v) => set('sort', v)}
          options={[
            { value: 'name', label: 'Name A–Z' },
            { value: 'dept', label: 'Department A–Z' },
            { value: 'role', label: 'Role A–Z' },
          ]}
        />
      </div>

      <p className="swipe-hint">Swipe the table sideways to see all columns</p>
      <div className="bt-wrap">
        {/* On a phone each member becomes a card: the face and the name on one
            line, everything else labelled underneath. */}
        <table className="bluetable stacks team-tbl">
          <thead>
            <tr>
              <th style={{ width: 76 }}>Member</th>
              <th>Name</th>
              <th>Department</th>
              <th>Role</th>
              {isChair && <th style={{ width: 170 }}>Action</th>}
            </tr>
          </thead>
          <tbody>
            {slice.map((m) => (
              <tr key={m.id}>
                <td className="t-face"><MemberAvatar member={m} /></td>
                <td className="t-name">
                  {displayName(m.name, m.accountRole)}
                  {m.id === user?.id && <span className="muted"> (you)</span>}
                </td>
                <td className="muted" data-label="Department">{m.dept}</td>
                <td data-label="Role"><span className="pill role">{m.role}</span></td>
                {isChair && (
                  /* Not on your own row: the chairman has no department or
                     job title to edit, and Remove refuses your own account —
                     the button could only ever have failed. */
                  <td className="row-act td-act">
                    {m.id !== user?.id && (
                      <>
                        <button className="edit" onClick={() => setEditing(m)}>Edit Role</button>
                        <span className="sep">|</span>
                        <button className="rm" onClick={() => setRemoving(m)}>Remove</button>
                      </>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {slice.length === 0 && <div className="empty">No members match your filters.</div>}

      <IdeaPager page={current} pages={pages} onChange={setPage} />

      <InviteMemberModal open={inviteOpen} onClose={() => setInviteOpen(false)} onAdd={addMember} />
      <EditRoleModal member={editing} onClose={() => setEditing(null)} onSave={updateMember} />

      <ConfirmDialog
        open={!!removing}
        title={`Remove ${displayName(removing?.name, removing?.accountRole)}?`}
        body="They will lose access to the workspace immediately."
        okLabel="Remove"
        onCancel={() => setRemoving(null)}
        onConfirm={async () => {
          const name = displayName(removing.name, removing.accountRole);
          try {
            await removeMember(removing.id);
            toast(`${name} removed`);
          } finally {
            setRemoving(null);
          }
        }}
      />
    </>
  );
}
