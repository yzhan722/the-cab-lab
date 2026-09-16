/**
 * Lounge v0 generator.
 *
 * Cab Lab native: a floor polyline (the back / wall edge) offset toward the
 * room by `depth`. I = 2 points (one box), L = 3, U = 4. U is three I
 * segments, not a fourth formula. Parallel (P) is two facing I runs with
 * an aisle between them (3 clicks: first run + opposite, then seat depth).
 *
 * Coordinates: X left→right, Y front (room) side of the AABB → back, Z up.
 */

import type { Board, LoungeParams, LoungePoint, LoungeResult, LoungeSegment, LoungeStyle } from "./types.ts";

export const LOUNGE_MIN = { depth: 300, height: 300, segment: 300 };
export const LOUNGE_MIN_AISLE = 100;
export const LOUNGE_DEFAULT_HEIGHT = 420;
export const LOUNGE_DEFAULT_DEPTH = 600;
export const LOUNGE_DEFAULT_RETURN = 600;

const DEFAULT_CPT = 16;
const DEFAULT_COLOR = "White Stipple";

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function asNum(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function loungeStyleFromCount(n: number): LoungeStyle {
  if (n <= 2) return "I";
  if (n === 3) return "L";
  return "U";
}

export function normalizeLoungeStyle(value: unknown): LoungeStyle | null {
  if (value === "P" || value === "PARALLEL") return "P";
  if (value === "I" || value === "L" || value === "U") return value;
  return null;
}

export function pointsNeeded(style: LoungeStyle): number {
  if (style === "L") return 3;
  if (style === "P") return 3;
  if (style === "U") return 4;
  return 2;
}

export function styleLabel(style: LoungeStyle): string {
  if (style === "L") return "L";
  if (style === "U") return "U";
  if (style === "P") return "Parallel";
  return "I";
}

/** Which side of directed A→B contains P. +1 = left, -1 = right, 0 = on the line. */
export function sideOf(a: LoungePoint, b: LoungePoint, p: LoungePoint): number {
  const c = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
  if (Math.abs(c) < 1e-6) return 0;
  return c > 0 ? 1 : -1;
}

function mid(a: LoungePoint, b: LoungePoint): LoungePoint {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function leftNormal(a: LoungePoint, b: LoungePoint): LoungePoint | null {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < 1) return null;
  return { x: -dy / len, y: dx / len };
}

function defaultTurn(a: LoungePoint, b: LoungePoint, len: number, toward: LoungePoint | null): LoungePoint {
  const alongX = Math.abs(b.x - a.x) >= Math.abs(b.y - a.y);
  if (alongX) {
    const sy = toward ? Math.sign(toward.y - b.y) || 1 : 1;
    return { x: round1(b.x), y: round1(b.y + sy * len) };
  }
  const sx = toward ? Math.sign(toward.x - b.x) || 1 : 1;
  return { x: round1(b.x + sx * len), y: round1(b.y) };
}

export function offsetSegment(a: LoungePoint, b: LoungePoint, depth: number, sign: number): {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
} | null {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < 1) return null;
  const nx = (-dy / len) * sign;
  const ny = (dx / len) * sign;
  const q0 = { x: a.x + nx * depth, y: a.y + ny * depth };
  const q1 = { x: b.x + nx * depth, y: b.y + ny * depth };
  const xs = [a.x, b.x, q0.x, q1.x];
  const ys = [a.y, b.y, q0.y, q1.y];
  return {
    x0: round1(Math.min(...xs)),
    x1: round1(Math.max(...xs)),
    y0: round1(Math.min(...ys)),
    y1: round1(Math.max(...ys)),
  };
}

export interface LoungePair {
  a: LoungePoint;
  b: LoungePoint;
}

