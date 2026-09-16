/**
 * Lounge v0 generator.
 *
 * Cab Lab native: a floor polyline (the back / wall edge) offset toward the
 * room by `depth`. I = 2 points (one box), L = 3, U = 4. U is three I
 * segments, not a fourth formula. Each segment is one XY board of thickness H.
 *
 * Coordinates: X left→right, Y front (room) side of the AABB → back, Z up.
 */

import type { Board, LoungeParams, LoungePoint, LoungeResult, LoungeSegment, LoungeStyle } from "./types.ts";

export const LOUNGE_MIN = { depth: 300, height: 300, segment: 300 };
export const LOUNGE_DEFAULT_HEIGHT = 420;
export const LOUNGE_DEFAULT_DEPTH = 600;

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

/** Which side of directed A→B contains P. +1 = left, -1 = right, 0 = on the line. */
export function sideOf(a: LoungePoint, b: LoungePoint, p: LoungePoint): number {
  const c = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
  if (Math.abs(c) < 1e-6) return 0;
  return c > 0 ? 1 : -1;
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

export function loungeSegments(path: LoungePoint[], depth: number, inward: LoungePoint): LoungeSegment[] {
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

export function loungeAabb(path: LoungePoint[], depth: number, inward: LoungePoint): {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
} | null {
  const segs = loungeSegments(path, depth, inward);
  if (!segs.length) return null;
  return {
    x0: Math.min(...segs.map((s) => s.x0)),
    x1: Math.max(...segs.map((s) => s.x1)),
    y0: Math.min(...segs.map((s) => s.y0)),
    y1: Math.max(...segs.map((s) => s.y1)),
  };
}

export function loungeBounds(path: LoungePoint[], depth: number, inward: LoungePoint, height: number): {
  W: number;
  D: number;
  H: number;
} {
  const box = loungeAabb(path, depth, inward);
  if (!box) return { W: 0, D: 0, H: height };
  return { W: round1(box.x1 - box.x0), D: round1(box.y1 - box.y0), H: height };
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
  const path: LoungePoint[] = rawPath.map((p) => ({ x: round1(asNum(p?.x)), y: round1(asNum(p?.y)) }));
  const inward = {
    x: round1(asNum(raw.inwardX, path[0] ? path[0].x : 0)),
    y: round1(asNum(raw.inwardY, depth)),
  };

  if (path.length < 2) errors.push("A lounge needs at least two path points (I).");
  if (path.length > 4) errors.push("A lounge path has at most four points (U).");
  if (depth < LOUNGE_MIN.depth) errors.push(`depth must be at least ${LOUNGE_MIN.depth} mm.`);
  if (height < LOUNGE_MIN.height) errors.push(`height must be at least ${LOUNGE_MIN.height} mm.`);
  if (t <= 0) errors.push("panelThickness must be positive.");
  for (let i = 0; i < path.length - 1; i += 1) {
    const len = Math.hypot(path[i + 1].x - path[i].x, path[i + 1].y - path[i].y);
    if (len < LOUNGE_MIN.segment) errors.push(`Path segment ${i + 1} is ${round1(len)} mm; minimum ${LOUNGE_MIN.segment} mm.`);
  }

  const style = loungeStyleFromCount(path.length);
  let segs = errors.length ? [] : loungeSegments(path, depth, inward);
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
        name: `Lounge ${style} ${seg.id}`,
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
        notes: [`Seat depth ${depth} mm toward the room`],
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
    debug: { form: "polyline_segments", style, boardFrame: "final" },
  };
}
