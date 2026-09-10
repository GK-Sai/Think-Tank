import FlowchartView from './FlowchartView';
import TextZoom from './TextZoom';
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
 * `plain` drops the zoom controls and shows everything at its own size. That
 * is the printing case: how somebody has zoomed a description to read it on
 * screen is not how they want it on paper.
 */
export default function DescriptionView({ type, content, fallbackText = '', plain = false }) {
  const c = { ...emptyDescription(), ...(content || {}) };
  /* Words are zoomed by resizing the type and letting the lines re-wrap;
     a flowchart is a picture and does its own, inside the drawing. */
  const wrap = (label, node) => (plain ? node : <TextZoom label={label}>{node}</TextZoom>);

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
