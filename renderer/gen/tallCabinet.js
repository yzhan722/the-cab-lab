// Generated from generators/tallCabinet/generator.ts - do not edit.

// generators/smallCabinet/frontPanelCalculator.ts
function round1(value) {
  return Math.round(value * 10) / 10;
}
function zoneHasFront(type) {
  return type === "left_door" || type === "right_door" || type === "drawer" || type === "double_door";
}
function computeFrontPanelBounds(input) {
  const W = input.cabinetWidth;
  const H = input.cabinetHeight;
  const CPT = input.panelThickness;
  const FC = input.frontClearance;
  const { zone, zoneIndex, zones } = input;
  const x0 = round1(FC);
  const x1 = round1(W - FC);
  const above = zoneIndex > 0 ? zones[zoneIndex - 1] : null;
  const below = zoneIndex < zones.length - 1 ? zones[zoneIndex + 1] : null;
  let z0;
  let z0Source;
  if (below && zoneHasFront(below.type)) {
    z0 = round1(zone.zBottom + FC / 2);
    z0Source = "mid_center_plus_half_fc";
  } else {
    z0 = round1(zone.clearZ0 + FC);
    z0Source = below ? "clear_plus_fc_open_neighbor" : "bottom_face_plus_fc";
  }
  let z1;
  let z1Source;
  if (above && zoneHasFront(above.type)) {
    z1 = round1(zone.zTop - FC / 2);
    z1Source = "mid_center_minus_half_fc";
  } else {
    z1 = round1(zone.clearZ1 - FC);
    z1Source = above ? "clear_minus_fc_open_neighbor" : "top_face_minus_fc";
  }
  return {
    x0,
    x1,
    z0,
    z1,
    sources: { x: "outer_fc", z0: z0Source, z1: z1Source }
  };
}
function frontPanelIsValid(bounds, eps = 1e-6) {
  return bounds.x1 - bounds.x0 > eps && bounds.z1 - bounds.z0 > eps;
}

