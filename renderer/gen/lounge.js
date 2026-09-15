// Generated from generators/lounge/generator.ts - do not edit.

// generators/lounge/relationshipDeclarations.ts
var LOUNGE_RELATIONSHIP_DECLARATIONS = [
  {
    declarationId: "lg_main_front_to_top",
    generator: "lounge",
    panelAId: "main_front",
    panelBId: "main_top",
    relationshipType: "structural_butt_joint",
    geometryType: "edge_to_surface",
    hostPanelId: "main_front",
    targetPanelId: "main_top",
    ruleId: "lounge_main_front_top_v1",
    allowedHardware: ["screw_hole"]
  },
  {
    declarationId: "lg_l_front_to_side",
    generator: "lounge",
    panelAId: "l_front",
    panelBId: "l_side",
    relationshipType: "structural_butt_joint",
    geometryType: "edge_to_surface",
    hostPanelId: "l_front",
    targetPanelId: "l_side",
    ruleId: "lounge_l_front_side_v1",
    allowedHardware: ["screw_hole"]
  },
  {
    declarationId: "lg_l_front_to_top",
    generator: "lounge",
    panelAId: "l_front",
    panelBId: "l_top",
    relationshipType: "structural_butt_joint",
    geometryType: "edge_to_surface",
    hostPanelId: "l_front",
    targetPanelId: "l_top",
    ruleId: "lounge_l_front_top_v1",
    allowedHardware: ["screw_hole"]
  }
];
function relationshipDeclarationsForPanels(panels) {
  const panelIds = new Set(panels.map((panel) => panel.id));
  return LOUNGE_RELATIONSHIP_DECLARATIONS.filter((item) => {
    const required = /* @__PURE__ */ new Set([item.panelAId, item.panelBId, item.hostPanelId, item.targetPanelId]);
    for (const panelId of required) {
      if (!panelIds.has(panelId)) {
        return false;
      }
    }
    return true;
  });
}

