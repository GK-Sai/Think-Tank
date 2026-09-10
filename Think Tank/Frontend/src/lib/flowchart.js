/**
 * Where a flowchart's arrows go.
 *
 * Both the editor and the read-only view draw the same arrows, so the geometry
 * lives here once. Positions are measured from the rendered boxes rather than
 * the stored coordinates, because a box is only as wide as its label.
 *
 * Two kinds of arrow:
 *
 *  - a plain arrow runs straight from one shape to the next, clipped to the
 *    two box edges;
 *  - a return arrow (`back: true`) goes from a shape back to an earlier one —
 *    End straight back to Start — and is routed around the outside of the
 *    chart. Drawn straight it would cut through every step in between, which
 *    is exactly the stepping back through the boxes that made a loop-back
 *    unreadable. It takes whichever way round is clear: a lane underneath the
 *    boxes when the two shapes sit side by side, or a channel down the right
 *    of the chart when they are stacked one above the other.
 */

const LANE_GAP = 26;     // the first return lane sits this far under the boxes
const LANE_STEP = 16;    // each further return arrow runs outside the last
const SIDE_GAP = 26;     // how far the side channel clears the widest box
const CORNER = 12;       // corner radius on a routed arrow
const PAD = 6;           // how close a routed arrow may pass a box

/** Vertical room a chart needs under its boxes for its return arrows. */
export function laneSpace(links = []) {
  const backs = links.filter((l) => l && l.back).length;
  if (!backs) return 0;
  return LANE_GAP + (backs - 1) * LANE_STEP + 16;
}

const dist = (p, q) => Math.hypot(q.x - p.x, q.y - p.y) || 0;

const along = (from, to, d) => {
  const len = dist(from, to);
  if (!len) return { ...from };
  return { x: from.x + ((to.x - from.x) / len) * d, y: from.y + ((to.y - from.y) / len) * d };
};

/** A polyline with rounded corners, as an SVG path. */
function roundedPath(pts, r = CORNER) {
  if (pts.length < 2) return '';
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length - 1; i += 1) {
    const p = pts[i];
    const rr = Math.min(r, dist(pts[i - 1], p) / 2, dist(p, pts[i + 1]) / 2);
    const a = along(p, pts[i - 1], rr);
    const b = along(p, pts[i + 1], rr);
    d += ` L ${a.x} ${a.y} Q ${p.x} ${p.y} ${b.x} ${b.y}`;
  }
  const last = pts[pts.length - 1];
  return `${d} L ${last.x} ${last.y}`;
}

/** Straight, centre to centre, clipped to both box edges. */
function straightPath(a, b) {
  const x1 = a.offsetLeft + a.offsetWidth / 2;
  const y1 = a.offsetTop + a.offsetHeight / 2;
  const x2 = b.offsetLeft + b.offsetWidth / 2;
  const y2 = b.offsetTop + b.offsetHeight / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  if (!dx && !dy) return null;

  /* Without this the line hides under the shapes whenever they sit close
     together, and the arrowhead ends up inside the target. */
  const edgeT = (el, pad) => {
    const hw = el.offsetWidth / 2 + pad;
    const hh = el.offsetHeight / 2 + pad;
    const tx = dx ? hw / Math.abs(dx) : Infinity;
    const ty = dy ? hh / Math.abs(dy) : Infinity;
    return Math.min(tx, ty);
  };
  const ta = Math.min(edgeT(a, 2), 0.49);
  const tb = Math.min(edgeT(b, 6), 0.49);

  return `M ${x1 + dx * ta} ${y1 + dy * ta} L ${x2 - dx * tb} ${y2 - dy * tb}`;
}

const boxOf = (el) => ({
  el,
  left: el.offsetLeft,
  top: el.offsetTop,
  right: el.offsetLeft + el.offsetWidth,
  bottom: el.offsetTop + el.offsetHeight,
});

/** Does this straight run of the arrow miss every box that is not an end of it? */
function clear(boxes, skip, p, q) {
  const x = Math.min(p.x, q.x) - PAD;
  const X = Math.max(p.x, q.x) + PAD;
  const y = Math.min(p.y, q.y) - PAD;
  const Y = Math.max(p.y, q.y) + PAD;
  return !boxes.some((b) => (
    !skip.includes(b.el) && b.left < X && b.right > x && b.top < Y && b.bottom > y
  ));
}

const allClear = (boxes, skip, pts) => pts.every((p, i) => (
  i === 0 || clear(boxes, skip, pts[i - 1], p)
));

/**
 * Build one SVG path per link.
 *
 * `nodes` maps a shape id to its rendered element, `ids` lists the shapes on
 * the canvas now (so a deleted one cannot drag a lane out of place), and
 * `width` / `height` are the canvas size, which the routed arrows are kept
 * inside.
 */
export function linkPaths({ nodes, links = [], ids = [], width = 0, height = 0 }) {
  const boxes = ids.map((id) => nodes[id]).filter(Boolean).map(boxOf);
  const floor = boxes.reduce((m, b) => Math.max(m, b.bottom), 0);
  const edge = boxes.reduce((m, b) => Math.max(m, b.right), 0);

  const out = [];
  let lanes = 0;
  let channels = 0;

  links.forEach((l, index) => {
    const a = nodes[l.from];
    const b = nodes[l.to];
    if (!a || !b) return;
    const key = `${l.from}-${l.to}-${index}`;

    if (!l.back) {
      const d = straightPath(a, b);
      if (d) out.push({ key, index, back: false, d });
      return;
    }

    const skip = [a, b];
    const ax = a.offsetLeft + a.offsetWidth / 2;
    const bx = b.offsetLeft + b.offsetWidth / 2;

    /* Under the boxes: down out of one, along a clear lane, up into the other.
       This is the shape a loop-back has when the steps run left to right. */
    let lane = floor + LANE_GAP + lanes * LANE_STEP;
    if (height) lane = Math.min(lane, height - 10);
    const underneath = [
      { x: ax, y: a.offsetTop + a.offsetHeight + 2 },
      { x: ax, y: lane },
      { x: bx, y: lane },
      { x: bx, y: b.offsetTop + b.offsetHeight + 6 },
    ];

    if (Math.abs(bx - ax) >= 24 && allClear(boxes, skip, underneath)) {
      lanes += 1;
      out.push({ key, index, back: true, d: roundedPath(underneath) });
      return;
    }

    /* Otherwise the steps are stacked, and going up the middle would run
       straight back through them: out to the right of everything, up the
       side, and in at the earlier shape's edge. */
    let channel = edge + SIDE_GAP + channels * LANE_STEP;
    if (width) channel = Math.min(channel, width - 10);
    channels += 1;
    out.push({
      key,
      index,
      back: true,
      d: roundedPath([
        { x: a.offsetLeft + a.offsetWidth + 2, y: a.offsetTop + a.offsetHeight / 2 },
        { x: channel, y: a.offsetTop + a.offsetHeight / 2 },
        { x: channel, y: b.offsetTop + b.offsetHeight / 2 },
        { x: b.offsetLeft + b.offsetWidth + 6, y: b.offsetTop + b.offsetHeight / 2 },
      ]),
    });
  });

  return out;
}
