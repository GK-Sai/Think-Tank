/**
 * The zoom row: − · a live percentage · + · a way back.
 *
 * One control for the flowchart and for the text descriptions, because a
 * reader should not have to learn two. What each of them does with the number
 * differs — a drawing is scaled, type is resized and re-wrapped — but pressing
 * the same button in the same place has the same meaning either way.
 *
 * Two things it does that the old flowchart control did not:
 *
 *  - **It is always here.** The old one appeared only when a chart was too
 *    wide for its card, so a small dense chart — the one you most want to
 *    enlarge — offered nothing to press.
 *  - **It says where you are.** "Fit to screen" told you what the button did,
 *    never what you were looking at. A percentage answers "am I zoomed in?"
 *    without you having to press anything to find out.
 */
export const ZOOM_STEP = 1.25;

/** The next level up or down. Multiplied, not added, so every press feels the
    same: +0.25 on top of 0.4 is a 62% jump, on top of 2.0 it is 12%. */
export const stepScale = (scale, dir, min, max) => (
  Math.min(max, Math.max(min, dir > 0 ? scale * ZOOM_STEP : scale / ZOOM_STEP))
);

export default function ZoomControl({
  scale,
  min,
  max,
  onZoom,          // (direction: 1 | -1) => void
  onReset,
  resetLabel = 'Reset',
  atRest,          // true when there is nothing for Reset to undo
  label = 'description',
}) {
  const pct = Math.round(scale * 100);
  /* Floating point: 0.25 * 1.25 / 1.25 does not land exactly on 0.25, so the
     buttons compare with a little room rather than exactly. */
  const atMin = scale <= min * 1.001;
  const atMax = scale >= max * 0.999;

  return (
    <div className="zoomctl" role="group" aria-label={`Zoom ${label}`}>
      <button
        type="button"
        className="zb"
        onClick={() => onZoom(-1)}
        disabled={atMin}
        aria-label="Zoom out"
        title="Zoom out"
      >
        −
      </button>

      {/* Announced politely so a screen reader says the new level after a
          press, rather than interrupting whatever it was reading. */}
      <span className="zb pct" aria-live="polite" aria-label={`Zoom ${pct} percent`}>
        {pct}%
      </span>

      <button
        type="button"
        className="zb"
        onClick={() => onZoom(1)}
        disabled={atMax}
        aria-label="Zoom in"
        title="Zoom in"
      >
        +
      </button>

      <button
        type="button"
        className="zb rst"
        onClick={onReset}
        disabled={atRest}
        title={resetLabel}
      >
        {resetLabel}
      </button>
    </div>
  );
}
