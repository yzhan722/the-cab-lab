/**
 * U-overhead: three Cab Lab overhead runs (left, back, right) around a
 * bounding box. Does not re-implement OHC formulas — each run is
 * `generateOverheadCabinet`. Boards are mapped into the U's local frame
 * (open mouth at y = 0, back wall at y = outerDepth). 3D uses bounding
 * boxes; run-local outlines stay on each OHC result for manufacturing.
 *
 * Local: X left→right, Y mouth→back, Z up. Each run's doors face the opening.
 */

import { generateOverheadCabinet } from "../overheadCabinet/generator.ts";
import type { Board, OverheadCabinetParams } from "../overheadCabinet/types.ts";

export const U_OHC_MIN_ZONE = 150;
export const U_OHC_MIN_RUN = 150;

const round1 = (v: number) => Math.round(v * 10) / 10;

function asNum(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export type UOhcZone = { id: string; type: string; width: number };

export interface UShapeOverheadParams {
  cabinetWidth: number;
  /** Bounding-box depth of the U (not the run thickness). */
  outerDepth: number;
  cabinetHeight: number;
  /** Each run's carcass depth (OHC cabinetDepth). */
  cabinetDepth?: number;
  style?: string;
  featureWidth?: number;
  frontPanelThickness?: number;
  topClearanceHeight?: number;
  clearance?: number;
  carcassColor?: string;
  carcassColorName?: string;
  leftZones?: UOhcZone[];
  backZones?: UOhcZone[];
  rightZones?: UOhcZone[];
}

export interface UOhcLayout {
  W: number;
  D: number;
  H: number;
  run: number;
  fpt: number;
  leftLen: number;
  backLen: number;
  rightLen: number;
}

function fitWidths(zones: UOhcZone[] | undefined, total: number): UOhcZone[] {
  const list = Array.isArray(zones) && zones.length
    ? zones.map((z, i) => ({
      id: String(z.id || `zone-${i + 1}`),
      type: String(z.type || "up_flap"),
      width: asNum(z.width, 0),
    }))
    : [{ id: "zone-1", type: "up_flap", width: total }];
  const sum = list.reduce((s, z) => s + z.width, 0) || 1;
  const out = list.map((z) => ({
    ...z,
    width: Math.max(U_OHC_MIN_ZONE, Math.round((z.width / sum) * total)),
  }));
  const partial = out.slice(0, -1).reduce((s, z) => s + z.width, 0);
  out[out.length - 1]!.width = round1(total - partial);
  if (out[out.length - 1]!.width < U_OHC_MIN_ZONE) {
    const even = round1(total / out.length);
    out.forEach((z) => { z.width = even; });
    out[out.length - 1]!.width = round1(total - even * (out.length - 1));
  }
  return out;
}

/** Resolve run thickness so three OHC runs fit the bounding box. */
export function resolveUOverheadLayout(params: UShapeOverheadParams): UOhcLayout {
  const W = round1(asNum(params.cabinetWidth, 0));
  const D = round1(asNum(params.outerDepth, 0));
  const H = round1(asNum(params.cabinetHeight, 0));
  const fpt = round1(asNum(params.frontPanelThickness, 16));
  const want = Math.max(U_OHC_MIN_RUN, round1(asNum(params.cabinetDepth, 350)));
  const maxRun = Math.max(
    U_OHC_MIN_RUN,
    Math.min(want, Math.floor((W - U_OHC_MIN_ZONE) / 2), Math.max(U_OHC_MIN_RUN, D - U_OHC_MIN_ZONE)),
  );
  const run = Number.isFinite(maxRun) ? round1(maxRun) : U_OHC_MIN_RUN;
  return {
    W,
    D,
    H,
    run,
    fpt,
    leftLen: D,
    rightLen: D,
    backLen: round1(W - 2 * run),
  };
}

type MapPt = (x: number, y: number, z: number) => { x: number; y: number; z: number };

function mapBoard(board: Board, prefix: string, map: MapPt): Board {
  const corners = [
    [board.x0, board.y0, board.z0],
    [board.x1, board.y0, board.z0],
    [board.x0, board.y1, board.z0],
    [board.x1, board.y1, board.z0],
    [board.x0, board.y0, board.z1],
    [board.x1, board.y0, board.z1],
    [board.x0, board.y1, board.z1],
    [board.x1, board.y1, board.z1],
  ].map(([x, y, z]) => map(x, y, z));
  const xs = corners.map((p) => p.x);
  const ys = corners.map((p) => p.y);
  const zs = corners.map((p) => p.z);
  return {
    ...board,
    id: `${prefix}:${board.id}`,
    name: `${prefix} ${board.name || board.id}`,
    x0: Math.min(...xs),
    x1: Math.max(...xs),
    y0: Math.min(...ys),
    y1: Math.max(...ys),
    z0: Math.min(...zs),
    z1: Math.max(...zs),
    // Run-local outlines would be wrong after the 90° map; 3D uses the box.
    profileVector: undefined,
    cutProfileVector: undefined,
    profileFeatures: undefined,
  };
}

function runParams(base: UShapeOverheadParams, width: number, zones: UOhcZone[], run: number): OverheadCabinetParams {
  return {
    style: base.style || "style_1",
    cabinetWidth: width,
    cabinetDepth: run,
    cabinetHeight: asNum(base.cabinetHeight, 400),
    featureWidth: asNum(base.featureWidth, 15),
    frontPanelThickness: asNum(base.frontPanelThickness, 16),
    topClearanceHeight: asNum(base.topClearanceHeight, 40),
    clearance: asNum(base.clearance, 2.5),
    carcassColor: base.carcassColor,
    carcassColorName: base.carcassColorName,
    zones: fitWidths(zones, width),
  };
}

function mapRun(
  result: ReturnType<typeof generateOverheadCabinet>,
  prefix: string,
  map: MapPt,
): { boards: Board[]; errors: string[]; warnings: string[] } {
  const errors = (result.validation?.errors || []).map((m) => `${prefix}: ${m}`);
  const warnings = (result.validation?.warnings || []).map((m) => `${prefix}: ${m}`);
  return {
    boards: (result.boards || []).map((b) => mapBoard(b, prefix, map)),
    errors,
    warnings,
  };
}

export function generateUShapeOverhead(raw: UShapeOverheadParams) {
  const errors: string[] = [];
  const warnings: string[] = [];
  const layout = resolveUOverheadLayout(raw);
  const { W, D, H, run, leftLen, backLen, rightLen } = layout;

  if (W < 2 * U_OHC_MIN_RUN + U_OHC_MIN_ZONE) errors.push(`width must be at least ${2 * U_OHC_MIN_RUN + U_OHC_MIN_ZONE} mm`);
  if (D < U_OHC_MIN_RUN + U_OHC_MIN_ZONE) errors.push(`depth must be at least ${U_OHC_MIN_RUN + U_OHC_MIN_ZONE} mm`);
  if (H < 150) errors.push("height must be at least 150 mm");
  if (backLen < U_OHC_MIN_ZONE) errors.push(`back run width ${backLen} mm is under ${U_OHC_MIN_ZONE} mm`);
  if (leftLen < U_OHC_MIN_ZONE) errors.push(`side run length ${leftLen} mm is under ${U_OHC_MIN_ZONE} mm`);

  const params = {
    cabinetWidth: W,
    outerDepth: D,
    cabinetHeight: H,
    cabinetDepth: run,
    style: raw.style || "style_1",
    featureWidth: asNum(raw.featureWidth, 15),
    frontPanelThickness: asNum(raw.frontPanelThickness, 16),
    topClearanceHeight: asNum(raw.topClearanceHeight, 40),
    clearance: asNum(raw.clearance, 2.5),
    carcassColor: raw.carcassColor || "White Stipple",
    carcassColorName: raw.carcassColorName || "White Stipple",
    leftZones: fitWidths(raw.leftZones, leftLen),
    backZones: fitWidths(raw.backZones, backLen),
    rightZones: fitWidths(raw.rightZones, rightLen),
  };

  if (errors.length) {
    return { params, layout, boards: [], features: [], validation: { errors, warnings } };
  }

  const left = mapRun(
    generateOverheadCabinet(runParams(raw, leftLen, params.leftZones, run)),
    "left",
    (x, y, z) => ({ x: run - y, y: x, z }),
  );
  const right = mapRun(
    generateOverheadCabinet(runParams(raw, rightLen, params.rightZones, run)),
    "right",
    (x, y, z) => ({ x: W - run + y, y: D - x, z }),
  );
  const back = mapRun(
    generateOverheadCabinet(runParams(raw, backLen, params.backZones, run)),
    "back",
    (x, y, z) => ({ x: run + x, y: D - run + y, z }),
  );

  errors.push(...left.errors, ...right.errors, ...back.errors);
  warnings.push(...left.warnings, ...right.warnings, ...back.warnings);

  return {
    params: { ...params, frontPanelThickness: 0, runFrontPanelThickness: params.frontPanelThickness },
    layout,
    boards: [...left.boards, ...back.boards, ...right.boards],
    features: [],
    validation: { errors, warnings },
  };
}
