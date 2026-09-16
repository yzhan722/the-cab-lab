/**
 * U overhead v0.
 *
 * Three `generateOverheadCabinet` runs mapped into one U envelope. Opening at
 * y = 0 (the missing side of the U). Back run along X at the far wall; left
 * and right runs along Y, butting the back run (width = D − armDepth).
 *
 * Does not re-implement OHC formulas.
 */

import { generateOverheadCabinet } from "../overheadCabinet/generator.ts";
import type { Board } from "../overheadCabinet/types.ts";
import type { UOverheadParams, UOverheadResult, UOverheadZone } from "./types.ts";

export const DEFAULT_ARM_DEPTH = 350;
export const MIN_ARM_RUN = 150;

function round1(value: number): number {
  const n = Math.round(value * 10) / 10;
  return Object.is(n, -0) ? 0 : n;
}

function asNum(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function xy(x: number, y: number, pose: { x: number; y: number; rotZ: number }): { x: number; y: number } {
  const a = (pose.rotZ * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return { x: pose.x + x * c - y * s, y: pose.y + x * s + y * c };
}

function mapBoard(board: Board, pose: { x: number; y: number; rotZ: number }, prefix: string): Board {
  const corners = [
    [board.x0, board.y0],
    [board.x1, board.y0],
    [board.x1, board.y1],
    [board.x0, board.y1],
  ].map(([x, y]) => xy(x, y, pose));
  const xs = corners.map((p) => p.x);
  const ys = corners.map((p) => p.y);
  const next: Board = {
    ...board,
    id: `${prefix}${board.id}`,
    name: `${prefix.slice(0, -1)} ${board.name}`,
    x0: round1(Math.min(...xs)),
    x1: round1(Math.max(...xs)),
    y0: round1(Math.min(...ys)),
    y1: round1(Math.max(...ys)),
    source: prefix.replace(/_$/, ""),
  };
  if (pose.rotZ === 0) {
    next.profileVector = (board.profileVector || []).map((p) => {
      if ("x" in p && "y" in p) return { x: (p as { x: number }).x + pose.x, y: (p as { y: number }).y + pose.y };
      if ("x" in p && "z" in p) return { x: (p as { x: number }).x + pose.x, z: (p as { z: number }).z };
      if ("y" in p && "z" in p) return { y: (p as { y: number }).y + pose.y, z: (p as { z: number }).z };
      return p;
    });
  } else {
    next.profileVector = undefined;
    next.cutProfileVector = undefined;
  }
  return next;
}

function defaultZones(width: number): UOverheadZone[] {
  return [{ id: "zone-1", type: "up_flap", width: round1(width) }];
}

function armParams(params: UOverheadParams, width: number, zones: UOverheadZone[] | undefined) {
  return {
    style: params.style || "style_1",
    cabinetWidth: round1(width),
    cabinetDepth: round1(asNum(params.armDepth, DEFAULT_ARM_DEPTH)),
    cabinetHeight: round1(params.cabinetHeight),
    featureWidth: params.featureWidth,
    frontPanelThickness: params.frontPanelThickness,
    topClearanceHeight: params.topClearanceHeight ?? 40,
    clearance: params.clearance ?? 2.5,
    carcassColor: params.carcassColor,
    carcassColorName: params.carcassColorName,
    doorSeries: params.doorSeries,
    doorColor: params.doorColor,
    doorColorName: params.doorColorName,
    colorSlot: params.colorSlot,
    zones: (zones && zones.length ? zones : defaultZones(width)).map((z) => ({
      id: z.id,
      type: z.type || "up_flap",
      width: round1(asNum(z.width)),
    })),
  };
}

export function generateUOverheadCabinet(params: UOverheadParams): UOverheadResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const W = round1(asNum(params.cabinetWidth));
  const D = round1(asNum(params.cabinetDepth));
  const H = round1(asNum(params.cabinetHeight));
  const arm = round1(asNum(params.armDepth, DEFAULT_ARM_DEPTH));
  const cpt = round1(asNum(params.featureWidth, 16));
  const color = String(params.carcassColor || "White Stipple");
  const colorName = String(params.carcassColorName || color);
  const sideLen = round1(D - arm);

  if (W <= 0) errors.push("cabinetWidth must be > 0.");
  if (D <= 0) errors.push("cabinetDepth must be > 0.");
  if (H <= 0) errors.push("cabinetHeight must be > 0.");
  if (arm <= 0) errors.push("armDepth must be > 0.");
  if (sideLen < MIN_ARM_RUN) errors.push(`cabinetDepth − armDepth must be at least ${MIN_ARM_RUN} mm so the side runs have a length.`);
  if (W < 2 * arm + MIN_ARM_RUN) errors.push(`cabinetWidth must be at least 2 × armDepth + ${MIN_ARM_RUN} mm so the U has an opening.`);

  const empty = (): UOverheadResult => ({
    params: {
      cabinetWidth: W,
      cabinetDepth: D,
      cabinetHeight: H,
      armDepth: arm,
      frontPanelThickness: 0,
      featureWidth: cpt,
      carcassColor: color,
      carcassColorName: colorName,
    },
    zones: [],
    boards: [],
    features: [],
    validation: { errors, warnings },
  });

  if (errors.length) return empty();

  const back = generateOverheadCabinet(armParams(params, W, params.backZones));
  const left = generateOverheadCabinet(armParams(params, sideLen, params.leftZones));
  const right = generateOverheadCabinet(armParams(params, sideLen, params.rightZones));

  for (const [name, r] of [["back", back], ["left", left], ["right", right]] as const) {
    for (const e of r.validation.errors) errors.push(`${name}: ${e}`);
    warnings.push(...r.validation.warnings.map((w) => `${name}: ${w}`));
  }
  if (errors.length) return empty();

  const backPose = { x: 0, y: sideLen, rotZ: 0 };
  const leftPose = { x: arm, y: 0, rotZ: 90 };
  const rightPose = { x: W - arm, y: sideLen, rotZ: 270 };

  const boards: Board[] = [
    ...back.boards.map((b) => mapBoard(b, backPose, "B_")),
    ...left.boards.map((b) => mapBoard(b, leftPose, "L_")),
    ...right.boards.map((b) => mapBoard(b, rightPose, "R_")),
  ];
  const features = [
    ...back.features.map((f) => ({ ...(f as object), source: "back" })),
    ...left.features.map((f) => ({ ...(f as object), source: "left" })),
    ...right.features.map((f) => ({ ...(f as object), source: "right" })),
  ];

  return {
    params: {
      cabinetWidth: W,
      cabinetDepth: D,
      cabinetHeight: H,
      armDepth: arm,
      frontPanelThickness: 0,
      featureWidth: cpt,
      carcassColor: color,
      carcassColorName: colorName,
    },
    zones: params.backZones || defaultZones(W),
    boards,
    features,
    validation: { errors, warnings },
    debug: {
      form: "three_ohc",
      boardFrame: "final",
      opening: "y=0",
      arms: { back: backPose, left: leftPose, right: rightPose, sideLen, arm },
    },
  };
}
