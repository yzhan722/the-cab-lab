// Axis-aligned lounge footprints from floor clicks. Geometry still comes from
// generateLoungeGeometry; this only turns a polyline + section depth into
// world rects and the params/pose inputs the generator already understands.
const round1 = (v) => Math.round(v * 10) / 10;

export const LOUNGE_MIN_RUN = 400;
export const LOUNGE_MIN_DEPTH = 200;

export function pointsNeeded(style) {
  if (style === "L_SHAPE") return 3;
  if (style === "U_SHAPE") return 4;
  if (style === "PARALLEL") return 3;
  return 2;
}

export function styleLabel(style) {
  if (style === "L_SHAPE") return "L";
  if (style === "U_SHAPE") return "U";
  if (style === "PARALLEL") return "Parallel";
  return "I";
}

/** Snap `to` onto the axis through `from` (the longer screen delta). */
export function axisLock(from, to) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dx) >= Math.abs(dy)) return { x: round1(to.x), y: from.y, z: from.z || 0 };
  return { x: from.x, y: round1(to.y), z: from.z || 0 };
}

/** Next point after a committed run: only the perpendicular axis may change. */
export function perpLock(corner, prev, to) {
  const alongX = Math.abs(prev.x - corner.x) >= Math.abs(prev.y - corner.y);
  if (alongX) return { x: corner.x, y: round1(to.y), z: corner.z || 0 };
  return { x: round1(to.x), y: corner.y, z: corner.z || 0 };
}

function runLen(a, b) {
  return round1(Math.abs(b.x - a.x) + Math.abs(b.y - a.y));
}

function alongX(a, b) {
  return Math.abs(b.x - a.x) >= Math.abs(b.y - a.y);
}

/** Unit left-normal of axis-aligned AB (90° CCW). */
function leftN(a, b) {
  const dx = Math.sign(round1(b.x - a.x));
  const dy = Math.sign(round1(b.y - a.y));
  return { x: -dy, y: dx };
}

function isCcw(a, b, c) {
  return (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x) >= 0;
}

function flip(n) {
  return { x: -n.x, y: -n.y };
}

function toward(n, ccw) {
  return ccw ? n : flip(n);
}

/** Rectangle covering AB (the back edge) extruded `depth` along unit `n`. */
function runRect(a, b, n, depth) {
  const x0 = Math.min(a.x, b.x) + Math.min(0, n.x * depth);
  const y0 = Math.min(a.y, b.y) + Math.min(0, n.y * depth);
  const W = Math.abs(b.x - a.x) + Math.abs(n.x) * depth;
  const D = Math.abs(b.y - a.y) + Math.abs(n.y) * depth;
  return { x0: round1(x0), y0: round1(y0), W: round1(W), D: round1(D) };
}

function aabbOf(rects) {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const r of rects) {
    x0 = Math.min(x0, r.x0);
    y0 = Math.min(y0, r.y0);
    x1 = Math.max(x1, r.x0 + r.W);
    y1 = Math.max(y1, r.y0 + r.D);
  }
  return { x0, y0, W: round1(x1 - x0), D: round1(y1 - y0) };
}

function doorFromN(n) {
  if (n.x) return { axis: "x", dir: n.x };
  return { axis: "y", dir: n.y };
}

function towardCenter(a, b, center) {
  const left = leftN(a, b);
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const dot = left.x * (center.x - mid.x) + left.y * (center.y - mid.y);
  return dot >= 0 ? left : flip(left);
}

function lPositionFromTurn(a, b, c) {
  // After rotating so AB is +X, a +Y second run is a left turn → L on the left of travel
  // which is the start of AB if we travel +X... Fusion RIGHT = L block at max local X.
  const ccw = isCcw(a, b, c);
  const along = alongX(a, b);
  if (along) {
    const plus = b.x >= a.x;
    if (plus) return ccw ? "LEFT" : "RIGHT";
    return ccw ? "RIGHT" : "LEFT";
  }
  const plus = b.y >= a.y;
  if (plus) return ccw ? "LEFT" : "RIGHT";
  return ccw ? "RIGHT" : "LEFT";
}

/**
 * Build world rects + generator params from committed `points` plus optional `hover`.
 * `center` is the space centre (depth grows toward it on the first I run).
 */
