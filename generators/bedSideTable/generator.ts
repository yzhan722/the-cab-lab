/**
 * Bed Side Table v0 generator — one solid volume, no boards.
 * Placement (against the Bedroom body, on a side wall) is the renderer's job.
 */

import type { BedSideTableParams, BedSideTableResult } from "./types.ts";
import { BED_SIDE_DEFAULT_HEIGHT, BED_SIDE_MIN } from "./types.ts";
export { BED_SIDE_DEFAULT_HEIGHT, BED_SIDE_MIN } from "./types.ts";

const DEFAULT_CPT = 16;
const DEFAULT_COLOR = "White Stipple";

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}
function asNum(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function generateBedSideTable(raw: BedSideTableParams): BedSideTableResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const W = round1(asNum(raw.width, 0));
  const D = round1(asNum(raw.depth, 0));
  const H = round1(asNum(raw.height, BED_SIDE_DEFAULT_HEIGHT));
  const t = round1(asNum(raw.panelThickness, DEFAULT_CPT));
  const fpt = round1(asNum(raw.frontPanelThickness, 0));
  const side = raw.side === "right" ? "right" : "left";
  const color = String(raw.carcassColor || DEFAULT_COLOR);

  if (W < BED_SIDE_MIN.width) errors.push(`width must be at least ${BED_SIDE_MIN.width} mm`);
  if (D < BED_SIDE_MIN.depth) errors.push(`depth must be at least ${BED_SIDE_MIN.depth} mm`);
  if (H < BED_SIDE_MIN.height) errors.push(`height must be at least ${BED_SIDE_MIN.height} mm`);
  if (t <= 0) errors.push("panelThickness must be positive");

  const boards: BedSideTableResult["boards"] = [];
  const params = { width: W, depth: D, height: H, side, panelThickness: t, frontPanelThickness: fpt, carcassColor: color };
  const zones = errors.length ? [] : [{ id: "table" as const, x0: 0, x1: W, y0: 0, y1: D, z0: 0, z1: H }];
  return { params, zones, boards, features: [], validation: { errors, warnings } };
}
