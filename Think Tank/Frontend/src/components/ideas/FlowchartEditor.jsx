import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import ZoomControl, { stepScale } from './ZoomControl';
import { linkPaths, laneSpace } from '../../lib/flowchart';

/* Never so small that a shape cannot be tapped, never so large that a drag
   loses the drawing off the edge. */
const MIN_SCALE = 0.4;
const MAX_SCALE = 3;

/**
 * Drag-and-drop flowchart canvas.
 *
 * Positions live in React state, but dragging writes straight to the DOM node's
 * style during the gesture and only commits to state on pointerup — otherwise
 * every pointermove would re-render the whole canvas.
 *
 * The drawing sits on a **stage** inside the canvas, and the stage grows to fit
 * whatever has been drawn on it. A chart drawn in the full-page editor is wider
 * than the Edit dialog, and a fixed canvas simply cut the far shapes off: they
 * could not be seen, moved or connected, and a return arrow routed round the
 * outside disappeared over the edge. The canvas scrolls instead, so every
 * member opening Edit gets the whole chart.
 *
 * Arrows have their own two buttons:
 *
 *  - **Arrow** joins one shape to the next, the way a flow reads forward.
 *  - **Return arrow** joins a shape back to an earlier one — End straight back
 *    to Start — and is drawn round the outside rather than back through every
 *    step in between.
 *
 * Clicking an arrow removes it, so a wrong connection no longer means clearing
 * the whole drawing.
 */
