import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHead from '../components/layout/PageHead';
import BackLink from '../components/layout/BackLink';
import Select from '../components/ui/Select';
import { IdeaPager } from '../components/ui/Pager';
import useCompact from '../lib/useCompact';
import { useApp } from '../store/AppContext';
import { useAuth } from '../store/AuthContext';
import { DEPARTMENTS } from '../data/seed';
import { TODAY, parseYmd, fmtShort, daysBetween } from '../lib/date';
import { statusTagClass, displayName } from '../lib/format';
import { SearchIcon, CloseIcon, ChevronDownIcon } from '../lib/icons';

const PER_PAGE = 6;

const STATUSES = ['Draft', 'Under Review', 'In Progress', 'Approved', 'On Hold'];

const PERIODS = [
  ['all', 'Any date'],
  ['7', 'Last 7 days'],
  ['30', 'Last 30 days'],
  ['90', 'Last 3 months'],
];

const SORTS = [
  ['newest', 'Newest first'],
  ['oldest', 'Oldest first'],
  ['title', 'Title A–Z'],
  ['dept', 'Department A–Z'],
];

const BLANK = { query: '', dept: '', status: '', tag: '', period: 'all', sort: 'newest' };

export default function Ideas() {
  const navigate = useNavigate();
  const { isChair } = useAuth();
  const { myIdeas } = useApp();
  const compact = useCompact();

  const [f, setF] = useState(BLANK);
  const [page, setPage] = useState(1);
  /* Laptop only. On a phone or tablet the field is simply there, at the right
     of the heading — see the note beside the markup. */
  const [searchOpen, setSearchOpen] = useState(false);

  // Any filter change starts again from page one — otherwise a narrow
  // filter can land you on an empty page 4.
  const set = (key, value) => setF((prev) => ({ ...prev, [key]: value }));
  useEffect(() => { setPage(1); }, [f]);

  /* The tag list follows the data rather than a hard-coded list, so tags
     added by new departments show up on their own. */
  const tags = useMemo(
    () => Array.from(new Set(myIdeas.map((i) => i.tag).filter(Boolean))).sort(),
    [myIdeas]
  );

  const rows = useMemo(() => {
    const q = f.query.trim().toLowerCase();
    const maxAge = f.period === 'all' ? null : Number(f.period);

    const matched = myIdeas.filter((i) => {
      if (f.dept && i.dept !== f.dept) return false;
      if (f.status && i.status !== f.status) return false;
      if (f.tag && i.tag !== f.tag) return false;
      if (maxAge !== null && daysBetween(parseYmd(i.created), TODAY) > maxAge) return false;
      if (!q) return true;
      return `${i.title} ${i.tagline} ${i.purpose} ${i.tag} ${i.owner} ${i.dept || ''}`
        .toLowerCase()
        .includes(q);
    });

    const sorters = {
      newest: (a, b) => parseYmd(b.created) - parseYmd(a.created),
      oldest: (a, b) => parseYmd(a.created) - parseYmd(b.created),
      title: (a, b) => a.title.localeCompare(b.title),
      dept: (a, b) => (a.dept || '~').localeCompare(b.dept || '~') || a.title.localeCompare(b.title),
    };
    return matched.sort(sorters[f.sort] || sorters.newest);
  }, [myIdeas, f]);

  const pages = Math.max(1, Math.ceil(rows.length / PER_PAGE));
  const current = Math.min(page, pages);
  const slice = rows.slice((current - 1) * PER_PAGE, current * PER_PAGE);

  return (
    <>
      {/* Laptop: the labelled button on its own line above the page. Phone
          and tablet: the arrow goes inside the heading block — see PageHead. */}
      {!compact && <BackLink to="/" label="Back to Dashboard" />}

      <PageHead
        back={compact ? <BackLink to="/" label="Back to Dashboard" /> : null}
        title="Ideas"
        /* The line under the heading is gone on every one of these five
           pages: on a phone it was pushing the list itself below the fold,
           and it only ever restated what the page already shows. */
        /* Only the chairman opens an idea; everyone else joins the ones he
           has opened, so the button is simply not there for them. */
        action={isChair
          ? <button className="btn-solid" onClick={() => navigate('/ideas/new')}>Create New Idea</button>
          : null}
        searching={!compact && searchOpen}
        /* Phone and tablet: the field itself, top right of the heading — the
           same as Task Overview, so the five pages no longer disagree about
           where their search is. A control folded behind a magnifier is a
           control half the people looking for it never find.

           Laptop: untouched. The field lives in the filter row down the page
           and this one folds away behind the icon, as it always did. */
        search={(
          <>
            {(compact || searchOpen) && (
              <div className={`search-box head-search${compact ? ' always' : ''}`}>
                <SearchIcon />
                <input
                  type="search"
                  autoFocus={!compact}
                  placeholder="Search ideas"
                  aria-label="Search ideas"
                  value={f.query}
                  onChange={(e) => set('query', e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Escape') { set('query', ''); setSearchOpen(false); } }}
                />
              </div>
            )}
            {!compact && (
              <button
                type="button"
                className={`hs-btn${searchOpen ? ' on' : ''}`}
                aria-label={searchOpen ? 'Close search' : 'Search ideas'}
                aria-expanded={searchOpen}
                onClick={() => {
                  if (searchOpen) set('query', '');
                  setSearchOpen((v) => !v);
                }}
              >
                {searchOpen ? <CloseIcon /> : <SearchIcon />}
              </button>
            )}
          </>
        )}
      />

      <div className="idea-filters">
        <div className="search-box">
          <SearchIcon />
          <input
            type="search"
            placeholder="Search ideas"
            aria-label="Search ideas"
            value={f.query}
            onChange={(e) => set('query', e.target.value)}
          />
        </div>

        <Select
          label="Filter by department"
          value={f.dept}
          onChange={(v) => set('dept', v)}
          options={[{ value: '', label: 'All Departments' }, ...DEPARTMENTS.map((d) => ({ value: d, label: d }))]}
        />

        <Select
          label="Filter by status"
          value={f.status}
          onChange={(v) => set('status', v)}
          options={[{ value: '', label: 'All Statuses' }, ...STATUSES.map((x) => ({ value: x, label: x }))]}
        />

        <Select
          label="Filter by category or tag"
          value={f.tag}
          onChange={(v) => set('tag', v)}
          options={[{ value: '', label: 'All Categories' }, ...tags.map((t) => ({ value: t, label: t }))]}
        />

        <Select
          label="Filter by date created"
          value={f.period}
          onChange={(v) => set('period', v)}
          options={PERIODS.map(([v, l]) => ({ value: v, label: l }))}
        />

        <Select
          label="Sort ideas"
          value={f.sort}
          onChange={(v) => set('sort', v)}
          options={SORTS.map(([v, l]) => ({ value: v, label: l }))}
        />
      </div>

      <div className="card">
        <div className="card-head">
          <div>
            <h2>All Ideas</h2>
            {/* "9 ideas" above a table showing 6 of them reads as a wrong
                number. Say what is on screen and what the total is. */}
            <span className="sub">
              {rows.length === 0
                ? 'No ideas'
                : rows.length <= PER_PAGE
                  ? `${rows.length} idea${rows.length === 1 ? '' : 's'}`
                  : `Showing ${(current - 1) * PER_PAGE + 1}–${Math.min(current * PER_PAGE, rows.length)} of ${rows.length}`}
              {rows.length !== myIdeas.length && ` · ${myIdeas.length} in total`}
            </span>
          </div>
        </div>
        <p className="swipe-hint">Swipe the table sideways to see all columns</p>
        {/* Every cell names its own column. On a phone the table stops being a
            table — each row becomes a card and the name is the label beside the
            value, so nothing has to be scrolled off to the right to be read. */}
        <div className="table-wrap">
          <table className="stacks acts-inline">
            <thead>
              <tr>
                <th>Title</th><th>Created Date</th><th>Department</th>
                <th>Category/Tag</th><th>Status</th><th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {slice.map((i) => (
                <tr key={i.id}>
                  <td className="td-title">
                    {i.title}
                    <small>
                      {i.tagline && i.tagline !== i.title
                        ? i.tagline
                        : `by ${displayName(i.owner, i.ownerRole)}`}
                    </small>
                  </td>
                  <td className="nowrap" data-label="Created">{fmtShort(parseYmd(i.created))}</td>
                  <td data-label="Department">{i.dept || '—'}</td>
                  <td data-label="Category"><span className="tag">{i.tag}</span></td>
                  <td data-label="Status"><span className={`tag ${statusTagClass(i.status)}`}>{i.status}</span></td>
                  <td className="td-act">
                    <div className="actions">
                      {/* The quick-view eye stood beside a control that opens
                          the same idea in full, so the row made the same offer
                          twice and the smaller one was the worse of the two.
                          Opens the discussion page — this is where the
                          chairman and the author talk it through. */}
                      <button className="link-action" onClick={() => navigate(`/ideas/${i.id}`)}>
                        View/Edit
                        {/* The badge slot is always rendered, empty or not, so
                            a row with comments does not shove View/Edit out of
                            line with the rows above and below it. */}
                        <span className={`cmt-count${i.comments?.length ? '' : ' none'}`}>
                          {i.comments?.length || ''}
                        </span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {slice.length === 0 && <div className="empty">No ideas match your filters.</div>}
        <IdeaPager page={current} pages={pages} onChange={setPage} />
      </div>

    </>
  );
}
