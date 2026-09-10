import { forwardRef } from 'react';
import DescriptionView from './DescriptionView';
import { DESCRIPTION_TYPES } from '../../data/seed';

/**
 * The page that gets printed — laid out but never seen on screen.
 *
 * It sits off to the left of the viewport at a fixed A4 text-column width, so
 * it is a real piece of layout: the flowchart measures its own boxes and fits
 * itself to that width exactly as it would on a card, and what comes out of
 * the printer is the same drawing the reader sees rather than a second
 * rendering of it. `visibility` is left alone deliberately — `display:none`
 * would give every box a width of zero and the flowchart nothing to measure.
 *
 * It is `aria-hidden` and inert, because a screen reader meeting the whole
 * description twice would be a bug, not a courtesy.
 */
const PrintableDescription = forwardRef(function PrintableDescription(
  { title, type, content, tagline, purpose, dept, author, when, version, fallbackText = '' },
  ref
) {
  const typeLabel = DESCRIPTION_TYPES.find((t) => t.key === type)?.label || 'Description';

  return (
    <div className="print-stage" aria-hidden="true">
      <article className="pr-doc" ref={ref}>
        <header className="pr-head">
          <div className="pr-brand">
            Think Tank
            {/* Which version this sheet is, printed on the sheet. An idea
                edited three times produces three different pages, and paper
                that does not say which one it is is worse than no paper. */}
            {version && <span className="pr-version">{version}</span>}
          </div>
          <h1>{title || tagline || 'Untitled idea'}</h1>
          {tagline && tagline !== title && <p className="pr-tagline">{tagline}</p>}
          <p className="pr-meta">
            {[typeLabel, dept, author, when].filter(Boolean).join('  ·  ')}
          </p>
        </header>

        <section className="pr-section">
          <h2>{typeLabel}</h2>
          <DescriptionView type={type} content={content} fallbackText={fallbackText} plain />
        </section>

        {purpose && (
          <section className="pr-section">
            <h2>Purpose of the idea</h2>
            {String(purpose).split('\n').filter(Boolean).map((line, i) => <p key={i}>{line}</p>)}
          </section>
        )}
      </article>
    </div>
  );
});

export default PrintableDescription;