/** Two back-edge runs for Parallel: path of 4 points, or 3 (A–B + a point on the opposite). */
export function parallelPairs(path: LoungePoint[], depth: number): LoungePair[] {
  if (path.length >= 4) {
    return [
      { a: path[0], b: path[1] },
      { a: path[2], b: path[3] },
    ];
  }
  if (path.length < 3) return [];
  const a = path[0];
  const b = path[1];
  const c = path[2];
  const n = leftNormal(a, b);
  if (!n) return [];
  const m = mid(a, b);
  let dist = (c.x - m.x) * n.x + (c.y - m.y) * n.y;
  const minGap = 2 * depth + LOUNGE_MIN_AISLE;
  if (Math.abs(dist) < minGap) dist = Math.sign(dist || 1) * minGap;
  return [
    { a, b },
    { a: { x: round1(a.x + n.x * dist), y: round1(a.y + n.y * dist) }, b: { x: round1(b.x + n.x * dist), y: round1(b.y + n.y * dist) } },
  ];
}

export function materializePath(style: LoungeStyle, path: LoungePoint[], depth: number): LoungePoint[] {
  if (style !== "P") return path.map((p) => ({ x: round1(p.x), y: round1(p.y) }));
  const pairs = parallelPairs(path, depth);
  if (pairs.length < 2) return path.map((p) => ({ x: round1(p.x), y: round1(p.y) }));
  return [pairs[0].a, pairs[0].b, pairs[1].a, pairs[1].b].map((p) => ({ x: round1(p.x), y: round1(p.y) }));
}

export function parallelGap(path: LoungePoint[], depth: number): number {
  const pairs = parallelPairs(path, depth);
  if (pairs.length < 2) return 0;
  const n = leftNormal(pairs[0].a, pairs[0].b);
  if (!n) return 0;
  const m1 = mid(pairs[0].a, pairs[0].b);
  const m2 = mid(pairs[1].a, pairs[1].b);
  return round1(Math.abs((m2.x - m1.x) * n.x + (m2.y - m1.y) * n.y));
}

function aisleInward(pairs: LoungePair[]): LoungePoint {
  const m1 = mid(pairs[0].a, pairs[0].b);
  const m2 = mid(pairs[1].a, pairs[1].b);
  return { x: round1((m1.x + m2.x) / 2), y: round1((m1.y + m2.y) / 2) };
}

function boxesFromPairs(pairs: LoungePair[], depth: number, inward: LoungePoint): LoungeSegment[] {
  const out: LoungeSegment[] = [];
  for (let i = 0; i < pairs.length; i += 1) {
    const { a, b } = pairs[i];
    let sign = sideOf(a, b, inward);
    if (sign === 0) sign = 1;
    const box = offsetSegment(a, b, depth, sign);
    if (!box) continue;
    out.push({ id: `SEG_${i + 1}`, ...box });
  }
  return out;
}

export function loungeSegments(path: LoungePoint[], depth: number, inward: LoungePoint, style?: LoungeStyle): LoungeSegment[] {
  if (style === "P") {
    const pairs = parallelPairs(path, depth);
    if (pairs.length < 2) return [];
    return boxesFromPairs(pairs, depth, aisleInward(pairs));
  }
  const out: LoungeSegment[] = [];
  for (let i = 0; i < path.length - 1; i += 1) {
    const a = path[i];
    const b = path[i + 1];
    let sign = sideOf(a, b, inward);
    if (sign === 0) sign = 1;
    const box = offsetSegment(a, b, depth, sign);
    if (!box) continue;
    out.push({ id: `SEG_${i + 1}`, ...box });
  }
  return out;
}

export function loungeAabb(path: LoungePoint[], depth: number, inward: LoungePoint, style?: LoungeStyle): {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
} | null {
  const segs = loungeSegments(path, depth, inward, style);
  if (!segs.length) return null;
  return {
    x0: Math.min(...segs.map((s) => s.x0)),
    x1: Math.max(...segs.map((s) => s.x1)),
    y0: Math.min(...segs.map((s) => s.y0)),
    y1: Math.max(...segs.map((s) => s.y1)),
  };
}

export function loungeBounds(path: LoungePoint[], depth: number, inward: LoungePoint, height: number, style?: LoungeStyle): {
  W: number;
  D: number;
  H: number;
} {
  const box = loungeAabb(path, depth, inward, style);
  if (!box) return { W: 0, D: 0, H: height };
  return { W: round1(box.x1 - box.x0), D: round1(box.y1 - box.y0), H: height };
}

