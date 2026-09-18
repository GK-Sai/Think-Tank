import FlowchartView from './FlowchartView';
import { fmtSize, extOf } from '../../lib/format';
import { emptyDescription } from '../../data/seed';

/**
 * A description, shown the way it was written.
 *
 * A flowchart is rendered as the flowchart, bullet points as a bullet list,
 * an upload as its files. Only a paragraph is prose. Flattening everything
 * into a line of text loses the reason someone chose that editor in the first
 * place.
 *
 * It takes a type and a content bundle rather than an idea, because every
 * *version* of an idea is drawn this way — the chairman's original flowchart
 * as well as the one a member edited it into.
 *
 * `plain` is the printing case: the flowchart at the size that fits the
 * sheet, with nothing to press.
 *
 * **Words carry no zoom control, on any screen.** Bullet points and a
 * paragraph sat under the same − / % / + / Reset row a flowchart has, and
 * those buttons took a corner of every description to do a job that is
 * already done: text reflows to the width it is given, and a reader who wants
 * it larger has said so in their browser already.
 *
 * The flowchart keeps its own, everywhere: that one is a picture, it does not
 * reflow, and without zooming it cannot be read on a phone at all.
 */
export default function DescriptionView({ type, content, fallbackText = '', plain = false }) {
  const c = { ...emptyDescription(), ...(content || {}) };

  if (type === 'flowchart') {
    return <FlowchartView value={c.flowchart} plain={plain} />;
  }

  if (type === 'bulletPoints') {
    const points = (c.bulletPoints || []).map((t) => String(t).trim()).filter(Boolean);
    if (!points.length) return <p className="rev-none">Nothing written yet.</p>;
    return (
      <ul className="desc-bullets">
        {points.map((t, i) => <li key={i}>{t}</li>)}
      </ul>
    );
  }

  if (type === 'uploadFile') {
    const files = c.uploadFile || [];
    if (!files.length) return <p className="rev-none">No files were attached.</p>;
    return (
      <ul className="desc-files">
        {files.map((f, i) => (
          <li key={i}>
            <span className="desc-ext">{extOf(f.name)}</span>
            <span className="desc-file-b">
              <strong>{f.name}</strong>
              {f.size ? <span>{fmtSize(f.size)}</span> : null}
            </span>
          </li>
        ))}
      </ul>
    );
  }

  const text = String(c.paragraph || fallbackText || '').trim();
  if (!text) return <p className="rev-none">Nothing written yet.</p>;
  return (
    <div className="rev-text">
      {text.split('\n').filter(Boolean).map((line, i) => <p key={i}>{line}</p>)}
    </div>
  );
}