// generators/lounge/generator.ts
var DEFAULT_HEIGHT = 420;
var DEFAULT_PPT = 18;
var OPENING_RADIUS = 50;
var LID_CLEARANCE_EACH_SIDE = 1.5;
var FINGER_HOLE_DIAMETER = 40;
function withRelationshipDeclarations(result) {
  return {
    ...result,
    relationshipDeclarations: relationshipDeclarationsForPanels(result.panels)
  };
}
function lSupportOuter(length, profileHeight) {
  const safeLength = Math.max(0, length);
  const safeHeight = Math.max(0, profileHeight);
  const returnDepth = Math.min(100, safeLength);
  const topDropZ = Math.max(0, safeHeight - 100);
  return [[0, 0], [0, safeHeight], [safeLength, safeHeight], [safeLength, topDropZ], [returnDepth, topDropZ], [returnDepth, 0], [0, 0]];
}
function num(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
function normalizeSettings(input) {
  return {
    style: input.style || "L_SHAPE",
    height: num(input.height, DEFAULT_HEIGHT),
    partitionPanelThickness: num(input.partitionPanelThickness, DEFAULT_PPT),
    wheelAvoidanceEnabled: input.wheelAvoidanceEnabled === true,
    mainWidth: num(input.mainWidth, 2e3),
    mainDepth: num(input.mainDepth, 600),
    lWidth: num(input.lWidth, 1600),
    lDepth: num(input.lDepth, 800),
    lPosition: input.lPosition || "RIGHT",
    topLidEnabled: input.topLidEnabled !== false,
    lFrontAccess: input.lFrontAccess || "NONE",
    totalWidth: num(input.totalWidth, 4e3),
    singleLoungeWidth: num(input.singleLoungeWidth, 1500),
    depth: num(input.depth, 800),
    avoidanceDepth: num(input.avoidanceDepth, 300),
    avoidanceHeight: num(input.avoidanceHeight, 250),
    hasMiddleCabinet: input.hasMiddleCabinet === true,
    middleCabinet: {
      width: num(input.middleCabinet?.width, 600),
      depth: num(input.middleCabinet?.depth, 350),
      height: num(input.middleCabinet?.height, 500),
      startHeight: num(input.middleCabinet?.startHeight, 300),
      doorPanelThickness: num(input.middleCabinet?.doorPanelThickness, 15),
      doorClearance: num(input.middleCabinet?.doorClearance, 2),
      doorLockStyle: input.middleCabinet?.doorLockStyle === "NONE" ? "NONE" : "RAZOR_ROUNDED",
      lockSideDistance: num(input.middleCabinet?.lockSideDistance, 30),
      hingeSideDistance: num(input.middleCabinet?.hingeSideDistance, 80),
      hingeCupCenterFromEdge: num(input.middleCabinet?.hingeCupCenterFromEdge, 22.5),
      hingeCupDiameter: num(input.middleCabinet?.hingeCupDiameter, 35),
      hingeCupDepth: num(input.middleCabinet?.hingeCupDepth, 12.5)
    }
  };
}
function loungeLBounds(state) {
  if (state.lPosition === "LEFT") {
    return { x0: 0, x1: state.lWidth, y0: 0, y1: state.lDepth };
  }
  return { x0: state.mainWidth - state.lWidth, x1: state.mainWidth, y0: 0, y1: state.lDepth };
}
function loungeMainVisibleBounds(state) {
  if (state.lPosition === "LEFT") {
    return { x0: state.lWidth, x1: state.mainWidth, y0: 0, y1: state.mainDepth };
  }
  return { x0: 0, x1: state.mainWidth - state.lWidth, y0: 0, y1: state.mainDepth };
}
function openingForPanel(panelId, width, depth, ppt) {
  return {
    id: `${panelId}_opening`,
    panelId,
    x0: width / 4,
    x1: width * 3 / 4,
    y0: depth / 4,
    y1: depth * 3 / 4,
    width: width / 2,
    depth: depth / 2,
    radius: OPENING_RADIUS,
    stepWidth: ppt / 2,
    stepHeight: ppt / 2
  };
}
function lidForOpening(panelName, opening, ppt, sourceBounds, loungeHeight) {
  const width = Math.max(0, opening.width - LID_CLEARANCE_EACH_SIDE * 2);
  const depth = Math.max(0, opening.depth - LID_CLEARANCE_EACH_SIDE * 2);
  const x0 = sourceBounds.x0 + opening.x0 + LID_CLEARANCE_EACH_SIDE;
  const y0 = sourceBounds.y0 + opening.y0 + LID_CLEARANCE_EACH_SIDE;
  return {
    id: `${opening.panelId}_lid`,
    name: `${panelName} Lid`,
    kind: "lid",
    profilePlane: "XY",
    width,
    depth,
    thickness: ppt,
    radius: OPENING_RADIUS - LID_CLEARANCE_EACH_SIDE,
    stepWidth: ppt / 2,
    stepHeight: ppt / 2,
    fingerHoleDiameter: FINGER_HOLE_DIAMETER,
    fingerHole: {
      diameter: FINGER_HOLE_DIAMETER,
      centerX: width / 2,
      centerY: depth / 2,
      through: true
    },
    placement: {
      x0,
      x1: x0 + width,
      y0,
      y1: y0 + depth,
      z0: loungeHeight - ppt,
      z1: loungeHeight
    },
    outer: [[0, 0], [width, 0], [width, depth], [0, depth], [0, 0]]
  };
}
function addTopPanel(panels, openings, lids, id, name, width, depth, ppt, sourceBounds, loungeHeight, topLidEnabled) {
  const panel = {
    id,
    name,
    kind: "top_panel",
    profilePlane: "XY",
    width,
    depth,
    height: ppt,
    thickness: ppt,
    outer: [[0, 0], [width, 0], [width, depth], [0, depth], [0, 0]],
    sourceBounds,
    placement: {
      x0: sourceBounds.x0,
      x1: sourceBounds.x1,
      y0: sourceBounds.y0,
      y1: sourceBounds.y1,
      z0: loungeHeight - ppt,
      z1: loungeHeight
    }
  };
  if (topLidEnabled) {
    const opening = openingForPanel(id, width, depth, ppt);
    panel.opening = opening;
    openings.push(opening);
    lids.push(lidForOpening(name, opening, ppt, sourceBounds, loungeHeight));
  }
  panels.push(panel);
}
function loungeWarnings(state) {
  const warnings = [];
  if (!(state.lWidth < state.mainWidth)) warnings.push("L Width should be less than Main Width for a valid L footprint.");
  if (state.style !== "L_SHAPE") warnings.push("Only L-Shaped Lounge is implemented in this phase.");
  if (state.lFrontAccess !== "NONE") warnings.push("Drawer/Flap access is a UI placeholder and does not affect geometry yet.");
  if (state.wheelAvoidanceEnabled) warnings.push("Wheel arch avoidance is a UI placeholder in the Lounge phase 1 geometry.");
  return warnings;
}
function parallelWarnings(state) {
  const warnings = [];
  const gap = state.totalWidth - state.singleLoungeWidth * 2;
  if (gap < 0) warnings.push("Left and Right sections overlap: Total Width must be at least 2 x Single Lounge Width.");
  if (state.wheelAvoidanceEnabled) {
    if (!(state.avoidanceDepth < state.depth)) warnings.push("Avoidance Depth must be less than Depth.");
    if (!(state.avoidanceHeight < state.height - state.partitionPanelThickness)) warnings.push("Avoidance Height must be less than Height - PPT.");
  }
  if (state.hasMiddleCabinet) {
    const mc = state.middleCabinet;
    if (state.wheelAvoidanceEnabled && !(mc.startHeight > state.avoidanceHeight)) {
      warnings.push("Middle cabinet start height must be greater than avoidance height.");
    }
    if (mc.width > Math.max(0, gap)) warnings.push("Middle cabinet width exceeds the middle gap.");
    if (mc.depth > state.depth) warnings.push("Middle cabinet depth exceeds lounge depth.");
    if (!(mc.width > 3 * mc.doorClearance)) warnings.push("Middle cabinet width must exceed 3 x door clearance.");
    if (!(mc.height > 2 * mc.doorClearance)) warnings.push("Middle cabinet height must exceed 2 x door clearance.");
    const doorHeight = mc.height - 2 * mc.doorClearance;
    if (!(mc.hingeSideDistance * 2 < doorHeight)) warnings.push("Hinge side distance is too large for the door height.");
  }
  return warnings;
}
function addParallelSection(panels, openings, lids, state, ppt, panelHeight, prefix, label) {
  const D = state.depth;
  const SW = state.singleLoungeWidth;
  const isLeft = prefix === "left";
  const xStart = isLeft ? 0 : state.totalWidth - SW;
  const xEnd = isLeft ? SW : state.totalWidth;
  const sideX0 = isLeft ? xEnd - ppt : xStart;
  const sideX1 = isLeft ? xEnd : xStart + ppt;
  const frontX0 = isLeft ? xStart : xStart + ppt;
  const frontX1 = isLeft ? xEnd - ppt : xEnd;
  const stripX0 = isLeft ? xStart : xEnd - ppt;
  const stripX1 = isLeft ? xStart + ppt : xEnd;
  const avoidance = state.wheelAvoidanceEnabled === true;
  const AD = Math.max(0, state.avoidanceDepth);
  const AH = Math.max(0, state.avoidanceHeight);
  panels.push({
    id: `${prefix}_front`,
    name: `${label} Front`,
    kind: "front_panel",
    profilePlane: "XZ",
    width: Math.max(0, SW - ppt),
    height: panelHeight,
    depth: ppt,
    thickness: ppt,
    placement: { x0: frontX0, x1: frontX1, y0: 0, y1: ppt, z0: 0, z1: panelHeight },
    outer: [[0, 0], [Math.max(0, SW - ppt), 0], [Math.max(0, SW - ppt), panelHeight], [0, panelHeight], [0, 0]]
  });
  const hasCutout = avoidance && AD > 0 && AD < D && AH > 0 && AH < panelHeight;
  panels.push({
    id: `${prefix}_side`,
    name: `${label} Side`,
    kind: "side_panel",
    profilePlane: "YZ",
    width: D,
    height: panelHeight,
    depth: ppt,
    thickness: ppt,
    placement: { x0: sideX0, x1: sideX1, y0: 0, y1: D, z0: 0, z1: panelHeight },
    outer: hasCutout ? [[0, 0], [D - AD, 0], [D - AD, AH], [D, AH], [D, panelHeight], [0, panelHeight], [0, 0]] : [[0, 0], [D, 0], [D, panelHeight], [0, panelHeight], [0, 0]]
  });
  addTopPanel(panels, openings, lids, `${prefix}_top`, `${label} Top`, SW, D, ppt, { x0: xStart, x1: xEnd, y0: 0, y1: D }, state.height, state.topLidEnabled);
  panels.push({
    id: `${prefix}_support_strip`,
    name: `${label} Support Strip`,
    kind: "support_strip",
    profilePlane: "YZ",
    length: Math.max(0, D - ppt),
    height: 100,
    thickness: ppt,
    placement: { x0: stripX0, x1: stripX1, y0: ppt, y1: D, z0: Math.max(0, panelHeight - 100), z1: panelHeight },
    outer: [[0, 0], [Math.max(0, D - ppt), 0], [Math.max(0, D - ppt), 100], [0, 100], [0, 0]]
  });
}
function addParallelAvoidanceCovers(panels, state, ppt) {
  if (state.wheelAvoidanceEnabled !== true) return;
  const TW = state.totalWidth;
  const D = state.depth;
  const AD = Math.max(0, state.avoidanceDepth);
  const AH = Math.max(0, state.avoidanceHeight);
  if (!(AD > 0 && AH > ppt)) return;
  panels.push({
    id: "parallel_avoidance_top",
    name: "Parallel Avoidance Top",
    kind: "avoidance_top",
    profilePlane: "XY",
    width: TW,
    depth: AD,
    thickness: ppt,
    placement: { x0: 0, x1: TW, y0: D - AD, y1: D, z0: AH - ppt, z1: AH },
    outer: [[0, 0], [TW, 0], [TW, AD], [0, AD], [0, 0]]
  });
  panels.push({
    id: "parallel_avoidance_front",
    name: "Parallel Avoidance Front",
    kind: "avoidance_front",
    profilePlane: "XZ",
    width: TW,
    height: AH - ppt,
    thickness: ppt,
    placement: { x0: 0, x1: TW, y0: D - AD, y1: D - AD + ppt, z0: 0, z1: AH - ppt },
    outer: [[0, 0], [TW, 0], [TW, AH - ppt], [0, AH - ppt], [0, 0]]
  });
}
function addMiddleCabinet(panels, state) {
  const mc = state.middleCabinet;
  const dpt = Math.max(1, mc.doorPanelThickness);
  const dc = Math.max(0, mc.doorClearance);
  const CW = mc.width;
  const CD = mc.depth;
  const CH = mc.height;
  const CSH = mc.startHeight;
  const x0 = (state.totalWidth - CW) / 2;
  const y0 = state.depth - CD;
  const dividerDepth = Math.max(0, CD - dpt);
  const tongueWidth = dividerDepth / 2;
  const tongueDepth = dpt / 2 - 0.5;
  const dividerBodyWidth = Math.max(0, CW - 2 * dpt);
  const doorSlotWidth = Math.max(0, (CW - 3 * dc) / 2);
  const doorWidth = Math.max(0, doorSlotWidth - dpt);
  const doorHeight = Math.max(0, CH - 2 * dc - 2 * dpt);
  panels.push({
    id: "middle_cabinet_bottom",
    name: "Middle Cabinet Bottom",
    kind: "cabinet_bottom",
    profilePlane: "XY",
    width: CW,
    depth: CD,
    thickness: dpt,
    placement: { x0, x1: x0 + CW, y0, y1: state.depth, z0: CSH, z1: CSH + dpt },
    outer: [[0, 0], [CW, 0], [CW, CD], [0, CD], [0, 0]]
  });
  panels.push({
    id: "middle_cabinet_top",
    name: "Middle Cabinet Top",
    kind: "cabinet_top",
    profilePlane: "XY",
    width: CW,
    depth: CD,
    thickness: dpt,
    note: "Razor Rounded Lock bases mount on the underside of this panel (Kitchen module rules).",
    placement: { x0, x1: x0 + CW, y0, y1: state.depth, z0: CSH + CH - dpt, z1: CSH + CH },
    outer: [[0, 0], [CW, 0], [CW, CD], [0, CD], [0, 0]]
  });
  const sideHeight = Math.max(0, CH - 2 * dpt);
  const grooveX0 = Math.max(0, CD - tongueWidth - 5);
  const grooveY0 = (CH - dpt) / 2 - dpt - 0.5;
  const grooveRect = { x0: grooveX0, y0: grooveY0, x1: CD, y1: grooveY0 + dpt + 1, depth: dpt / 2 };
  panels.push({
    id: "middle_cabinet_left",
    name: "Middle Cabinet Left",
    kind: "cabinet_side",
    profilePlane: "YZ",
    width: CD,
    height: sideHeight,
    thickness: dpt,
    placement: { x0, x1: x0 + dpt, y0, y1: state.depth, z0: CSH + dpt, z1: CSH + dpt + sideHeight },
    outer: [[0, 0], [CD, 0], [CD, sideHeight], [0, sideHeight], [0, 0]],
    // Inner face of the left side is world X+, which is the local flat top face.
    grooves: [{ id: "middle_cabinet_left_groove", ...grooveRect, face: "top" }]
  });
  panels.push({
    id: "middle_cabinet_right",
    name: "Middle Cabinet Right",
    kind: "cabinet_side",
    profilePlane: "YZ",
    width: CD,
    height: sideHeight,
    thickness: dpt,
    placement: { x0: x0 + CW - dpt, x1: x0 + CW, y0, y1: state.depth, z0: CSH + dpt, z1: CSH + dpt + sideHeight },
    outer: [[0, 0], [CD, 0], [CD, sideHeight], [0, sideHeight], [0, 0]],
    // Inner face of the right side is world X-, which is the local flat bottom face.
    grooves: [{ id: "middle_cabinet_right_groove", ...grooveRect, face: "bottom" }]
  });
  const dividerZ0 = CSH + (CH - dpt) / 2;
  panels.push({
    id: "middle_cabinet_mid_divider",
    name: "Middle Cabinet Mid Horizontal Divider",
    kind: "cabinet_divider",
    profilePlane: "XY",
    width: dividerBodyWidth,
    depth: dividerDepth,
    thickness: dpt,
    note: "Tongues on both sides, rear half of the divider depth.",
    placement: { x0: x0 + dpt, x1: x0 + CW - dpt, y0: y0 + dpt, y1: state.depth, z0: dividerZ0, z1: dividerZ0 + dpt },
    outer: [
      [0, 0],
      [dividerBodyWidth, 0],
      [dividerBodyWidth, dividerDepth - tongueWidth],
      [dividerBodyWidth + tongueDepth, dividerDepth - tongueWidth],
      [dividerBodyWidth + tongueDepth, dividerDepth],
      [-tongueDepth, dividerDepth],
      [-tongueDepth, dividerDepth - tongueWidth],
      [0, dividerDepth - tongueWidth],
      [0, 0]
    ]
  });
  const LOCK_WIDTH = 55;
  const LOCK_HEIGHT = 15.5;
  const lockSideDistance = Math.max(0, mc.lockSideDistance);
  const lockCenterY = CH - dc - 2 * dpt - 30.5;
  const hingeSide = Math.max(0, mc.hingeSideDistance);
  const hingeEdge = Math.max(0, mc.hingeCupCenterFromEdge);
  const cupDiameter = Math.max(1, mc.hingeCupDiameter);
  const cupDepth = Math.min(Math.max(0.5, mc.hingeCupDepth), dpt);
  const doorCuts = (doorId, isLeftDoor) => {
    const hingeCenterX = isLeftDoor ? hingeEdge : doorWidth - hingeEdge;
    const hingeHoles = [
      { id: `${doorId}_hinge_bottom`, centerX: hingeCenterX, centerY: hingeSide, diameter: cupDiameter, depth: cupDepth, face: "bottom" },
      { id: `${doorId}_hinge_top`, centerX: hingeCenterX, centerY: doorHeight - hingeSide, diameter: cupDiameter, depth: cupDepth, face: "bottom" }
    ];
    if (mc.doorLockStyle === "NONE") return { hingeHoles, lockCutouts: [] };
    const lockCenterX = isLeftDoor ? doorWidth - lockSideDistance : lockSideDistance;
    return {
      hingeHoles,
      lockCutouts: [{
        id: `${doorId}_lock`,
        presetId: "razor_long_rounded_1",
        shape: "rounded_slot",
        centerX: lockCenterX,
        centerY: lockCenterY,
        width: LOCK_WIDTH,
        height: LOCK_HEIGHT,
        radius: LOCK_HEIGHT / 2,
        through: true
      }]
    };
  };
  const leftDoorCuts = doorCuts("middle_cabinet_left_door", true);
  panels.push({
    id: "middle_cabinet_left_door",
    name: "Middle Cabinet Left Door",
    kind: "cabinet_door",
    profilePlane: "XZ",
    width: doorWidth,
    height: doorHeight,
    thickness: dpt,
    placement: { x0: x0 + dc + dpt, x1: x0 + dc + doorSlotWidth, y0, y1: y0 + dpt, z0: CSH + dc + dpt, z1: CSH + dc + dpt + doorHeight },
    outer: [[0, 0], [doorWidth, 0], [doorWidth, doorHeight], [0, doorHeight], [0, 0]],
    hingeHoles: leftDoorCuts.hingeHoles,
    lockCutouts: leftDoorCuts.lockCutouts
  });
  const rightDoorCuts = doorCuts("middle_cabinet_right_door", false);
  panels.push({
    id: "middle_cabinet_right_door",
    name: "Middle Cabinet Right Door",
    kind: "cabinet_door",
    profilePlane: "XZ",
    width: doorWidth,
    height: doorHeight,
    thickness: dpt,
    placement: { x0: x0 + dc + doorSlotWidth + dc, x1: x0 + dc + doorSlotWidth + dc + doorWidth, y0, y1: y0 + dpt, z0: CSH + dc + dpt, z1: CSH + dc + dpt + doorHeight },
    outer: [[0, 0], [doorWidth, 0], [doorWidth, doorHeight], [0, doorHeight], [0, 0]],
    hingeHoles: rightDoorCuts.hingeHoles,
    lockCutouts: rightDoorCuts.lockCutouts
  });
}
function iShapeWarnings(state) {
  const warnings = [];
  const ppt = Math.max(1, state.partitionPanelThickness);
  if (!(state.mainWidth > 2 * ppt)) warnings.push("Width must exceed 2 x PPT for the side panels.");
  if (!(state.mainDepth > 2 * ppt)) warnings.push("Depth must exceed 2 x PPT for the front panel.");
  if (!(state.height > ppt)) warnings.push("Height must exceed PPT.");
  if (state.wheelAvoidanceEnabled) {
    if (!(state.avoidanceDepth < state.mainDepth)) warnings.push("Avoidance Depth must be less than Depth.");
    if (!(state.avoidanceHeight < state.height - ppt)) warnings.push("Avoidance Height must be less than Height - PPT.");
  }
  return warnings;
}
function generateIShapeGeometry(state) {
  const ppt = Math.max(1, state.partitionPanelThickness);
  const panelHeight = Math.max(0, state.height - ppt);
  const W = state.mainWidth;
  const D = state.mainDepth;
  const bounds = { x0: 0, x1: W, y0: 0, y1: D };
  const panels = [];
  const openings = [];
  const lids = [];
  const avoidance = state.wheelAvoidanceEnabled === true;
  const AD = Math.max(0, state.avoidanceDepth);
  const AH = Math.max(0, state.avoidanceHeight);
  const hasCutout = avoidance && AD > 0 && AD < D && AH > 0 && AH < panelHeight;
  panels.push({
    id: "i_front",
    name: "I Front",
    kind: "front_panel",
    profilePlane: "XZ",
    width: W,
    height: panelHeight,
    depth: ppt,
    thickness: ppt,
    placement: { x0: 0, x1: W, y0: Math.max(0, D - ppt), y1: D, z0: 0, z1: panelHeight },
    outer: [[0, 0], [W, 0], [W, panelHeight], [0, panelHeight], [0, 0]]
  });
  const sideDepth = Math.max(0, D - ppt);
  const sideOuter = hasCutout ? [[AD, 0], [sideDepth, 0], [sideDepth, panelHeight], [0, panelHeight], [0, AH], [AD, AH], [AD, 0]] : [[0, 0], [sideDepth, 0], [sideDepth, panelHeight], [0, panelHeight], [0, 0]];
  const sideNote = hasCutout ? "Rear-lower wheel avoidance cutout applied." : void 0;
  panels.push({
    id: "i_left_side",
    name: "I Left Side",
    kind: "side_panel",
    profilePlane: "YZ",
    width: sideDepth,
    height: panelHeight,
    depth: ppt,
    thickness: ppt,
    note: sideNote,
    placement: { x0: 0, x1: ppt, y0: 0, y1: sideDepth, z0: 0, z1: panelHeight },
    outer: sideOuter.map((point) => [...point])
  });
  panels.push({
    id: "i_right_side",
    name: "I Right Side",
    kind: "side_panel",
    profilePlane: "YZ",
    width: sideDepth,
    height: panelHeight,
    depth: ppt,
    thickness: ppt,
    note: sideNote,
    placement: { x0: W - ppt, x1: W, y0: 0, y1: sideDepth, z0: 0, z1: panelHeight },
    outer: sideOuter.map((point) => [...point])
  });
  addTopPanel(panels, openings, lids, "i_top", "I Top", W, D, ppt, bounds, state.height, state.topLidEnabled);
  if (hasCutout && AH > ppt) {
    panels.push({
      id: "i_avoidance_top",
      name: "I Avoidance Top",
      kind: "avoidance_top",
      profilePlane: "XY",
      width: W,
      depth: AD,
      thickness: ppt,
      placement: { x0: 0, x1: W, y0: 0, y1: AD, z0: AH - ppt, z1: AH },
      outer: [[0, 0], [W, 0], [W, AD], [0, AD], [0, 0]]
    });
    panels.push({
      id: "i_avoidance_front",
      name: "I Avoidance Front",
      kind: "avoidance_front",
      profilePlane: "XZ",
      width: W,
      height: AH - ppt,
      thickness: ppt,
      placement: { x0: 0, x1: W, y0: AD - ppt, y1: AD, z0: 0, z1: AH - ppt },
      outer: [[0, 0], [W, 0], [W, AH - ppt], [0, AH - ppt], [0, 0]]
    });
  }
  return withRelationshipDeclarations({
    meta: { module: "lounge", style: "I_SHAPE", phase: "i_shape_geometry_v1" },
    state,
    footprint: { i: bounds },
    panels,
    openings,
    lids,
    validation: { warnings: iShapeWarnings(state), errors: [] }
  });
}
function generateParallelLoungeGeometry(state) {
  const ppt = Math.max(1, state.partitionPanelThickness);
  const panelHeight = Math.max(0, state.height - ppt);
  const gap = state.totalWidth - state.singleLoungeWidth * 2;
  const panels = [];
  const openings = [];
  const lids = [];
  addParallelSection(panels, openings, lids, state, ppt, panelHeight, "left", "Left");
  addParallelSection(panels, openings, lids, state, ppt, panelHeight, "right", "Right");
  addParallelAvoidanceCovers(panels, state, ppt);
  if (state.hasMiddleCabinet) addMiddleCabinet(panels, state);
  return withRelationshipDeclarations({
    meta: { module: "lounge", style: "PARALLEL", phase: "parallel_geometry_v1" },
    state,
    footprint: {
      left: { x0: 0, x1: state.singleLoungeWidth, y0: 0, y1: state.depth },
      right: { x0: state.totalWidth - state.singleLoungeWidth, x1: state.totalWidth, y0: 0, y1: state.depth },
      middleGap: gap
    },
    panels,
    openings,
    lids,
    validation: { warnings: parallelWarnings(state), errors: [] }
  });
}
var U_LOUNGE_MIN_RUN = 200;
var U_LOUNGE_MIN_LEN = 400;
function round1(value) {
  return Math.round(value * 10) / 10;
}
function resolveULoungeLayout(params) {
  const W = round1(num(params.totalWidth, num(params.mainWidth, 2e3)));
  const D = round1(num(params.depth, 1200));
  const want = Math.max(U_LOUNGE_MIN_RUN, round1(num(params.mainDepth, 600)));
  const maxRun = Math.max(
    U_LOUNGE_MIN_RUN,
    Math.min(want, Math.floor((W - U_LOUNGE_MIN_LEN) / 2), Math.max(U_LOUNGE_MIN_RUN, D - U_LOUNGE_MIN_LEN))
  );
  const run = Number.isFinite(maxRun) ? round1(maxRun) : U_LOUNGE_MIN_RUN;
  return { W, D, run, leftLen: D, rightLen: D, backLen: round1(W - 2 * run) };
}
function mapPlacement(pl, map) {
  const p = pl || { x0: 0, x1: 0, y0: 0, y1: 0, z0: 0, z1: 0 };
  const corners = [
    [p.x0, p.y0, p.z0],
    [p.x1, p.y0, p.z0],
    [p.x0, p.y1, p.z0],
    [p.x1, p.y1, p.z0],
    [p.x0, p.y0, p.z1],
    [p.x1, p.y0, p.z1],
    [p.x0, p.y1, p.z1],
    [p.x1, p.y1, p.z1]
  ].map(([x, y, z]) => map(x, y, z));
  const xs = corners.map((c) => c.x);
  const ys = corners.map((c) => c.y);
  const zs = corners.map((c) => c.z);
  return {
    x0: Math.min(...xs),
    x1: Math.max(...xs),
    y0: Math.min(...ys),
    y1: Math.max(...ys),
    z0: Math.min(...zs),
    z1: Math.max(...zs)
  };
}
function mapLoungePart(item, prefix, map) {
  return {
    ...item,
    id: `${prefix}:${item.id}`,
    name: `${prefix} ${item.name || item.id}`,
    placement: mapPlacement(item.placement, map),
    outer: void 0,
    opening: void 0
  };
}
function generateUShapeLoungeGeometry(state) {
  const layout = resolveULoungeLayout(state);
  const { W, D, run, leftLen, backLen, rightLen } = layout;
  const errors = [];
  if (W < 2 * U_LOUNGE_MIN_RUN + U_LOUNGE_MIN_LEN) errors.push(`U width must be at least ${2 * U_LOUNGE_MIN_RUN + U_LOUNGE_MIN_LEN} mm`);
  if (D < U_LOUNGE_MIN_RUN + U_LOUNGE_MIN_LEN) errors.push(`U depth must be at least ${U_LOUNGE_MIN_RUN + U_LOUNGE_MIN_LEN} mm`);
  if (backLen < U_LOUNGE_MIN_LEN) errors.push(`U back run ${backLen} mm is under ${U_LOUNGE_MIN_LEN} mm`);
  const iBase = {
    ...state,
    style: "I_SHAPE",
    wheelAvoidanceEnabled: false,
    hasMiddleCabinet: false
  };
  if (errors.length) {
    return withRelationshipDeclarations({
      meta: { module: "lounge", style: "U_SHAPE", phase: "u_shape_three_i_runs" },
      state,
      footprint: {
        left: { x0: 0, x1: run, y0: 0, y1: D },
        back: { x0: run, x1: W - run, y0: D - run, y1: D },
        right: { x0: W - run, x1: W, y0: 0, y1: D }
      },
      panels: [],
      openings: [],
      lids: [],
      validation: { warnings: [], errors }
    });
  }
  const left = generateIShapeGeometry({ ...iBase, mainWidth: leftLen, mainDepth: run });
  const back = generateIShapeGeometry({ ...iBase, mainWidth: backLen, mainDepth: run });
  const right = generateIShapeGeometry({ ...iBase, mainWidth: rightLen, mainDepth: run });
  const mapLeft = (x, y, z) => ({ x: run - y, y: x, z });
  const mapBack = (x, y, z) => ({ x: run + x, y: D - run + y, z });
  const mapRight = (x, y, z) => ({ x: W - run + y, y: D - x, z });
  const panels = [
    ...left.panels.map((p) => mapLoungePart(p, "left", mapLeft)),
    ...back.panels.map((p) => mapLoungePart(p, "back", mapBack)),
    ...right.panels.map((p) => mapLoungePart(p, "right", mapRight))
  ];
  const lids = [
    ...left.lids.map((p) => mapLoungePart(p, "left", mapLeft)),
    ...back.lids.map((p) => mapLoungePart(p, "back", mapBack)),
    ...right.lids.map((p) => mapLoungePart(p, "right", mapRight))
  ];
  const warnings = [
    ...(left.validation.warnings || []).map((m) => `left: ${m}`),
    ...(back.validation.warnings || []).map((m) => `back: ${m}`),
    ...(right.validation.warnings || []).map((m) => `right: ${m}`)
  ];
  return withRelationshipDeclarations({
    meta: { module: "lounge", style: "U_SHAPE", phase: "u_shape_three_i_runs" },
    state,
    footprint: {
      left: { x0: 0, x1: run, y0: 0, y1: D },
      back: { x0: run, x1: W - run, y0: D - run, y1: D },
      right: { x0: W - run, x1: W, y0: 0, y1: D }
    },
    panels,
    openings: [],
    lids,
    validation: { warnings, errors: [] }
  });
}
function generateLoungeGeometry(input) {
  const state = normalizeSettings(input);
  if (state.style === "PARALLEL") return generateParallelLoungeGeometry(state);
  if (state.style === "I_SHAPE") return generateIShapeGeometry(state);
  if (state.style === "U_SHAPE") return generateUShapeLoungeGeometry(state);
  const ppt = Math.max(1, state.partitionPanelThickness);
  const panelHeight = Math.max(0, state.height - ppt);
  const mainBounds = { x0: 0, x1: state.mainWidth, y0: 0, y1: state.mainDepth };
  const mainVisibleBounds = loungeMainVisibleBounds(state);
  const lBounds = loungeLBounds(state);
  const panels = [];
  const openings = [];
  const lids = [];
  panels.push({
    id: "main_front",
    name: "Main Front",
    kind: "front_panel",
    profilePlane: "XZ",
    width: mainVisibleBounds.x1 - mainVisibleBounds.x0,
    height: panelHeight,
    depth: ppt,
    thickness: ppt,
    placement: {
      x0: mainVisibleBounds.x0,
      x1: mainVisibleBounds.x1,
      y0: Math.max(0, state.mainDepth - ppt),
      y1: state.mainDepth,
      z0: 0,
      z1: panelHeight
    },
    outer: [[0, 0], [mainVisibleBounds.x1 - mainVisibleBounds.x0, 0], [mainVisibleBounds.x1 - mainVisibleBounds.x0, panelHeight], [0, panelHeight], [0, 0]]
  });
  addTopPanel(panels, openings, lids, "main_top", "Main Top", mainVisibleBounds.x1 - mainVisibleBounds.x0, mainVisibleBounds.y1 - mainVisibleBounds.y0, ppt, mainVisibleBounds, state.height, state.topLidEnabled);
  panels.push({
    id: "main_left_l_piece",
    name: "Main Left L Piece",
    kind: "l_support_profile",
    profilePlane: "YZ",
    length: Math.max(0, state.mainDepth - ppt),
    verticalLegWidth: 100,
    horizontalLegWidth: 100,
    thickness: ppt,
    placement: {
      x0: mainVisibleBounds.x0,
      x1: mainVisibleBounds.x0 + ppt,
      y0: ppt,
      y1: state.mainDepth,
      z0: 0,
      z1: panelHeight
    },
    outer: lSupportOuter(state.mainDepth - ppt, panelHeight)
  });
  panels.push({
    id: "main_right_l_piece",
    name: "Main Right L Piece",
    kind: "l_support_profile",
    profilePlane: "YZ",
    length: Math.max(0, state.mainDepth - ppt),
    verticalLegWidth: 100,
    horizontalLegWidth: 100,
    thickness: ppt,
    mirrored: true,
    placement: {
      x0: mainVisibleBounds.x1 - ppt,
      x1: mainVisibleBounds.x1,
      y0: ppt,
      y1: state.mainDepth,
      z0: 0,
      z1: panelHeight
    },
    outer: lSupportOuter(state.mainDepth - ppt, panelHeight)
  });
  const lFrontX0 = state.lPosition === "LEFT" ? lBounds.x0 + ppt : lBounds.x0;
  const lFrontX1 = state.lPosition === "LEFT" ? lBounds.x1 : lBounds.x1 - ppt;
  panels.push({
    id: "l_front",
    name: "L Front",
    kind: "front_panel",
    profilePlane: "XZ",
    width: Math.max(0, state.lWidth - ppt),
    height: panelHeight,
    depth: ppt,
    thickness: ppt,
    note: "Width reduced by one PPT for future drawer/flap access logic.",
    placement: {
      x0: lFrontX0 + ppt,
      x1: lFrontX1 + ppt,
      y0: Math.max(0, state.lDepth - ppt),
      y1: state.lDepth,
      z0: 0,
      z1: panelHeight
    },
    outer: [[0, 0], [Math.max(0, state.lWidth - ppt), 0], [Math.max(0, state.lWidth - ppt), panelHeight], [0, panelHeight], [0, 0]]
  });
  const lSideX0 = state.lPosition === "LEFT" ? lBounds.x0 : lBounds.x1 - ppt;
  const lSideX1 = state.lPosition === "LEFT" ? lBounds.x0 + ppt : lBounds.x1;
  const lSideShift = Math.max(0, state.lWidth - ppt);
  panels.push({
    id: "l_side",
    name: "L Side",
    kind: "side_panel",
    profilePlane: "YZ",
    width: state.lDepth,
    height: panelHeight,
    depth: ppt,
    thickness: ppt,
    placement: {
      x0: lSideX0 - lSideShift,
      x1: lSideX1 - lSideShift,
      y0: 0,
      y1: state.lDepth,
      z0: 0,
      z1: panelHeight
    },
    outer: [[0, 0], [state.lDepth, 0], [state.lDepth, panelHeight], [0, panelHeight], [0, 0]]
  });
  panels.push({
    id: "l_side_strip",
    name: "L Side Strip",
    kind: "side_panel",
    profilePlane: "YZ",
    width: state.lDepth,
    height: Math.min(100, panelHeight),
    depth: ppt,
    thickness: ppt,
    placement: {
      x0: lSideX0,
      x1: lSideX1,
      y0: 0,
      y1: Math.max(0, state.lDepth - ppt),
      z0: Math.max(0, panelHeight - 100),
      z1: panelHeight
    },
    outer: [[0, 0], [Math.max(0, state.lDepth - ppt), 0], [Math.max(0, state.lDepth - ppt), Math.min(100, panelHeight)], [0, Math.min(100, panelHeight)], [0, 0]]
  });
  addTopPanel(panels, openings, lids, "l_top", "L Top", state.lWidth, state.lDepth, ppt, lBounds, state.height, state.topLidEnabled);
  return withRelationshipDeclarations({
    meta: { module: "lounge", style: state.style, phase: "ui_geometry_svg_only" },
    state,
    footprint: {
      main: mainBounds,
      l: lBounds,
      lPosition: state.lPosition
    },
    panels,
    openings,
    lids,
    validation: { warnings: loungeWarnings(state), errors: [] }
  });
}
export {
  generateLoungeGeometry,
  loungeLBounds,
  loungeMainVisibleBounds,
  resolveULoungeLayout
};
