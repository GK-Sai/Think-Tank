/** The big page title block. Pages that carry their own heading skip this.
 *
 * `search` is the phone-only fold-away search: whatever is passed sits on the
 * heading's own line, to the right of the title, rather than in the filter bar
 * underneath it. On a wide screen it hides itself and the filter bar keeps the
 * real field.
 */
export default function PageHead({
  title, subtitle, action, search, searching, hideSubtitleOnMobile,
}) {
  return (
    <div className={`page-head${searching ? ' searching' : ''}`}>
      <div className="ph-txt">
        <h1 className="page-h">{title}</h1>
        {subtitle && (
          <p className={`page-sub${hideSubtitleOnMobile ? ' page-sub-hide-mobile' : ''}`}>
            {subtitle}
          </p>
        )}
      </div>
      {search}
      {action && <div className="page-actions">{action}</div>}
    </div>
  );
}
