import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import FlowchartEditor from './FlowchartEditor';
import BulletEditor from './BulletEditor';
import ParagraphEditor from './ParagraphEditor';
import UploadEditor from './UploadEditor';
import ExportBar from './ExportBar';
import PrintableDescription from './PrintableDescription';
import ConfirmDialog from '../ui/ConfirmDialog';
import PageHead from '../layout/PageHead';
import BackLink from '../layout/BackLink';
import { useApp } from '../../store/AppContext';
import { useAuth } from '../../store/AuthContext';
import { useToast } from '../../store/ToastContext';
import { blankIdea, cloneIdea, emptyDescription, DEPARTMENTS, DESCRIPTION_TYPES } from '../../data/seed';
import { displayName } from '../../lib/format';
import { TODAY, fmtLong } from '../../lib/date';
import {
  FlowIcon, BulletIcon, ParagraphIcon, UploadIcon, ChevronDownIcon,
} from '../../lib/icons';

const TAB_ICONS = {
  flowchart: FlowIcon,
  bulletPoints: BulletIcon,
  paragraph: ParagraphIcon,
  uploadFile: UploadIcon,
};

/** Is the currently selected description editor empty? */
function isEditorEmpty(type, content) {
  if (type === 'flowchart') return content.flowchart.shapes.length === 0;
  if (type === 'bulletPoints') return content.bulletPoints.filter((t) => t.trim()).length === 0;
  if (type === 'paragraph') return !content.paragraph.trim();
  return content.uploadFile.length === 0;
}

