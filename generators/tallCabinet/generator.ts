/**
 * Tall Cabinet v0 generator.
 *
 * Cab Lab native, Small's floor-box carcass (full-depth sides). Not a Fusion
 * Style-1 stile copy: no rear 150 mm posts, no avoidance, no fridge kit.
 *
 * Spec (locked for v0):
 * - Floor box; zones stack top→bottom.
 * - Zone types: left_door | right_door | double_door | drawer | open.
 * - Boards: L/R sides (Y 0..D, Z 0..H), rear vertical, top, bottom, N-1 middles
 *   centered on zone boundaries, fronts at Y = -FPT..0. Open zones emit no front.
 * - double_door: two leaves meeting on centre with full frontClearance between them.
 * - Joinery: Small's through tongues / side grooves.
 *
 * Coordinates: X left→right, Y front carcass (0) → back (D), Z floor→top.
 */

import { computeFrontPanelBounds, frontPanelIsValid } from "../smallCabinet/frontPanelCalculator.ts";
import {
  applyBackJoinery,
  applyHorizontalJoinery,
  attachSideGrooveProfileFeatures,
} from "../smallCabinet/shelfJoinery.ts";
import type { Board as SmallBoard, SmallCabinetFeature } from "../smallCabinet/types.ts";
import type {
  Board,
  LockCutout,
  ProfilePoint,
  ResolvedZone,
  TallCabinetFeature,
  TallCabinetParams,
  TallCabinetResult,
  TallCabinetZoneType,
} from "./types.ts";