// generators/smallCabinet/shelfJoinery.ts
var SHELF_TONGUE_DEPTH_FRACTION = 1 / 3;
var GROOVE_LENGTH_OVERSIZE = 5;
var GROOVE_THICKNESS_OVERSIZE = 0.5;
function round12(value) {
  return Math.round(value * 10) / 10;
}
function centeredThirdRange(spanStart, spanEnd) {
  const span = spanEnd - spanStart;
  const length = span * SHELF_TONGUE_DEPTH_FRACTION;
  const a0 = round12(spanStart + (span - length) / 2);
  const a1 = round12(a0 + length);
  return { a0, a1 };
}
function shelfTongueYRange(shelfY0, shelfY1) {
  const { a0, a1 } = centeredThirdRange(shelfY0, shelfY1);
  return { tongueY0: a0, tongueY1: a1 };
}
function shelfProfileWithTongues(bodyX0, bodyX1, y0, y1, tongueLength, tongueY0, tongueY1) {
  const left = Math.max(0, tongueLength);
  const right = Math.max(0, tongueLength);
  return [
    { x: bodyX0, y: y0 },
    { x: bodyX1, y: y0 },
    { x: bodyX1, y: tongueY0 },
    { x: bodyX1 + right, y: tongueY0 },
    { x: bodyX1 + right, y: tongueY1 },
    { x: bodyX1, y: tongueY1 },
    { x: bodyX1, y: y1 },
    { x: bodyX0, y: y1 },
    { x: bodyX0, y: tongueY1 },
    { x: bodyX0 - left, y: tongueY1 },
    { x: bodyX0 - left, y: tongueY0 },
    { x: bodyX0, y: tongueY0 },
    { x: bodyX0, y: y0 }
  ];
}
function backProfileWithTongues(bodyX0, bodyX1, z0, z1, tongueLength, tongueZ0, tongueZ1) {
  const left = Math.max(0, tongueLength);
  const right = Math.max(0, tongueLength);
  return [
    { x: bodyX0, z: z0 },
    { x: bodyX1, z: z0 },
    { x: bodyX1, z: tongueZ0 },
    { x: bodyX1 + right, z: tongueZ0 },
    { x: bodyX1 + right, z: tongueZ1 },
    { x: bodyX1, z: tongueZ1 },
    { x: bodyX1, z: z1 },
    { x: bodyX0, z: z1 },
    { x: bodyX0, z: tongueZ1 },
    { x: bodyX0 - left, z: tongueZ1 },
    { x: bodyX0 - left, z: tongueZ0 },
    { x: bodyX0, z: tongueZ0 },
    { x: bodyX0, z: z0 }
  ];
}
function buildShelfTongueSpec(shelf, panelThickness) {
  const bodyX0 = shelf.x0;
  const bodyX1 = shelf.x1;
  const { tongueY0, tongueY1 } = shelfTongueYRange(shelf.y0, shelf.y1);
  return {
    shelfId: shelf.id,
    bodyX0,
    bodyX1,
    y0: shelf.y0,
    y1: shelf.y1,
    tongueY0,
    tongueY1,
    // Through tongue so side groove reads on the outer face (matches Fusion visual).
    tongueLength: round12(panelThickness),
    z0: shelf.z0,
    z1: shelf.z1
  };
}
function buildBackTongueSpec(back, panelThickness) {
  const { a0: tongueZ0, a1: tongueZ1 } = centeredThirdRange(back.z0, back.z1);
  return {
    backId: back.id,
    bodyX0: back.x0,
    bodyX1: back.x1,
    y0: back.y0,
    y1: back.y1,
    z0: back.z0,
    z1: back.z1,
    tongueZ0,
    tongueZ1,
    tongueLength: round12(panelThickness)
  };
}
function applyShelfTongues(shelf, spec) {
  shelf.x0 = round12(spec.bodyX0 - spec.tongueLength);
  shelf.x1 = round12(spec.bodyX1 + spec.tongueLength);
  shelf.profileVector = shelfProfileWithTongues(
    spec.bodyX0,
    spec.bodyX1,
    spec.y0,
    spec.y1,
    spec.tongueLength,
    spec.tongueY0,
    spec.tongueY1
  );
  shelf.notes = [
    ...shelf.notes || [],
    `Tongues length=${spec.tongueLength} Y=${spec.tongueY0}..${spec.tongueY1} (depth/3, through)`
  ];
}
function applyBackTongues(back, spec) {
  back.x0 = round12(spec.bodyX0 - spec.tongueLength);
  back.x1 = round12(spec.bodyX1 + spec.tongueLength);
  back.profileVector = backProfileWithTongues(
    spec.bodyX0,
    spec.bodyX1,
    spec.z0,
    spec.z1,
    spec.tongueLength,
    spec.tongueZ0,
    spec.tongueZ1
  );
  back.notes = [
    ...back.notes || [],
    `Tongues length=${spec.tongueLength} Z=${spec.tongueZ0}..${spec.tongueZ1} (height/3, through)`
  ];
}
function buildShelfJoineryFeatures(spec) {
  const grooveY0 = round12(spec.tongueY0 - GROOVE_LENGTH_OVERSIZE);
  const grooveY1 = round12(spec.tongueY1 + GROOVE_LENGTH_OVERSIZE);
  const grooveZ0 = round12(spec.z0 - GROOVE_THICKNESS_OVERSIZE);
  const grooveZ1 = round12(spec.z1 + GROOVE_THICKNESS_OVERSIZE);
  const depth = spec.tongueLength;
  return [
    {
      id: `${spec.shelfId}_tongue_L`,
      type: "shelf_tongue",
      targetBoardId: spec.shelfId,
      relatedBoardId: "SIDE_L",
      side: "left",
      y0: spec.tongueY0,
      y1: spec.tongueY1,
      z0: spec.z0,
      z1: spec.z1,
      insertionDepth: depth,
      source: "shelf_joinery"
    },
    {
      id: `${spec.shelfId}_tongue_R`,
      type: "shelf_tongue",
      targetBoardId: spec.shelfId,
      relatedBoardId: "SIDE_R",
      side: "right",
      y0: spec.tongueY0,
      y1: spec.tongueY1,
      z0: spec.z0,
      z1: spec.z1,
      insertionDepth: depth,
      source: "shelf_joinery"
    },
    {
      id: `SIDE_L_${spec.shelfId}_groove`,
      type: "side_groove",
      targetBoardId: "SIDE_L",
      relatedBoardId: spec.shelfId,
      side: "left",
      y0: grooveY0,
      y1: grooveY1,
      z0: grooveZ0,
      z1: grooveZ1,
      depth,
      source: "shelf_joinery"
    },
    {
      id: `SIDE_R_${spec.shelfId}_groove`,
      type: "side_groove",
      targetBoardId: "SIDE_R",
      relatedBoardId: spec.shelfId,
      side: "right",
      y0: grooveY0,
      y1: grooveY1,
      z0: grooveZ0,
      z1: grooveZ1,
      depth,
      source: "shelf_joinery"
    }
  ];
}
function buildBackJoineryFeatures(spec) {
  const grooveZ0 = round12(spec.tongueZ0 - GROOVE_LENGTH_OVERSIZE);
  const grooveZ1 = round12(spec.tongueZ1 + GROOVE_LENGTH_OVERSIZE);
  const grooveY0 = round12(spec.y0 - GROOVE_THICKNESS_OVERSIZE);
  const grooveY1 = round12(spec.y1 + GROOVE_THICKNESS_OVERSIZE);
  const depth = spec.tongueLength;
  return [
    {
      id: `${spec.backId}_tongue_L`,
      type: "back_tongue",
      targetBoardId: spec.backId,
      relatedBoardId: "SIDE_L",
      side: "left",
      y0: spec.y0,
      y1: spec.y1,
      z0: spec.tongueZ0,
      z1: spec.tongueZ1,
      insertionDepth: depth,
      source: "back_joinery"
    },
    {
      id: `${spec.backId}_tongue_R`,
      type: "back_tongue",
      targetBoardId: spec.backId,
      relatedBoardId: "SIDE_R",
      side: "right",
      y0: spec.y0,
      y1: spec.y1,
      z0: spec.tongueZ0,
      z1: spec.tongueZ1,
      insertionDepth: depth,
      source: "back_joinery"
    },
    {
      id: `SIDE_L_${spec.backId}_groove`,
      type: "side_groove",
      targetBoardId: "SIDE_L",
      relatedBoardId: spec.backId,
      side: "left",
      y0: grooveY0,
      y1: grooveY1,
      z0: grooveZ0,
      z1: grooveZ1,
      depth,
      source: "back_joinery"
    },
    {
      id: `SIDE_R_${spec.backId}_groove`,
      type: "side_groove",
      targetBoardId: "SIDE_R",
      relatedBoardId: spec.backId,
      side: "right",
      y0: grooveY0,
      y1: grooveY1,
      z0: grooveZ0,
      z1: grooveZ1,
      depth,
      source: "back_joinery"
    }
  ];
}
function attachSideGrooveProfileFeatures(side, features) {
  const grooves = features.filter(
    (feature) => feature.type === "side_groove" && feature.targetBoardId === side.id
  );
  if (!grooves.length) return;
  side.profileFeatures = [
    ...side.profileFeatures || [],
    ...grooves.map((groove) => ({
      id: groove.id,
      type: "side_groove",
      y0: groove.y0,
      y1: groove.y1,
      z0: groove.z0,
      z1: groove.z1,
      depth: groove.depth,
      relatedBoardId: groove.relatedBoardId,
      source: groove.source
    }))
  ];
}
function applyHorizontalJoinery(board, panelThickness) {
  const spec = buildShelfTongueSpec(board, panelThickness);
  applyShelfTongues(board, spec);
  return buildShelfJoineryFeatures(spec);
}
function applyBackJoinery(board, panelThickness) {
  const spec = buildBackTongueSpec(board, panelThickness);
  applyBackTongues(board, spec);
  return buildBackJoineryFeatures(spec);
}

