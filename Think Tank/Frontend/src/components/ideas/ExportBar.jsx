import { useState } from 'react';
import { printNode, pdfFromNode, slugify } from '../../lib/exportDoc';
import { useToast } from '../../store/ToastContext';
import { PrinterIcon, DownloadIcon } from '../../lib/icons';

/**
 * Print and Download PDF, for whichever description is on screen.
 *
 * One pair of buttons rather than a pair per description type: both act on the
 * hidden printable copy, which already knows how to draw a flowchart, a bullet
 * list, a paragraph or a list of files. Everyone gets them — a member reading
 * an idea has as much reason to take it into a meeting as the chairman who
 * wrote it.
 *
 * Saving a PDF fetches its two libraries on first use, which on a slow
 * connection is a second or two of nothing happening, so the button says what
 * it is doing while it does it.
 */
export default function ExportBar({ targetRef, name, label = 'this description' }) {
  const toast = useToast();
  const [busy, setBusy] = useState(null);   // 'print' | 'pdf'

  const run = async (kind, fn, failure) => {
    if (busy) return;
    setBusy(kind);
    try {
      await fn();
    } catch {
      toast(failure);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="export-bar">
      <span className="export-lab">Take {label} with you</span>
      <div className="export-acts">
        <button
          type="button"
          className="btn-ghost-sm"
          disabled={!!busy}
          title="Print"
          onClick={() => run(
            'print',
            () => printNode(targetRef.current, name),
            'Your browser would not open the print view'
          )}
        >
          <PrinterIcon />
          {busy === 'print' ? 'Opening…' : 'Print'}
        </button>

        <button
          type="button"
          className="btn-ghost-sm"
          disabled={!!busy}
          title="Download as PDF"
          onClick={() => run(
            'pdf',
            async () => {
              await pdfFromNode(targetRef.current, slugify(name));
              toast('PDF saved to your downloads');
            },
            'The PDF could not be created'
          )}
        >
          <DownloadIcon />
          {busy === 'pdf' ? 'Preparing…' : 'Download PDF'}
        </button>
      </div>
    </div>
  );
}
