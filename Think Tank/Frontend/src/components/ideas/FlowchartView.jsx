import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import ZoomControl, { stepScale } from './ZoomControl';
import { linkPaths, laneSpace } from '../../lib/flowchart';

/**
 * A flowchart, read-only.
 *
 * The editor draws its arrows by measuring the rendered boxes rather than
 * trusting the stored coordinates, because a box is as wide as its label. This
 * does the same — same maths, from the same module, no dragging — so an idea
 * drawn as a flowchart is shown as that flowchart on the discussion page
 * instead of being flattened into "A → B → C", and a return arrow from End
 * back to Start reads here exactly as it was drawn.
 *
 * **It fits the screen.** A chart drawn on a desktop is wider than a phone,
 * and left at full size it hung off the right of the card: you saw a Start
 * box, half an arrow, and had to guess at the rest. The drawing is scaled down
 * to the width it is being shown in, so the whole shape of it is there at a
 * glance on any screen.
 *
 * Fitting is where it starts, not where it ends. The chart is drawn once at
 * its true size and scaled as a whole — boxes, labels and arrows shrink
 * together, so nothing goes crooked — and the reader can zoom in on the part
 * they want to read: the buttons, a pinch on a phone, or a double-tap to go
 * between fitting and full size. Zoomed past the box, it pans by scrolling.
 *
 * ---- how the zoom works, and what it used to get wrong ----
 *
 * `scale` is now the only number: what the drawing is being shown at, 1 being
 * its true size. It used to be two — a `fit` and a reader's `zoom` multiplied
 * together — and the two disagreed at the edges: the buttons moved `zoom` but
 * the disabled test read the product, which on a wide chart was already at the
 * floor the moment it was fitted, so zoom out was greyed out before anyone
 * touched it. One number cannot disagree with itself.
 *
 * The control is always on screen. It used to appear only when a chart was too
 * wide for its card, which meant a small dense chart — exactly the one worth
 * enlarging — offered nothing to press.
 *
 * **Zooming holds what you are looking at.** The drawing is still drawn from
 * its top-left corner; what changed is that the box is scrolled, in the same
 * breath, to keep the point at the centre of the viewport where it was.
 * Without that, enlarging walked the chart down and to the right and you went
 * looking for the box you had been reading. A pinch anchors between the two
 * fingers instead of the centre, which is where the reader is pointing.
 *
 * The viewport keeps the height the fitted chart needs rather than growing
 * with the zoom, so the page does not lurch when you press +; past that, the
 * chart pans inside it.
 */

const MIN_SCALE = 0.25;
const MAX_SCALE = 4;
const VIEW_MIN_H = 200;       // always room to look around, even in a small chart
const VIEW_MAX_H = 560;       // ...and never a chart that swallows the page
const EDGE_PAD = 24;          // air between the first shape and the card's edge
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

/**
 * `plain` is the printing case: the chart at the size that fits the sheet,
 * whole, with no controls and nothing to scroll. What somebody has zoomed to
 * on screen is how they are reading it, not how they want it printed.
 */
