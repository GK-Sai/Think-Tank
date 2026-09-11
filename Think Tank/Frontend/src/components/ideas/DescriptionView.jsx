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
 * **Words carry no zoom control.** Bullet points and a paragraph used to sit
 * under the same − / Fit / + buttons a flowchart has. Text does not need
 * them: it reflows to whatever width it is given, and a reader who wants it
 * larger has already set that in their browser or their phone. The buttons
 * took a corner of every description to do a job that was already done.
 *
 * The flowchart keeps its own, inside the drawing — that one is a picture, it
 * does not reflow, and on a phone it cannot be read without zooming.
 */
export default function DescriptionView({ type, content, fallbackText = '', plain = false }) {
  const c = { ...emptyDescription(), ...(content || {}) };
  const wrap = (label, node) => node;

  if (type === 'flowchart') {
    return <FlowchartView value={c.flowchart} plain={plain} />;
  }

  if (type === 'bulletPoints') {
    const points = (c.bulletPoints || []).map((t) => String(t).trim()).filter(Boolean);
    if (!points.length) return <p className="rev-none">Nothing written yet.</p>;
    return wrap('bullet points', (
      <ul className="desc-bullets">
        {points.map((t, i) => <li key={i}>{t}</li>)}
      </ul>
    ));
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
  return wrap('paragraph', (
    <div className="rev-text">
      {text.split('\n').filter(Boolean).map((line, i) => <p key={i}>{line}</p>)}
    </div>
  ));
}
