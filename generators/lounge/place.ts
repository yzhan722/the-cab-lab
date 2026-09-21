/**
 * Lounge floor-plan placement: back-edge polyline → style / params / pose.
 * I = 2 pts, L = 3 orthogonal, Parallel = 3 colinear, U = 4.
 * Walk P0→P1; depth grows to the right of the walk (into the room).
 */
import type { LoungeParams, LoungeResult } from "./types.ts";

export interface LoungeBox {
  id: string;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

export interface LoungePose {
  x: number;
  y: number;
  z: number;
  rotZ: number;
}

const r2 = (v: number) => Math.round(v * 1000) / 1000;
const asNum = (v: unknown, fb: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
};

function boxesFromParams(p: LoungeParams): LoungeBox[] {
  const style = p.style ?? "L_SHAPE";
  if (style === "I_SHAPE") {
    const W = asNum(p.mainWidth, 2000);
    const D = asNum(p.mainDepth, 600);
    return [{ id: "i", x0: 0, x1: W, y0: 0, y1: D }];
  }
  if (style === "U_SHAPE") {
    const W = asNum(p.mainWidth, 2000);
    const D = asNum(p.mainDepth, 1600);
    const runD = asNum(p.lDepth, 600);
    return [
      { id: "left", x0: 0, x1: runD, y0: 0, y1: D },
      { id: "back", x0: 0, x1: W, y0: r2(D - runD), y1: D },
      { id: "right", x0: r2(W - runD), x1: W, y0: 0, y1: D },
    ];
  }
  if (style === "PARALLEL") {
    const totalW = asNum(p.totalWidth, 4000);
    const SW = asNum(p.singleLoungeWidth, 1500);
    const D = asNum(p.depth, 800);
    return [
      { id: "left", x0: 0, x1: SW, y0: 0, y1: D },
      { id: "right", x0: r2(totalW - SW), x1: totalW, y0: 0, y1: D },
    ];
  }
  const mainW = asNum(p.mainWidth, 2000);
  const mainD = asNum(p.mainDepth, 600);
  const lW = asNum(p.lWidth, 1600);
  const lD = asNum(p.lDepth, 800);
  const right = (p.lPosition ?? "RIGHT") !== "LEFT";
  const lX0 = right ? r2(mainW - lW) : 0;
  const lX1 = right ? mainW : lW;
  return [
    { id: "main", x0: 0, x1: mainW, y0: 0, y1: mainD },
    { id: "l", x0: lX0, x1: lX1, y0: 0, y1: lD },
  ];
}

/** Local footprint rectangles (cabinet frame). Result.footprint wins when present. */
export function loungeFootprintBoxes(params: LoungeParams, result?: Pick<LoungeResult, "footprint">): LoungeBox[] {
  const fp = result?.footprint;
  if (fp) {
    const out: LoungeBox[] = [];
    if (fp.i) out.push({ id: "i", ...fp.i });
    if (fp.main) out.push({ id: "main", ...fp.main });
    if (fp.l) out.push({ id: "l", ...fp.l });
    if (fp.left) out.push({ id: "left", ...fp.left });
    if (fp.right) out.push({ id: "right", ...fp.right });
    if (out.length) return out;
  }
  return boxesFromParams(params);
}

export function pointInFootprintBoxes(x: number, y: number, boxes: LoungeBox[]): boolean {
  return boxes.some((b) => x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1);
}

/** Back-edge polyline in cabinet-local XY (wall side, +Y). */
export function loungePolyline(params: LoungeParams): Array<{ x: number; y: number }> {
  const style = params.style ?? "L_SHAPE";
  if (style === "I_SHAPE") {
    const W = asNum(params.mainWidth, 2000);
    const D = asNum(params.mainDepth, 600);
    return [{ x: 0, y: D }, { x: W, y: D }];
  }
  if (style === "U_SHAPE") {
    const W = asNum(params.mainWidth, 2000);
    const D = asNum(params.mainDepth, 1600);
    return [{ x: 0, y: 0 }, { x: 0, y: D }, { x: W, y: D }, { x: W, y: 0 }];
  }
  if (style === "PARALLEL") {
    const totalW = asNum(params.totalWidth, 4000);
    const SW = asNum(params.singleLoungeWidth, 1500);
    const D = asNum(params.depth, 800);
    return [{ x: 0, y: D }, { x: SW, y: D }, { x: totalW, y: D }];
  }
  const mainW = asNum(params.mainWidth, 2000);
  const mainD = asNum(params.mainDepth, 600);
  const lD = asNum(params.lDepth, 800);
  const right = (params.lPosition ?? "RIGHT") !== "LEFT";
  if (right) return [{ x: 0, y: mainD }, { x: mainW, y: mainD }, { x: mainW, y: lD }];
  return [{ x: 0, y: lD }, { x: 0, y: mainD }, { x: mainW, y: mainD }];
}

/**
 * World back-edge points → lounge params + pose (cabinet origin at local 0,0).
 */
export function loungeFromPolyline(
  points: Array<{ x: number; y: number }>,
  base: LoungeParams = {},
): { params: LoungeParams; pose: LoungePose } {
  if (points.length < 2) throw new Error("lounge polyline needs at least 2 points");
  const p0 = points[0]!;
  const p1 = points[1]!;
  const dx = p1.x - p0.x;
  const dy = p1.y - p0.y;
  const len = Math.hypot(dx, dy);
  if (len < 1) throw new Error("lounge polyline first segment is too short");
  const rot = Math.atan2(dy, dx);
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  const toPlace = (p: { x: number; y: number }) => {
    const wx = p.x - p0.x;
    const wy = p.y - p0.y;
    return { U: wx * c + wy * s, V: wx * s - wy * c };
  };
  const local = points.map(toPlace);
  const H = asNum(base.height, 420);
  const ppt = asNum(base.partitionPanelThickness, 18);
  const rotZ = r2((rot * 180) / Math.PI);

  const poseFromDepth = (depth: number): LoungePose => ({
    x: r2(p0.x + depth * s),
    y: r2(p0.y - depth * c),
    z: 0,
    rotZ,
  });

  if (points.length === 2) {
    const D = asNum(base.mainDepth, 600);
    return {
      params: { ...base, style: "I_SHAPE", mainWidth: r2(len), mainDepth: D, height: H, partitionPanelThickness: ppt },
      pose: poseFromDepth(D),
    };
  }

  if (points.length === 3) {
    const p2 = local[2]!;
    const colinear = Math.abs(p2.V) < 1;
    if (colinear) {
      const D = asNum(base.depth ?? base.mainDepth, 800);
      const SW = asNum(base.singleLoungeWidth, 1500);
      return {
        params: {
          ...base, style: "PARALLEL",
          totalWidth: r2(Math.abs(p2.U)), singleLoungeWidth: SW, depth: D,
          height: H, partitionPanelThickness: ppt,
        },
        pose: poseFromDepth(D),
      };
    }
    const mainD = asNum(base.mainDepth, 600);
    const lW = asNum(base.lWidth, 1600);
    const lD = r2(mainD + Math.abs(p2.V));
    const right = p2.U >= len / 2;
    return {
      params: {
        ...base, style: "L_SHAPE",
        mainWidth: r2(len), mainDepth: mainD, lWidth: lW, lDepth: lD,
        lPosition: right ? "RIGHT" : "LEFT",
        height: H, partitionPanelThickness: ppt,
      },
      pose: poseFromDepth(mainD),
    };
  }

  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const W = r2(Math.max(...xs) - minX);
  const D = r2(Math.max(...ys) - minY);
  const runD = asNum(base.lDepth, 600);
  return {
    params: {
      ...base, style: "U_SHAPE",
      mainWidth: W, mainDepth: D, lDepth: runD,
      height: H, partitionPanelThickness: ppt,
    },
    pose: { x: r2(minX), y: r2(minY), z: 0, rotZ: 0 },
  };
}