export default function FlowchartView({ value, plain = false }) {
  const shapes = value?.shapes || [];
  const links = value?.links || [];

  const canvasRef = useRef(null);
  const scaleBoxRef = useRef(null);
  const stageRef = useRef(null);
  const nodeRefs = useRef({});
  const [paths, setPaths] = useState([]);
  const [size, setSize] = useState({ w: 0, h: 0 });
  /* The top-left corner of the drawing itself, which is not the corner of the
     canvas it was drawn on — see `measure` below. */
  const [origin, setOrigin] = useState({ x: 0, y: 0 });

  /* `fit` is the scale that puts the whole drawing inside the box — the
     starting point, and what Fit returns to. `scale` is what is on screen. */
  const [fit, setFit] = useState(1);
  const [scale, setScale] = useState(1);

  /* Until the reader touches the zoom, the chart follows the fit: rotate the
     phone and it re-fits itself. After that it is theirs, and a resize leaves
     it where they put it. */
  const touched = useRef(false);
  const scaleRef = useRef(1);
  scaleRef.current = scale;

  /* Where the box should be scrolled to once the new scale has painted, so
     the point we zoomed about does not move. Applied in a layout effect —
     setting scrollLeft before the content is its new size does nothing. */
  const pendingScroll = useRef(null);

  const measure = useCallback(() => {
    const stage = stageRef.current;
    const box = canvasRef.current;
    if (!stage || !box) return;

    /* The drawing's own four edges, not the canvas's.
       This is the whole of the "the chart has slid to the right" bug. A chart
       is laid out on a canvas far wider than this card, and the chairman
       naturally arranges it somewhere in the middle of that canvas — so the
       first shape might start 300px in. Measuring only the right and bottom
       edges meant the box handed to the card ran from the canvas's corner,
       carrying all of that empty space with it: the drawing was pushed across
       by the width of a margin nobody can see, and shrunk to make room for it.
       Measuring the left and top edges as well makes the box wrap the drawing
       and nothing else. */
    let left = Infinity;
    let top = Infinity;
    let right = 0;
    let bottom = 0;
    shapes.forEach((s) => {
      const el = nodeRefs.current[s.id];
      if (!el) return;
      left = Math.min(left, el.offsetLeft);
      top = Math.min(top, el.offsetTop);
      right = Math.max(right, el.offsetLeft + el.offsetWidth);
      bottom = Math.max(bottom, el.offsetTop + el.offsetHeight);
    });

    const room = Math.max(48, laneSpace(links) + 24);
    /* A little air on the leading side, and never a negative origin. */
    const ox = Number.isFinite(left) ? Math.max(0, left - EDGE_PAD) : 0;
    const oy = Number.isFinite(top) ? Math.max(0, top - EDGE_PAD) : 0;
    setOrigin((cur) => (cur.x === ox && cur.y === oy ? cur : { x: ox, y: oy }));

    const w = right ? right + room - ox : 0;
    const h = bottom ? bottom + room - oy : 0;
    setSize((cur) => (cur.w === w && cur.h === h ? cur : { w, h }));

    /* How much of the drawing's own width the box can show. This only ever
       shrinks: a chart narrower than the card is left at its own size rather
       than being blown up into something coarse. */
    const avail = box.clientWidth - 2;
    const nextFit = w && avail > 0 ? Math.min(1, avail / w) : 1;
    setFit((cur) => (Math.abs(nextFit - cur) < 0.005 ? cur : nextFit));
    /* A reader who has not zoomed gets the chart fitted, however the box
       changes size under them. One who has is left where they put it. */
    if (!touched.current) {
      setScale((cur) => (Math.abs(nextFit - cur) < 0.005 ? cur : nextFit));
    }

    /* The arrows are still built in the drawing's own coordinates — the stage
       is shifted as one piece, so nothing here has to know about it. */
    setPaths(linkPaths({
      nodes: nodeRefs.current,
      links,
      ids: shapes.map((s) => s.id),
      width: Math.max(w + ox, stage.clientWidth),
      height: Math.max(h + oy, stage.clientHeight),
    }));
  }, [links, shapes]);

  useLayoutEffect(measure, [measure, size.w, size.h]);

  /* ---- why the arrows used to be missing ----

     The paths are built by measuring the rendered boxes, so a measurement
     taken before the browser has laid them out produces nothing to draw. That
     is exactly what happens on the frame this view first mounts — coming back
     from Save, or opening the editor's preview — and there was nothing to make
     it look again: `measure` only re-ran when the measured size changed, and a
     size of zero never changes to a size of zero.

     Two things fix it. The refs are dropped whenever the chart itself changes,
     so nothing is measured against boxes belonging to the chart before it; and
     the measurement is taken again after the browser has painted, and once
     more after the web font has settled, because a label in the fallback face
     is a different width from the same label in the real one. */
  const chartKey = `${shapes.map((s) => s.id).join(',')}|${links.length}`;

  useLayoutEffect(() => {
    nodeRefs.current = {};
  }, [chartKey]);

  useEffect(() => {
    const frame = requestAnimationFrame(measure);
    const settle = setTimeout(measure, 120);
    let cancelled = false;
    if (typeof document !== 'undefined' && document.fonts?.ready) {
      document.fonts.ready.then(() => { if (!cancelled) measure(); }).catch(() => {});
    }
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      clearTimeout(settle);
    };
  }, [chartKey, measure]);

  /* The box narrows when the column does — and on a phone it narrows a lot —
     so both the arrows and the fit have to be worked out again. */
  useEffect(() => {
    const el = canvasRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure]);

  /**
   * Go to `next`, keeping whatever sits under `anchor` under it afterwards.
   *
   * The anchor is in box coordinates — the centre of the viewport for the
   * buttons, the midpoint of two fingers for a pinch. Work out which point of
   * the drawing is there now, then say where the box will have to be scrolled
   * for that same point to still be there at the new size.
   */
  const zoomAbout = useCallback((next, anchor) => {
    const box = canvasRef.current;
    const to = clamp(next, MIN_SCALE, MAX_SCALE);
    touched.current = true;

    if (!box) { setScale(to); return; }

    const from = scaleRef.current;
    const ax = anchor?.x ?? box.clientWidth / 2;
    const ay = anchor?.y ?? box.clientHeight / 2;

    /* Where the drawing sits inside the scrolling area. It is not always at
       the origin: while the drawing is smaller than the box it is centred by
       its auto margins, and those margins vanish the moment a zoom makes it
       bigger. Reading the offset rather than assuming zero is what stops the
       chart jumping sideways on the press that first makes it scrollable. */
    const inset = scaleBoxRef.current?.offsetLeft || 0;
    const insetY = scaleBoxRef.current?.offsetTop || 0;

    pendingScroll.current = {
      // The point of the drawing currently under the anchor…
      px: (box.scrollLeft + ax - inset) / from,
      py: (box.scrollTop + ay - insetY) / from,
      ax,
      ay,
      to,
    };
    setScale(to);
  }, []);

  useLayoutEffect(() => {
    const box = canvasRef.current;
    const want = pendingScroll.current;
    if (!box || !want) return;
    pendingScroll.current = null;

    // …put back under it, against the offset the new size actually has.
    const inset = scaleBoxRef.current?.offsetLeft || 0;
    const insetY = scaleBoxRef.current?.offsetTop || 0;

    /* Clamped by the browser to what there is to scroll, which is what should
       happen: zoomed out far enough there is nothing left to hold in place. */
    box.scrollLeft = Math.max(0, inset + want.px * want.to - want.ax);
    box.scrollTop = Math.max(0, insetY + want.py * want.to - want.ay);
  }, [scale]);

  /* ---------- pinch, the way a picture is zoomed on a phone ----------
     Two fingers on the drawing scale it. Registered by hand rather than
     through React so it can be passive:false — the browser would otherwise
     take the gesture as a scroll of the page underneath. */
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return undefined;

    let start = 0;      // finger distance when the pinch began
    let base = 1;       // the scale it began from

    const gap = (t) => Math.hypot(
      t[0].clientX - t[1].clientX,
      t[0].clientY - t[1].clientY,
    );

    /* Halfway between the fingers, in the box's own coordinates — the place
       the reader is pointing at, and so the place to hold still. */
    const midpoint = (t) => {
      const r = el.getBoundingClientRect();
      return {
        x: (t[0].clientX + t[1].clientX) / 2 - r.left,
        y: (t[0].clientY + t[1].clientY) / 2 - r.top,
      };
    };

    const onStart = (e) => {
      if (e.touches.length !== 2) return;
      start = gap(e.touches);
      base = scaleRef.current;
    };

    const onMove = (e) => {
      if (e.touches.length !== 2 || !start) return;
      e.preventDefault();
      zoomAbout((base * gap(e.touches)) / start, midpoint(e.touches));
    };

    const onEnd = (e) => { if (e.touches.length < 2) start = 0; };

    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd);
    el.addEventListener('touchcancel', onEnd);
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
    };
  }, [zoomAbout]);

  if (!shapes.length) return <p className="fcv-empty">No flowchart was drawn.</p>;

  /* Tall enough for the whole drawing before it has been measured, so the box
     does not jump on first paint. */
  /* Only for the frame before the first measurement — the drawing's own height
     rather than its distance from the canvas's top, so the box does not open
     tall and then snap shorter. */
  const topY = Math.min(...shapes.map((sh) => sh.y || 0));
  const fallbackH = Math.max(
    ...shapes.map((sh) => (sh.y || 0) - topY + 90), 200,
  ) + laneSpace(links);

  const drawnW = size.w || 0;
  const drawnH = size.h || fallbackH;

  /* Double-tap or double-click: the whole chart ↔ its true size, the one
     gesture people already expect from a picture. */
  const toggle = () => zoomAbout(scale > fit * 1.01 ? fit : Math.max(1, fit));

  const zoomBy = (dir) => zoomAbout(stepScale(scale, dir, MIN_SCALE, MAX_SCALE));

  /* The viewport is the room the *fitted* chart needs, not the room the zoomed
     one needs. Sizing it to the zoom made the page jump a screenful every time
     somebody pressed +; this way the chart pans inside a box that stays put. */
  const viewH = plain
    ? Math.round(drawnH * fit) + 2
    : clamp(Math.round(drawnH * fit) + 2, VIEW_MIN_H, VIEW_MAX_H);
  const shown = plain ? fit : scale;

  /* `+` and `-` while the chart has focus, and `0` back to fitting — the
     shortcuts every other zoom on a computer uses. */
  const onKeyDown = (e) => {
    if (e.key === '+' || e.key === '=') { e.preventDefault(); zoomBy(1); }
    else if (e.key === '-' || e.key === '_') { e.preventDefault(); zoomBy(-1); }
    else if (e.key === '0') { e.preventDefault(); touched.current = false; zoomAbout(fit); }
  };

  return (
    <div className="fcv-wrap">
      <div
        className={`fcv${plain ? ' plain' : ''}`}
        ref={canvasRef}
        onDoubleClick={plain ? undefined : toggle}
        onKeyDown={plain ? undefined : onKeyDown}
        tabIndex={plain ? undefined : 0}
        role="img"
        aria-label={`Flowchart, ${shapes.length} step${shapes.length === 1 ? '' : 's'}`}
        style={{ height: viewH }}
      >
        {/* Two boxes, and they do different jobs. The outer one takes up the
            room the scaled drawing actually occupies, so the card scrolls by
            the right amount once someone zooms past its edges; the inner one
            is the drawing at its true size, scaled by a transform — which is
            what leaves the measurements the arrows are built from alone. */}
        <div
          ref={scaleBoxRef}
          className="fcv-scale"
          style={drawnW ? { width: Math.round(drawnW * shown), height: Math.round(drawnH * shown) } : undefined}
        >
          <div
            className="fcv-stage"
            ref={stageRef}
            style={{
              width: size.w || undefined,
              height: size.h || undefined,
              minWidth: size.w || undefined,
              minHeight: size.h || undefined,
              /* Scaled, then slid so the drawing's own corner lands on the
                 card's corner. The translate is written after the scale so it
                 is measured in the drawing's units, which is what leaves every
                 shape and arrow exactly where it was drawn relative to the
                 others — the whole picture moves, never a part of it. */
              transform: `scale(${shown}) translate(${-origin.x}px, ${-origin.y}px)`,
            }}
          >
            <svg className="fcv-links" aria-hidden="true">
              <defs>
                <marker
                  id="fcvArrow" viewBox="0 0 10 10" refX="9" refY="5"
                  markerWidth="7" markerHeight="7" orient="auto-start-reverse"
                >
                  <path d="M0 0 10 5 0 10z" fill="#94a3b8" />
                </marker>
                <marker
                  id="fcvArrowBack" viewBox="0 0 10 10" refX="9" refY="5"
                  markerWidth="7" markerHeight="7" orient="auto-start-reverse"
                >
                  <path d="M0 0 10 5 0 10z" fill="#c98a17" />
                </marker>
              </defs>
              {paths.map((p) => (
                <path
                  key={p.key}
                  className={`fcv-link${p.back ? ' back' : ''}`}
                  d={p.d}
                  fill="none"
                  stroke={p.back ? '#c98a17' : '#94a3b8'}
                  strokeWidth="2"
                  markerEnd={p.back ? 'url(#fcvArrowBack)' : 'url(#fcvArrow)'}
                />
              ))}
            </svg>

            {shapes.map((shape) => (
              <div
                key={shape.id}
                ref={(el) => { if (el) nodeRefs.current[shape.id] = el; }}
                className={`fcv-node ${shape.type || 'process'}`}
                style={{ left: shape.x || 0, top: shape.y || 0 }}
              >
                <span>{shape.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Always here. Hiding it whenever a chart happened to fit meant the
          small, dense charts — the ones worth enlarging — offered nothing. */}
      {!plain && (
      <ZoomControl
        scale={scale}
        min={MIN_SCALE}
        max={MAX_SCALE}
        onZoom={zoomBy}
        onReset={() => { touched.current = false; zoomAbout(fit); }}
        resetLabel="Fit"
        atRest={Math.abs(scale - fit) < 0.005}
        label="flowchart"
      />
      )}
    </div>
  );
}
