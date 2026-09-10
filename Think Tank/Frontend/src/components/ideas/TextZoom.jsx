import { useState } from 'react';
import ZoomControl, { stepScale } from './ZoomControl';

/**
 * Zoom for a description made of words rather than boxes.
 *
 * A flowchart is a picture and is scaled like one. Bullet points and a
 * paragraph are not: scaling them as a picture would push the ends of the
 * lines off the right of the card and leave the reader dragging sideways to
 * finish a sentence, which is the one thing reading on a phone must never
 * ask. So the *type* grows and the lines re-wrap to the card they are in —
 * the card gets taller, never wider.
 *
 * `em` rather than pixels, so every size inside keeps its relationship to
 * every other: the bullet marker, a nested line and the text all grow
 * together, and the type scale the rest of the page uses is not thrown away.
 */
const MIN_SCALE = 0.7;
const MAX_SCALE = 2.5;

export default function TextZoom({ children, label = 'text' }) {
  const [scale, setScale] = useState(1);

  return (
    <div className="tzoom">
      <div className="tzoom-body" style={scale === 1 ? undefined : { fontSize: `${scale}em` }}>
        {children}
      </div>
      <ZoomControl
        scale={scale}
        min={MIN_SCALE}
        max={MAX_SCALE}
        onZoom={(dir) => setScale((s) => stepScale(s, dir, MIN_SCALE, MAX_SCALE))}
        onReset={() => setScale(1)}
        resetLabel="Reset"
        atRest={Math.abs(scale - 1) < 0.005}
        label={label}
      />
    </div>
  );
}