function towardOf(params: LoungeParams, path: LoungePoint[]): LoungePoint | null {
  if (params.inwardX == null && params.inwardY == null) return null;
  return { x: asNum(params.inwardX, path[0] ? path[0].x : 0), y: asNum(params.inwardY, path[0] ? path[0].y : 0) };
}

/** Fill missing vertices when switching style (or Enter before the last click). */
export function loungeRestyle(params: LoungeParams, style: LoungeStyle): LoungeParams {
  const depth = round1(Math.max(LOUNGE_MIN.depth, asNum(params.depth, LOUNGE_DEFAULT_DEPTH)));
  const raw = Array.isArray(params.path) ? params.path : [];
  let path: LoungePoint[] = raw.map((p) => ({ x: round1(asNum(p?.x)), y: round1(asNum(p?.y)) }));
  const toward = towardOf(params, path);
  const ret = Math.max(LOUNGE_MIN.segment, LOUNGE_DEFAULT_RETURN);

  if (style === "I") {
    if (path.length >= 2) path = path.slice(0, 2);
  } else if (style === "L") {
    if (path.length >= 3 && params.style !== "P") path = path.slice(0, 3);
    else if (path.length >= 2) {
      path = [path[0], path[1], defaultTurn(path[0], path[1], ret, toward)];
    }
  } else if (style === "U") {
    if (path.length >= 4 && params.style !== "P") path = path.slice(0, 4);
    else if (path.length >= 2) {
      const a = path[0];
      const b = path[1];
      const n = leftNormal(a, b);
      const side = n
        ? (() => {
          const s = toward && sideOf(a, b, toward) < 0 ? -1 : 1;
          return [
            { x: round1(a.x + n.x * ret * s), y: round1(a.y + n.y * ret * s) },
            { x: round1(b.x + n.x * ret * s), y: round1(b.y + n.y * ret * s) },
          ];
        })()
        : [{ x: round1(a.x), y: round1(a.y + ret) }, { x: round1(b.x), y: round1(b.y + ret) }];
      path = [a, side[0], side[1], b];
    }
  } else if (style === "P") {
    if (path.length >= 4 && params.style === "P") path = path.slice(0, 4);
    else if (path.length >= 3) path = materializePath("P", path, depth);
    else if (path.length >= 2) {
      const a = path[0];
      const b = path[1];
      const n = leftNormal(a, b);
      const s = n && toward && sideOf(a, b, toward) < 0 ? -1 : 1;
      const gap = 2 * depth + LOUNGE_MIN_AISLE + 600;
      if (n) {
        path = [
          a, b,
          { x: round1(a.x + n.x * gap * s), y: round1(a.y + n.y * gap * s) },
          { x: round1(b.x + n.x * gap * s), y: round1(b.y + n.y * gap * s) },
        ];
      }
    }
  }

  let inwardX = params.inwardX;
  let inwardY = params.inwardY;
  if (style === "P" && path.length >= 4) {
    const inn = aisleInward(parallelPairs(path, depth));
    inwardX = inn.x;
    inwardY = inn.y;
  }

  return { ...params, style, path, depth, inwardX, inwardY };
}