export default function IdeaForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const { ideas, loading, saveIdea, deleteIdea } = useApp();

  const existing = useMemo(
    () => (id ? ideas.find((i) => i.id === Number(id)) : null),
    [id, ideas]
  );

  /** A deep copy of the record, so cancelling leaves the stored one alone. */
  const draftFrom = (idea) => {
    if (!idea) return blankIdea(user);
    const copy = cloneIdea(idea);
    // Older records may predate a field; fill the gaps so no editor reads undefined.
    copy.descriptionContent = { ...emptyDescription(), ...(copy.descriptionContent || {}) };
    return copy;
  };

  const [draft, setDraft] = useState(() => draftFrom(existing));
  const [errors, setErrors] = useState({});
  const [confirmOpen, setConfirmOpen] = useState(false);

  /* Opening /ideas/:id/edit directly — a refresh, or a pasted link — reaches
     this component before the store has loaded any ideas, so `existing` was
     null on the first render and the form initialised itself blank. Saving
     from that state created a *second* idea instead of updating this one.
     Fill the form in as soon as the record arrives, and only then. */
  const loadedId = useRef(existing?.id ?? null);
  useEffect(() => {
    if (!id || !existing || loadedId.current === existing.id) return;
    loadedId.current = existing.id;
    setDraft(draftFrom(existing));
    setErrors({});
    // draftFrom is a plain local helper; `user` is only read for a blank draft.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, existing]);

  /* What Print and Download PDF act on: a hidden, page-width rendering of the
     description as a reader would see it, not the editor being typed into. */
  const printRef = useRef(null);

  const patch = (key, value) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setErrors((e) => ({ ...e, [key]: false }));
  };

  const patchContent = (key, value) =>
    setDraft((d) => ({ ...d, descriptionContent: { ...d.descriptionContent, [key]: value } }));

  const validate = () => {
    const next = {
      tagline: !draft.tagline.trim(),
      purpose: !draft.purpose.trim(),
      dept: !draft.dept,
    };
    setErrors(next);
    if (next.tagline || next.purpose || next.dept) {
      toast('Please complete the highlighted fields');
      return false;
    }
    if (isEditorEmpty(draft.descriptionType, draft.descriptionContent)) {
      const label = DESCRIPTION_TYPES.find((t) => t.key === draft.descriptionType)?.label;
      toast(`Add something to the ${label} description first`);
      return false;
    }
    return true;
  };

  const [saving, setSaving] = useState(false);

  const persist = async (status, message) => {
    setSaving(true);
    try {
      const saved = await saveIdea(draft, status);
      toast(message);
      /* Creating an idea drops you straight into its discussion — that is
         where the work now happens, and where everyone else has just been
         sent by their notification. A draft has no discussion to join. */
      navigate(status === 'Draft' ? '/ideas' : `/ideas/${saved.id}`);
    } catch {
      // saveIdea already surfaced the server's message in a toast
      setSaving(false);
    }
  };

  const submit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    persist(
      existing ? existing.status || 'Under Review' : 'Under Review',
      existing ? 'Idea updated — the team has been told' : 'Idea opened for discussion'
    );
  };

  const saveDraft = () => {
    if (!draft.tagline.trim()) {
      setErrors((e) => ({ ...e, tagline: true }));
      toast('A tagline is needed even for a draft');
      return;
    }
    persist('Draft', 'Saved as draft');
  };

  const onDelete = () => {
    if (!existing) {
      setDraft(blankIdea(user));
      setErrors({});
      toast('Form cleared');
      return;
    }
    setConfirmOpen(true);
  };

  const content = draft.descriptionContent;

  /* An edit URL opened cold: wait for the idea rather than showing an empty
     form headed "Edit Idea", which is how a save here used to become a new
     idea instead of a change to this one. */
  if (id && !existing) {
    return (
      <>
        <BackLink to="/ideas" label="Back to Ideas" />
        <div className="empty" style={{ marginTop: 24 }}>
          {loading ? 'Loading idea…' : 'That idea could not be found.'}
        </div>
      </>
    );
  }

  return (
    <>
      <PageHead
        title={existing ? 'Edit Idea' : 'Create New Idea'}
        subtitle={existing
          ? `Editing “${existing.title}”`
          : 'Describe the idea, then fill in the details below'}
      />

      <BackLink
        to={existing ? `/ideas/${id}` : '/ideas'}
        label={existing ? 'Back to the idea' : 'Back to Ideas'}
      />

      <form className="card" onSubmit={submit} noValidate>
        <div className="card-body">
          <h3 className="section-label">Idea Brief Description</h3>

          <div className="desc-tabs" role="tablist" aria-label="Description type">
            {DESCRIPTION_TYPES.map(({ key, label }) => {
              const TabIcon = TAB_ICONS[key];
              const on = draft.descriptionType === key;
              return (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  className={`desc-tab${on ? ' active' : ''}`}
                  onClick={() => patch('descriptionType', key)}
                >
                  <TabIcon />
                  {label}
                </button>
              );
            })}
          </div>

          {/* Print and save work on whichever tab is open, so a flowchart, a
              bullet list, a paragraph and a set of files all come out on paper
              without four separate exports. Empty is not worth printing. */}
          {!isEditorEmpty(draft.descriptionType, content) && (
            <ExportBar
              targetRef={printRef}
              name={draft.tagline?.trim() || existing?.title || 'idea'}
              label="this description"
            />
          )}

          {/* Only one editor renders at a time, but every type keeps its own
              slice of `descriptionContent`, so switching tabs loses nothing. */}
          <div className="desc-panels">
            <div className="desc-panel active" role="tabpanel">
              {draft.descriptionType === 'flowchart' && (
                <FlowchartEditor
                  value={content.flowchart}
                  onChange={(v) => patchContent('flowchart', v)}
                />
              )}
              {draft.descriptionType === 'bulletPoints' && (
                <BulletEditor
                  value={content.bulletPoints}
                  onChange={(v) => patchContent('bulletPoints', v)}
                />
              )}
              {draft.descriptionType === 'paragraph' && (
                <ParagraphEditor
                  value={content.paragraph}
                  onChange={(v) => patchContent('paragraph', v)}
                />
              )}
              {draft.descriptionType === 'uploadFile' && (
                <UploadEditor
                  value={content.uploadFile}
                  onChange={(v) => patchContent('uploadFile', v)}
                />
              )}
            </div>
          </div>

          {/* Common fields — declared once, shared by all four description types. */}
          <div className="common-fields">
            <div className="field-row">
              <label htmlFor="fTagline">Tagline</label>
              <input
                id="fTagline"
                className={errors.tagline ? 'invalid' : undefined}
                placeholder="Enter Tagline"
                maxLength={90}
                value={draft.tagline}
                onChange={(e) => patch('tagline', e.target.value)}
              />
              <p className={`field-err${errors.tagline ? ' show' : ''}`}>Please enter a tagline.</p>
            </div>

            <div className="field-row">
              <label htmlFor="fPurpose">Purpose of the Idea</label>
              <textarea
                id="fPurpose"
                className={errors.purpose ? 'invalid' : undefined}
                placeholder="Enter Purpose of the idea"
                rows={3}
                value={draft.purpose}
                onChange={(e) => patch('purpose', e.target.value)}
              />
              <p className={`field-err${errors.purpose ? ' show' : ''}`}>Please describe the purpose.</p>
            </div>

            {/* The department the idea belongs to, chosen here alongside the
                tagline and the purpose rather than later on. */}
            <div className="field-row">
              <label htmlFor="fDept">Department</label>
              <div className="select-box wide">
                <select
                  id="fDept"
                  className={errors.dept ? 'invalid' : undefined}
                  value={draft.dept || ''}
                  onChange={(e) => patch('dept', e.target.value)}
                >
                  <option value="">Select Department</option>
                  {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
                <ChevronDownIcon />
              </div>
              <p className={`field-err${errors.dept ? ' show' : ''}`}>Please choose a department.</p>
            </div>
          </div>
        </div>

        <div className="form-actions">
          <button type="button" className="btn-danger" onClick={onDelete}>
            {existing ? 'Delete' : 'Clear form'}
          </button>
          <button type="button" className="btn-muted" onClick={saveDraft} disabled={saving}>
            Save as Draft
          </button>
          <button type="submit" className="btn-solid" disabled={saving}>
            {saving ? 'Saving…' : existing ? 'Save changes' : 'Create Idea'}
          </button>
        </div>
      </form>

      <PrintableDescription
        ref={printRef}
        title={existing?.title || draft.tagline}
        tagline={draft.tagline}
        purpose={draft.purpose}
        dept={draft.dept}
        author={`by ${displayName(user?.name, user?.role)}`}
        when={fmtLong(TODAY)}
        type={draft.descriptionType}
        content={draft.descriptionContent}
      />

      <ConfirmDialog
        open={confirmOpen}
        title="Delete this idea?"
        body={`“${existing?.title}” will be removed. This cannot be undone.`}
        okLabel="Delete"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={async () => {
          try {
            await deleteIdea(existing.id);
            setConfirmOpen(false);
            toast('Idea deleted');
            navigate('/ideas');
          } catch {
            setConfirmOpen(false);
          }
        }}
      />
    </>
  );
}
