import { useEffect, useState } from 'react';
import Modal from '../ui/Modal';
import FlowchartEditor from './FlowchartEditor';
import BulletEditor from './BulletEditor';
import ParagraphEditor from './ParagraphEditor';
import UploadEditor from './UploadEditor';
import { emptyDescription, DESCRIPTION_TYPES } from '../../data/seed';

const TYPE_LABEL = Object.fromEntries(DESCRIPTION_TYPES.map((t) => [t.key, t.label]));

/** Is there anything in the editor to save? */
function isEmpty(type, content) {
  if (type === 'flowchart') return !content.flowchart.shapes.length;
  if (type === 'bulletPoints') return !content.bulletPoints.filter((t) => t.trim()).length;
  if (type === 'paragraph') return !content.paragraph.trim();
  return !content.uploadFile.length;
}

/**
 * The "Edit" dialog from the discussion page.
 *
 * It opens the editor the idea was written in — a flowchart opens the
 * flowchart canvas, bullets open the bullet list — rather than a text box.
 * That is the point: a member who moves a box or adds a step is editing the
 * drawing everyone sees, not a paragraph describing it.
 *
 * Saving appends a version. The one it replaces stays above it on the page,
 * with the name and the time of whoever wrote each.
 */
export default function EditIdeaModal({ open, idea, onClose, onSave }) {
  const [content, setContent] = useState(emptyDescription);
  const [saving, setSaving] = useState(false);

  const type = idea?.descriptionType || 'paragraph';

  /* Reopening shows what is on the page right now, not whatever was left in
     the editor last time — and a missing slice is filled in, so an older idea
     never hands an editor `undefined`. */
  useEffect(() => {
    if (!open || !idea) return;
    setContent({ ...emptyDescription(), ...(idea.descriptionContent || {}) });
  }, [open, idea]);

  const patch = (key, value) => setContent((c) => ({ ...c, [key]: value }));

  const submit = async () => {
    if (saving || isEmpty(type, content)) return;
    setSaving(true);
    try {
      await onSave({ descriptionType: type, descriptionContent: content });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  if (!idea) return null;

  return (
    <Modal
      open={open}
      title={`Edit the ${TYPE_LABEL[type] || 'description'}`}
      subtitle="Everyone in the discussion sees the new version, with your name on it"
      onClose={onClose}
      labelledBy="editIdeaTitle"
      /* A flowchart needs the room; the other editors do not. */
      size={type === 'flowchart' ? 'wide' : undefined}
      footer={
        <>
          <button type="button" className="btn-cancel" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="btn-primary"
            onClick={submit}
            disabled={saving || isEmpty(type, content)}
          >
            {saving ? 'Saving…' : 'Save new version'}
          </button>
        </>
      }
    >
      <div className="edit-desc">
        {type === 'flowchart' && (
          <FlowchartEditor value={content.flowchart} onChange={(v) => patch('flowchart', v)} />
        )}
        {type === 'bulletPoints' && (
          <BulletEditor value={content.bulletPoints} onChange={(v) => patch('bulletPoints', v)} />
        )}
        {type === 'paragraph' && (
          <ParagraphEditor value={content.paragraph} onChange={(v) => patch('paragraph', v)} />
        )}
        {type === 'uploadFile' && (
          <UploadEditor value={content.uploadFile} onChange={(v) => patch('uploadFile', v)} />
        )}
      </div>

      <p className="modal-hint">
        This is saved as a new version and appears under the one it replaces,
        with your name and the time on it. To change the tagline, purpose or
        department, use the full editor.
      </p>
    </Modal>
  );
}