export function generateLounge(raw: LoungeParams): LoungeResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const depth = round1(asNum(raw.depth, LOUNGE_DEFAULT_DEPTH));
  const height = round1(asNum(raw.height, LOUNGE_DEFAULT_HEIGHT));
  const t = round1(asNum(raw.panelThickness, DEFAULT_CPT));
  const fpt = round1(asNum(raw.frontPanelThickness, 0));
  const color = String(raw.carcassColor || DEFAULT_COLOR);
  const colorName = String(raw.carcassColorName || color);
  const rawPath = Array.isArray(raw.path) ? raw.path : [];
  let path: LoungePoint[] = rawPath.map((p) => ({ x: round1(asNum(p?.x)), y: round1(asNum(p?.y)) }));
  const requested = normalizeLoungeStyle(raw.style);
  const style: LoungeStyle = requested || loungeStyleFromCount(path.length);

  if (style === "P") {
    if (path.length < 3) errors.push("Parallel needs the first run and a point on the opposite lounge.");
    path = materializePath("P", path, depth);
  } else {
    if (path.length < 2) errors.push("A lounge needs at least two path points (I).");
    if (path.length > 4) errors.push("A lounge path has at most four points (U).");
  }
  if (depth < LOUNGE_MIN.depth) errors.push(`depth must be at least ${LOUNGE_MIN.depth} mm.`);
  if (height < LOUNGE_MIN.height) errors.push(`height must be at least ${LOUNGE_MIN.height} mm.`);
  if (t <= 0) errors.push("panelThickness must be positive.");

  if (style === "P") {
    const pairs = parallelPairs(path, depth);
    for (let i = 0; i < pairs.length; i += 1) {
      const len = Math.hypot(pairs[i].b.x - pairs[i].a.x, pairs[i].b.y - pairs[i].a.y);
      if (len < LOUNGE_MIN.segment) errors.push(`Path segment ${i + 1} is ${round1(len)} mm; minimum ${LOUNGE_MIN.segment} mm.`);
    }
    const gap = parallelGap(path, depth);
    if (gap > 0 && gap < 2 * depth + LOUNGE_MIN_AISLE) {
      errors.push(`Parallel aisle is ${round1(gap - 2 * depth)} mm; need ${LOUNGE_MIN_AISLE} mm between the seats.`);
    }
  } else {
    for (let i = 0; i < path.length - 1; i += 1) {
      const len = Math.hypot(path[i + 1].x - path[i].x, path[i + 1].y - path[i].y);
      if (len < LOUNGE_MIN.segment) errors.push(`Path segment ${i + 1} is ${round1(len)} mm; minimum ${LOUNGE_MIN.segment} mm.`);
    }
  }

  let inward = {
    x: round1(asNum(raw.inwardX, path[0] ? path[0].x : 0)),
    y: round1(asNum(raw.inwardY, depth)),
  };
  if (style === "P" && path.length >= 4) inward = aisleInward(parallelPairs(path, depth));

  let segs = errors.length ? [] : loungeSegments(path, depth, inward, style);
  if (segs.length) {
    const minx = Math.min(...segs.map((s) => s.x0));
    const miny = Math.min(...segs.map((s) => s.y0));
    if (minx !== 0 || miny !== 0) {
      segs = segs.map((s) => ({
        ...s,
        x0: round1(s.x0 - minx),
        x1: round1(s.x1 - minx),
        y0: round1(s.y0 - miny),
        y1: round1(s.y1 - miny),
      }));
      for (const p of path) {
        p.x = round1(p.x - minx);
        p.y = round1(p.y - miny);
      }
      inward.x = round1(inward.x - minx);
      inward.y = round1(inward.y - miny);
    }
  }
  const boards: Board[] = [];
  if (!errors.length) {
    for (const seg of segs) {
      boards.push({
        id: seg.id,
        name: `Lounge ${styleLabel(style)} ${seg.id}`,
        category: "carcass",
        boardType: "lounge_segment",
        materialThickness: height,
        profilePlane: "XY",
        thicknessAxis: "Z",
        x0: seg.x0,
        x1: seg.x1,
        y0: seg.y0,
        y1: seg.y1,
        z0: 0,
        z1: height,
        notes: style === "P"
          ? [`Seat depth ${depth} mm toward the aisle`]
          : [`Seat depth ${depth} mm toward the room`],
      });
    }
  }

  return {
    params: {
      path,
      depth,
      height,
      inwardX: inward.x,
      inwardY: inward.y,
      panelThickness: t,
      frontPanelThickness: fpt,
      carcassColor: color,
      carcassColorName: colorName,
      style,
    },
    zones: segs,
    boards,
    features: [],
    validation: { errors, warnings },
    debug: { form: style === "P" ? "parallel_i" : "polyline_segments", style, boardFrame: "final" },
  };
}
