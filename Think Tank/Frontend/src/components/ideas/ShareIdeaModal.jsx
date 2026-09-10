import { useEffect, useMemo, useState } from 'react';
import Modal from '../ui/Modal';
import CandidatePicker from '../ui/CandidatePicker';
import { useApp } from '../../store/AppContext';
import { useAuth } from '../../store/AuthContext';
import { useToast } from '../../store/ToastContext';

/**
 * The chairman's other closing move: hand the project to the few people most
 * connected to it.
 *
 * This is not about who can read the idea — the whole company already can.
 * It is about naming the people who will carry it. They are told directly,
 * and their names sit on the idea page under "carrying", so the rest of the
 * company knows who picked it up.
 */
export default function ShareIdeaModal({ open, idea, onClose, onSave }) {
  const { team } = useApp();
  const { user } = useAuth();
  const toast = useToast();

  const [members, setMembers] = useState(new Set());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open && idea) setMembers(new Set(idea.sharedWith || []));
  }, [open, idea]);

  /* You never share a project with yourself. */
  const candidates = useMemo(
    () => team.filter((m) => m.id !== user?.id && m.accountRole !== 'chairman'),
    [team, user]
  );

  /* Once a department is on the idea, its own people are the obvious choice,
     so they sort to the top rather than being hunted for in the list. */
  const ordered = useMemo(() => {
    if (!idea?.dept) return candidates;
    return [...candidates].sort((a, b) => {
      const ad = a.dept === idea.dept ? 0 : 1;
      const bd = b.dept === idea.dept ? 0 : 1;
      return ad - bd;
    });
  }, [candidates, idea]);

  const save = async () => {
    setBusy(true);
    try {
      await onSave({ memberIds: [...members] });
      toast(
        members.size
          ? `Project shared with ${members.size} team ${members.size === 1 ? 'member' : 'members'}`
          : 'Sharing cleared'
      );
      onClose();
    } catch {
      /* the store already surfaced the message */
    } finally {
      setBusy(false);
    }
  };

  if (!idea) return null;

  return (
    <Modal
      open={open}
      title="Share the project"
      subtitle="Name the people who will carry this one"
      onClose={onClose}
      labelledBy="shareTitle"
      footer={
        <>
          <button className="btn-muted" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="btn-solid" onClick={save} disabled={busy}>
            {busy ? 'Sharing…' : `Share with ${members.size}`}
          </button>
        </>
      }
    >
      <p className="share-note">
        Everyone can already read “{idea.title}”. Sharing it tells these people
        it is <strong>theirs to carry</strong> — they get a notification, and
        their names appear on the idea so the rest of the team knows who has
        picked it up.
        {idea.dept && ` ${idea.dept} is listed first, since the project sits with them.`}
      </p>

      <CandidatePicker
        members={ordered}
        selected={members}
        onChange={setMembers}
        note="Pick the team members most connected to this project."
      />
    </Modal>
  );
}
