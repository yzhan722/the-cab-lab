/**
 * Kitchen Base v0 generator.
 *
 * Cab Lab native, Small's floor-box carcass plus a toe-kick:
 * - Envelope H includes the plinth.
 * - Sides are full-height YZ plates with a front-bottom notch (cabinet-frame
 *   outline — cabinets3d extrudes YZ as-is).
 * - PLINTH_FRONT closes the kick at y = setback.
 * - BOTTOM sits on the plinth (z = P); zones stack in the carcass interior
 *   (H − P − 2×CPT).
 *
 * Not this pass: V-panel slots, wheel arch, B-system, Fusion kitchen columns.
 *
 * Coordinates: X left→right, Y front carcass (0) → back (D), Z floor→top.
 * Front panels sit at Y = -FPT .. 0, above the plinth.
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
  KitchenCabinetFeature,
  KitchenCabinetParams,
  KitchenCabinetResult,
  KitchenCabinetZoneType,
  LockCutout,
  ProfilePoint,
  ResolvedZone,
} from "./types.ts";

export const DEFAULT_CPT = 16;
export const DEFAULT_FPT = 16;
export const DEFAULT_CLEARANCE = 2.5;
export const DEFAULT_PLINTH_HEIGHT = 150;
export const DEFAULT_PLINTH_SETBACK = 50;
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

export function carcassInteriorHeight(cabinetHeight: number, plinthHeight: number, panelThickness: number): number {
  return round1(cabinetHeight - plinthHeight - 2 * panelThickness);
}

function normalizeZoneType(raw: unknown): KitchenCabinetZoneType | null {
  const t = String(raw || "").trim().toLowerCase();
  if (t === "left_door" || t === "left-door" || t === "left") return "left_door";
  if (t === "right_door" || t === "right-door" || t === "right") return "right_door";
  if (t === "drawer" || t === "draw") return "drawer";
  return null;
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

/** Cabinet-frame YZ outline: rectangle, or L with a front-bottom toe-kick. */
export function sideProfileWithKick(D: number, H: number, P: number, setback: number): ProfilePoint[] {
  if (setback < 1) {
    return [
      { y: 0, z: 0 },
      { y: D, z: 0 },
      { y: D, z: H },
      { y: 0, z: H },
      { y: 0, z: 0 },
    ];
  }
  return [
    { y: setback, z: 0 },
    { y: D, z: 0 },
    { y: D, z: H },
    { y: 0, z: H },
    { y: 0, z: P },
    { y: setback, z: P },
    { y: setback, z: 0 },
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
  P: number,
  setback: number,
  locksEnabled: boolean,
  lockSideDistance: number,
  leftSideDoorColor: boolean,
  rightSideDoorColor: boolean,
  carcassColor: string,
  carcassColorName: string,
  errors: string[],
  warnings: string[],
): KitchenCabinetResult {
  return {
    params: {
      cabinetWidth: W,
      cabinetDepth: D,
      cabinetHeight: H,
      panelThickness: CPT,
      frontPanelThickness: FPT,
      frontClearance: clearance,
      plinthHeight: P,
      plinthSetback: setback,
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

export function generateKitchenCabinet(params: KitchenCabinetParams): KitchenCabinetResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const W = round1(asNum(params.cabinetWidth));
  const D = round1(asNum(params.cabinetDepth));
  const H = round1(asNum(params.cabinetHeight));
  const CPT = round1(asNum(params.panelThickness, DEFAULT_CPT));
  const FPT = round1(asNum(params.frontPanelThickness, DEFAULT_FPT));
  const clearance = round1(asNum(params.frontClearance, DEFAULT_CLEARANCE));
  const P = round1(asNum(params.plinthHeight, DEFAULT_PLINTH_HEIGHT));
  const setback = round1(asNum(params.plinthSetback, DEFAULT_PLINTH_SETBACK));
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
  if (P <= 0) errors.push("plinthHeight must be > 0.");
  if (setback < 0) errors.push("plinthSetback must be >= 0.");
  if (setback >= D - CPT) errors.push("plinthSetback must be less than cabinetDepth − panelThickness.");
  if (H - P <= 2 * CPT) errors.push("plinthHeight leaves no carcass interior (cabinetHeight − plinthHeight must be greater than 2 × panelThickness).");

  const interiorH = carcassInteriorHeight(H, P, CPT);
  const rawZones = Array.isArray(params.zones) ? params.zones : [];
  if (rawZones.length < 1) errors.push("At least one functional zone is required.");

  const parsed: Array<{
    id: string;
    type: KitchenCabinetZoneType;
    height: number;
    lockEnabled: boolean;
    lockSideDistance: number;
  }> = [];
  for (let i = 0; i < rawZones.length; i += 1) {
    const zone = rawZones[i];
    const type = normalizeZoneType(zone?.type);
    const height = round1(asNum(zone?.height));
    if (!type) {
      errors.push(`Zone ${i + 1}: unsupported type "${zone?.type}". Use left_door, right_door, or drawer.`);
      continue;
    }
    if (height <= 0) {
      errors.push(`Zone ${i + 1}: height must be > 0.`);
      continue;
    }
    const isDoor = type === "left_door" || type === "right_door";
    parsed.push({
      id: String(zone?.id || `zone-${i + 1}`),
      type,
      height,
      lockEnabled: isDoor && locksEnabled && zone?.lockEnabled !== false,
      lockSideDistance: round1(asNum(zone?.lockSideDistance, defaultLockSideDistance)),
    });
  }

  const zoneHeightSum = round1(parsed.reduce((sum, z) => sum + z.height, 0));
  if (parsed.length > 0 && interiorH > 0 && Math.abs(zoneHeightSum - interiorH) > 0.05) {
    errors.push(
      `Zone heights sum to ${zoneHeightSum} mm but carcass interior is ${interiorH} mm (cabinetHeight − plinthHeight − 2×CPT).`,
    );
  }

  if (errors.length > 0) {
    return emptyParamsResult(
      W, D, H, CPT, FPT, clearance, P, setback, locksEnabled, defaultLockSideDistance,
      leftSideDoorColor, rightSideDoorColor, carcassColor, carcassColorName, errors, warnings,
    );
  }

  const boards: Board[] = [];
  const joinery: SmallCabinetFeature[] = [];
  const lockFeatures: KitchenCabinetFeature[] = [];
  const resolvedZones: ResolvedZone[] = [];
  const sideOutline = sideProfileWithKick(D, H, P, setback);

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
    notes: setback >= 1 ? [`Toe-kick notch ${setback} × ${P}`] : undefined,
    profileVector: sideOutline,
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
    notes: setback >= 1 ? [`Toe-kick notch ${setback} × ${P}`] : undefined,
    profileVector: sideOutline,
  });

  const plinth: Board = {
    id: "PLINTH_FRONT",
    name: "Plinth front",
    category: "plinth",
    boardType: "plinth_front",
    materialThickness: CPT,
    profilePlane: "XZ",
    thicknessAxis: "Y",
    x0: CPT,
    x1: W - CPT,
    y0: setback,
    y1: round1(setback + CPT),
    z0: 0,
    z1: P,
    notes: [`Set back ${setback} mm from carcass front`],
    profileVector: rectProfile("XZ", CPT, W - CPT, 0, P),
  };
  boards.push(plinth);

  const carcassFloor = P;
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
    z0: carcassFloor,
    z1: round1(carcassFloor + CPT),
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
    z0: round1(carcassFloor + CPT),
    z1: H - CPT,
    profileVector: rectProfile("XZ", CPT, W - CPT, carcassFloor + CPT, H - CPT),
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

    const front: Board = {
      id: `FP_${i + 1}`,
      name: `Front ${i + 1} (${zone.type})`,
      category: "front_panel",
      boardType,
      materialThickness: FPT,
      profilePlane: "XZ",
      thicknessAxis: "Y",
      x0: bounds.x0,
      x1: bounds.x1,
      y0: -FPT,
      y1: 0,
      z0: bounds.z0,
      z1: bounds.z1,
      hingeSide,
      zoneId: zone.id,
      notes: [`clearance ${bounds.sources.z0}/${bounds.sources.z1}`],
      profileVector: rectProfile("XZ", bounds.x0, bounds.x1, bounds.z0, bounds.z1),
    };

    if (zone.lockEnabled && hingeSide) {
      const handleIsRight = hingeSide === "left";
      const inset = zone.lockSideDistance;
      let centerX = handleIsRight ? front.x1 - inset : front.x0 + inset;
      let centerZ = front.z1 - inset;
      const halfW = LOCK_SLOT_WIDTH / 2;
      const halfH = LOCK_SLOT_LENGTH / 2;
      centerX = Math.max(front.x0 + halfW, Math.min(front.x1 - halfW, centerX));
      centerZ = Math.max(front.z0 + halfH, Math.min(front.z1 - halfH, centerZ));
      front.lockCutout = lockCutoutFromCenter(centerX, centerZ);
      front.thickness = FPT;
      lockFeatures.push({
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

    boards.push(front);
  }

  if (errors.length > 0) {
    return emptyParamsResult(
      W, D, H, CPT, FPT, clearance, P, setback, locksEnabled, defaultLockSideDistance,
      leftSideDoorColor, rightSideDoorColor, carcassColor, carcassColorName, errors, warnings,
    );
  }

  const features: KitchenCabinetFeature[] = [...(joinery as KitchenCabinetFeature[]), ...lockFeatures];
  return {
    params: {
      cabinetWidth: W,
      cabinetDepth: D,
      cabinetHeight: H,
      panelThickness: CPT,
      frontPanelThickness: FPT,
      frontClearance: clearance,
      plinthHeight: P,
      plinthSetback: setback,
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
      carcassFloor,
      boardFrame: "final",
      spec: {
        form: "floor_box_with_plinth",
        zoneTypes: ["left_door", "right_door", "drawer"],
      },
    },
  };
}

export type { KitchenCabinetParams, KitchenCabinetResult } from "./types.ts";
export { computeFrontPanelBounds } from "../smallCabinet/frontPanelCalculator.ts";
export {
  GROOVE_LENGTH_OVERSIZE,
  GROOVE_THICKNESS_OVERSIZE,
  shelfTongueYRange,
} from "../smallCabinet/shelfJoinery.ts";