export default function FlowchartEditor({ value, onChange }) {
  const { shapes, links } = value;
  const canvasRef = useRef(null);
  const stageRef = useRef(null);
  const nodeRefs = useRef({});
  const seq = useRef(0);
  // True for the length of a drag gesture.
  const dragging = useRef(false);
  // True once a shape has been moved by hand; the canvas stops re-fitting itself.
  const arranged = useRef(false);

  // null · 'arrow' · 'return'
  const [mode, setMode] = useState(null);
  const [pendingFrom, setPendingFrom] = useState(null);
  const [editingId, setEditingId] = useState(null);
  // What the label said before this rename, so Escape can put it back.
  const labelBefore = useRef('');
  const [paths, setPaths] = useState([]);
  const [size, setSize] = useState({ w: 0, h: 0 });

  /* `fit` puts the whole drawing inside the canvas — a chart made on a desktop
     is wider than a phone, and editing what you cannot see is not editing.
     `scale` is what is on screen: one number, so the buttons and the limits
     cannot disagree the way a separate fit and zoom used to. */
  const [fit, setFit] = useState(1);
  const [scale, setScale] = useState(1);
  const scaleRef = useRef(1);
  scaleRef.current = scale;

  /* Until the drawer touches the zoom the canvas keeps itself fitted; after
     that it stays where they put it, however the dialog resizes. */
  const touched = useRef(false);
  const pendingScroll = useRef(null);
  const scaleBoxRef = useRef(null);

  /**
   * Zoom to `next`, keeping what is under `anchor` under it afterwards — the
   * centre of the canvas unless something says otherwise. Anchoring matters
   * more here than in the read-only view: zooming in to place a shape and
   * having the shape walk off the corner is how a drag lands in the wrong
   * place.
   */
  const zoomAbout = useCallback((next, anchor) => {
    const box = canvasRef.current;
    const to = Math.min(MAX_SCALE, Math.max(MIN_SCALE, next));
    touched.current = true;

    if (!box) { setScale(to); return; }

    const from = scaleRef.current;
    const ax = anchor?.x ?? box.clientWidth / 2;
    const ay = anchor?.y ?? box.clientHeight / 2;

    /* Where the drawing sits inside the scrolling area — centred by its auto
       margins while it is smaller than the canvas, flush once it is bigger.
       Reading it rather than assuming zero is what keeps the drawing still on
       the press that first makes the canvas scrollable. */
    const inset = scaleBoxRef.current?.offsetLeft || 0;
    const insetY = scaleBoxRef.current?.offsetTop || 0;

    pendingScroll.current = {
      px: (box.scrollLeft + ax - inset) / from,
      py: (box.scrollTop + ay - insetY) / from,
      ax,
      ay,
      to,
    };
    setScale(to);
  }, []);

  const zoomBy = (dir) => zoomAbout(stepScale(scaleRef.current, dir, MIN_SCALE, MAX_SCALE));

  // Scrolling has to wait for the new size to paint, or there is nothing yet
  // to scroll to.
  useLayoutEffect(() => {
    const box = canvasRef.current;
    const want = pendingScroll.current;
    if (!box || !want) return;
    pendingScroll.current = null;
    const inset = scaleBoxRef.current?.offsetLeft || 0;
    const insetY = scaleBoxRef.current?.offsetTop || 0;
    box.scrollLeft = Math.max(0, inset + want.px * want.to - want.ax);
    box.scrollTop = Math.max(0, insetY + want.py * want.to - want.ay);
  }, [scale]);

  /* ---------- the stage is measured from the rendered nodes ---------- */
  const measure = useCallback(() => {
    const stage = stageRef.current;
    const box = canvasRef.current;
    if (!stage) return;

    let right = 0;
    let bottom = 0;
    shapes.forEach((s) => {
      const el = nodeRefs.current[s.id];
      if (!el) return;
      right = Math.max(right, el.offsetLeft + el.offsetWidth);
      bottom = Math.max(bottom, el.offsetTop + el.offsetHeight);
    });

    /* Room past the last shape for the lanes the return arrows travel along,
       and a margin so nothing sits flush against the edge. */
    const room = Math.max(48, laneSpace(links) + 24);
    const drawnW = right ? right + room : 0;
    const drawnH = bottom ? bottom + room : 0;

    const availW = Math.max(0, (box?.clientWidth || 0) - 2);
    const availH = Math.max(0, (box?.clientHeight || 0) - 2);

    /* Only ever shrinks. A drawing that already fits is left at its own size
       rather than being blown up. */
    const nextFit = drawnW && availW > 0 ? Math.min(1, availW / drawnW) : 1;
    setFit((cur) => (Math.abs(nextFit - cur) < 0.005 ? cur : nextFit));

    /* The fit is applied while the chart is being read, not while it is being
       arranged. Re-fitting on every change of size is what shrank a shape as
       it was dragged towards the right-hand edge: the drawing grew, the fit
       tightened to keep it in view, and the shape got smaller under the
       pointer holding it. Once someone has moved a shape the zoom is theirs —
       the Fit button gives it back. */
    if (!touched.current && !arranged.current && !dragging.current) {
      setScale((cur) => (Math.abs(nextFit - cur) < 0.005 ? cur : nextFit));
    }

    /* The stage covers the whole canvas at the very least, whatever has been
       drawn on it so far.
       Two things came of a stage that was only as big as its drawing. It was
       narrower than the canvas, so its auto margins centred it — and then
       every resize re-centred it, sliding the whole drawing sideways as a
       shape was dragged. And the drawing's own origin, which is as far up and
       left as a shape is allowed to go, sat in the middle of the canvas
       instead of at its top-left corner: shapes stopped dead in mid-air with
       the whole corner of the grid still empty in front of them. */
    const k = scaleRef.current || 1;
    const w = Math.max(drawnW, availW / k);
    const h = Math.max(drawnH, availH / k);
    setSize((cur) => (
      Math.abs(cur.w - w) < 0.5 && Math.abs(cur.h - h) < 0.5 ? cur : { w, h }
    ));

    setPaths(linkPaths({
      nodes: nodeRefs.current,
      links,
      ids: shapes.map((s) => s.id),
      width: Math.max(w, stage.clientWidth),
      height: Math.max(h, stage.clientHeight),
    }));
  }, [links, shapes]);

  // Re-measuring after the stage resizes settles in one pass: the guard above
  // returns the same object when nothing moved, so this cannot loop.
  useLayoutEffect(measure, [measure, size.w, size.h]);

  useEffect(() => {
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [measure]);

  /* The dialog this sits in is not the page: it narrows on its own, and the
     drawing has to be re-fitted when it does. */
  useEffect(() => {
    const el = canvasRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure]);

  /* The label is read-only until this render, so putting the cursor in it has
     to wait until after the DOM has caught up — which is exactly what a layout
     effect is for. Selecting the whole word means the usual thing happens when
     somebody starts typing: it is replaced. */
  useLayoutEffect(() => {
    if (!editingId) return;
    const input = nodeRefs.current[editingId]?.querySelector('input');
    if (!input) return;
    input.focus();
    input.select();
  }, [editingId]);

  /* ---------- mutations ---------- */
  /**
   * `type` is what the shape is; `label` is what it says.
   *
   * Start and End are the same terminator shape, so they used to share one
   * button and both came out saying "Start" — every End had to be renamed by
   * hand. They get a button each now, and the caller passes the wording.
   */
  const addShape = (type, label) => {
    const n = shapes.length;
    seq.current += 1;

    /* A step is numbered by the steps before it, not by everything on the
       canvas. Counting shapes meant a Start, a decision and an End all took a
       number with them, so the first process after them came out "Step 6" and
       Steps 2 to 5 existed nowhere — a chart that reads as though most of it
       had been deleted. Only process boxes are counted, so they run 1, 2, 3
       however many terminators and decisions sit between them. */
    const stepNo = shapes.filter((s) => (s.type || 'process') === 'process').length + 1;

    /* New shapes are laid out three to a row, and always inside the width in
       front of the person adding them — never off the edge. */
    const perRow = Math.max(1, Math.min(3, Math.floor(((canvasRef.current?.clientWidth || 600) - 30) / 190)));
    onChange({
      shapes: [
        ...shapes,
        {
          id: `n${seq.current}_${n}`,
          type,
          label: label ?? (type === 'decision' ? 'Decision?' : `Step ${stepNo}`),
          x: 30 + (n % perRow) * 190,
          y: 26 + Math.floor(n / perRow) * 110,
        },
      ],
      links,
    });
  };

  const removeShape = (id) => {
    delete nodeRefs.current[id];
    onChange({
      shapes: shapes.filter((s) => s.id !== id),
      links: links.filter((l) => l.from !== id && l.to !== id),
    });
  };

  const renameShape = (id, label) => {
    onChange({ shapes: shapes.map((s) => (s.id === id ? { ...s, label } : s)), links });
  };

  /**
   * Start renaming a shape.
   *
   * This is called from the shape's **outer box**, not from the label inside
   * it, and that is the whole bug fix. Pressing a shape captures the pointer so
   * the drag can outrun it, and a captured pointer sends its click and
   * double-click to the element holding the capture — the box. The label never
   * heard the double-click, so it never came out of read-only, and everything
   * typed afterwards went nowhere while the word sat there helpfully
   * highlighted by the browser's own text selection.
   *
   * Focus and selection wait for the effect below rather than happening here:
   * at this moment the input is still read-only, and selecting it before React
   * has unlocked it is what made the first keystroke disappear.
   */
  const beginRename = (id) => {
    labelBefore.current = shapes.find((s) => s.id === id)?.label ?? '';
    setEditingId(id);
  };

  const removeLink = (index) => {
    onChange({ shapes, links: links.filter((_, i) => i !== index) });
  };

  const clearAll = () => {
    nodeRefs.current = {};
    setMode(null);
    setPendingFrom(null);
    onChange({ shapes: [], links: [] });
  };

  const pickMode = (next) => {
    setMode((cur) => (cur === next ? null : next));
    setPendingFrom(null);
  };

  const onNodeClick = (id) => {
    if (!mode) return;
    if (!pendingFrom) { setPendingFrom(id); return; }
    if (pendingFrom !== id) {
      const back = mode === 'return';
      const dup = links.some((l) => l.from === pendingFrom && l.to === id && !!l.back === back);
      if (!dup) onChange({ shapes, links: [...links, { from: pendingFrom, to: id, back }] });
    }
    setPendingFrom(null);
  };

  /* ---------- dragging (pointer events cover mouse, pen and touch) ---------- */
  const startDrag = (e, shape) => {
    if (mode || e.button > 0) return;
    const target = e.target;
    if (!(target instanceof Element)) return;
    if (target.closest('.kill')) return;
    /* A shape is mostly its label, so a press usually lands on the input
       inside it. Bailing out on any input meant a shape could only be dragged
       by the thin border around its words. The input is off limits only while
       it is actually being renamed. */
    const onLabel = target.tagName === 'INPUT';
    if (onLabel && editingId === shape.id) return;

    const stage = stageRef.current;
    const node = nodeRefs.current[shape.id];
    if (!stage || !node) return;

    /* Not over the label: cancelling the default there would take the
       double-click that renames a shape with it. The label is unselectable and
       untouchable in CSS while it is read-only, which is what stops a drag
       from smearing a selection across it or being taken for a scroll. */
    if (!onLabel) e.preventDefault();

    /* The gesture is measured off the DOM rather than from the numbers this
     * component is holding.
     *
     * `k` is the drawing's rendered scale, read back from the stage itself: on
     * the phone the canvas sits inside panels of its own, and if anything
     * above the stage is scaled as well then the zoom state is the wrong
     * divisor — the shape then travels a fraction of the distance the finger
     * does and is left trailing behind it.
     *
     * The grab is held as a screen-pixel offset into the shape's own
     * rectangle, so the shape stays under the point that picked it up however
     * the stage is resized underneath.
     */
    const scaleNow = () => {
      const r = stage.getBoundingClientRect();
      const w = stage.offsetWidth;
      return w > 0 && r.width > 0 ? r.width / w : (scaleRef.current || 1);
    };

    const nodeRect = node.getBoundingClientRect();
    const grabX = e.clientX - nodeRect.left;
    const grabY = e.clientY - nodeRect.top;

    let last = { x: shape.x, y: shape.y };
    let frame = 0;

    dragging.current = true;
    node.classList.add('dragging');
    /* Capture keeps the moves coming when the pointer outruns the shape. It is
       not load-bearing: the listeners below sit on the window, so a browser
       that refuses the capture still finishes the drag. */
    try { node.setPointerCapture(e.pointerId); } catch { /* not captured */ }

    const move = (ev) => {
      if (ev.pointerId !== e.pointerId) return;
      /* Only the top and left edges hold a shape back, and they are the canvas
         corner now that the stage starts there. Nothing stops a shape at the
         other two: the stage is as big as what has been drawn on it, so a
         shape taken past the right or bottom edge takes the stage with it and
         the canvas scrolls to follow. */
      const rect = stage.getBoundingClientRect();
      const k = scaleNow();
      const x = Math.max(0, (ev.clientX - grabX - rect.left) / k);
      const y = Math.max(0, (ev.clientY - grabY - rect.top) / k);
      last = { x, y };
      node.style.left = `${x}px`;
      node.style.top = `${y}px`;
      /* Re-measuring is a render, and one per pointer event made a long drag
         stutter. Once a frame is enough for the arrows to keep up. */
      if (!frame) {
        frame = requestAnimationFrame(() => { frame = 0; measure(); });
      }
    };

    const end = (ev) => {
      if (ev.pointerId !== e.pointerId) return;
      if (frame) { cancelAnimationFrame(frame); frame = 0; }
      dragging.current = false;
      /* A press that moved nothing is a click, not an arrangement — the two
         presses of a double-click used to count as two drags, which committed
         the same position twice and switched the canvas's own fitting off. */
      const moved = Math.abs(last.x - shape.x) > 0.5 || Math.abs(last.y - shape.y) > 0.5;
      if (moved) arranged.current = true;
      node.classList.remove('dragging');
      /* A cancelled pointer has already had its capture taken back, and asking
         for it again throws — which used to happen before the listeners came
         off and before the move was committed, so the shape sprang back to
         where it started and the next press had two drags running at once. */
      try {
        if (node.hasPointerCapture?.(ev.pointerId)) node.releasePointerCapture(ev.pointerId);
      } catch { /* already released */ }
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
      // Commit the final position once, not on every frame — and only if the
      // shape actually went somewhere.
      if (moved) {
        onChange({ shapes: shapes.map((s) => (s.id === shape.id ? { ...s, ...last } : s)), links });
      }
    };

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
  };

  const hint = mode === 'arrow'
    ? (pendingFrom ? 'Now click the shape the arrow points to.' : 'Click the shape the arrow starts from.')
    : mode === 'return'
      ? (pendingFrom ? 'Now click the shape it returns to — Start.' : 'Click the shape the return starts from — End.')
      : 'Drag shapes to arrange · double-click to rename · click an arrow to remove it';

  /* Sized exactly once it has been measured — the "at least as big as the
     canvas" rule is for the empty canvas, and would otherwise stretch the
     drawing back out the moment someone zoomed in. */
  const stageStyle = { transform: `scale(${scale})` };
  if (size.w) {
    stageStyle.width = size.w;
    stageStyle.minWidth = size.w;
  }
  if (size.h) {
    stageStyle.height = size.h;
    stageStyle.minHeight = size.h;
  }

  const scaleBox = size.w
    ? { width: Math.round(size.w * scale), height: Math.round(size.h * scale) }
    : undefined;

  return (
    <>
      <div className="fc-toolbar">
        <button type="button" className="btn-ghost-sm" onClick={() => addShape('process')}>+ Process</button>
        <button type="button" className="btn-ghost-sm" onClick={() => addShape('decision')}>+ Decision</button>
        <button
          type="button"
          className="btn-ghost-sm"
          onClick={() => addShape('terminator', 'Start')}
          title="Add the shape the flow begins at"
        >
          + Start
        </button>
        <button
          type="button"
          className="btn-ghost-sm"
          onClick={() => addShape('terminator', 'End')}
          title="Add the shape the flow finishes at"
        >
          + End
        </button>
        <button
          type="button"
          className={`btn-ghost-sm${mode === 'arrow' ? ' active' : ''}`}
          onClick={() => pickMode('arrow')}
          title="Draw an arrow from one shape to another"
        >
          → Arrow
        </button>
        <button
          type="button"
          className={`btn-ghost-sm${mode === 'return' ? ' active' : ''}`}
          onClick={() => pickMode('return')}
          title="Draw an arrow back to an earlier shape — it goes round, not back through the steps"
        >
          ↩ Return Arrow
        </button>
        <button type="button" className="btn-ghost-sm danger" onClick={clearAll}>Clear</button>
        <span className="fc-hint">{hint}</span>
      </div>

      <div className={`fc-canvas${mode ? ' connecting' : ''}`} ref={canvasRef}>
        {/* Sits on the canvas rather than on the drawing: the drawing is only
            as big as what has been put on it, which is nothing yet. */}
        {shapes.length === 0 && (
          <div className="fc-empty">
            <strong>Flowchart Canvas</strong>
            <span>Add shapes from the toolbar above, then drag them into place.</span>
            {/* On an empty canvas this is the first shape of the chart, and a
                chart begins at Start. It used to drop a process box, so every
                new flowchart opened on a middle step with nothing before it. */}
            <button type="button" className="btn-solid sm" onClick={() => addShape('terminator', 'Start')}>Add Shape</button>
          </div>
        )}

        {/* The outer box takes up the room the scaled drawing occupies, so the
            canvas scrolls by the right amount; the inner stage is the drawing
            at the size it was laid out, shrunk by a transform. */}
        <div className="fc-scale" ref={scaleBoxRef} style={scaleBox}>
        <div className="fc-stage" ref={stageRef} style={stageStyle}>
          <svg className="fc-links" aria-hidden="true">
            <defs>
              <marker
                id="fcArrow" viewBox="0 0 10 10" refX="9" refY="5"
                markerWidth="7" markerHeight="7" orient="auto-start-reverse"
              >
                <path d="M0 0 10 5 0 10z" fill="#94a3b8" />
              </marker>
              <marker
                id="fcArrowBack" viewBox="0 0 10 10" refX="9" refY="5"
                markerWidth="7" markerHeight="7" orient="auto-start-reverse"
              >
                <path d="M0 0 10 5 0 10z" fill="#c98a17" />
              </marker>
            </defs>

            {paths.map((p) => (
              <g key={p.key}>
                {/* A wide invisible copy first, so the arrow is easy to hit — and
                    so hovering it can light up the visible one next to it. */}
                <path
                  className="fc-link-hit"
                  d={p.d}
                  fill="none"
                  stroke="transparent"
                  strokeWidth="14"
                  onClick={() => removeLink(p.index)}
                >
                  <title>Remove this arrow</title>
                </path>
                <path
                  className={`fc-link${p.back ? ' back' : ''}`}
                  d={p.d}
                  fill="none"
                  stroke={p.back ? '#c98a17' : '#94a3b8'}
                  strokeWidth="2"
                  markerEnd={p.back ? 'url(#fcArrowBack)' : 'url(#fcArrow)'}
                />
              </g>
            ))}
          </svg>

          {shapes.map((shape) => (
            <div
              key={shape.id}
              ref={(el) => { if (el) nodeRefs.current[shape.id] = el; else delete nodeRefs.current[shape.id]; }}
              className={`fc-node ${shape.type}${pendingFrom === shape.id ? ' pick' : ''}`}
              style={{ left: shape.x, top: shape.y }}
              onPointerDown={(e) => startDrag(e, shape)}
              onClick={() => onNodeClick(shape.id)}
              /* On the box, not on the label: a captured pointer delivers its
                 double-click here, which is why renaming never started. */
              onDoubleClick={() => { if (!mode) beginRename(shape.id); }}
            >
              <input
                value={shape.label}
                readOnly={editingId !== shape.id}
                aria-label={`Shape label: ${shape.label}`}
                onChange={(e) => renameShape(shape.id, e.target.value)}
                onBlur={(e) => {
                  setEditingId(null);
                  // A shape with no name at all is a box nobody can read.
                  if (!e.target.value.trim()) renameShape(shape.id, labelBefore.current || 'Step');
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); }
                  if (e.key === 'Escape') {
                    e.preventDefault();
                    /* The dialog closes on Escape as well, and it listens on
                       the document — so without this, abandoning a rename
                       threw the whole edit away with it. */
                    e.stopPropagation();
                    renameShape(shape.id, labelBefore.current);
                    setEditingId(null);
                  }
                }}
              />
              <button
                type="button"
                className="kill"
                aria-label="Delete shape"
                onClick={(e) => { e.stopPropagation(); removeShape(shape.id); }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
        </div>
      </div>

      {/* Always here. It used to appear only once a drawing had been shrunk
          to fit, so on a chart that fitted there was no way to zoom in to put
          a shape down accurately — which is the moment zoom is for. */}
      <div className="fc-zoom">
        <ZoomControl
          scale={scale}
          min={MIN_SCALE}
          max={MAX_SCALE}
          onZoom={zoomBy}
          onReset={() => { arranged.current = false; zoomAbout(fit); touched.current = false; }}
          resetLabel="Fit"
          atRest={Math.abs(scale - fit) < 0.005}
          label="canvas"
        />
      </div>
    </>
  );
}