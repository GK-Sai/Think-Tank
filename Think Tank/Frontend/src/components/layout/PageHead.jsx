/** The big page title block. Pages that carry their own heading skip this.
 *
 * `search` is the phone-only fold-away search: whatever is passed sits on the
 * heading's own line, to the right of the title, rather than in the filter bar
 * underneath it. On a wide screen it hides itself and the filter bar keeps the
 * real field.
 */
/* `back` is the back control on a phone or tablet. It is rendered *inside*
   this block rather than above it: floated alongside from outside, it took
   the whole block out of the page's width for as long as it was tall, so a
   search field on the second line started 50px in from everything under it.
   Inside, it is simply the first item on the heading's row. */
export default function PageHead({
  title, subtitle, action, search, searching, hideSubtitleOnMobile, className = '', back,
}) {
  return (
    <div className={`page-head${searching ? ' searching' : ''}${className ? ` ${className}` : ''}`}>
      {back}
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