// generators/tallCabinet/generator.ts
var DEFAULT_CPT = 16;
var DEFAULT_FPT = 16;
var DEFAULT_CLEARANCE = 2.5;
var DEFAULT_LOCK_SIDE_DISTANCE = 80;
var DEFAULT_CARCASS_COLOR = "White Stipple";
var LOCK_SLOT_LENGTH = 55;
var LOCK_SLOT_WIDTH = 15.5;
var LOCK_SLOT_RADIUS = 7.75;
function round13(value) {
  return Math.round(value * 10) / 10;
}
function asNum(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}
function normalizeZoneType(raw) {
  const t = String(raw || "").trim().toLowerCase();
  if (t === "left_door" || t === "left-door" || t === "left") return "left_door";
  if (t === "right_door" || t === "right-door" || t === "right") return "right_door";
  if (t === "double_door" || t === "double-door" || t === "double") return "double_door";
  if (t === "drawer" || t === "draw") return "drawer";
  if (t === "open" || t === "open_space" || t === "open-space") return "open";
  return null;
}
function zoneHasDoorLock(type) {
  return type === "left_door" || type === "right_door" || type === "double_door";
}
function rectProfile(plane, a0, a1, b0, b1) {
  const w = Math.max(0, a1 - a0);
  const h = Math.max(0, b1 - b0);
  if (plane === "YZ") {
    return [
      { y: 0, z: 0 },
      { y: w, z: 0 },
      { y: w, z: h },
      { y: 0, z: h },
      { y: 0, z: 0 }
    ];
  }
  if (plane === "XZ") {
    return [
      { x: 0, z: 0 },
      { x: w, z: 0 },
      { x: w, z: h },
      { x: 0, z: h },
      { x: 0, z: 0 }
    ];
  }
  return [
    { x: 0, y: 0 },
    { x: w, y: 0 },
    { x: w, y: h },
    { x: 0, y: h },
    { x: 0, y: 0 }
  ];
}
function asSmallBoard(board) {
  return board;
}
function lockCutoutFromCenter(centerX, centerZ) {
  return {
    x0: round13(centerX - LOCK_SLOT_WIDTH / 2),
    x1: round13(centerX + LOCK_SLOT_WIDTH / 2),
    z0: round13(centerZ - LOCK_SLOT_LENGTH / 2),
    z1: round13(centerZ + LOCK_SLOT_LENGTH / 2),
    radius: LOCK_SLOT_RADIUS,
    orientation: "vertical"
  };
}
function emptyParamsResult(W, D, H, CPT, FPT, clearance, locksEnabled, lockSideDistance, leftSideDoorColor, rightSideDoorColor, carcassColor, carcassColorName, errors, warnings) {
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
      rightSideDoorColor
    },
    zones: [],
    boards: [],
    features: [],
    validation: { errors, warnings }
  };
}
function applyLock(front, hingeSide, inset, FPT, features) {
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
    source: "door_lock"
  });
  front.profileFeatures = [
    {
      id: `${front.id}_door_lock`,
      type: "door_lock",
      thickness: FPT,
      ...front.lockCutout
    }
  ];
}
function makeFront(id, name, boardType, hingeSide, zoneId, FPT, x0, x1, z0, z1, note) {
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
    profileVector: rectProfile("XZ", x0, x1, z0, z1)
  };
}
function generateTallCabinet(params) {
  const errors = [];
  const warnings = [];
  const W = round13(asNum(params.cabinetWidth));
  const D = round13(asNum(params.cabinetDepth));
  const H = round13(asNum(params.cabinetHeight));
  const CPT = round13(asNum(params.panelThickness, DEFAULT_CPT));
  const FPT = round13(asNum(params.frontPanelThickness, DEFAULT_FPT));
  const clearance = round13(asNum(params.frontClearance, DEFAULT_CLEARANCE));
  const locksEnabled = params.locksEnabled !== false;
  const defaultLockSideDistance = round13(asNum(params.lockSideDistance, DEFAULT_LOCK_SIDE_DISTANCE));
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
  if (W <= 2 * CPT) errors.push("cabinetWidth must be greater than 2 \xD7 panelThickness.");
  if (D <= CPT) errors.push("cabinetDepth must be greater than panelThickness.");
  if (H <= 2 * CPT) errors.push("cabinetHeight must be greater than 2 \xD7 panelThickness.");
  const interiorH = round13(H - 2 * CPT);
  const rawZones = Array.isArray(params.zones) ? params.zones : [];
  if (rawZones.length < 1) errors.push("At least one functional zone is required.");
  const parsed = [];
  for (let i = 0; i < rawZones.length; i += 1) {
    const zone = rawZones[i];
    const type = normalizeZoneType(zone?.type);
    const height = round13(asNum(zone?.height));
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
      lockSideDistance: round13(asNum(zone?.lockSideDistance, defaultLockSideDistance))
    });
  }
  const zoneHeightSum = round13(parsed.reduce((sum, z) => sum + z.height, 0));
  if (parsed.length > 0 && Math.abs(zoneHeightSum - interiorH) > 0.05) {
    errors.push(
      `Zone heights sum to ${zoneHeightSum} mm but interior height is ${interiorH} mm (cabinetHeight \u2212 2\xD7CPT).`
    );
  }
  if (errors.length > 0) {
    return emptyParamsResult(
      W,
      D,
      H,
      CPT,
      FPT,
      clearance,
      locksEnabled,
      defaultLockSideDistance,
      leftSideDoorColor,
      rightSideDoorColor,
      carcassColor,
      carcassColorName,
      errors,
      warnings
    );
  }
  const boards = [];
  const joinery = [];
  const lockFeatures = [];
  const resolvedZones = [];
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
    profileVector: rectProfile("YZ", 0, D, 0, H)
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
    profileVector: rectProfile("YZ", 0, D, 0, H)
  });
  const bottom = {
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
    profileVector: rectProfile("XY", CPT, W - CPT, 0, D - CPT)
  };
  const top = {
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
    profileVector: rectProfile("XY", CPT, W - CPT, 0, D - CPT)
  };
  joinery.push(...applyHorizontalJoinery(asSmallBoard(bottom), CPT));
  joinery.push(...applyHorizontalJoinery(asSmallBoard(top), CPT));
  boards.push(bottom, top);
  const back = {
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
    profileVector: rectProfile("XZ", CPT, W - CPT, CPT, H - CPT)
  };
  joinery.push(...applyBackJoinery(asSmallBoard(back), CPT));
  boards.push(back);
  let zCursor = H - CPT;
  for (let i = 0; i < parsed.length; i += 1) {
    const zone = parsed[i];
    const zTop = zCursor;
    const zBottom = round13(zCursor - zone.height);
    const hasMiddleAbove = i > 0;
    const hasMiddleBelow = i < parsed.length - 1;
    resolvedZones.push({
      id: zone.id,
      type: zone.type,
      height: zone.height,
      zTop,
      zBottom,
      clearZ1: round13(zTop - (hasMiddleAbove ? CPT / 2 : 0)),
      clearZ0: round13(zBottom + (hasMiddleBelow ? CPT / 2 : 0)),
      lockEnabled: zone.lockEnabled,
      lockSideDistance: zone.lockSideDistance
    });
    zCursor = zBottom;
  }
  for (let i = 0; i < resolvedZones.length - 1; i += 1) {
    const boundaryZ = resolvedZones[i].zBottom;
    const mid = {
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
      z0: round13(boundaryZ - CPT / 2),
      z1: round13(boundaryZ + CPT / 2),
      notes: [`Centered on boundary between ${resolvedZones[i].id} and ${resolvedZones[i + 1].id}`],
      profileVector: rectProfile("XY", CPT, W - CPT, 0, D - CPT)
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
      zones: resolvedZones
    });
    if (!frontPanelIsValid(bounds)) {
      errors.push(`Zone ${zone.id}: front panel degenerates after clearance.`);
      continue;
    }
    const note = `clearance ${bounds.sources.z0}/${bounds.sources.z1}`;
    if (zone.type === "double_door") {
      const mid = round13((bounds.x0 + bounds.x1) / 2);
      const leftX1 = round13(mid - clearance / 2);
      const rightX0 = round13(mid + clearance / 2);
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
    let boardType;
    let hingeSide;
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
      W,
      D,
      H,
      CPT,
      FPT,
      clearance,
      locksEnabled,
      defaultLockSideDistance,
      leftSideDoorColor,
      rightSideDoorColor,
      carcassColor,
      carcassColorName,
      errors,
      warnings
    );
  }
  const features = [...joinery, ...lockFeatures];
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
      rightSideDoorColor
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
        zoneTypes: ["left_door", "right_door", "double_door", "drawer", "open"]
      }
    }
  };
}
export {
  GROOVE_LENGTH_OVERSIZE,
  GROOVE_THICKNESS_OVERSIZE,
  computeFrontPanelBounds,
  generateTallCabinet,
  shelfTongueYRange
};