export function loungeDraft(style, points, hover, depth, center) {
  const d = Math.max(LOUNGE_MIN_DEPTH, depth);
  const pts = hover ? [...points, hover] : points.slice();
  const need = pointsNeeded(style);
  const empty = { ok: false, rects: [], aabb: null, door: null, params: null, tip: "", ready: false };

  if (style === "I_SHAPE") {
    if (pts.length < 2) return { ...empty, tip: "Click the other end of the run (along a wall)" };
    const a = pts[0];
    const b = pts[1];
    const len = runLen(a, b);
    const n = towardCenter(a, b, center);
    const rect = runRect(a, b, n, d);
    const aabb = aabbOf([rect]);
    const ready = points.length >= 2 && len >= LOUNGE_MIN_RUN;
    return {
      ok: len >= LOUNGE_MIN_RUN,
      ready,
      rects: [rect],
      aabb,
      door: doorFromN(n),
      params: { style: "I_SHAPE", mainWidth: len, mainDepth: d, height: null },
      tip: `I · ${Math.round(len)} mm run · ${Math.round(d)} mm deep`,
    };
  }

  if (style === "L_SHAPE") {
    if (pts.length < 2) return { ...empty, tip: "Click the corner of the L" };
    if (pts.length < 3) return { ...empty, rects: [], tip: "Click the end of the return run (90°)" };
    const [a, b, c] = pts;
    const l1 = runLen(a, b);
    const l2 = runLen(b, c);
    const ccw = isCcw(a, b, c);
    const n1 = toward(leftN(a, b), ccw);
    const n2 = toward(leftN(b, c), ccw);
    const rects = [runRect(a, b, n1, d), runRect(b, c, n2, d)];
    const aabb = aabbOf(rects);
    const pos = lPositionFromTurn(a, b, c);
    const ready = points.length >= 3 && l1 >= LOUNGE_MIN_RUN && l2 >= LOUNGE_MIN_RUN;
    return {
      ok: l1 >= LOUNGE_MIN_RUN && l2 >= LOUNGE_MIN_RUN,
      ready,
      rects,
      aabb,
      door: doorFromN(n1),
      params: {
        style: "L_SHAPE",
        mainWidth: l1,
        mainDepth: d,
        lWidth: d,
        lDepth: l2,
        lPosition: pos,
        height: null,
      },
      tip: `L · ${Math.round(l1)} + ${Math.round(l2)} mm · ${pos === "LEFT" ? "left" : "right"} return`,
    };
  }

  if (style === "U_SHAPE") {
    if (pts.length < 2) return { ...empty, tip: "Click the first corner of the U" };
    if (pts.length < 3) return { ...empty, tip: "Click the second corner (same turn as the first)" };
    if (pts.length < 4) return { ...empty, tip: "Click the end of the third run" };
    const [a, b, c, e] = pts;
    const ccw = isCcw(a, b, c);
    const segs = [[a, b], [b, c], [c, e]];
    const rects = segs.map(([p, q]) => runRect(p, q, toward(leftN(p, q), ccw), d));
    const aabb = aabbOf(rects);
    const lens = segs.map(([p, q]) => runLen(p, q));
    const ready = points.length >= 4 && lens.every((n) => n >= LOUNGE_MIN_RUN) && aabb.W >= 2 * d + LOUNGE_MIN_RUN;
    return {
      ok: ready || (lens.every((n) => n >= LOUNGE_MIN_RUN) && aabb.W >= 2 * d + LOUNGE_MIN_RUN),
      ready,
      rects,
      aabb,
      // Mouth faces the inward normal of the back (middle) run, not the first arm.
      door: doorFromN(toward(leftN(b, c), ccw)),
      params: {
        style: "U_SHAPE",
        totalWidth: aabb.W,
        depth: aabb.D,
        mainDepth: d,
        mainWidth: aabb.W,
        height: null,
      },
      tip: `U · ${lens.map((n) => Math.round(n)).join(" + ")} mm`,
    };
  }

  // PARALLEL: A–B first run, C sets the opposite run (perp distance).
  if (pts.length < 2) return { ...empty, tip: "Click the other end of the first lounge" };
  const a = pts[0];
  const b = pts[1];
  const len = runLen(a, b);
  if (pts.length < 3) return { ...empty, tip: "Click the opposite lounge (parallel)" };
  const c = pts[2];
  const n = leftN(a, b);
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  let dist = (c.x - mid.x) * n.x + (c.y - mid.y) * n.y;
  const minGap = 2 * d + 100;
  if (Math.abs(dist) < minGap) dist = Math.sign(dist || 1) * minGap;
  const n1 = dist >= 0 ? n : flip(n);
  const n2 = flip(n1);
  const a2 = { x: a.x + n.x * dist, y: a.y + n.y * dist, z: a.z || 0 };
  const b2 = { x: b.x + n.x * dist, y: b.y + n.y * dist, z: b.z || 0 };
  const rects = [runRect(a, b, n1, d), runRect(a2, b2, n2, d)];
  const aabb = aabbOf(rects);
  const along = alongX(a, b);
  // Fusion parallel faces across local X; sitting length is `depth`.
  const params = along
    ? { style: "PARALLEL", totalWidth: aabb.D, singleLoungeWidth: d, depth: len, height: null, rotHint: 90 }
    : { style: "PARALLEL", totalWidth: aabb.W, singleLoungeWidth: d, depth: len, height: null, rotHint: 0 };
  const ready = points.length >= 3 && len >= LOUNGE_MIN_RUN;
  return {
    ok: len >= LOUNGE_MIN_RUN,
    ready,
    rects,
    aabb,
    door: doorFromN(n1),
    params,
    tip: `Parallel · ${Math.round(len)} mm · gap ${Math.round(Math.abs(dist) - 2 * d)} mm`,
  };
}

export function nextHover(style, points, cursor) {
  if (!points.length) return { ...cursor, z: 0 };
  if (points.length === 1) return axisLock(points[0], cursor);
  if (style === "PARALLEL" && points.length === 2) {
    const a = points[0];
    const b = points[1];
    const n = leftN(a, b);
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const dist = (cursor.x - mid.x) * n.x + (cursor.y - mid.y) * n.y;
    return { x: round1(mid.x + n.x * dist), y: round1(mid.y + n.y * dist), z: 0 };
  }
  return perpLock(points[points.length - 1], points[points.length - 2], cursor);
}