const DEFAULT_CPT = 16;
const DEFAULT_FPT = 16;
const DEFAULT_CLEARANCE = 2.5;
const DEFAULT_LOCK_SIDE_DISTANCE = 80;
const DEFAULT_CARCASS_COLOR = "White Stipple";
const LOCK_SLOT_LENGTH = 55;
const LOCK_SLOT_WIDTH = 15.5;
const LOCK_SLOT_RADIUS = 7.75;

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function asNum(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeZoneType(raw: unknown): TallCabinetZoneType | null {
  const t = String(raw || "").trim().toLowerCase();
  if (t === "left_door" || t === "left-door" || t === "left") return "left_door";
  if (t === "right_door" || t === "right-door" || t === "right") return "right_door";
  if (t === "double_door" || t === "double-door" || t === "double") return "double_door";
  if (t === "drawer" || t === "draw") return "drawer";
  if (t === "open" || t === "open_space" || t === "open-space") return "open";
  return null;
}

function zoneHasDoorLock(type: TallCabinetZoneType): boolean {
  return type === "left_door" || type === "right_door" || type === "double_door";
}

function rectProfile(
  plane: "XY" | "XZ" | "YZ",
  a0: number,
  a1: number,
  b0: number,
  b1: number,
): ProfilePoint[] {
  const w = Math.max(0, a1 - a0);
  const h = Math.max(0, b1 - b0);
  if (plane === "YZ") {
    return [
      { y: 0, z: 0 },
      { y: w, z: 0 },
      { y: w, z: h },
      { y: 0, z: h },
      { y: 0, z: 0 },
    ];
  }
  if (plane === "XZ") {
    return [
      { x: 0, z: 0 },
      { x: w, z: 0 },
      { x: w, z: h },
      { x: 0, z: h },
      { x: 0, z: 0 },
    ];
  }
  return [
    { x: 0, y: 0 },
    { x: w, y: 0 },
    { x: w, y: h },
    { x: 0, y: h },
    { x: 0, y: 0 },
  ];
}

function asSmallBoard(board: Board): SmallBoard {
  return board as unknown as SmallBoard;
}

function lockCutoutFromCenter(centerX: number, centerZ: number): LockCutout {
  return {
    x0: round1(centerX - LOCK_SLOT_WIDTH / 2),
    x1: round1(centerX + LOCK_SLOT_WIDTH / 2),
    z0: round1(centerZ - LOCK_SLOT_LENGTH / 2),
    z1: round1(centerZ + LOCK_SLOT_LENGTH / 2),
    radius: LOCK_SLOT_RADIUS,
    orientation: "vertical",
  };
}

function emptyParamsResult(
  W: number,
  D: number,
  H: number,
  CPT: number,
  FPT: number,
  clearance: number,
  locksEnabled: boolean,
  lockSideDistance: number,
  leftSideDoorColor: boolean,
  rightSideDoorColor: boolean,
  carcassColor: string,
  carcassColorName: string,
  errors: string[],
  warnings: string[],
): TallCabinetResult {
  return {
    params: {
      cabinetWidth: W,
      cabinetDepth: D,
      cabinetHeight: H,
      panelThickness: CPT,
      frontPanelThickness: FPT,
      frontClearance: clearance,
      locksEnabled,
      lockSideDistance,
      carcassColor,
      carcassColorName,
      leftSideDoorColor,
      rightSideDoorColor,
    },
    zones: [],
    boards: [],
    features: [],
    validation: { errors, warnings },
  };
}

function applyLock(
  front: Board,
  hingeSide: "left" | "right",
  inset: number,
  FPT: number,
  features: TallCabinetFeature[],
): void {
  const handleIsRight = hingeSide === "left";
  let centerX = handleIsRight ? front.x1 - inset : front.x0 + inset;
  let centerZ = front.z1 - inset;
  const halfW = LOCK_SLOT_WIDTH / 2;
  const halfH = LOCK_SLOT_LENGTH / 2;
  centerX = Math.max(front.x0 + halfW, Math.min(front.x1 - halfW, centerX));
  centerZ = Math.max(front.z0 + halfH, Math.min(front.z1 - halfH, centerZ));
  front.lockCutout = lockCutoutFromCenter(centerX, centerZ);
  front.thickness = FPT;
  features.push({
    id: `${front.id}_door_lock`,
    type: "door_lock",
    targetBoardId: front.id,
    x0: front.lockCutout.x0,
    x1: front.lockCutout.x1,
    z0: front.lockCutout.z0,
    z1: front.lockCutout.z1,
    source: "door_lock",
  });
  front.profileFeatures = [
    {
      id: `${front.id}_door_lock`,
      type: "door_lock",
      thickness: FPT,
      ...front.lockCutout,
    },
  ];
}

function makeFront(
  id: string,
  name: string,
  boardType: string,
  hingeSide: "left" | "right" | undefined,
  zoneId: string,
  FPT: number,
  x0: number,
  x1: number,
  z0: number,
  z1: number,
  note: string,
): Board {
  return {
    id,
    name,
    category: "front_panel",
    boardType,
    materialThickness: FPT,
    profilePlane: "XZ",
    thicknessAxis: "Y",
    x0,
    x1,
    y0: -FPT,
    y1: 0,
    z0,
    z1,
    hingeSide,
    zoneId,
    notes: [note],
    profileVector: rectProfile("XZ", x0, x1, z0, z1),
  };
}

export function generateTallCabinet(params: TallCabinetParams): TallCabinetResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const W = round1(asNum(params.cabinetWidth));
  const D = round1(asNum(params.cabinetDepth));
  const H = round1(asNum(params.cabinetHeight));
  const CPT = round1(asNum(params.panelThickness, DEFAULT_CPT));
  const FPT = round1(asNum(params.frontPanelThickness, DEFAULT_FPT));
  const clearance = round1(asNum(params.frontClearance, DEFAULT_CLEARANCE));
  const locksEnabled = params.locksEnabled !== false;
  const defaultLockSideDistance = round1(asNum(params.lockSideDistance, DEFAULT_LOCK_SIDE_DISTANCE));
  const leftSideDoorColor = Boolean(params.leftSideDoorColor);
  const rightSideDoorColor = Boolean(params.rightSideDoorColor);
  const carcassColor = String(params.carcassColor || DEFAULT_CARCASS_COLOR).trim() || DEFAULT_CARCASS_COLOR;
  const carcassColorName = String(params.carcassColorName || carcassColor).trim() || carcassColor;

  if (W <= 0) errors.push("cabinetWidth must be > 0.");
  if (D <= 0) errors.push("cabinetDepth must be > 0.");
  if (H <= 0) errors.push("cabinetHeight must be > 0.");
  if (CPT <= 0) errors.push("panelThickness must be > 0.");
  if (FPT <= 0) errors.push("frontPanelThickness must be > 0.");
  if (clearance < 0) errors.push("frontClearance must be >= 0.");
  if (W <= 2 * CPT) errors.push("cabinetWidth must be greater than 2 × panelThickness.");
  if (D <= CPT) errors.push("cabinetDepth must be greater than panelThickness.");
  if (H <= 2 * CPT) errors.push("cabinetHeight must be greater than 2 × panelThickness.");

  const interiorH = round1(H - 2 * CPT);
  const rawZones = Array.isArray(params.zones) ? params.zones : [];
  if (rawZones.length < 1) errors.push("At least one functional zone is required.");

  const parsed: Array<{
    id: string;
    type: TallCabinetZoneType;
    height: number;
    lockEnabled: boolean;
    lockSideDistance: number;
  }> = [];
  for (let i = 0; i < rawZones.length; i += 1) {
    const zone = rawZones[i];
    const type = normalizeZoneType(zone?.type);
    const height = round1(asNum(zone?.height));
    if (!type) {
      errors.push(`Zone ${i + 1}: unsupported type "${zone?.type}". Use left_door, right_door, double_door, drawer, or open.`);
      continue;
    }
    if (height <= 0) {
      errors.push(`Zone ${i + 1}: height must be > 0.`);
      continue;
    }
    parsed.push({
      id: String(zone?.id || `zone-${i + 1}`),
      type,
      height,
      lockEnabled: zoneHasDoorLock(type) && locksEnabled && zone?.lockEnabled !== false,
      lockSideDistance: round1(asNum(zone?.lockSideDistance, defaultLockSideDistance)),
    });
  }

  const zoneHeightSum = round1(parsed.reduce((sum, z) => sum + z.height, 0));
  if (parsed.length > 0 && Math.abs(zoneHeightSum - interiorH) > 0.05) {
    errors.push(
      `Zone heights sum to ${zoneHeightSum} mm but interior height is ${interiorH} mm (cabinetHeight − 2×CPT).`,
    );
  }

  if (errors.length > 0) {
    return emptyParamsResult(
      W, D, H, CPT, FPT, clearance, locksEnabled, defaultLockSideDistance,
      leftSideDoorColor, rightSideDoorColor, carcassColor, carcassColorName, errors, warnings,
    );
  }

  const boards: Board[] = [];
  const joinery: SmallCabinetFeature[] = [];
  const lockFeatures: TallCabinetFeature[] = [];
  const resolvedZones: ResolvedZone[] = [];

  boards.push({
    id: "SIDE_L",
    name: "Left side",
    category: "side_panel",
    boardType: "left_side_panel",
    materialThickness: CPT,
    profilePlane: "YZ",
    thicknessAxis: "X",
    x0: 0,
    x1: CPT,
    y0: 0,
    y1: D,
    z0: 0,
    z1: H,
    useDoorColor: leftSideDoorColor,
    profileVector: rectProfile("YZ", 0, D, 0, H),
  });
  boards.push({
    id: "SIDE_R",
    name: "Right side",
    category: "side_panel",
    boardType: "right_side_panel",
    materialThickness: CPT,
    profilePlane: "YZ",
    thicknessAxis: "X",
    x0: W - CPT,
    x1: W,
    y0: 0,
    y1: D,
    z0: 0,
    z1: H,
    useDoorColor: rightSideDoorColor,
    profileVector: rectProfile("YZ", 0, D, 0, H),
  });

  const bottom: Board = {
    id: "BOTTOM",
    name: "Bottom",
    category: "horizontal",
    boardType: "bottom_panel",
    materialThickness: CPT,
    profilePlane: "XY",
    thicknessAxis: "Z",
    x0: CPT,
    x1: W - CPT,
    y0: 0,
    y1: D - CPT,
    z0: 0,
    z1: CPT,
    profileVector: rectProfile("XY", CPT, W - CPT, 0, D - CPT),
  };
  const top: Board = {
    id: "TOP",
    name: "Top",
    category: "horizontal",
    boardType: "top_panel",
    materialThickness: CPT,
    profilePlane: "XY",
    thicknessAxis: "Z",
    x0: CPT,
    x1: W - CPT,
    y0: 0,
    y1: D - CPT,
    z0: H - CPT,
    z1: H,
    profileVector: rectProfile("XY", CPT, W - CPT, 0, D - CPT),
  };
  joinery.push(...applyHorizontalJoinery(asSmallBoard(bottom), CPT));
  joinery.push(...applyHorizontalJoinery(asSmallBoard(top), CPT));
  boards.push(bottom, top);

  const back: Board = {
    id: "BACK",
    name: "Rear vertical",
    category: "back_panel",
    boardType: "rear_vertical",
    materialThickness: CPT,
    profilePlane: "XZ",
    thicknessAxis: "Y",
    x0: CPT,
    x1: W - CPT,
    y0: D - CPT,
    y1: D,
    z0: CPT,
    z1: H - CPT,
    profileVector: rectProfile("XZ", CPT, W - CPT, CPT, H - CPT),
  };
  joinery.push(...applyBackJoinery(asSmallBoard(back), CPT));
  boards.push(back);

  let zCursor = H - CPT;
  for (let i = 0; i < parsed.length; i += 1) {
    const zone = parsed[i];
    const zTop = zCursor;
    const zBottom = round1(zCursor - zone.height);
    const hasMiddleAbove = i > 0;
    const hasMiddleBelow = i < parsed.length - 1;
    resolvedZones.push({
      id: zone.id,
      type: zone.type,
      height: zone.height,
      zTop,
      zBottom,
      clearZ1: round1(zTop - (hasMiddleAbove ? CPT / 2 : 0)),
      clearZ0: round1(zBottom + (hasMiddleBelow ? CPT / 2 : 0)),
      lockEnabled: zone.lockEnabled,
      lockSideDistance: zone.lockSideDistance,
    });
    zCursor = zBottom;
  }

  for (let i = 0; i < resolvedZones.length - 1; i += 1) {
    const boundaryZ = resolvedZones[i].zBottom;
    const mid: Board = {
      id: `MID_${i + 1}`,
      name: `Middle ${i + 1}`,
      category: "horizontal",
      boardType: "middle_shelf",
      materialThickness: CPT,
      profilePlane: "XY",
      thicknessAxis: "Z",
      x0: CPT,
      x1: W - CPT,
      y0: 0,
      y1: D - CPT,
      z0: round1(boundaryZ - CPT / 2),
      z1: round1(boundaryZ + CPT / 2),
      notes: [`Centered on boundary between ${resolvedZones[i].id} and ${resolvedZones[i + 1].id}`],
      profileVector: rectProfile("XY", CPT, W - CPT, 0, D - CPT),
    };
    joinery.push(...applyHorizontalJoinery(asSmallBoard(mid), CPT));
    boards.push(mid);
  }

  const sideL = boards.find((b) => b.id === "SIDE_L");
  const sideR = boards.find((b) => b.id === "SIDE_R");
  if (sideL) attachSideGrooveProfileFeatures(asSmallBoard(sideL), joinery);
  if (sideR) attachSideGrooveProfileFeatures(asSmallBoard(sideR), joinery);

  for (let i = 0; i < resolvedZones.length; i += 1) {
    const zone = resolvedZones[i];
    if (zone.type === "open") continue;

    const bounds = computeFrontPanelBounds({
      cabinetWidth: W,
      cabinetHeight: H,
      panelThickness: CPT,
      frontClearance: clearance,
      zone,
      zoneIndex: i,
      zones: resolvedZones,
    });
    if (!frontPanelIsValid(bounds)) {
      errors.push(`Zone ${zone.id}: front panel degenerates after clearance.`);
      continue;
    }

    const note = `clearance ${bounds.sources.z0}/${bounds.sources.z1}`;
    if (zone.type === "double_door") {
      const mid = round1((bounds.x0 + bounds.x1) / 2);
      const leftX1 = round1(mid - clearance / 2);
      const rightX0 = round1(mid + clearance / 2);
      if (leftX1 - bounds.x0 < 1 || bounds.x1 - rightX0 < 1) {
        errors.push(`Zone ${zone.id}: double door leaves degenerate after clearance.`);
        continue;
      }
      const left = makeFront(`FP_${i + 1}L`, `Front ${i + 1} left`, "left_door", "left", zone.id, FPT, bounds.x0, leftX1, bounds.z0, bounds.z1, note);
      const right = makeFront(`FP_${i + 1}R`, `Front ${i + 1} right`, "right_door", "right", zone.id, FPT, rightX0, bounds.x1, bounds.z0, bounds.z1, note);
      if (zone.lockEnabled) {
        applyLock(left, "left", zone.lockSideDistance, FPT, lockFeatures);
        applyLock(right, "right", zone.lockSideDistance, FPT, lockFeatures);
      }
      boards.push(left, right);
      continue;
    }

    let boardType: string;
    let hingeSide: "left" | "right" | undefined;
    if (zone.type === "left_door") {
      boardType = "left_door";
      hingeSide = "left";
    } else if (zone.type === "right_door") {
      boardType = "right_door";
      hingeSide = "right";
    } else {
      boardType = "drawer_front";
    }
    const front = makeFront(`FP_${i + 1}`, `Front ${i + 1} (${zone.type})`, boardType, hingeSide, zone.id, FPT, bounds.x0, bounds.x1, bounds.z0, bounds.z1, note);
    if (zone.lockEnabled && hingeSide) applyLock(front, hingeSide, zone.lockSideDistance, FPT, lockFeatures);
    boards.push(front);
  }

  if (errors.length > 0) {
    return emptyParamsResult(
      W, D, H, CPT, FPT, clearance, locksEnabled, defaultLockSideDistance,
      leftSideDoorColor, rightSideDoorColor, carcassColor, carcassColorName, errors, warnings,
    );
  }

  const features: TallCabinetFeature[] = [...(joinery as TallCabinetFeature[]), ...lockFeatures];
  return {
    params: {
      cabinetWidth: W,
      cabinetDepth: D,
      cabinetHeight: H,
      panelThickness: CPT,
      frontPanelThickness: FPT,
      frontClearance: clearance,
      locksEnabled,
      lockSideDistance: defaultLockSideDistance,
      carcassColor,
      carcassColorName,
      leftSideDoorColor,
      rightSideDoorColor,
    },
    zones: resolvedZones,
    boards,
    features,
    validation: { errors, warnings },
    debug: {
      interiorHeight: interiorH,
      zoneHeightSum,
      boardFrame: "final",
      spec: {
        form: "simple_floor_box",
        zoneTypes: ["left_door", "right_door", "double_door", "drawer", "open"],
      },
    },
  };
}

export type { TallCabinetParams, TallCabinetResult } from "./types.ts";
export { computeFrontPanelBounds } from "../smallCabinet/frontPanelCalculator.ts";
export {
  GROOVE_LENGTH_OVERSIZE,
  GROOVE_THICKNESS_OVERSIZE,
  shelfTongueYRange,
} from "../smallCabinet/shelfJoinery.ts";
