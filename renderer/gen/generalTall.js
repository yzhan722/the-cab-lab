// Generated from generators/generalTall/generator.ts - do not edit.

// generators/generalTall/boundaryResolver.ts
var TOP_SYSTEM = { id: "top_system", type: "top_system" };
var BOTTOM_SYSTEM = { id: "bottom_system", type: "bottom_system" };
function isFunctionalZone(zone) {
  return zone.type !== "top_system" && zone.type !== "bottom_system";
}
function zoneId(zone) {
  return "id" in zone && zone.id ? String(zone.id) : String(zone.type);
}
function fullZi(reason) {
  return { boundaryType: "full_zi", reason };
}
function none(reason) {
  return { boundaryType: "none", reason };
}
function halfZi(reason) {
  return { boundaryType: "half_zi", reason };
}
function resolveBoundary(aboveZone, belowZone) {
  if (!aboveZone || !belowZone) {
    throw new Error("resolveBoundary requires aboveZone and belowZone.");
  }
  if (aboveZone.type === "top_system") {
    return none("Top System already provides the upper structural interface.");
  }
  if (belowZone.type === "bottom_system") {
    return none("Bottom System already provides the lower structural interface.");
  }
  if (aboveZone.type === "blank_panel") {
    return none("Blank Panel above does not force a lower top boundary.");
  }
  if (aboveZone.type === "drawer" && belowZone.type === "drawer") {
    return halfZi("Drawer to drawer uses half Zi support.");
  }
  if (aboveZone.type === "top_flap") {
    return fullZi("Top flap bottom requires full Zi.");
  }
  if (aboveZone.type === "side_door" || aboveZone.type === "double_door" || aboveZone.type === "drawer" || aboveZone.type === "open_space" || aboveZone.type === "open_appliance" || aboveZone.type === "fridge" || aboveZone.type === "bottom_flap") {
    return fullZi(`${aboveZone.type} bottom rule requires full Zi.`);
  }
  return none("No boundary panel required by resolver rules.");
}
function makeBoundary(index, aboveZone, belowZone) {
  const base = resolveBoundary(aboveZone, belowZone);
  return {
    index,
    aboveZoneId: zoneId(aboveZone),
    belowZoneId: zoneId(belowZone),
    ...base
  };
}
function forceFullZiForDivider(boundary, doubleDoorId) {
  if (boundary.boundaryType === "full_zi") {
    return {
      ...boundary,
      reason: `${boundary.reason} Double-door vertical divider support requires full Zi.`
    };
  }
  return {
    ...boundary,
    boundaryType: "full_zi",
    reason: `Double-door vertical divider in ${doubleDoorId} requires full-depth structural support.`,
    upgradedByDoubleDoorDivider: true
  };
}
function applyDoubleDoorDividerUpgrade(boundary, aboveZone, belowZone) {
  if (isFunctionalZone(belowZone) && belowZone.type === "double_door" && belowZone.verticalDivider) {
    if (aboveZone.type !== "top_system") {
      return forceFullZiForDivider(boundary, belowZone.id);
    }
  }
  if (isFunctionalZone(aboveZone) && aboveZone.type === "double_door" && aboveZone.verticalDivider) {
    if (belowZone.type !== "bottom_system") {
      return forceFullZiForDivider(boundary, aboveZone.id);
    }
  }
  return boundary;
}
function validateZones(zones) {
  const errors = [];
  const warnings = [];
  if (!Array.isArray(zones)) {
    throw new Error("resolveZoneBoundaries requires an array of functional zones.");
  }
  zones.forEach((zone, index) => {
    if (!zone || typeof zone !== "object") {
      errors.push(`Zone at index ${index} is missing or invalid.`);
      return;
    }
    if (!(Number(zone.height) > 0)) {
      errors.push(`Zone ${zone.id || index} height must be > 0.`);
    }
    if (zone.type === "top_flap" && index !== zones.length - 1) {
      warnings.push(
        "Top flap is not the highest functional zone; hinge semantics still apply but verify the layout is intentional."
      );
    }
    if (zone.type === "bottom_flap" && index !== 0) {
      warnings.push(
        "Bottom flap is not the lowest functional zone; hinge semantics still apply but verify the layout is intentional."
      );
    }
  });
  return { errors, warnings };
}
function resolveZoneBoundaries(zones) {
  const validation = validateZones(zones);
  const boundaries = [];
  const debugBoundaries = [];
  if (zones.length > 0) {
    const topDebug = makeBoundary(-1, TOP_SYSTEM, zones[0]);
    debugBoundaries.push(applyDoubleDoorDividerUpgrade(topDebug, TOP_SYSTEM, zones[0]));
  }
  for (let index = 0; index < zones.length - 1; index += 1) {
    const aboveZone = zones[index];
    const belowZone = zones[index + 1];
    const boundary = makeBoundary(index, aboveZone, belowZone);
    boundaries.push(applyDoubleDoorDividerUpgrade(boundary, aboveZone, belowZone));
  }
  if (zones.length > 0) {
    const lastIndex = zones.length - 1;
    const bottomDebug = makeBoundary(lastIndex, zones[lastIndex], BOTTOM_SYSTEM);
    debugBoundaries.push(applyDoubleDoorDividerUpgrade(bottomDebug, zones[lastIndex], BOTTOM_SYSTEM));
  }
  return {
    boundaries,
    debugBoundaries,
    errors: validation.errors,
    warnings: validation.warnings
  };
}

// generators/generalTall/stackingCalculator.ts
var DEFAULT_ZI_THICKNESS = 15;
var DEFAULT_STYLE_1_INSERT_SLOT_THICKNESS = 16;
var TOP_STYLE_1_MIN_FRONT_RAIL_HEIGHT = 40;
var BOTTOM_STYLE_1_MIN_FRONT_RAIL_HEIGHT = 53;
var STYLE_2_MIN_HEIGHT = 60;
function numericOrDefault(value, fallback) {
  const n2 = Number(value);
  return Number.isFinite(n2) ? n2 : fallback;
}
function boundaryThickness(boundaryType, ziThickness) {
  return boundaryType === "none" ? 0 : ziThickness;
}
function systemHeight(config, position, errors) {
  if (!config || typeof config !== "object") {
    throw new Error(`Missing ${position} system config.`);
  }
  if (config.style === "style_1") {
    const minHeight = position === "top" ? TOP_STYLE_1_MIN_FRONT_RAIL_HEIGHT : BOTTOM_STYLE_1_MIN_FRONT_RAIL_HEIGHT;
    const frontRailHeight = Math.max(numericOrDefault(config.frontRailHeight, minHeight), minHeight);
    const insertSlotThickness = numericOrDefault(config.insertSlotThickness, DEFAULT_STYLE_1_INSERT_SLOT_THICKNESS);
    return frontRailHeight + insertSlotThickness;
  }
  if (config.style === "style_2") {
    const height = Number(config.height);
    if (!Number.isFinite(height)) {
      errors.push(`${position} Style 2 height must be a finite number.`);
      return 0;
    }
    if (height < STYLE_2_MIN_HEIGHT) {
      errors.push(`${position} Style 2 height must be >= ${STYLE_2_MIN_HEIGHT} mm.`);
    }
    return height;
  }
  throw new Error(`Unsupported ${position} system style.`);
}
function resolveSystemHeights(topSystem, bottomSystem) {
  const errors = [];
  return {
    topSystemHeight: systemHeight(topSystem, "top", errors),
    bottomSystemHeight: systemHeight(bottomSystem, "bottom", errors),
    errors
  };
}
function pushItem(items, item) {
  const z1 = item.z0 + item.height;
  items.push({
    ...item,
    z1
  });
  return z1;
}
function boundaryNotes(boundary) {
  if (boundary.upgradedByDoubleDoorDivider) {
    return `${boundary.reason} Upgraded by double-door vertical divider.`;
  }
  return boundary.reason;
}
function calculateZStacking(input) {
  if (!input || typeof input !== "object") {
    throw new Error("calculateZStacking requires an input object.");
  }
  if (!Array.isArray(input.zones)) {
    throw new Error("calculateZStacking requires input.zones to be an array.");
  }
  const expectedCabinetHeight = Number(input.cabinetHeight);
  const ziThickness = numericOrDefault(input.ziThickness, DEFAULT_ZI_THICKNESS);
  const systemHeights = resolveSystemHeights(input.topSystem, input.bottomSystem);
  const boundaryResolution = resolveZoneBoundaries(input.zones);
  const errors = [...systemHeights.errors, ...boundaryResolution.errors];
  const warnings = [...boundaryResolution.warnings];
  const items = [];
  let currentZ = 0;
  currentZ = pushItem(items, {
    id: "bottom-system",
    type: "bottom_system",
    z0: currentZ,
    height: systemHeights.bottomSystemHeight,
    notes: `${input.bottomSystem.style} bottom system.`
  });
  input.zones.forEach((zone, index) => {
    currentZ = pushItem(items, {
      id: `zone-${zone.id}`,
      type: "functional_zone",
      z0: currentZ,
      height: Number(zone.height),
      zoneId: zone.id,
      notes: `${zone.type} clear-space height.`
    });
    const boundary = boundaryResolution.boundaries[index];
    if (!boundary) return;
    const thickness = boundaryThickness(boundary.boundaryType, ziThickness);
    if (thickness <= 0) return;
    const z0 = currentZ;
    currentZ = pushItem(items, {
      id: `boundary-${boundary.aboveZoneId}-${boundary.belowZoneId}`,
      type: "boundary_panel",
      z0,
      height: thickness,
      boundaryType: boundary.boundaryType,
      centerZ: z0 + thickness / 2,
      notes: boundaryNotes(boundary)
    });
  });
  currentZ = pushItem(items, {
    id: "top-system",
    type: "top_system",
    z0: currentZ,
    height: systemHeights.topSystemHeight,
    notes: `${input.topSystem.style} top system.`
  });
  const functionalZoneTotal = input.zones.reduce((sum, zone) => sum + Number(zone.height || 0), 0);
  const boundaryPanelTotal = boundaryResolution.boundaries.reduce(
    (sum, boundary) => sum + boundaryThickness(boundary.boundaryType, ziThickness),
    0
  );
  const calculatedHeight = systemHeights.topSystemHeight + systemHeights.bottomSystemHeight + functionalZoneTotal + boundaryPanelTotal;
  const difference = calculatedHeight - expectedCabinetHeight;
  if (Number.isFinite(expectedCabinetHeight) && Math.abs(difference) > 1e-3) {
    warnings.push(
      `Height mismatch: expected CH = ${expectedCabinetHeight}; calculated CH = ${calculatedHeight}; difference = ${difference}.`
    );
  }
  return {
    items,
    boundaryResolution,
    validation: {
      errors,
      warnings
    },
    topSystemHeight: systemHeights.topSystemHeight,
    bottomSystemHeight: systemHeights.bottomSystemHeight,
    boundaryPanelTotal,
    functionalZoneTotal,
    calculatedHeight,
    expectedCabinetHeight,
    difference,
    ziThickness
  };
}

// generators/generalTall/assemblyOverlapAudit.ts
function boardBbox(board2) {
  return {
    x0: board2.x0,
    x1: board2.x1,
    y0: board2.y0,
    y1: board2.y1,
    z0: board2.z0,
    z1: board2.z1
  };
}
function boardsOverlap3d(a, b) {
  return a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0 && a.z0 < b.z1 && a.z1 > b.z0;
}
function overlapBbox(a, b) {
  if (!boardsOverlap3d(a, b)) return null;
  return {
    x0: Math.max(a.x0, b.x0),
    x1: Math.min(a.x1, b.x1),
    y0: Math.max(a.y0, b.y0),
    y1: Math.min(a.y1, b.y1),
    z0: Math.max(a.z0, b.z0),
    z1: Math.min(a.z1, b.z1)
  };
}
function overlapVolumeMm3(region) {
  const dx = Math.max(0, region.x1 - region.x0);
  const dy = Math.max(0, region.y1 - region.y0);
  const dz = Math.max(0, region.z1 - region.z0);
  return dx * dy * dz;
}
function pairKey(idA, idB) {
  return [idA, idB].sort().join("|");
}
function areParallelSlabs(boardA, boardB) {
  return boardA.profilePlane === boardB.profilePlane && boardA.thicknessAxis === boardB.thicknessAxis;
}
var ALLOWED_PARALLEL_OVERLAP_REASONS = {
  "SidePanel_L|V1": "V stile shares the left side-panel X slab.",
  "SidePanel_L|V3": "V stile shares the left side-panel X slab.",
  "SidePanel_R|V2": "V stile shares the right side-panel X slab.",
  "SidePanel_R|V4": "V stile shares the right side-panel X slab.",
  "V1|V3": "Front/rear stile sections are split boards with deferred union.",
  "V2|V4": "Front/rear stile sections are split boards with deferred union."
};
function allowedParallelOverlapReason(boardA, boardB) {
  const key = pairKey(boardA.id, boardB.id);
  if (ALLOWED_PARALLEL_OVERLAP_REASONS[key]) return ALLOWED_PARALLEL_OVERLAP_REASONS[key];
  const ids = [boardA.id, boardB.id];
  const vId = ids.find((id) => /^V[1-4]$/.test(id));
  const hId = ids.find((id) => /^H\d/.test(id));
  if (vId && hId) {
    if ((vId === "V1" || vId === "V3") && hId.startsWith("H13")) {
      return "H13 bridge seated in left stile notch region.";
    }
    if ((vId === "V2" || vId === "V4") && hId.startsWith("H24")) {
      return "H24 bridge seated in right stile notch region.";
    }
    if ((vId === "V3" || vId === "V4") && hId.startsWith("H34")) {
      return "H34 bridge seated in rear stile notch region.";
    }
  }
  return void 0;
}
function runAssemblyOverlapAudit(boards) {
  const solids = boards.filter((board2) => Number.isFinite(board2.x0) && Number.isFinite(board2.x1));
  const pairs = [];
  for (let i = 0; i < solids.length; i += 1) {
    for (let j = i + 1; j < solids.length; j += 1) {
      const boardA = solids[i];
      const boardB = solids[j];
      const region = overlapBbox(boardBbox(boardA), boardBbox(boardB));
      if (!region) continue;
      const parallel = areParallelSlabs(boardA, boardB);
      const allowReason = parallel ? allowedParallelOverlapReason(boardA, boardB) : "Perpendicular boards; corner intersection is expected joinery.";
      pairs.push({
        boardAId: boardA.id,
        boardBId: boardB.id,
        boardACategory: boardA.category,
        boardBCategory: boardB.category,
        overlapMm3: overlapVolumeMm3(region),
        overlapBbox: region,
        relation: parallel ? "parallel_slab" : "perpendicular_corner",
        allowed: Boolean(allowReason),
        allowReason
      });
    }
  }
  const unexpectedOverlaps = pairs.filter((pair) => pair.relation === "parallel_slab" && !pair.allowed);
  const parallelOverlapCount = pairs.filter((pair) => pair.relation === "parallel_slab").length;
  const perpendicularOverlapCount = pairs.length - parallelOverlapCount;
  return {
    boardCount: solids.length,
    overlapPairCount: pairs.length,
    parallelOverlapCount,
    perpendicularOverlapCount,
    allowedOverlapCount: pairs.length - unexpectedOverlaps.length,
    unexpectedOverlapCount: unexpectedOverlaps.length,
    pairs,
    unexpectedOverlaps,
    note: "Unexpected overlaps are same-orientation slab intersections only; perpendicular corner joins are ignored."
  };
}
function formatAssemblyOverlapWarning(pair) {
  const region = pair.overlapBbox;
  const size = [
    Math.round((region.x1 - region.x0) * 100) / 100,
    Math.round((region.y1 - region.y0) * 100) / 100,
    Math.round((region.z1 - region.z0) * 100) / 100
  ].join("\xD7");
  return `Assembly overlap: ${pair.boardAId} \u2229 ${pair.boardBId} (${Math.round(pair.overlapMm3)} mm\xB3, region ${size} mm, ${pair.relation}).`;
}

// generators/generalTall/relationshipDeclarations.ts
var GENERAL_TALL_RELATIONSHIP_DECLARATIONS = [
  {
    declarationId: "gt_b1_b3_bottom_rail_to_deck",
    generator: "general_tall",
    panelAId: "B1",
    panelBId: "B3",
    relationshipType: "structural_butt_joint",
    geometryType: "edge_to_surface",
    hostPanelId: "B1",
    targetPanelId: "B3",
    ruleId: "general_tall_bottom_rail_deck_v1",
    allowedHardware: ["screw_hole"]
  },
  {
    declarationId: "gt_t1_t3_top_rail_to_deck",
    generator: "general_tall",
    panelAId: "T1",
    panelBId: "T3",
    relationshipType: "structural_butt_joint",
    geometryType: "edge_to_surface",
    hostPanelId: "T1",
    targetPanelId: "T3",
    ruleId: "general_tall_top_rail_deck_v1",
    allowedHardware: ["screw_hole"]
  },
  {
    declarationId: "gt_b2_b3_mid_rail_to_deck",
    generator: "general_tall",
    panelAId: "B2",
    panelBId: "B3",
    relationshipType: "structural_butt_joint",
    geometryType: "edge_to_surface",
    hostPanelId: "B2",
    targetPanelId: "B3",
    ruleId: "general_tall_mid_rail_deck_v1",
    allowedHardware: ["screw_hole"]
  },
  {
    declarationId: "gt_t2_t3_mid_rail_to_deck",
    generator: "general_tall",
    panelAId: "T2",
    panelBId: "T3",
    relationshipType: "structural_butt_joint",
    geometryType: "edge_to_surface",
    hostPanelId: "T2",
    targetPanelId: "T3",
    ruleId: "general_tall_mid_top_rail_deck_v1",
    allowedHardware: ["screw_hole"]
  }
];
var FRIDGE_SIDE_PANEL_L_V1 = {
  declarationId: "gt_sidepanel_l_v1",
  generator: "general_tall",
  panelAId: "SidePanel_L",
  panelBId: "V1",
  relationshipType: "face_contact",
  geometryType: "surface_to_surface",
  hostPanelId: "SidePanel_L",
  targetPanelId: "V1",
  ruleId: "general_tall_fridge_sidepanel_l_v1",
  allowedHardware: ["screw_hole"]
};
var FRIDGE_SIDE_PANEL_R_V2 = {
  declarationId: "gt_sidepanel_r_v2",
  generator: "general_tall",
  panelAId: "SidePanel_R",
  panelBId: "V2",
  relationshipType: "face_contact",
  geometryType: "surface_to_surface",
  hostPanelId: "SidePanel_R",
  targetPanelId: "V2",
  ruleId: "general_tall_fridge_sidepanel_r_v2",
  allowedHardware: ["screw_hole"]
};
function fridgeV5Declaration(mateId) {
  return {
    declarationId: mateId === "V1" ? "gt_v5_v1" : "gt_v5_v2",
    generator: "general_tall",
    panelAId: "V5",
    panelBId: mateId,
    relationshipType: "face_contact",
    geometryType: "surface_to_surface",
    hostPanelId: "V5",
    targetPanelId: mateId,
    ruleId: mateId === "V1" ? "general_tall_fridge_v5_v1" : "general_tall_fridge_v5_v2",
    allowedHardware: ["screw_hole"]
  };
}
function declarationPresent(item, boardIds) {
  const required = /* @__PURE__ */ new Set([item.panelAId, item.panelBId, item.hostPanelId, item.targetPanelId]);
  for (const boardId of required) {
    if (!boardIds.has(boardId)) {
      return false;
    }
  }
  return true;
}
function fridgeExtrasForBoards(boardIds) {
  const extras = [];
  if (declarationPresent(FRIDGE_SIDE_PANEL_L_V1, boardIds)) {
    extras.push(FRIDGE_SIDE_PANEL_L_V1);
  }
  if (declarationPresent(FRIDGE_SIDE_PANEL_R_V2, boardIds)) {
    extras.push(FRIDGE_SIDE_PANEL_R_V2);
  }
  if (!boardIds.has("V5")) {
    return extras;
  }
  const mateId = boardIds.has("SidePanel_L") ? "V2" : "V1";
  const v5Decl = fridgeV5Declaration(mateId);
  if (declarationPresent(v5Decl, boardIds)) {
    extras.push(v5Decl);
  }
  return extras;
}
function relationshipDeclarationsForBoards(boards) {
  const boardIds = new Set(boards.map((board2) => board2.id));
  const skeleton = GENERAL_TALL_RELATIONSHIP_DECLARATIONS.filter(
    (item) => declarationPresent(item, boardIds)
  );
  return [...skeleton, ...fridgeExtrasForBoards(boardIds)];
}

// generators/generalTall/generator.ts
var DEFAULT_PANEL_THICKNESS = 15;
var DEFAULT_FRONT_FACE_ALLOWANCE = 16;
var DEFAULT_ZI_THICKNESS2 = 15;
var DEFAULT_H_THICKNESS = 15;
var DEFAULT_SIDE_CLEARANCE = 3;
var DEFAULT_DIVIDER_THICKNESS = 15;
var DEFAULT_STYLE_1_INSERT_SLOT_THICKNESS2 = 16;
var TOP_STYLE_1_MIN_FRONT_RAIL_HEIGHT2 = 40;
var BOTTOM_STYLE_1_MIN_FRONT_RAIL_HEIGHT2 = 53;
var STYLE_1_SECOND_RAIL_THICKNESS = 15;
var STYLE_1_INSERT_FRONT_NOTCH_DEPTH = 75;
var STYLE_1_INSERT_BOARD_DEPTH = 150;
var ZI_FULL_FRONT_REAR_NOTCH_DEPTH = 105;
var ZI_HALF_FRONT_NOTCH_DEPTH = 45;
var ZI_HALF_DEPTH = 150;
var B3_GROOVE_WIDTH = 14.5;
var B3_GROOVE_DEPTH = 6.5;
var B3_GROOVE_BRANCH_COUNT = 2;
var B3_GROOVE_BRANCH_WIDTH = 20;
var ZI_SLOT_CLEARANCE = 1;
var ZI_SLOT_DEPTH = 50;
var V12_STYLE_1_Y_FRONT_FACE = 70;
var V12_STYLE_1_Y_STEP_INNER = 80;
var V12_STYLE_1_Y_REAR = 150;
var V12_STYLE_1_Y_ZI_INNER = 100;
var V34_STYLE_1_Y_FRONT = 0;
var V34_STYLE_1_Y_ZI_INNER = 50;
var V34_STYLE_1_Y_REAR = 150;
var V34_TOP_NOTCH_FRONT_Y = 29;
var V34_TOP_NOTCH_INNER_Y = 134;
var V34_TOP_REAR_NOTCH_HEIGHT = 105;
var ZI_GROOVE_WIDTH_CLEARANCE = 1;
var ZI_GROOVE_Y_OVERHANG = 5;
var DIVIDER_TONGUE_GROOVE_CLEARANCE = 0.5;
var H34_CLEARANCE_DEPTH = 16;
var H34_CLEARANCE_Z_BELOW = 5;
var H34_CLEARANCE_Z_ABOVE_START = 105;
var H12_DEPTH = 15;
var H12_SPLIT_HEIGHT = 300;
var H12_RAIL_HEIGHT = 100;
var H_SUPPORT_THICKNESS = 15;
var H_SUPPORT_HEIGHT = 100;
var H_SUPPORT_SIDE_DEPTH_START = 150;
var H_SUPPORT_SIDE_REAR_CLEARANCE = 150;
var H34_DEPTH = 15;
var END_SYSTEM_FRONT_DEPTH = 105;
var END_SYSTEM_REAR_DEPTH = 105;
var V_STYLE_2_END_NOTCH_DEPTH = 105;
var V_END_NOTCH_THICKNESS = 16;
var MIN_END_SYSTEM_GAP = 50;
var DEFAULT_FRONT_CLEARANCE = 2.5;
var DEFAULT_HINGE_CUP_DIAMETER = 35;
var DEFAULT_HINGE_CUP_DEPTH = 12.5;
var DEFAULT_HINGE_CUP_CENTER_FROM_EDGE = 22.5;
var DEFAULT_LOCK_SIDE_DISTANCE = 80;
var LOCK_MOUNTING_SURFACE_TO_SLOT_CENTER = 30.5;
var LOCK_SLOT_LENGTH = 55;
var LOCK_SLOT_WIDTH = 15.5;
var LOCK_SLOT_RADIUS = 7.75;
var GT_LOCK_PRESET_ID = "razor_long_rounded_1";
function n(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
function board(id, name, category, boardType, materialThickness, profilePlane, thicknessAxis, bounds, source, notes) {
  return {
    id,
    name,
    category,
    boardType,
    materialThickness,
    profilePlane,
    thicknessAxis,
    ...bounds,
    source,
    notes
  };
}
function findZoneItem(stackingItems, zoneId2) {
  return stackingItems.find((item) => item.type === "functional_zone" && item.zoneId === zoneId2);
}
function addFridgeV5Boards(boards, params, stackingItems, debug, notes) {
  const fridgeZones = (params.zones || []).filter((zone) => zone.type === "fridge");
  if (!fridgeZones.length) return;
  const pt = debug.panelThickness;
  const fpt = debug.frontFaceAllowance;
  const carcassY0 = fpt;
  const carcassY1 = fpt + debug.midDepth;
  const cabinetWidth = Number(params.cabinetWidth);
  const v5OnLeft = params.exteriorSide !== "left";
  for (const zone of fridgeZones) {
    const item = findZoneItem(stackingItems, zone.id);
    if (!item) {
      notes.push(`Fridge zone ${zone.id}: skipped V5 (stacking item missing).`);
      continue;
    }
    let x0;
    let x1;
    if (v5OnLeft) {
      x0 = debug.leftSidePanelThickness + pt;
      x1 = x0 + pt;
    } else {
      x1 = cabinetWidth - debug.rightSidePanelThickness - pt;
      x0 = x1 - pt;
    }
    const depth = carcassY1 - carcassY0;
    const height = item.z1 - item.z0;
    const v5Profile = [
      { y: 0, z: 0 },
      { y: depth, z: 0 },
      { y: depth, z: height },
      { y: 0, z: height },
      { y: 0, z: 0 }
    ];
    const v5Board = board(
      "V5",
      "V5",
      "vertical_structure",
      "V5",
      pt,
      "YZ",
      "X",
      {
        x0,
        x1,
        y0: carcassY0,
        y1: carcassY1,
        z0: item.z0,
        z1: item.z1
      },
      "fridge_v5",
      [
        "V5 fridge clearance strip: opposite exteriorSide (none\u2192left); Z spans fridge cavity; X inset one PT from carcass wall."
      ]
    );
    v5Board.profileVector = v5Profile;
    v5Board.cutProfileVector = v5Profile;
    boards.push(v5Board);
    notes.push(
      `Fridge zone ${zone.id}: V5 on ${v5OnLeft ? "left" : "right"} (exteriorSide=${params.exteriorSide || "none"}).`
    );
    break;
  }
}
function resolveAvoidanceAdjustment(params, debug, validation) {
  if (params.avoidance?.enabled !== true) {
    return { enabled: false };
  }
  const depth = Number(params.avoidance.depth);
  if (!Number.isFinite(depth)) {
    validation.errors.push("Avoidance depth must be a finite number.");
    return { enabled: false };
  }
  if (depth <= 0) {
    validation.errors.push(`Avoidance depth must be > 0; received ${depth}.`);
    return { enabled: false };
  }
  const shortDepth = debug.midDepth - depth;
  if (shortDepth <= 0) {
    validation.errors.push(`Avoidance ShortDepth must be > 0; received ${shortDepth}.`);
    return { enabled: false };
  }
  if (shortDepth >= debug.midDepth) {
    validation.errors.push(`Avoidance ShortDepth ${shortDepth} must be less than MidDepth ${debug.midDepth}.`);
    return { enabled: false };
  }
  if (shortDepth < ZI_SLOT_DEPTH) {
    validation.warnings.push(`Avoidance ShortDepth ${shortDepth} is less than Zi slot depth ${ZI_SLOT_DEPTH}.`);
  }
  if (params.avoidance.height === void 0 || params.avoidance.height === null) {
    validation.errors.push("Avoidance height is required when avoidance is enabled.");
    return { enabled: false };
  }
  const avoidH = Number(params.avoidance.height);
  if (!Number.isFinite(avoidH)) {
    validation.errors.push("Avoidance height is required when avoidance is enabled.");
    return { enabled: false };
  }
  if (avoidH < 0) {
    validation.errors.push("Avoidance height must be >= 0.");
    return { enabled: false };
  }
  const ch = Number(params.cabinetHeight);
  const effectiveAvoidH = avoidH > ch ? ch : avoidH;
  if (avoidH > ch) {
    validation.warnings.push("Avoidance height exceeds cabinet height; affected range capped to CH for overlap tests.");
  }
  return { enabled: true, shortDepth, effectiveAvoidH };
}
function applyFridgeRaisedAvoidance(params, stackingItems, debug, avoidance, validation) {
  const fridgeZone = (params.zones || []).find((zone) => zone.type === "fridge");
  if (!fridgeZone) return avoidance;
  const fridgeItemIndex = stackingItems.findIndex(
    (item) => item.type === "functional_zone" && item.zoneId === fridgeZone.id
  );
  if (fridgeItemIndex < 0) return avoidance;
  const below = stackingItems[fridgeItemIndex - 1];
  const fridgeItem = stackingItems[fridgeItemIndex];
  const fridgeBaseBottomZ = below?.type === "boundary_panel" ? below.z0 : fridgeItem.z0;
  const inputHeight = Number(params.avoidance?.height);
  const pt = debug.panelThickness;
  if (params.avoidance?.enabled !== true || avoidance.enabled !== true) {
    debug.fridgeAvoidance = {
      finalMode: "none",
      fridgeGap: 0,
      fridgeBaseBottomZ,
      inputHeight: Number.isFinite(inputHeight) ? inputHeight : 0
    };
    return avoidance;
  }
  if (!Number.isFinite(inputHeight)) return avoidance;
  const gap = fridgeBaseBottomZ - inputHeight;
  if (fridgeBaseBottomZ < inputHeight + pt) {
    validation.errors.push(
      `Fridge base bottom Z (${fridgeBaseBottomZ}) must be >= Avoidance Height + panel thickness (${inputHeight}+${pt}).`
    );
    debug.fridgeAvoidance = {
      finalMode: "none",
      fridgeGap: gap,
      fridgeBaseBottomZ,
      inputHeight
    };
    return avoidance;
  }
  if (gap < 105) {
    validation.warnings.push(
      `Fridge/avoidance gap ${gap.toFixed(1)} mm < 105 mm: raised avoidance mode and above-fridge HSet will be used.`
    );
    debug.fridgeAvoidance = {
      finalMode: "raised",
      fridgeGap: gap,
      fridgeBaseBottomZ,
      inputHeight
    };
    return {
      ...avoidance,
      effectiveAvoidH: fridgeBaseBottomZ,
      fridgeMode: "raised",
      fridgeGap: gap,
      fridgeBaseBottomZ
    };
  }
  validation.warnings.push(
    `Fridge/avoidance gap ${gap.toFixed(1)} mm >= 105 mm: normal avoidance height kept.`
  );
  debug.fridgeAvoidance = {
    finalMode: "normal",
    fridgeGap: gap,
    fridgeBaseBottomZ,
    inputHeight
  };
  return {
    ...avoidance,
    fridgeMode: "normal",
    fridgeGap: gap,
    fridgeBaseBottomZ
  };
}
function boundaryId(aboveZoneId, belowZoneId) {
  return `boundary-${aboveZoneId}-${belowZoneId}`;
}
function isDoubleDoorDividerSupportBoundary(boundaryItemId, zones) {
  return zones.some((zone, index) => {
    if (zone.type !== "double_door" || zone.verticalDivider !== true) return false;
    const upperZone = index > 0 ? zones[index - 1] : void 0;
    const lowerZone = index < zones.length - 1 ? zones[index + 1] : void 0;
    return upperZone && boundaryItemId === boundaryId(upperZone.id, zone.id) || lowerZone && boundaryItemId === boundaryId(zone.id, lowerZone.id);
  });
}
function addVerticalBoards(boards, params, debug, ch) {
  const pt = debug.panelThickness;
  const cabinetWidth = Number(params.cabinetWidth);
  const rspT = debug.rightSidePanelThickness;
  const fpt = debug.frontFaceAllowance;
  const midDepth = debug.midDepth;
  const carcassY0 = fpt;
  const carcassY1 = fpt + midDepth;
  const rearY0 = carcassY0 + Math.max(0, midDepth - 150);
  const rightV0 = rspT > 0 ? cabinetWidth - rspT : cabinetWidth - pt;
  const rightV1 = rspT > 0 ? cabinetWidth - rspT + pt : cabinetWidth;
  boards.push(
    board("V1", "V1", "vertical_structure", "V1", pt, "YZ", "X", {
      x0: 0,
      x1: pt,
      y0: carcassY0,
      y1: carcassY1,
      z0: 0,
      z1: ch
    }),
    board("V2", "V2", "vertical_structure", "V2", pt, "YZ", "X", {
      x0: rightV0,
      x1: rightV1,
      y0: carcassY0,
      y1: carcassY1,
      z0: 0,
      z1: ch
    }),
    board(
      "V3",
      "V3",
      "vertical_structure",
      "V3",
      pt,
      "YZ",
      "X",
      {
        x0: 0,
        x1: pt,
        y0: rearY0,
        y1: carcassY1,
        z0: 0,
        z1: ch
      },
      "core_verticals",
      ["V3/V4 exact geometry deferred"]
    ),
    board(
      "V4",
      "V4",
      "vertical_structure",
      "V4",
      pt,
      "YZ",
      "X",
      {
        x0: rightV0,
        x1: rightV1,
        y0: rearY0,
        y1: carcassY1,
        z0: 0,
        z1: ch
      },
      "core_verticals",
      ["V3/V4 exact geometry deferred"]
    )
  );
}
function sidePanelProfileVector(cabinetDepth, cabinetHeight, notch) {
  if (!notch || notch.avoidDepth <= 0 || notch.avoidHeight <= 0) {
    return [
      { y: 0, z: 0 },
      { y: cabinetDepth, z: 0 },
      { y: cabinetDepth, z: cabinetHeight },
      { y: 0, z: cabinetHeight },
      { y: 0, z: 0 }
    ];
  }
  const cutY = Math.max(0, cabinetDepth - notch.avoidDepth);
  const cutZ = Math.min(cabinetHeight, notch.avoidHeight);
  return [
    { y: 0, z: 0 },
    { y: cutY, z: 0 },
    { y: cutY, z: cutZ },
    { y: cabinetDepth, z: cutZ },
    { y: cabinetDepth, z: cabinetHeight },
    { y: 0, z: cabinetHeight },
    { y: 0, z: 0 }
  ];
}
function addSidePanelBoards(boards, params, debug, validation) {
  const cabinetWidth = Number(params.cabinetWidth);
  const cabinetDepth = Number(params.cabinetDepth);
  const cabinetHeight = Number(params.cabinetHeight);
  const leftThickness = n(params.leftSidePanelThickness, 0);
  const rightThickness = n(params.rightSidePanelThickness, 0);
  const leftAdaptAvoidance = params.leftSidePanelAdaptAvoidance !== void 0 ? params.leftSidePanelAdaptAvoidance === true : params.leftSidePanelIgnoreAvoidance !== true;
  const rightAdaptAvoidance = params.rightSidePanelAdaptAvoidance !== void 0 ? params.rightSidePanelAdaptAvoidance === true : params.rightSidePanelIgnoreAvoidance !== true;
  const practicalThicknesses = /* @__PURE__ */ new Set([0, 15, 16]);
  const avoidanceEnabled = params.avoidance?.enabled === true;
  const avoidDepthRaw = Number(params.avoidance?.depth);
  const avoidHeightRaw = Number(params.avoidance?.height);
  const avoidDepth = Number.isFinite(avoidDepthRaw) ? Math.max(0, Math.min(cabinetDepth, avoidDepthRaw)) : 0;
  const avoidHeight = Number.isFinite(avoidHeightRaw) ? Math.max(0, Math.min(cabinetHeight, avoidHeightRaw)) : 0;
  for (const [label, thickness] of [["left", leftThickness], ["right", rightThickness]]) {
    if (thickness < 0) {
      validation.errors.push(`${label}SidePanelThickness must be >= 0; received ${thickness}.`);
    } else if (!practicalThicknesses.has(thickness)) {
      validation.errors.push(`${label}SidePanelThickness must be one of 0, 15, 16; received ${thickness}.`);
    }
  }
  const addOne = (id, thickness, adaptAvoidance) => {
    if (thickness <= 0) return;
    const isLeft = id === "SidePanel_L";
    const notchApplied = avoidanceEnabled && adaptAvoidance && avoidDepth > 0 && avoidHeight > 0;
    const sidePanel = board(
      id,
      id,
      "side_panel",
      "side_panel",
      thickness,
      "YZ",
      "X",
      {
        x0: isLeft ? 0 : cabinetWidth - thickness,
        x1: isLeft ? thickness : cabinetWidth,
        y0: -debug.frontFaceAllowance,
        y1: cabinetDepth - debug.frontFaceAllowance,
        z0: 0,
        z1: cabinetHeight
      },
      "side_panel_input",
      [
        `${id} generated from side panel thickness input.`,
        `Side panel protrudes ${debug.frontFaceAllowance} mm toward -Y to cover the front panel layer.`,
        notchApplied ? "Side panel rear-lower avoidance notch applied." : avoidanceEnabled ? "Side panel avoidance notch not adapted on this side." : "Rectangular side panel profile."
      ]
    );
    sidePanel.profileVector = sidePanelProfileVector(
      cabinetDepth,
      cabinetHeight,
      notchApplied ? { avoidDepth, avoidHeight } : void 0
    );
    boards.push(sidePanel);
  };
  addOne("SidePanel_L", leftThickness, leftAdaptAvoidance);
  addOne("SidePanel_R", rightThickness, rightAdaptAvoidance);
  if (debug.midWidth <= 0) {
    validation.errors.push(
      `MidWidth must be > 0 after side panel thickness; received ${debug.midWidth} from CW ${cabinetWidth}, left ${leftThickness}, right ${rightThickness}.`
    );
  }
}
function addAvoidanceSupportBoards(boards, params, debug, validation, avoidance) {
  if (params.avoidance?.enabled !== true) return;
  const cabinetDepth = Number(params.cabinetDepth);
  const avoidDepth = Number(params.avoidance.depth);
  const avoidHeight = Number(
    avoidance?.effectiveAvoidH != null ? avoidance.effectiveAvoidH : params.avoidance.height
  );
  if (!Number.isFinite(cabinetDepth) || !Number.isFinite(avoidDepth) || !Number.isFinite(avoidHeight)) return;
  if (avoidDepth <= 0 || avoidHeight <= 0) return;
  const thickness = 15;
  const panelWidth = debug.midWidth;
  const x0 = debug.leftSidePanelThickness;
  const x1 = x0 + panelWidth;
  const y0 = cabinetDepth - avoidDepth;
  const y1 = cabinetDepth;
  const z1 = avoidHeight;
  const z0 = z1 - thickness;
  if (x1 <= x0 || y1 <= y0 || z1 <= z0) {
    validation.warnings.push("Avoidance support panels skipped due to invalid horizontal panel dimensions.");
    return;
  }
  if (x0 < 0 || x1 > Number(params.cabinetWidth)) {
    validation.warnings.push("Avoidance support panel X range exceeds cabinet width; generated as requested for inspection.");
  }
  const horizontal = board(
    "avoidance_horizontal",
    "avoidance_horizontal",
    "avoidance_support",
    "avoidance_horizontal",
    thickness,
    "XY",
    "Z",
    { x0, x1, y0, y1, z0, z1 },
    "avoidance_support",
    [
      avoidance?.fridgeMode === "raised" ? "Avoidance horizontal raised to fridge base bottom (gap < 105mm)." : "Avoidance horizontal support panel generated from avoidance settings."
    ]
  );
  horizontal.profileVector = [
    { x: 0, y: 0 },
    { x: panelWidth, y: 0 },
    { x: panelWidth, y: avoidDepth },
    { x: 0, y: avoidDepth },
    { x: 0, y: 0 }
  ];
  boards.push(horizontal);
  const verticalHeight = avoidHeight - thickness;
  if (verticalHeight <= 0) {
    validation.warnings.push("Avoidance_Vertical skipped because Avoidance height is not greater than horizontal panel thickness.");
    return;
  }
  const vy0 = cabinetDepth - avoidDepth;
  const vy1 = vy0 + thickness;
  const vertical = board(
    "Avoidance_Vertical",
    "Avoidance_Vertical",
    "avoidance_support",
    "avoidance_vertical",
    thickness,
    "XZ",
    "Y",
    { x0, x1, y0: vy0, y1: vy1, z0: 0, z1: verticalHeight },
    "avoidance_support",
    ["Avoidance vertical support panel generated from avoidance settings."]
  );
  vertical.profileVector = [
    { x: 0, z: 0 },
    { x: panelWidth, z: 0 },
    { x: panelWidth, z: verticalHeight },
    { x: 0, z: verticalHeight },
    { x: 0, z: 0 }
  ];
  boards.push(vertical);
}
function applyCoreBoardXOffset(boards, debug, params) {
  const dx = debug.leftSidePanelThickness;
  if (!Number.isFinite(dx) || Math.abs(dx) <= 1e-9) return;
  void params;
  for (const item of boards) {
    if (item.category === "side_panel" || item.category === "avoidance_support") continue;
    if (["V1", "V2", "V3", "V4"].includes(item.id)) continue;
    item.x0 += dx;
    item.x1 += dx;
  }
}
function updateSidePanelOverlapAudit(boards, debug, validation) {
  const sidePanels = boards.filter((item) => item.category === "side_panel" && (item.id === "SidePanel_L" || item.id === "SidePanel_R"));
  const verticalBoards = boards.filter((item) => ["V1", "V2", "V3", "V4"].includes(item.id));
  const fpt = debug.frontFaceAllowance;
  const bboxOf = (item) => ({
    x0: item.x0,
    x1: item.x1,
    y0: item.y0,
    y1: item.y1,
    z0: item.z0,
    z1: item.z1
  });
  const overlaps3d = (a, b) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0 && a.z0 < b.z1 && a.z1 > b.z0;
  const sharesXSlab = (sidePanel, verticalBoard) => Math.abs(sidePanel.x0 - verticalBoard.x0) <= 1e-3 && Math.abs(sidePanel.x1 - verticalBoard.x1) <= 1e-3;
  if (sidePanels.length === 0) {
    debug.sidePanelOverlapAudit = void 0;
    return;
  }
  for (const sidePanel of sidePanels) {
    const verticalId = sidePanel.id === "SidePanel_L" ? "V1" : "V2";
    const verticalBoard = verticalBoards.find((item) => item.id === verticalId);
    if (!verticalBoard || !sharesXSlab(sidePanel, verticalBoard)) continue;
    const expectedFrontY = -fpt;
    const expectedCarcassY0 = fpt;
    if (Math.abs(sidePanel.y0 - expectedFrontY) > 0.01) {
      validation?.warnings.push(
        `${sidePanel.id} y0 ${sidePanel.y0} differs from expected front wrap ${expectedFrontY} (FPT ${fpt}).`
      );
    }
    if (Math.abs(verticalBoard.y0 - expectedCarcassY0) > 0.01) {
      validation?.warnings.push(
        `${verticalId} y0 ${verticalBoard.y0} differs from expected carcass start ${expectedCarcassY0} (FPT ${fpt}).`
      );
    }
  }
  debug.sidePanelOverlapAudit = {
    sidePanels: sidePanels.map((item) => ({
      boardId: item.id,
      bbox: bboxOf(item)
    })),
    verticalBoards: verticalBoards.map((item) => ({
      boardId: item.id,
      bbox: bboxOf(item)
    })),
    overlaps: sidePanels.flatMap(
      (sidePanel) => verticalBoards.map((verticalBoard) => {
        const overlaps = overlaps3d(sidePanel, verticalBoard);
        return {
          sidePanelId: sidePanel.id,
          verticalBoardId: verticalBoard.id,
          overlaps,
          note: overlaps ? "Overlap is visible and expected in current inner-width model; non-fatal." : "No overlap detected."
        };
      })
    ),
    note: "V stiles share the side-panel X slab (0..pt left, cw-rspT..cw right); core boards use inner span offset."
  };
}
function updateAssemblyOverlapAudit(boards, debug, validation) {
  const audit = runAssemblyOverlapAudit(boards);
  debug.assemblyOverlapAudit = audit;
  for (const pair of audit.unexpectedOverlaps) {
    validation.warnings.push(formatAssemblyOverlapWarning(pair));
  }
}
function style1FrontRailHeight(value, minHeight) {
  return Math.max(n(value, minHeight), minHeight);
}
function style1InsertSlotThickness(value) {
  return n(value, DEFAULT_STYLE_1_INSERT_SLOT_THICKNESS2);
}
function addProfileFeature(board2, feature) {
  board2.profileFeatures ??= [];
  board2.profileFeatures.push(feature);
}
function addVBoardSideProfileSkeletons(boards, features, params, debug, validation, avoidance) {
  const ch = Number(params.cabinetHeight);
  const vBoards = boards.filter((board2) => ["V1", "V2", "V3", "V4"].includes(board2.id));
  const useStyle1RealVerticalProfiles = params.topSystem.style === "style_1" && params.bottomSystem.style === "style_1";
  const defaultVStileDepth = 150;
  for (const vBoard of vBoards) {
    vBoard.profileVector = [
      { y: 0, z: 0 },
      { y: defaultVStileDepth, z: 0 },
      { y: defaultVStileDepth, z: ch },
      { y: 0, z: ch },
      { y: 0, z: 0 }
    ];
    vBoard.profileFeatures = [];
    if (!useStyle1RealVerticalProfiles) {
      vBoard.notes = [
        ...vBoard.notes ?? [],
        "Exact side profile cut vector deferred; profileFeatures contain slot/notch data"
      ];
    }
    if (!useStyle1RealVerticalProfiles) {
      vBoard.notes = [
        ...vBoard.notes ?? [],
        "Style 2 real side profile deferred"
      ];
    }
  }
  if (params.topSystem.style === "style_1") {
    const frontRailHeight = style1FrontRailHeight(params.topSystem.frontRailHeight, TOP_STYLE_1_MIN_FRONT_RAIL_HEIGHT2);
    const insertSlotThickness = style1InsertSlotThickness(params.topSystem.insertSlotThickness);
    const topSystemHeight = frontRailHeight + insertSlotThickness;
    for (const vBoard of vBoards) {
      if (vBoard.id === "V3" || vBoard.id === "V4") continue;
      addProfileFeature(vBoard, {
        type: "style1_top_insert_slot",
        y0: 0,
        y1: 150,
        z0: ch - topSystemHeight,
        z1: ch - frontRailHeight,
        source: "top_system",
        notes: ["Exact top style side notch vector deferred"]
      });
    }
  } else if (params.topSystem.style === "style_2") {
    const notchZ0 = Math.max(0, ch - V_END_NOTCH_THICKNESS);
    const notchZ1 = ch;
    for (const vBoard of vBoards) {
      if (vBoard.id === "V3" || vBoard.id === "V4") continue;
      addProfileFeature(vBoard, {
        type: "style1_top_insert_slot",
        y0: 0,
        y1: V_STYLE_2_END_NOTCH_DEPTH,
        z0: notchZ0,
        z1: notchZ1,
        source: "top_system_style2",
        notes: ["Style 2 top side notch (105x16)"]
      });
    }
  }
  if (params.bottomSystem.style === "style_1") {
    const frontRailHeight = style1FrontRailHeight(
      params.bottomSystem.frontRailHeight,
      BOTTOM_STYLE_1_MIN_FRONT_RAIL_HEIGHT2
    );
    const insertSlotThickness = style1InsertSlotThickness(params.bottomSystem.insertSlotThickness);
    const bottomSystemHeight = frontRailHeight + insertSlotThickness;
    for (const vBoard of vBoards) {
      if (vBoard.id === "V3" || vBoard.id === "V4") continue;
      addProfileFeature(vBoard, {
        type: "style1_bottom_insert_slot",
        y0: 0,
        y1: 150,
        z0: frontRailHeight,
        z1: bottomSystemHeight,
        source: "bottom_system",
        notes: ["Exact bottom style side notch vector deferred"]
      });
    }
  } else if (params.bottomSystem.style === "style_2") {
    const notchZ0 = 0;
    const notchZ1 = Math.min(ch, V_END_NOTCH_THICKNESS);
    for (const vBoard of vBoards) {
      if (vBoard.id === "V3" || vBoard.id === "V4") continue;
      addProfileFeature(vBoard, {
        type: "style1_bottom_insert_slot",
        y0: 0,
        y1: V_STYLE_2_END_NOTCH_DEPTH,
        z0: notchZ0,
        z1: notchZ1,
        source: "bottom_system_style2",
        notes: ["Style 2 bottom side notch (105x16)"]
      });
    }
  }
  for (const feature of features) {
    if (feature.type !== "zi_slot") continue;
    const targetBoard = boards.find((board2) => board2.id === feature.targetBoardId);
    if (!targetBoard) continue;
    addProfileFeature(targetBoard, {
      type: "zi_slot",
      y0: feature.y0,
      y1: feature.y1,
      z0: feature.z0,
      z1: feature.z1,
      source: feature.source,
      boundaryId: feature.boundaryId,
      boundaryType: feature.boundaryType
    });
  }
  for (const vBoard of vBoards) {
    if (vBoard.id === "V1" || vBoard.id === "V2") {
      const realProfile = buildV12CombinedSideProfileVector(vBoard, params, ch, validation);
      vBoard.profileVector = realProfile;
      vBoard.cutProfileVector = realProfile;
      vBoard.notes = [
        ...vBoard.notes ?? [],
        useStyle1RealVerticalProfiles ? "Style 1 real side profile implemented" : "V1/V2 combined style side profile implemented"
      ];
    } else if (vBoard.id === "V3" || vBoard.id === "V4") {
      const rearStileProfile = buildV34Style1RearStileProfileVector(
        vBoard,
        ch,
        validation,
        v34AvoidanceCutout(params, avoidance),
        true
      );
      vBoard.profileVector = rearStileProfile;
      vBoard.cutProfileVector = rearStileProfile;
      vBoard.notes = [
        ...(vBoard.notes ?? []).filter((note) => note !== "V3/V4 exact geometry deferred"),
        "Style 1 rear-stile profile implemented; rear top/bottom L-slot refinements deferred."
      ];
      if (v34AvoidanceCutout(params, avoidance).enabled) {
        vBoard.notes.push("Rear avoidance cutout applied to V3/V4 rear-stile profile.");
      }
    } else {
      const cutProfile = buildZiSlotCutProfileVector(vBoard, defaultVStileDepth, ch, validation);
      if (vBoard.id === "V1" || vBoard.id === "V2") {
        vBoard.cutProfileVector = normalizeV12Style2EndNotches(
          cutProfile,
          ch,
          params.topSystem.style === "style_2",
          params.bottomSystem.style === "style_2"
        );
      } else {
        vBoard.cutProfileVector = cutProfile;
      }
    }
  }
}
function v34AvoidanceCutout(params, avoidance) {
  const avoidD = Number(params.avoidance?.depth);
  const avoidH = typeof avoidance.effectiveAvoidH === "number" ? avoidance.effectiveAvoidH : 0;
  if (avoidance.enabled !== true || !Number.isFinite(avoidD) || avoidD <= 0 || avoidH <= 0) {
    return { enabled: false, affectedY0: V34_STYLE_1_Y_REAR, avoidH: 0 };
  }
  return {
    enabled: true,
    affectedY0: Math.max(V34_STYLE_1_Y_FRONT, V34_STYLE_1_Y_REAR - avoidD),
    avoidH
  };
}
function buildV12CombinedSideProfileVector(board2, params, cabinetHeight, validation) {
  const isTopStyle1 = params.topSystem.style === "style_1";
  const isBottomStyle1 = params.bottomSystem.style === "style_1";
  const topRailHeight = isTopStyle1 ? style1FrontRailHeight(params.topSystem.frontRailHeight, TOP_STYLE_1_MIN_FRONT_RAIL_HEIGHT2) : 0;
  const topInsertSlotThickness = isTopStyle1 ? style1InsertSlotThickness(params.topSystem.insertSlotThickness) : 0;
  const topSystemHeight = topRailHeight + topInsertSlotThickness;
  const topPanelBottomZ = cabinetHeight - topSystemHeight;
  const topPanelTopZ = cabinetHeight - topRailHeight;
  const bottomRailHeight = isBottomStyle1 ? style1FrontRailHeight(
    params.bottomSystem.frontRailHeight,
    BOTTOM_STYLE_1_MIN_FRONT_RAIL_HEIGHT2
  ) : 0;
  const bottomInsertSlotThickness = isBottomStyle1 ? style1InsertSlotThickness(params.bottomSystem.insertSlotThickness) : 0;
  const bottomSystemHeight = bottomRailHeight + bottomInsertSlotThickness;
  const bottomRailTopZ = bottomRailHeight;
  const bottomPanelTopZ = bottomSystemHeight;
  const rearSlots = (board2.profileFeatures ?? []).filter((feature) => feature.type === "zi_slot").sort((a, b) => a.z0 - b.z0);
  const points = [];
  if (isBottomStyle1) {
    points.push({ y: V12_STYLE_1_Y_FRONT_FACE, z: 0 }, { y: V12_STYLE_1_Y_REAR, z: 0 });
  } else {
    points.push({ y: V12_STYLE_1_Y_REAR, z: 0 });
  }
  let previousRearSlotZ1 = -Infinity;
  for (const slot of rearSlots) {
    if (slot.z1 <= slot.z0) {
      validation.warnings.push(`Invalid zi_slot profileFeature on ${board2.id}: ${slot.source ?? "unknown source"}.`);
      continue;
    }
    if (slot.z0 < previousRearSlotZ1) {
      validation.warnings.push(`Overlapping zi_slot profileFeatures on ${board2.id}: ${slot.source ?? "unknown source"}.`);
    }
    points.push(
      { y: V12_STYLE_1_Y_REAR, z: slot.z0 },
      { y: V12_STYLE_1_Y_ZI_INNER, z: slot.z0 },
      { y: V12_STYLE_1_Y_ZI_INNER, z: slot.z1 },
      { y: V12_STYLE_1_Y_REAR, z: slot.z1 }
    );
    previousRearSlotZ1 = Math.max(previousRearSlotZ1, slot.z1);
  }
  points.push({ y: V12_STYLE_1_Y_REAR, z: cabinetHeight });
  if (isTopStyle1) {
    points.push(
      { y: V12_STYLE_1_Y_FRONT_FACE, z: cabinetHeight },
      { y: V12_STYLE_1_Y_FRONT_FACE, z: topPanelTopZ },
      { y: V12_STYLE_1_Y_STEP_INNER, z: topPanelTopZ },
      { y: V12_STYLE_1_Y_STEP_INNER, z: topPanelBottomZ },
      { y: 0, z: topPanelBottomZ }
    );
  } else {
    points.push(
      { y: V_STYLE_2_END_NOTCH_DEPTH, z: cabinetHeight },
      { y: V_STYLE_2_END_NOTCH_DEPTH, z: cabinetHeight - V_END_NOTCH_THICKNESS },
      { y: 0, z: cabinetHeight - V_END_NOTCH_THICKNESS }
    );
  }
  if (isBottomStyle1) {
    points.push(
      { y: 0, z: bottomPanelTopZ },
      { y: V12_STYLE_1_Y_STEP_INNER, z: bottomPanelTopZ },
      { y: V12_STYLE_1_Y_STEP_INNER, z: bottomRailTopZ },
      { y: V12_STYLE_1_Y_FRONT_FACE, z: bottomRailTopZ },
      { y: V12_STYLE_1_Y_FRONT_FACE, z: 0 }
    );
  } else {
    points.push(
      { y: 0, z: V_END_NOTCH_THICKNESS },
      { y: V_STYLE_2_END_NOTCH_DEPTH, z: V_END_NOTCH_THICKNESS },
      { y: V_STYLE_2_END_NOTCH_DEPTH, z: 0 },
      { y: V12_STYLE_1_Y_REAR, z: 0 }
    );
  }
  return points;
}
function buildV34Style1RearStileProfileVector(board2, cabinetHeight, validation, avoidanceCutout, hasStyle2TopNotch = false) {
  const slots = (board2.profileFeatures ?? []).filter((feature) => feature.type === "zi_slot" && feature.boundaryType === "full_zi").sort((a, b) => b.z1 - a.z1);
  const points = [];
  const closePoint = avoidanceCutout.enabled && avoidanceCutout.affectedY0 === V34_STYLE_1_Y_FRONT ? { y: V34_STYLE_1_Y_FRONT, z: avoidanceCutout.avoidH } : { y: V34_STYLE_1_Y_FRONT, z: 0 };
  if (avoidanceCutout.enabled) {
    if (avoidanceCutout.affectedY0 > V34_STYLE_1_Y_FRONT) {
      points.push(
        { y: V34_STYLE_1_Y_FRONT, z: 0 },
        { y: avoidanceCutout.affectedY0, z: 0 },
        { y: avoidanceCutout.affectedY0, z: avoidanceCutout.avoidH },
        { y: V34_STYLE_1_Y_REAR, z: avoidanceCutout.avoidH }
      );
    } else {
      points.push(
        { y: V34_STYLE_1_Y_FRONT, z: avoidanceCutout.avoidH },
        { y: V34_STYLE_1_Y_REAR, z: avoidanceCutout.avoidH }
      );
    }
    points.push(...v34TopProfileSegment(cabinetHeight, hasStyle2TopNotch));
  } else {
    points.push(
      { y: V34_STYLE_1_Y_FRONT, z: 0 },
      { y: V34_STYLE_1_Y_REAR, z: 0 },
      ...v34TopProfileSegment(cabinetHeight, hasStyle2TopNotch)
    );
  }
  let previousSlotZ0 = Infinity;
  for (const slot of slots) {
    if (slot.z1 <= slot.z0) {
      validation.warnings.push(`Invalid zi_slot profileFeature on ${board2.id}: ${slot.source ?? "unknown source"}.`);
      continue;
    }
    if (slot.z1 > previousSlotZ0) {
      validation.warnings.push(`Overlapping zi_slot profileFeatures on ${board2.id}: ${slot.source ?? "unknown source"}.`);
    }
    if (avoidanceCutout.enabled && avoidanceCutout.affectedY0 <= V34_STYLE_1_Y_ZI_INNER && slot.z0 < avoidanceCutout.avoidH) {
      if (slot.z1 > avoidanceCutout.avoidH) {
        validation.warnings.push("V3/V4 Zi slot intersects avoidance cutout; slot omitted in V1.1.");
      }
      continue;
    }
    points.push(
      { y: V34_STYLE_1_Y_FRONT, z: slot.z1 },
      { y: V34_STYLE_1_Y_ZI_INNER, z: slot.z1 },
      { y: V34_STYLE_1_Y_ZI_INNER, z: slot.z0 },
      { y: V34_STYLE_1_Y_FRONT, z: slot.z0 }
    );
    previousSlotZ0 = Math.min(previousSlotZ0, slot.z0);
  }
  points.push(closePoint);
  return points;
}
function v34TopProfileSegment(cabinetHeight, hasStyle2TopNotch) {
  if (!hasStyle2TopNotch) {
    return [
      { y: V34_STYLE_1_Y_REAR, z: cabinetHeight },
      { y: V34_STYLE_1_Y_FRONT, z: cabinetHeight }
    ];
  }
  return [
    { y: V34_STYLE_1_Y_REAR, z: cabinetHeight - V34_TOP_REAR_NOTCH_HEIGHT },
    { y: V34_STYLE_1_Y_REAR - V_END_NOTCH_THICKNESS, z: cabinetHeight - V34_TOP_REAR_NOTCH_HEIGHT },
    { y: V34_TOP_NOTCH_INNER_Y, z: cabinetHeight - V_END_NOTCH_THICKNESS },
    { y: V34_TOP_NOTCH_FRONT_Y, z: cabinetHeight - V_END_NOTCH_THICKNESS },
    { y: V34_TOP_NOTCH_FRONT_Y, z: cabinetHeight },
    { y: V34_STYLE_1_Y_FRONT, z: cabinetHeight }
  ];
}
function buildZiSlotCutProfileVector(board2, midDepth, cabinetHeight, validation) {
  const rearSlots = (board2.profileFeatures ?? []).filter((feature) => feature.type === "zi_slot").sort((a, b) => a.z0 - b.z0);
  const frontSlots = (board2.profileFeatures ?? []).filter((feature) => feature.type === "style1_top_insert_slot" || feature.type === "style1_bottom_insert_slot").sort((a, b) => b.z0 - a.z0);
  const points = [
    { y: 0, z: 0 },
    { y: midDepth, z: 0 }
  ];
  let previousRearSlotZ1 = -Infinity;
  for (const slot of rearSlots) {
    if (slot.y1 <= slot.y0 || slot.z1 <= slot.z0) {
      validation.warnings.push(`Invalid zi_slot profileFeature on ${board2.id}: ${slot.source ?? "unknown source"}.`);
      continue;
    }
    if (slot.z0 < previousRearSlotZ1) {
      validation.warnings.push(`Overlapping zi_slot profileFeatures on ${board2.id}: ${slot.source ?? "unknown source"}.`);
    }
    points.push(
      { y: slot.y1, z: slot.z0 },
      { y: slot.y0, z: slot.z0 },
      { y: slot.y0, z: slot.z1 },
      { y: slot.y1, z: slot.z1 }
    );
    previousRearSlotZ1 = Math.max(previousRearSlotZ1, slot.z1);
  }
  points.push(
    { y: midDepth, z: cabinetHeight },
    { y: 0, z: cabinetHeight }
  );
  let previousFrontSlotZ0 = Infinity;
  for (const slot of frontSlots) {
    if (slot.y1 <= slot.y0 || slot.z1 <= slot.z0) {
      validation.warnings.push(`Invalid ${slot.type} profileFeature on ${board2.id}: ${slot.source ?? "unknown source"}.`);
      continue;
    }
    if (slot.z1 > previousFrontSlotZ0) {
      validation.warnings.push(`Overlapping Style 1 insert profileFeatures on ${board2.id}: ${slot.source ?? slot.type}.`);
    }
    points.push(
      { y: slot.y0, z: slot.z1 },
      { y: slot.y1, z: slot.z1 },
      { y: slot.y1, z: slot.z0 },
      { y: slot.y0, z: slot.z0 }
    );
    previousFrontSlotZ0 = Math.min(previousFrontSlotZ0, slot.z0);
  }
  points.push({ y: 0, z: 0 });
  return points;
}
function normalizeV12Style2EndNotches(points, cabinetHeight, hasTopStyle2, hasBottomStyle2) {
  if (!hasTopStyle2 && !hasBottomStyle2) return points;
  const filtered = points.filter((point) => {
    if (hasBottomStyle2 && point.y === 0 && point.z === 0) return false;
    if (hasTopStyle2 && point.y === 0 && point.z === cabinetHeight) return false;
    return true;
  });
  if (filtered.length === 0) return points;
  const deduped = [];
  for (const point of filtered) {
    const prev = deduped[deduped.length - 1];
    if (!prev || prev.y !== point.y || prev.z !== point.z) deduped.push(point);
  }
  const first = deduped[0];
  const last = deduped[deduped.length - 1];
  if (first && last && (first.y !== last.y || first.z !== last.z)) {
    deduped.push({ ...first });
  }
  return deduped;
}
function addStyle1TopSystemBoards(boards, params, debug) {
  if (params.topSystem.style !== "style_1") return;
  const ch = Number(params.cabinetHeight);
  const frontRailHeight = style1FrontRailHeight(params.topSystem.frontRailHeight, TOP_STYLE_1_MIN_FRONT_RAIL_HEIGHT2);
  const frontRailZ0 = ch - frontRailHeight;
  const insertZ1 = ch - frontRailHeight;
  boards.push(
    board("T1", "T1", "top_system", "T1", 16, "XZ", "Y", {
      x0: 0,
      x1: debug.midWidth,
      y0: 0,
      y1: 16,
      z0: frontRailZ0,
      z1: ch
    }, "top_system", ["Style 1 top front rail"]),
    board("T2", "T2", "top_system", "T2", STYLE_1_SECOND_RAIL_THICKNESS, "XZ", "Y", {
      x0: 0,
      x1: debug.midWidth,
      y0: 16,
      y1: 31,
      z0: frontRailZ0,
      z1: ch
    }, "top_system", ["Style 1 second top rail behind T1"]),
    // Board solid follows CPT (panelThickness); the V-stile insert slot stays
    // insertSlotThickness for clearance. T3 sits top-flush under the front
    // rails, matching the fridge module's T3Ref (topFaceZ = slot top).
    board("T3", "T3", "top_system", "T3", debug.panelThickness, "XY", "Z", {
      x0: 0,
      x1: debug.midWidth,
      y0: 0,
      y1: 150,
      z0: insertZ1 - debug.panelThickness,
      z1: insertZ1
    }, "top_system", ["Style 1 top inserted board"])
  );
}
function addStyle1BottomSystemBoards(boards, params, debug) {
  if (params.bottomSystem.style !== "style_1") return;
  const frontRailHeight = style1FrontRailHeight(
    params.bottomSystem.frontRailHeight,
    BOTTOM_STYLE_1_MIN_FRONT_RAIL_HEIGHT2
  );
  boards.push(
    board("B1", "B1", "bottom_system", "B1", 16, "XZ", "Y", {
      x0: 0,
      x1: debug.midWidth,
      y0: 0,
      y1: 16,
      z0: 0,
      z1: frontRailHeight
    }, "bottom_system", ["Style 1 bottom front rail"]),
    board("B2", "B2", "bottom_system", "B2", STYLE_1_SECOND_RAIL_THICKNESS, "XZ", "Y", {
      x0: 0,
      x1: debug.midWidth,
      y0: 16,
      y1: 31,
      z0: 0,
      z1: frontRailHeight
    }, "bottom_system", ["Style 1 second bottom rail behind B1"]),
    // Board solid follows CPT (panelThickness); the V-stile insert slot stays
    // insertSlotThickness for clearance. B3 rests bottom-flush on the front
    // rails, matching the fridge module's B3Ref (bottomFaceZ = rail top).
    board("B3", "B3", "bottom_system", "B3", debug.panelThickness, "XY", "Z", {
      x0: 0,
      x1: debug.midWidth,
      y0: 0,
      y1: 150,
      z0: frontRailHeight,
      z1: frontRailHeight + debug.panelThickness
    }, "bottom_system", [
      "Style 1 bottom inserted board",
      "B3 groove placeholder remains feature-only"
    ])
  );
}
function style1InsertBoardProfileVector(midWidth, notchWidth) {
  return [
    { x: notchWidth, y: 0 },
    { x: notchWidth, y: STYLE_1_INSERT_FRONT_NOTCH_DEPTH },
    { x: 0, y: STYLE_1_INSERT_FRONT_NOTCH_DEPTH },
    { x: 0, y: STYLE_1_INSERT_BOARD_DEPTH },
    { x: midWidth, y: STYLE_1_INSERT_BOARD_DEPTH },
    { x: midWidth, y: STYLE_1_INSERT_FRONT_NOTCH_DEPTH },
    { x: midWidth - notchWidth, y: STYLE_1_INSERT_FRONT_NOTCH_DEPTH },
    { x: midWidth - notchWidth, y: 0 },
    { x: notchWidth, y: 0 }
  ];
}
function addStyle1InsertBoardProfileVectors(boards, debug) {
  const t3 = boards.find((board2) => board2.id === "T3" && board2.boardType === "T3");
  if (t3) {
    t3.profileVector = style1InsertBoardProfileVector(debug.midWidth, debug.panelThickness);
    t3.notes = ["Style 1 top inserted board", "Exact Style 1 T3 notched profileVector implemented"];
  }
  const b3 = boards.find((board2) => board2.id === "B3" && board2.boardType === "B3");
  if (b3) {
    b3.profileVector = style1InsertBoardProfileVector(debug.midWidth, debug.panelThickness);
    b3.notes = [
      "Style 1 bottom inserted board",
      "Exact Style 1 B3 notched profileVector implemented",
      "B3 groove placeholder remains feature-only; exact path deferred"
    ];
  }
}
function addSystemPlaceholders(boards, params, debug, topSystemHeight, bottomSystemHeight) {
  const ch = Number(params.cabinetHeight);
  if (params.bottomSystem.style !== "style_1" && params.bottomSystem.style !== "style_2") {
    boards.push(board(
      "BottomSystem",
      "Bottom System Placeholder",
      "bottom_system",
      "bottom_system_placeholder",
      debug.ziThickness,
      "XY",
      "Z",
      {
        x0: 0,
        x1: debug.midWidth,
        y0: 0,
        y1: debug.midDepth,
        z0: 0,
        z1: bottomSystemHeight
      },
      "bottom_system",
      ["Exact Style 1/2 bottom board geometry deferred"]
    ));
  }
  if (params.topSystem.style !== "style_1" && params.topSystem.style !== "style_2") {
    boards.push(board(
      "TopSystem",
      "Top System Placeholder",
      "top_system",
      "top_system_placeholder",
      debug.ziThickness,
      "XY",
      "Z",
      {
        x0: 0,
        x1: debug.midWidth,
        y0: 0,
        y1: debug.midDepth,
        z0: ch - topSystemHeight,
        z1: ch
      },
      "top_system",
      ["Exact Style 1/2 top board geometry deferred"]
    ));
  }
}
function addStyle2SystemPanels(boards, params, debug) {
  const ch = Number(params.cabinetHeight);
  if (params.topSystem.style === "style_2") {
    boards.push(
      board(
        "TH1",
        "Top Style 2 Front System Panel",
        "top_system",
        "TH1",
        15,
        "XY",
        "Z",
        {
          x0: 0,
          x1: debug.midWidth,
          y0: 0,
          y1: 100,
          z0: ch - 16,
          z1: ch - 1
        },
        "top_system",
        ["Top style_2 front system panel (100 depth, 15 thickness)."]
      )
    );
  }
  if (params.bottomSystem.style === "style_2") {
    boards.push(
      board(
        "BH1",
        "Bottom Style 2 Front System Panel",
        "bottom_system",
        "BH1",
        15,
        "XY",
        "Z",
        {
          x0: 0,
          x1: debug.midWidth,
          y0: 0,
          y1: 100,
          z0: 1,
          z1: 16
        },
        "bottom_system",
        ["Bottom style_2 front system panel (100 depth, 15 thickness)."]
      )
    );
  }
}
function addBoundaryZiBoards(boards, stackingItems, debug, params, avoidance) {
  let ziIndex = 1;
  for (const item of stackingItems) {
    if (item.type !== "boundary_panel") continue;
    if (item.boundaryType !== "full_zi" && item.boundaryType !== "half_zi") continue;
    const shouldShorten = avoidance.enabled && typeof avoidance.shortDepth === "number" && typeof avoidance.effectiveAvoidH === "number" && item.boundaryType === "full_zi" && item.z0 < avoidance.effectiveAvoidH && item.z1 > 0 && !isDoubleDoorDividerSupportBoundary(item.id, params.zones);
    const boardType = shouldShorten ? "shortened_zi" : item.boundaryType;
    const notes = boardType === "shortened_zi" ? ["Converted from full_zi by avoidance adjustment", "V1 simplified avoidance shortening rule"] : void 0;
    boards.push(
      board(
        `Zi${ziIndex}`,
        `${boardType === "shortened_zi" ? "Shortened" : boardType === "full_zi" ? "Full" : "Half"} Zi ${ziIndex}`,
        "boundary_panel",
        boardType,
        debug.ziThickness,
        "XY",
        "Z",
        {
          x0: 0,
          x1: debug.midWidth,
          y0: 0,
          y1: shouldShorten ? avoidance.shortDepth : debug.midDepth,
          z0: item.z0,
          z1: item.z1
        },
        item.id,
        notes
      )
    );
    ziIndex += 1;
  }
}
function fullZiProfileVector(midWidth, midDepth, notchWidth) {
  return [
    { x: notchWidth, y: 0 },
    { x: notchWidth, y: ZI_FULL_FRONT_REAR_NOTCH_DEPTH },
    { x: 0, y: ZI_FULL_FRONT_REAR_NOTCH_DEPTH },
    { x: 0, y: midDepth - ZI_FULL_FRONT_REAR_NOTCH_DEPTH },
    { x: notchWidth, y: midDepth - ZI_FULL_FRONT_REAR_NOTCH_DEPTH },
    { x: notchWidth, y: midDepth },
    { x: midWidth - notchWidth, y: midDepth },
    { x: midWidth - notchWidth, y: midDepth - ZI_FULL_FRONT_REAR_NOTCH_DEPTH },
    { x: midWidth, y: midDepth - ZI_FULL_FRONT_REAR_NOTCH_DEPTH },
    { x: midWidth, y: ZI_FULL_FRONT_REAR_NOTCH_DEPTH },
    { x: midWidth - notchWidth, y: ZI_FULL_FRONT_REAR_NOTCH_DEPTH },
    { x: midWidth - notchWidth, y: 0 },
    { x: notchWidth, y: 0 }
  ];
}
function halfZiProfileVector(midWidth, notchWidth) {
  return [
    { x: 0, y: 0 },
    { x: 0, y: ZI_HALF_FRONT_NOTCH_DEPTH },
    { x: notchWidth, y: ZI_HALF_FRONT_NOTCH_DEPTH },
    { x: notchWidth, y: ZI_HALF_DEPTH },
    { x: midWidth - notchWidth, y: ZI_HALF_DEPTH },
    { x: midWidth - notchWidth, y: ZI_HALF_FRONT_NOTCH_DEPTH },
    { x: midWidth, y: ZI_HALF_FRONT_NOTCH_DEPTH },
    { x: midWidth, y: 0 },
    { x: 0, y: 0 }
  ];
}
function shortenedZiProfileVector(midWidth, shortDepth, notchWidth, validation) {
  if (shortDepth < ZI_HALF_DEPTH) {
    validation.warnings.push("shortened_zi ShortDepth below 150mm; exact notch geometry may be invalid.");
  }
  if (shortDepth <= ZI_FULL_FRONT_REAR_NOTCH_DEPTH) {
    return [
      { x: 0, y: 0 },
      { x: midWidth, y: 0 },
      { x: midWidth, y: shortDepth },
      { x: 0, y: shortDepth },
      { x: 0, y: 0 }
    ];
  }
  return [
    { x: notchWidth, y: 0 },
    { x: notchWidth, y: ZI_FULL_FRONT_REAR_NOTCH_DEPTH },
    { x: 0, y: ZI_FULL_FRONT_REAR_NOTCH_DEPTH },
    { x: 0, y: shortDepth },
    { x: midWidth, y: shortDepth },
    { x: midWidth, y: ZI_FULL_FRONT_REAR_NOTCH_DEPTH },
    { x: midWidth - notchWidth, y: ZI_FULL_FRONT_REAR_NOTCH_DEPTH },
    { x: midWidth - notchWidth, y: 0 },
    { x: notchWidth, y: 0 }
  ];
}
function exactZiNotes(board2, note) {
  return [
    ...(board2.notes ?? []).filter(
      (existing) => existing !== "Exact half Zi profile/vector deferred" && existing !== "Exact half Zi profile vector deferred"
    ),
    note
  ];
}
function addZiBoardProfileVectors(boards, debug, validation) {
  for (const board2 of boards) {
    if (board2.boardType !== "full_zi" && board2.boardType !== "half_zi" && board2.boardType !== "shortened_zi") continue;
    if (board2.boardType === "full_zi") {
      board2.profileVector = fullZiProfileVector(debug.midWidth, debug.midDepth, debug.panelThickness);
      board2.notes = exactZiNotes(board2, "Exact full_zi notched outer profile implemented; groove machining remains feature-only.");
    } else if (board2.boardType === "half_zi") {
      board2.profileVector = halfZiProfileVector(debug.midWidth, debug.panelThickness);
      board2.notes = exactZiNotes(board2, "Exact half_zi outer profile implemented.");
    } else {
      board2.profileVector = shortenedZiProfileVector(debug.midWidth, board2.y1, debug.panelThickness, validation);
      board2.notes = exactZiNotes(board2, "Exact shortened_zi notched outer profile implemented; rear connection omitted.");
    }
  }
}
function generatedBoundaryBoardType(boards, boundaryId2) {
  const boundaryBoard = boards.find((board2) => board2.category === "boundary_panel" && board2.source === boundaryId2);
  if (boundaryBoard?.boardType === "full_zi" || boundaryBoard?.boardType === "half_zi" || boundaryBoard?.boardType === "shortened_zi") {
    return boundaryBoard.boardType;
  }
  return void 0;
}
function generateZiSlotFeatures(stackingItems, boards, debug, validation) {
  const features = [];
  const targetBoardIds = ["V1", "V2", "V3", "V4"];
  for (const item of stackingItems) {
    if (item.type !== "boundary_panel") continue;
    if (item.boundaryType !== "full_zi" && item.boundaryType !== "half_zi") continue;
    if (typeof item.centerZ !== "number") continue;
    const boundaryBoardType = generatedBoundaryBoardType(boards, item.id) ?? item.boundaryType;
    const boundaryBoard = boards.find((board2) => board2.category === "boundary_panel" && board2.source === item.id);
    const slotY1 = boundaryBoardType === "shortened_zi" && boundaryBoard ? boundaryBoard.y1 : debug.midDepth;
    const slotY0 = slotY1 < ZI_SLOT_DEPTH ? 0 : slotY1 - ZI_SLOT_DEPTH;
    if (boundaryBoardType === "shortened_zi" && slotY1 < ZI_SLOT_DEPTH) {
      validation.warnings.push(`Zi slot depth clamped for shortened_zi boundary ${item.id}.`);
    }
    const slotHalfHeight = (debug.ziThickness + ZI_SLOT_CLEARANCE) / 2;
    for (const targetBoardId of targetBoardIds) {
      const useLocalV12Slot = targetBoardId === "V1" || targetBoardId === "V2";
      const useLocalV34Slot = (targetBoardId === "V3" || targetBoardId === "V4") && boundaryBoardType === "full_zi";
      if ((targetBoardId === "V3" || targetBoardId === "V4") && !useLocalV34Slot) {
        continue;
      }
      features.push({
        id: `${targetBoardId}_${item.id}_zi_slot`,
        type: "zi_slot",
        targetBoardId,
        boundaryId: item.id,
        boundaryType: boundaryBoardType,
        y0: useLocalV12Slot ? V12_STYLE_1_Y_ZI_INNER : useLocalV34Slot ? V34_STYLE_1_Y_FRONT : slotY0,
        y1: useLocalV12Slot ? V12_STYLE_1_Y_REAR : useLocalV34Slot ? V34_STYLE_1_Y_ZI_INNER : slotY1,
        z0: item.centerZ - slotHalfHeight,
        z1: item.centerZ + slotHalfHeight,
        centerZ: item.centerZ,
        source: item.id,
        notes: ["Rear Zi slot placeholder; exact side profile vector deferred"]
      });
    }
  }
  return features;
}
function addFridgeRaisedHSetBoards(boards, stackingItems, params, debug, avoidance) {
  if (avoidance.fridgeMode !== "raised") return;
  const fridgeZone = (params.zones || []).find((zone) => zone.type === "fridge");
  if (!fridgeZone) return;
  const fridgeItemIndex = stackingItems.findIndex(
    (item) => item.type === "functional_zone" && item.zoneId === fridgeZone.id
  );
  if (fridgeItemIndex < 0) return;
  const below = stackingItems[fridgeItemIndex - 1];
  const fridgeItem = stackingItems[fridgeItemIndex];
  const z0 = below?.type === "boundary_panel" ? below.z1 : fridgeItem.z0;
  const z1 = z0 + H_SUPPORT_HEIGHT;
  const sideY0 = H_SUPPORT_SIDE_DEPTH_START;
  const sideY1 = debug.midDepth - H_SUPPORT_SIDE_REAR_CLEARANCE;
  const rearY0 = debug.midDepth - H34_DEPTH;
  const rearY1 = debug.midDepth;
  const notes = [
    "Fridge raised HSet above fridge-base Zi (gap < 105mm)."
  ];
  boards.push(
    board(
      "H13_fridge",
      "H13 fridge",
      "h_support",
      "H13",
      H_SUPPORT_THICKNESS,
      "YZ",
      "X",
      {
        x0: 0,
        x1: H_SUPPORT_THICKNESS,
        y0: sideY0,
        y1: sideY1,
        z0,
        z1
      },
      "h_support_fridge",
      notes
    ),
    board(
      "H24_fridge",
      "H24 fridge",
      "h_support",
      "H24",
      H_SUPPORT_THICKNESS,
      "YZ",
      "X",
      {
        x0: debug.midWidth - H_SUPPORT_THICKNESS,
        x1: debug.midWidth,
        y0: sideY0,
        y1: sideY1,
        z0,
        z1
      },
      "h_support_fridge",
      notes
    ),
    board(
      "H34_fridge",
      "H34 fridge",
      "h_support",
      "H34",
      H_SUPPORT_THICKNESS,
      "XZ",
      "Y",
      {
        x0: H_SUPPORT_THICKNESS,
        x1: debug.midWidth - H_SUPPORT_THICKNESS,
        y0: rearY0,
        y1: rearY1,
        z0,
        z1
      },
      "h_support_fridge",
      notes
    )
  );
}
function addHSupportBoards(boards, params, debug, avoidance) {
  const ch = Number(params.cabinetHeight);
  const omitBottomForRaised = avoidance.fridgeMode === "raised";
  const hSets = [
    ...omitBottomForRaised ? [] : [
      {
        suffix: "bottom",
        z0: 0,
        z1: H_SUPPORT_HEIGHT,
        notes: ["Bottom H support skeleton", "Avoidance adjustment deferred"]
      }
    ],
    {
      suffix: "mid",
      z0: ch / 2 - H_SUPPORT_HEIGHT / 2,
      z1: ch / 2 + H_SUPPORT_HEIGHT / 2,
      notes: ["Mid H support skeleton; Zi conflict adjustment deferred"]
    },
    {
      suffix: "top",
      z0: ch - H_SUPPORT_HEIGHT,
      z1: ch,
      notes: ["Top H support skeleton", "Top merge adjustment deferred"]
    }
  ];
  const sideY0 = H_SUPPORT_SIDE_DEPTH_START;
  const sideY1 = debug.midDepth - H_SUPPORT_SIDE_REAR_CLEARANCE;
  const rearY0 = debug.midDepth - H34_DEPTH;
  const rearY1 = debug.midDepth;
  for (const hSet of hSets) {
    const shouldEmitH34Top = hSet.suffix !== "top";
    boards.push(
      board(
        `H13_${hSet.suffix}`,
        `H13 ${hSet.suffix}`,
        "h_support",
        "H13",
        H_SUPPORT_THICKNESS,
        "YZ",
        "X",
        {
          x0: 0,
          x1: H_SUPPORT_THICKNESS,
          y0: sideY0,
          y1: sideY1,
          z0: hSet.z0,
          z1: hSet.z1
        },
        `h_support_${hSet.suffix}`,
        hSet.notes
      ),
      board(
        `H24_${hSet.suffix}`,
        `H24 ${hSet.suffix}`,
        "h_support",
        "H24",
        H_SUPPORT_THICKNESS,
        "YZ",
        "X",
        {
          x0: debug.midWidth - H_SUPPORT_THICKNESS,
          x1: debug.midWidth,
          y0: sideY0,
          y1: sideY1,
          z0: hSet.z0,
          z1: hSet.z1
        },
        `h_support_${hSet.suffix}`,
        hSet.notes
      ),
      ...shouldEmitH34Top ? [board(
        `H34_${hSet.suffix}`,
        `H34 ${hSet.suffix}`,
        "h_support",
        "H34",
        H_SUPPORT_THICKNESS,
        "XZ",
        "Y",
        {
          x0: H_SUPPORT_THICKNESS,
          x1: debug.midWidth - H_SUPPORT_THICKNESS,
          y0: rearY0,
          y1: rearY1,
          z0: hSet.z0,
          z1: hSet.z1
        },
        `h_support_${hSet.suffix}`,
        hSet.notes
      )] : []
    );
  }
}
function addTopRearTBoards(boards, params, debug) {
  const ch = Number(params.cabinetHeight);
  const cd = Number(params.cabinetDepth);
  if (!Number.isFinite(ch) || !Number.isFinite(cd)) return;
  boards.push(
    board(
      "T5",
      "T5 Rear Vertical Top Board",
      "top_system",
      "T5",
      15,
      "XZ",
      "Y",
      {
        x0: 0,
        x1: debug.midWidth,
        y0: cd - 16,
        y1: cd - 1,
        z0: ch - 100,
        z1: ch
      },
      "top_system",
      ["Replaces H34_top; seated in V3/V4 rear notch region."]
    ),
    board(
      "T4",
      "T4 Rear Horizontal Top Board",
      "top_system",
      "T4",
      15,
      "XY",
      "Z",
      {
        x0: 0,
        x1: debug.midWidth,
        y0: cd - 116,
        y1: cd - 16,
        z0: ch - 16,
        z1: ch - 1
      },
      "top_system",
      ["Rear top horizontal board seated in V3/V4 top notch region."]
    )
  );
}
function detectMergeAndAdjustHConflicts(boards, params, debug, validation) {
  const ch = Number(params.cabinetHeight);
  const depthGap = debug.midDepth - END_SYSTEM_FRONT_DEPTH - END_SYSTEM_REAR_DEPTH;
  const mergeCandidate = depthGap < MIN_END_SYSTEM_GAP;
  const hZiConflicts = [];
  if (mergeCandidate) {
    validation.warnings.push(
      "Top/bottom merge candidate detected: MidDepth front/rear gap is below 50mm. Real merge is deferred."
    );
  }
  const hMidBoards = boards.filter(
    (board2) => board2.category === "h_support" && ["H13_mid", "H24_mid", "H34_mid"].includes(board2.id)
  );
  const ziBoards = boards.filter(
    (board2) => board2.category === "boundary_panel" && (board2.boardType === "full_zi" || board2.boardType === "shortened_zi" || board2.boardType === "half_zi")
  );
  for (const hBoard of hMidBoards) {
    const conflicts = ziBoards.filter((ziBoard) => hBoard.z0 < ziBoard.z1 && hBoard.z1 > ziBoard.z0).sort((a, b) => a.z0 - b.z0);
    const movementConflicts = conflicts.filter(
      (ziBoard) => ziBoard.boardType === "full_zi" || ziBoard.boardType === "shortened_zi"
    );
    const movementSource = movementConflicts[0];
    const originalZ0 = hBoard.z0;
    const originalZ1 = hBoard.z1;
    if (movementConflicts.length > 1) {
      validation.warnings.push(
        `Multiple H mid Zi conflicts detected; using first conflict for V1 movement. ${hBoard.id}.`
      );
    }
    let movementResult = { moved: false, movementDirection: "none" };
    if (movementSource) {
      if (hBoard.id === "H34_mid") {
        const newZ0 = movementSource.z1;
        const newZ1 = movementSource.z1 + H_SUPPORT_HEIGHT;
        if (newZ1 > ch) {
          movementResult = {
            moved: false,
            newZ0,
            newZ1,
            movementDirection: "above",
            skippedReason: "above_bounds"
          };
          validation.warnings.push("H34 mid movement above Zi would exceed cabinet bounds; movement skipped.");
        } else {
          hBoard.z0 = newZ0;
          hBoard.z1 = newZ1;
          hBoard.notes = [...hBoard.notes ?? [], "Moved above Zi conflict by Stage 2 H conflict adjustment"];
          movementResult = { moved: true, newZ0, newZ1, movementDirection: "above" };
        }
      } else {
        const newZ1 = movementSource.z0;
        const newZ0 = movementSource.z0 - H_SUPPORT_HEIGHT;
        if (newZ0 < 0) {
          movementResult = {
            moved: false,
            newZ0,
            newZ1,
            movementDirection: "below",
            skippedReason: "below_bounds"
          };
          validation.warnings.push("H mid movement below Zi would exceed cabinet bounds; movement skipped.");
        } else {
          hBoard.z0 = newZ0;
          hBoard.z1 = newZ1;
          hBoard.notes = [...hBoard.notes ?? [], "Moved below Zi conflict by Stage 2 H conflict adjustment"];
          movementResult = { moved: true, newZ0, newZ1, movementDirection: "below" };
        }
      }
    }
    for (const ziBoard of conflicts) {
      const ziBoardType = ziBoard.boardType;
      const isMovementSource = ziBoard.id === movementSource?.id;
      const action = ziBoardType === "half_zi" ? "half_zi_rule_deferred" : movementResult.moved && isMovementSource ? "movement_applied" : "movement_skipped";
      hZiConflicts.push({
        hBoardId: hBoard.id,
        hBoardType: hBoard.boardType,
        ziBoardId: ziBoard.id,
        ziBoardType,
        overlapZ0: Math.max(originalZ0, ziBoard.z0),
        overlapZ1: Math.min(originalZ1, ziBoard.z1),
        action,
        moved: movementResult.moved && isMovementSource,
        originalZ0,
        originalZ1,
        newZ0: isMovementSource ? movementResult.newZ0 : void 0,
        newZ1: isMovementSource ? movementResult.newZ1 : void 0,
        movementDirection: isMovementSource ? movementResult.movementDirection : "none",
        skippedReason: ziBoardType === "half_zi" ? "half_zi_rule_deferred" : isMovementSource ? movementResult.skippedReason : "non_primary_conflict"
      });
      if (ziBoardType === "half_zi") {
        validation.warnings.push(`H mid overlaps half_zi; half Zi movement rule deferred. ${hBoard.id} overlaps ${ziBoard.id}.`);
      } else if (ziBoardType === "shortened_zi") {
        validation.warnings.push(`H mid overlaps shortened_zi; Stage 2 movement evaluated. ${hBoard.id} overlaps ${ziBoard.id}.`);
      } else {
        validation.warnings.push(`H mid overlaps full_zi; Stage 2 movement evaluated. ${hBoard.id} overlaps ${ziBoard.id}.`);
      }
    }
  }
  debug.mergeAndConflict = {
    topMergeCandidate: mergeCandidate,
    bottomMergeCandidate: mergeCandidate,
    depthGap,
    topBottomHSystemOverlapExpected: true,
    hZiConflicts
  };
}
function addVerticalDividerBoards(boards, params, stackingItems, debug, validation) {
  const dividerThickness = n(params.dividerThickness, DEFAULT_DIVIDER_THICKNESS);
  if (dividerThickness <= 0) {
    validation.errors.push(`DividerThickness must be > 0; received ${dividerThickness}.`);
    return;
  }
  for (const zone of params.zones) {
    if (zone.type !== "double_door" || zone.verticalDivider !== true) continue;
    const zoneItem = findZoneItem(stackingItems, zone.id);
    if (!zoneItem) {
      validation.warnings.push(`Vertical divider requested for zone ${zone.id}, but no stacking item was found.`);
      continue;
    }
    const dividerCenterX = n(zone.dividerCenterX, debug.midWidth / 2);
    const x0 = dividerCenterX - dividerThickness / 2;
    const x1 = dividerCenterX + dividerThickness / 2;
    if (x0 < 0 || x1 > debug.midWidth) {
      validation.errors.push(
        `Vertical divider ${zone.id} X range ${x0} -> ${x1} is outside MidWidth 0 -> ${debug.midWidth}.`
      );
    }
    boards.push(
      board(
        `VD_${zone.id}`,
        `Vertical Divider ${zone.id}`,
        "vertical_divider",
        "vertical_divider",
        dividerThickness,
        "YZ",
        "X",
        {
          x0,
          x1,
          y0: 0,
          y1: debug.midDepth,
          z0: zoneItem.z0,
          z1: zoneItem.z1
        },
        zone.id,
        ["Vertical divider skeleton", "Tongue/groove features deferred", "H34 clearance slot deferred"]
      )
    );
  }
}
var DOOR_SHELF_MIN_ZONE_HEIGHT = 350;
function doorShelfProfileVector(width, depth, notchWidth, notchLeft, notchRight, rearConnected) {
  if (depth <= ZI_FULL_FRONT_REAR_NOTCH_DEPTH) {
    return [
      { x: 0, y: 0 },
      { x: width, y: 0 },
      { x: width, y: depth },
      { x: 0, y: depth },
      { x: 0, y: 0 }
    ];
  }
  const nw = notchWidth;
  const nd = ZI_FULL_FRONT_REAR_NOTCH_DEPTH;
  const points = [];
  const start = { x: notchLeft ? nw : 0, y: 0 };
  points.push(start);
  if (notchLeft) {
    points.push({ x: nw, y: nd }, { x: 0, y: nd });
    if (rearConnected) {
      points.push({ x: 0, y: depth - nd }, { x: nw, y: depth - nd }, { x: nw, y: depth });
    } else {
      points.push({ x: 0, y: depth });
    }
  } else {
    points.push({ x: 0, y: depth });
  }
  if (notchRight && rearConnected) {
    points.push({ x: width - nw, y: depth }, { x: width - nw, y: depth - nd }, { x: width, y: depth - nd });
  } else {
    points.push({ x: width, y: depth });
  }
  if (notchRight) {
    points.push({ x: width, y: nd }, { x: width - nw, y: nd }, { x: width - nw, y: 0 });
  } else {
    points.push({ x: width, y: 0 });
  }
  points.push({ ...start });
  return points;
}
function generateDoorShelfZiSlotFeatures(boards, debug) {
  const features = [];
  for (const shelf of boards) {
    if (shelf.category !== "door_shelf") continue;
    const centerZ = (shelf.z0 + shelf.z1) / 2;
    const rearConnected = shelf.y1 >= debug.midDepth;
    const isLeftSegment = shelf.id.endsWith("_L");
    const isRightSegment = shelf.id.endsWith("_R");
    const targets = [];
    if (!isRightSegment) targets.push("V1");
    if (!isLeftSegment) targets.push("V2");
    if (rearConnected) {
      if (!isRightSegment) targets.push("V3");
      if (!isLeftSegment) targets.push("V4");
    }
    const slotHalfHeight = (shelf.materialThickness + ZI_SLOT_CLEARANCE) / 2;
    for (const targetBoardId of targets) {
      const isFrontStile = targetBoardId === "V1" || targetBoardId === "V2";
      features.push({
        id: `${targetBoardId}_${shelf.id}_zi_slot`,
        type: "zi_slot",
        targetBoardId,
        boundaryId: shelf.id,
        boundaryType: "full_zi",
        y0: isFrontStile ? V12_STYLE_1_Y_ZI_INNER : V34_STYLE_1_Y_FRONT,
        y1: isFrontStile ? V12_STYLE_1_Y_REAR : V34_STYLE_1_Y_ZI_INNER,
        z0: centerZ - slotHalfHeight,
        z1: centerZ + slotHalfHeight,
        centerZ,
        source: shelf.id,
        notes: ["Door shelf Zi slot (same joinery as boundary full_zi)"]
      });
    }
  }
  return features;
}
function addDoorShelfBoards(boards, params, stackingItems, debug, validation, avoidance) {
  const shelfThickness = debug.panelThickness;
  for (const zone of params.zones) {
    if (!isGtDoorType(zone.type) || zone.shelfEnabled !== true) continue;
    const zoneItem = findZoneItem(stackingItems, zone.id);
    if (!zoneItem) {
      validation.warnings.push(`Door shelf requested for zone ${zone.id}, but no stacking item was found.`);
      continue;
    }
    const zoneHeight = zoneItem.z1 - zoneItem.z0;
    if (zoneHeight < DOOR_SHELF_MIN_ZONE_HEIGHT) {
      validation.warnings.push(
        `Door shelf skipped in ${zone.id}: zone height ${zoneHeight} < ${DOOR_SHELF_MIN_ZONE_HEIGHT}.`
      );
      continue;
    }
    const shelfTopHeight = n(zone.shelfHeight, Math.round(zoneHeight / 2));
    const shelfTopZ = zoneItem.z0 + shelfTopHeight;
    const shelfZ0 = shelfTopZ - shelfThickness;
    if (shelfZ0 <= zoneItem.z0 || shelfTopZ >= zoneItem.z1) {
      validation.warnings.push(
        `Door shelf skipped in ${zone.id}: shelf top Z ${shelfTopZ} (thickness ${shelfThickness}) is outside zone range ${zoneItem.z0}-${zoneItem.z1}.`
      );
      continue;
    }
    const shouldShorten = avoidance.enabled && typeof avoidance.shortDepth === "number" && typeof avoidance.effectiveAvoidH === "number" && shelfZ0 < avoidance.effectiveAvoidH;
    const shelfY1 = shouldShorten ? avoidance.shortDepth : debug.midDepth;
    const rearConnected = !shouldShorten;
    const shelfNotes = [
      "Horizontal door shelf: same joinery as a boundary full Zi (side tongues into V-board slots)",
      "Shelf top height is user input; z0 = shelfTopZ - panelThickness",
      ...shouldShorten ? ["Depth shortened by avoidance adjustment; rear V3/V4 connection omitted"] : []
    ];
    const hasDivider = zone.type === "double_door" && zone.verticalDivider === true;
    const segments = [];
    if (hasDivider) {
      const dividerThickness = n(params.dividerThickness, DEFAULT_DIVIDER_THICKNESS);
      const dividerCenterX = n(zone.dividerCenterX, debug.midWidth / 2);
      const dividerX0 = dividerCenterX - dividerThickness / 2;
      const dividerX1 = dividerCenterX + dividerThickness / 2;
      segments.push({ suffix: "_L", x0: 0, x1: dividerX0, notchLeft: true, notchRight: false });
      segments.push({ suffix: "_R", x0: dividerX1, x1: debug.midWidth, notchLeft: false, notchRight: true });
    } else {
      segments.push({ suffix: "", x0: 0, x1: debug.midWidth, notchLeft: true, notchRight: true });
    }
    for (const segment of segments) {
      if (segment.x1 - segment.x0 <= 0) {
        validation.warnings.push(
          `Door shelf segment DS_${zone.id}${segment.suffix} skipped: width ${segment.x1 - segment.x0} <= 0.`
        );
        continue;
      }
      const shelfBoard = board(
        `DS_${zone.id}${segment.suffix}`,
        `Door Shelf ${zone.id}${segment.suffix}`,
        "door_shelf",
        "door_shelf",
        shelfThickness,
        "XY",
        "Z",
        {
          x0: segment.x0,
          x1: segment.x1,
          y0: 0,
          y1: shelfY1,
          z0: shelfZ0,
          z1: shelfTopZ
        },
        zone.id,
        hasDivider ? [...shelfNotes, "Divider-side edge is plain; divider groove machining deferred"] : shelfNotes
      );
      shelfBoard.profileVector = doorShelfProfileVector(
        segment.x1 - segment.x0,
        shelfY1,
        debug.panelThickness,
        segment.notchLeft,
        segment.notchRight,
        rearConnected
      );
      boards.push(shelfBoard);
    }
  }
}
function findFullZiBoardForBoundary(boards, boundaryId2) {
  return boards.find(
    (board2) => board2.category === "boundary_panel" && board2.boardType === "full_zi" && board2.source === boundaryId2
  );
}
function generateZiGrooveFeatures(boards, params, debug, validation) {
  const features = [];
  const grooveY0 = debug.midDepth / 3 - ZI_GROOVE_Y_OVERHANG;
  const grooveY1 = debug.midDepth * 2 / 3 + ZI_GROOVE_Y_OVERHANG;
  function addGrooveFeature(zoneId2, dividerBoard, boundaryId2, face) {
    const targetBoard = findFullZiBoardForBoundary(boards, boundaryId2);
    if (!targetBoard) {
      validation.warnings.push(`Zi groove target full_zi board not found for boundary ${boundaryId2}.`);
      return;
    }
    const grooveHalfWidth = (dividerBoard.materialThickness + ZI_GROOVE_WIDTH_CLEARANCE) / 2;
    const dividerCenterX = (dividerBoard.x0 + dividerBoard.x1) / 2;
    const x0 = dividerCenterX - grooveHalfWidth;
    const x1 = dividerCenterX + grooveHalfWidth;
    if (x0 < 0 || x1 > debug.midWidth || grooveY0 < 0 || grooveY1 > debug.midDepth || x1 <= x0 || grooveY1 <= grooveY0) {
      validation.errors.push(
        `Zi groove ${zoneId2} ${face} range X ${x0} -> ${x1}, Y ${grooveY0} -> ${grooveY1} is invalid.`
      );
    }
    features.push({
      id: `${targetBoard.id}_${dividerBoard.id}_${face}_zi_groove`,
      type: "zi_groove",
      targetBoardId: targetBoard.id,
      dividerBoardId: dividerBoard.id,
      zoneId: zoneId2,
      boundaryId: boundaryId2,
      face,
      x0,
      x1,
      y0: grooveY0,
      y1: grooveY1,
      depth: debug.panelThickness / 2,
      source: boundaryId2,
      notes: ["Zi groove placeholder; exact groove cutting deferred", "Through groove merge deferred"]
    });
  }
  params.zones.forEach((zone, index) => {
    if (zone.type !== "double_door" || zone.verticalDivider !== true) return;
    const dividerBoard = boards.find((board2) => board2.id === `VD_${zone.id}` && board2.category === "vertical_divider");
    if (!dividerBoard) {
      validation.warnings.push(`Zi groove requested for zone ${zone.id}, but vertical divider board was not found.`);
      return;
    }
    const upperBoundary = index > 0 ? params.zones[index - 1] : void 0;
    const lowerBoundary = index < params.zones.length - 1 ? params.zones[index + 1] : void 0;
    if (upperBoundary) {
      addGrooveFeature(zone.id, dividerBoard, `boundary-${upperBoundary.id}-${zone.id}`, "bottom");
    }
    if (lowerBoundary) {
      addGrooveFeature(zone.id, dividerBoard, `boundary-${zone.id}-${lowerBoundary.id}`, "top");
    }
  });
  return features;
}
function generateH34ClearanceSlotFeatures(boards, debug, validation) {
  const features = [];
  const dividerBoards = boards.filter((board2) => board2.category === "vertical_divider");
  if (dividerBoards.length === 0) return features;
  const h34Boards = boards.filter((board2) => board2.category === "h_support" && board2.boardType === "H34");
  const t5Boards = boards.filter((board2) => board2.id === "T5" && board2.boardType === "T5");
  if (h34Boards.length === 0 && t5Boards.length === 0) {
    validation.warnings.push("H34 clearance slot requested, but no H34 boards were found.");
    return features;
  }
  for (const dividerBoard of dividerBoards) {
    for (const h34Board of h34Boards) {
      const z0 = h34Board.z0 - H34_CLEARANCE_Z_BELOW;
      const z1 = h34Board.z0 + H34_CLEARANCE_Z_ABOVE_START;
      if (z0 < dividerBoard.z0 || z1 > dividerBoard.z1) {
        debug.h34Clearance = debug.h34Clearance ?? [];
        debug.h34Clearance.push({
          dividerBoardId: dividerBoard.id,
          h34BoardId: h34Board.id,
          originalZ0: z0,
          originalZ1: z1,
          action: "placeholder_outside_divider_range",
          note: "H34 clearance placeholder extends outside divider Z range; effective cut will be clamped or skipped."
        });
      }
      features.push({
        id: `${dividerBoard.id}_${h34Board.id}_h34_clearance_slot`,
        type: "h34_clearance_slot",
        targetBoardId: dividerBoard.id,
        h34BoardId: h34Board.id,
        y0: debug.midDepth - H34_CLEARANCE_DEPTH,
        y1: debug.midDepth,
        z0,
        z1,
        source: h34Board.id,
        notes: ["H34 clearance slot placeholder", "Exact H34/divider interaction deferred"]
      });
    }
    for (const t5Board of t5Boards) {
      const contactZ0 = Math.max(dividerBoard.z0, t5Board.z0);
      const contactZ1 = Math.min(dividerBoard.z1, t5Board.z1);
      const contactHeight = Math.max(0, contactZ1 - contactZ0);
      if (contactHeight <= 0) continue;
      const z0 = dividerBoard.z1 - contactHeight - H34_CLEARANCE_Z_BELOW;
      const z1 = dividerBoard.z1;
      const y0 = debug.midDepth - H34_CLEARANCE_DEPTH;
      const y1 = debug.midDepth;
      features.push({
        id: `${dividerBoard.id}_${t5Board.id}_t5_clearance_slot`,
        type: "h34_clearance_slot",
        targetBoardId: dividerBoard.id,
        h34BoardId: t5Board.id,
        y0,
        y1,
        z0,
        z1,
        source: t5Board.id,
        notes: ["T5 clearance slot placeholder", "Exact T5/divider interaction implemented via H34 clearance pipeline"]
      });
    }
  }
  return features;
}
function generateDividerTongueFeatures(boards, features, debug, validation) {
  const tongueFeatures = [];
  const tongueY0 = debug.midDepth / 3;
  const tongueY1 = debug.midDepth * 2 / 3;
  for (const groove of features) {
    if (groove.type !== "zi_groove") continue;
    const divider = boards.find((board2) => board2.id === groove.dividerBoardId && board2.category === "vertical_divider");
    if (!divider) {
      validation.warnings.push(`Divider tongue target vertical divider not found for zi_groove ${groove.id}.`);
      continue;
    }
    const ziBoard = boards.find((board2) => board2.id === groove.targetBoardId);
    if (!ziBoard) {
      validation.warnings.push(`Divider tongue related Zi board not found for zi_groove ${groove.id}.`);
      continue;
    }
    if (ziBoard.boardType !== "full_zi") {
      validation.warnings.push(`Divider tongue requires full_zi target; received ${ziBoard.boardType} for ${groove.id}.`);
      continue;
    }
    const position = groove.face === "bottom" ? "top" : "bottom";
    const tongueInsertionDepth = debug.panelThickness / 2 - DIVIDER_TONGUE_GROOVE_CLEARANCE;
    const z0 = position === "top" ? divider.z1 - tongueInsertionDepth : divider.z0;
    const z1 = position === "top" ? divider.z1 : divider.z0 + tongueInsertionDepth;
    if (tongueY1 <= tongueY0 || z1 <= z0) {
      validation.warnings.push(`Invalid divider tongue range for zi_groove ${groove.id}.`);
      continue;
    }
    tongueFeatures.push({
      id: `${divider.id}_${groove.id}_${position}_divider_tongue`,
      type: "divider_tongue",
      targetBoardId: divider.id,
      relatedZiBoardId: ziBoard.id,
      relatedGrooveFeatureId: groove.id,
      zoneId: groove.zoneId,
      boundaryId: groove.boundaryId,
      position,
      y0: tongueY0,
      y1: tongueY1,
      z0,
      z1,
      insertionDepth: tongueInsertionDepth,
      source: groove.id,
      notes: [
        "Divider tongue placeholder generated from zi_groove",
        "Exact tongue outline deferred",
        "Zi groove real cutting deferred"
      ]
    });
  }
  return tongueFeatures;
}
function deriveDividerTongueCuts(divider, boards, features, validation) {
  const tolerance = 0.01;
  const cuts = [];
  const tongueFeatures = features.filter((feature) => feature.type === "divider_tongue" && feature.targetBoardId === divider.id);
  for (const tongue of tongueFeatures) {
    const groove = features.find((feature) => feature.type === "zi_groove" && feature.id === tongue.relatedGrooveFeatureId) || features.find(
      (feature) => feature.type === "zi_groove" && feature.targetBoardId === tongue.relatedZiBoardId && feature.dividerBoardId === divider.id
    );
    const relatedZi = boards.find((board2) => board2.id === tongue.relatedZiBoardId);
    if (!groove || !relatedZi) {
      validation.warnings.push(`Divider tongue cut skipped; related Zi/groove not found for ${tongue.id}.`);
      continue;
    }
    const y0 = groove.y0;
    const y1 = groove.y1;
    if (y1 <= y0 || y0 < 0 || y1 > divider.y1) {
      validation.warnings.push(`Divider tongue cut skipped; invalid Y range for ${tongue.id}.`);
      continue;
    }
    if (relatedZi.z1 <= divider.z0 && Math.abs(relatedZi.z1 - divider.z0) <= tolerance) {
      cuts.push({
        y0,
        y1,
        z0: divider.z0 - tongue.insertionDepth,
        z1: divider.z0,
        position: "bottom",
        source: "divider_tongue_effective_cut",
        boundaryId: tongue.boundaryId,
        relatedZiBoardId: tongue.relatedZiBoardId,
        relatedGrooveFeatureId: tongue.relatedGrooveFeatureId
      });
      continue;
    }
    if (relatedZi.z0 >= divider.z1 && Math.abs(relatedZi.z0 - divider.z1) <= tolerance) {
      validation.warnings.push(`Top divider tongue cutProfileVector deferred for ${tongue.id}.`);
      continue;
    }
    validation.warnings.push(`Divider tongue cut skipped; unable to derive Zi/VD adjacency for ${tongue.id}.`);
  }
  return cuts.sort((a, b) => a.y0 - b.y0);
}
function sameYZPoint(a, b, tolerance = 1e-9) {
  return Math.abs(a.y - b.y) <= tolerance && Math.abs(a.z - b.z) <= tolerance;
}
function isCollinearMiddlePoint(a, b, c, tolerance = 1e-9) {
  const cross = (b.y - a.y) * (c.z - a.z) - (b.z - a.z) * (c.y - a.y);
  if (Math.abs(cross) > tolerance) return false;
  const minY = Math.min(a.y, c.y) - tolerance;
  const maxY = Math.max(a.y, c.y) + tolerance;
  const minZ = Math.min(a.z, c.z) - tolerance;
  const maxZ = Math.max(a.z, c.z) + tolerance;
  return b.y >= minY && b.y <= maxY && b.z >= minZ && b.z <= maxZ;
}
function isBacktrackingSpike(a, b, c, tolerance = 1e-9) {
  const abY = b.y - a.y;
  const abZ = b.z - a.z;
  const bcY = c.y - b.y;
  const bcZ = c.z - b.z;
  const cross = abY * bcZ - abZ * bcY;
  if (Math.abs(cross) > tolerance) return false;
  const dot = abY * bcY + abZ * bcZ;
  return dot < -tolerance;
}
function cleanupClosedYZPolyline(points) {
  if (points.length < 3) return points;
  let cleaned = [points[0]];
  for (let i = 1; i < points.length; i++) {
    if (!sameYZPoint(points[i], cleaned[cleaned.length - 1])) {
      cleaned.push(points[i]);
    }
  }
  if (cleaned.length < 2) return points;
  if (!sameYZPoint(cleaned[0], cleaned[cleaned.length - 1])) {
    cleaned.push({ ...cleaned[0] });
  }
  let changed = true;
  while (changed && cleaned.length >= 4) {
    changed = false;
    const next = [cleaned[0]];
    for (let i = 1; i < cleaned.length - 1; i++) {
      const a = next[next.length - 1];
      const b = cleaned[i];
      const c = cleaned[i + 1];
      if (isBacktrackingSpike(a, b, c)) {
        changed = true;
        continue;
      }
      if (isCollinearMiddlePoint(a, b, c)) {
        changed = true;
        continue;
      }
      next.push(b);
    }
    next.push(cleaned[cleaned.length - 1]);
    const deduped = [next[0]];
    for (let i = 1; i < next.length; i++) {
      if (!sameYZPoint(next[i], deduped[deduped.length - 1])) {
        deduped.push(next[i]);
      }
    }
    cleaned = deduped;
    if (!sameYZPoint(cleaned[0], cleaned[cleaned.length - 1])) {
      cleaned.push({ ...cleaned[0] });
    }
  }
  return cleaned.length >= 4 ? cleaned : points;
}
function addVerticalDividerH34ClearanceProfiles(boards, features, debug, validation) {
  const dividerBoards = boards.filter((board2) => board2.category === "vertical_divider");
  for (const divider of dividerBoards) {
    divider.profileVector = [
      { y: 0, z: divider.z0 },
      { y: debug.midDepth, z: divider.z0 },
      { y: debug.midDepth, z: divider.z1 },
      { y: 0, z: divider.z1 },
      { y: 0, z: divider.z0 }
    ];
    const effectiveSlots = features.filter((feature) => feature.type === "h34_clearance_slot" && feature.targetBoardId === divider.id).flatMap((feature) => {
      const cutZ0 = Math.max(feature.z0, divider.z0);
      const cutZ1 = Math.min(feature.z1, divider.z1);
      debug.h34Clearance = debug.h34Clearance ?? [];
      if (cutZ0 >= cutZ1) {
        debug.h34Clearance.push({
          dividerBoardId: divider.id,
          h34BoardId: feature.h34BoardId,
          originalZ0: feature.z0,
          originalZ1: feature.z1,
          effectiveZ0: cutZ0,
          effectiveZ1: cutZ1,
          action: "cut_skipped_no_intersection",
          note: "H34 clearance has no intersection with divider Z range; cut skipped."
        });
        return [];
      }
      debug.h34Clearance.push({
        dividerBoardId: divider.id,
        h34BoardId: feature.h34BoardId,
        originalZ0: feature.z0,
        originalZ1: feature.z1,
        effectiveZ0: cutZ0,
        effectiveZ1: cutZ1,
        action: "cut_kept",
        note: "H34 clearance effective cut kept after clamp."
      });
      return [{ feature, cutZ0, cutZ1 }];
    }).sort((a, b) => a.cutZ0 - b.cutZ0);
    divider.profileFeatures = [];
    const bottomTongues = deriveDividerTongueCuts(divider, boards, features, validation).filter((cut) => cut.position === "bottom");
    const points = [{ y: 0, z: divider.z0 }];
    let previousBottomY = 0;
    for (const tongue of bottomTongues) {
      if (tongue.y0 < previousBottomY) {
        validation.warnings.push(`Overlapping bottom divider tongue cuts on ${divider.id}.`);
        continue;
      }
      points.push(
        { y: tongue.y0, z: divider.z0 },
        { y: tongue.y0, z: tongue.z0 },
        { y: tongue.y1, z: tongue.z0 },
        { y: tongue.y1, z: divider.z0 }
      );
      addProfileFeature(divider, {
        type: "divider_tongue",
        y0: tongue.y0,
        y1: tongue.y1,
        z0: tongue.z0,
        z1: tongue.z1,
        source: tongue.source,
        notes: [
          "Bottom divider tongue implemented in cutProfileVector",
          "Zi groove remains face machining"
        ],
        boundaryId: tongue.boundaryId
      });
      previousBottomY = tongue.y1;
    }
    points.push({ y: debug.midDepth, z: divider.z0 });
    let previousCutZ1 = -Infinity;
    let topEdgeY = debug.midDepth;
    for (const slot of effectiveSlots) {
      if (slot.cutZ0 < previousCutZ1) {
        validation.warnings.push(
          `Overlapping H34 clearance cuts on ${divider.id}: ${slot.feature.h34BoardId}.`
        );
      }
      addProfileFeature(divider, {
        type: "h34_clearance_slot",
        y0: slot.feature.y0,
        y1: slot.feature.y1,
        z0: slot.cutZ0,
        z1: slot.cutZ1,
        source: "h34_clearance_slot_effective_cut",
        notes: [
          "Clamped effective H34 clearance cut on vertical divider",
          "Original placeholder remains in top-level features"
        ],
        h34BoardId: slot.feature.h34BoardId
      });
      const reachesDividerTop = slot.cutZ1 >= divider.z1;
      if (reachesDividerTop) {
        points.push(
          { y: debug.midDepth, z: slot.cutZ0 },
          { y: slot.feature.y0, z: slot.cutZ0 },
          { y: slot.feature.y0, z: slot.cutZ1 }
        );
        topEdgeY = Math.min(topEdgeY, slot.feature.y0);
      } else if (slot.feature.y1 > debug.midDepth) {
        points.push(
          { y: debug.midDepth, z: slot.cutZ0 },
          { y: slot.feature.y1, z: slot.cutZ0 },
          { y: slot.feature.y1, z: slot.cutZ1 },
          { y: slot.feature.y0, z: slot.cutZ1 }
        );
      } else {
        points.push(
          { y: debug.midDepth, z: slot.cutZ0 },
          { y: slot.feature.y0, z: slot.cutZ0 },
          { y: slot.feature.y0, z: slot.cutZ1 },
          { y: debug.midDepth, z: slot.cutZ1 }
        );
      }
      previousCutZ1 = Math.max(previousCutZ1, slot.cutZ1);
    }
    points.push(
      { y: topEdgeY, z: divider.z1 },
      { y: 0, z: divider.z1 },
      { y: 0, z: divider.z0 }
    );
    divider.cutProfileVector = cleanupClosedYZPolyline(points);
    divider.notes = [
      ...divider.notes ?? [],
      "H34 clearance cutProfileVector implemented from effective placeholder cuts",
      ...bottomTongues.length > 0 ? ["Bottom divider tongue implemented in cutProfileVector; Zi groove remains face machining."] : []
    ];
  }
}
function generateStyle1T3B3FeaturePlaceholders(boards) {
  const features = [];
  const b3 = boards.find((board2) => board2.id === "B3" && board2.boardType === "B3");
  if (!b3) return features;
  features.push({
    id: "B3_groove_placeholder",
    type: "b3_groove",
    targetBoardId: "B3",
    width: B3_GROOVE_WIDTH,
    depth: B3_GROOVE_DEPTH,
    branchCount: B3_GROOVE_BRANCH_COUNT,
    branchWidth: B3_GROOVE_BRANCH_WIDTH,
    source: "B3",
    notes: ["B3 connected groove placeholder", "Exact connected groove path deferred"]
  });
  return features;
}
function addBlankPanelH12Boards(boards, zones, stackingItems, debug) {
  for (const zone of zones) {
    if (zone.type !== "blank_panel") continue;
    const zoneItem = findZoneItem(stackingItems, zone.id);
    if (!zoneItem) continue;
    const h12Bounds = {
      x0: debug.panelThickness,
      x1: debug.midWidth - debug.panelThickness,
      y0: 0,
      y1: H12_DEPTH
    };
    if (zoneItem.height < H12_SPLIT_HEIGHT) {
      boards.push(
        board(
          `H12_${zone.id}`,
          `H12 Support (${zone.id})`,
          "blank_panel_support",
          "H12",
          debug.hThickness,
          "XZ",
          "Y",
          {
            ...h12Bounds,
            z0: zoneItem.z0,
            z1: zoneItem.z1
          },
          zone.id,
          ["Blank panel V1 generates H12 only; front panel deferred"]
        )
      );
      continue;
    }
    boards.push(
      board(
        `H12_${zone.id}_bottom`,
        `H12 Bottom Support (${zone.id})`,
        "blank_panel_support",
        "H12",
        debug.hThickness,
        "XZ",
        "Y",
        {
          ...h12Bounds,
          z0: zoneItem.z0,
          z1: zoneItem.z0 + H12_RAIL_HEIGHT
        },
        zone.id,
        ["Blank panel V1 generates H12 only; front panel deferred"]
      ),
      board(
        `H12_${zone.id}_top`,
        `H12 Top Support (${zone.id})`,
        "blank_panel_support",
        "H12",
        debug.hThickness,
        "XZ",
        "Y",
        {
          ...h12Bounds,
          z0: zoneItem.z1 - H12_RAIL_HEIGHT,
          z1: zoneItem.z1
        },
        zone.id,
        ["Blank panel V1 generates H12 only; front panel deferred"]
      )
    );
  }
}
function addStyle2FixedFrontPanels(boards, params, debug) {
  const ch = Number(params.cabinetHeight);
  const frontBounds = {
    x0: debug.sideClearance,
    x1: debug.midWidth - debug.sideClearance,
    y0: -debug.doorPanelThickness,
    y1: 0
  };
  if (params.topSystem.style === "style_2") {
    boards.push(
      board(
        "TopStyle2FixedFrontPanel",
        "Top Style 2 Fixed Front Panel",
        "top_system",
        "style2_fixed_front_panel",
        debug.doorPanelThickness,
        "XZ",
        "Y",
        {
          ...frontBounds,
          z0: ch - params.topSystem.height,
          z1: ch
        },
        "top_system",
        ["Belongs to top structural system; not a functional-zone front panel", "No H12 or hardware holes generated"]
      )
    );
  }
  if (params.bottomSystem.style === "style_2") {
    boards.push(
      board(
        "BottomStyle2FixedFrontPanel",
        "Bottom Style 2 Fixed Front Panel",
        "bottom_system",
        "style2_fixed_front_panel",
        debug.doorPanelThickness,
        "XZ",
        "Y",
        {
          ...frontBounds,
          z0: 0,
          z1: params.bottomSystem.height
        },
        "bottom_system",
        ["Belongs to bottom structural system; not a functional-zone front panel", "No H12 or hardware holes generated"]
      )
    );
  }
}
function isGtDoorType(type) {
  return type === "side_door" || type === "left_side_door" || type === "right_side_door" || type === "double_door";
}
function generatesGtFrontPanel(type) {
  return isGtDoorType(type) || type === "drawer" || type === "top_flap" || type === "bottom_flap" || type === "blank_panel";
}
function gtClamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
function gtDefaultHingeSideDistance(longSide) {
  return gtClamp(75 + (longSide - 300) * (25 / 300), 75, 100);
}
function normalizeGtFrontHardware(params) {
  const source = params.frontHardware || {};
  const hinge = source.defaultHingeSettings || {};
  return {
    frontPanelsEnabled: source.frontPanelsEnabled !== false,
    frontClearance: n(params.frontClearance, n(source.frontClearance, DEFAULT_FRONT_CLEARANCE)),
    locksEnabled: source.locksEnabled !== false,
    lockPresetId: source.lockPresetId || GT_LOCK_PRESET_ID,
    defaultHingeSettings: {
      cupDiameter: n(hinge.cupDiameter, DEFAULT_HINGE_CUP_DIAMETER),
      cupDepth: n(hinge.cupDepth, DEFAULT_HINGE_CUP_DEPTH),
      cupCenterFromEdge: n(hinge.cupCenterFromEdge, DEFAULT_HINGE_CUP_CENTER_FROM_EDGE),
      useThreeHinges: hinge.useThreeHinges === true,
      sideDistance: hinge.sideDistance === "auto" || hinge.sideDistance == null ? "auto" : n(hinge.sideDistance, 0) || "auto"
    }
  };
}
function gtLockCutoutFromCenter(centerX, centerZ, orientation, mountingBoardId, mountingFace, fallbackApplied) {
  const width = orientation === "horizontal" ? LOCK_SLOT_LENGTH : LOCK_SLOT_WIDTH;
  const height = orientation === "horizontal" ? LOCK_SLOT_WIDTH : LOCK_SLOT_LENGTH;
  return {
    presetId: GT_LOCK_PRESET_ID,
    shape: "rounded_slot",
    orientation,
    centerX,
    centerY: 0,
    centerZ,
    width,
    height,
    radius: LOCK_SLOT_RADIUS,
    x0: centerX - width / 2,
    x1: centerX + width / 2,
    z0: centerZ - height / 2,
    z1: centerZ + height / 2,
    mountingBoardId,
    mountingFace,
    fallbackApplied: fallbackApplied || void 0
  };
}
function buildGeneralTallFrontPanels(params, stackingItems, boards, debug, validation) {
  const hardware = normalizeGtFrontHardware(params);
  if (!hardware.frontPanelsEnabled) return [];
  const FPT = debug.frontFaceAllowance;
  const FC = hardware.frontClearance;
  const cabinetWidth = Number(params.cabinetWidth);
  const frontX0 = debug.leftSidePanelThickness;
  const frontX1 = cabinetWidth - debug.rightSidePanelThickness;
  const boardById = (id) => boards.find((item) => item.id === id);
  const zoneById = new Map(params.zones.map((zone) => [zone.id, zone]));
  const frontRefs = [];
  stackingItems.forEach((item, itemIndex) => {
    if (item.type !== "functional_zone" || !item.zoneId) return;
    const zone = zoneById.get(item.zoneId);
    if (!zone || !generatesGtFrontPanel(zone.type)) return;
    if (zone.frontPanelEnabled === false) return;
    frontRefs.push({ zone, item, itemIndex });
  });
  if (frontRefs.length === 0) return [];
  const lowestRef = frontRefs[0];
  const highestRef = frontRefs[frontRefs.length - 1];
  const zoneGeneratesFront = (zoneId2) => {
    if (!zoneId2) return false;
    const zone = zoneById.get(zoneId2);
    return !!zone && generatesGtFrontPanel(zone.type) && zone.frontPanelEnabled !== false;
  };
  const zoneIsOpen = (zoneId2) => {
    if (!zoneId2) return false;
    const zone = zoneById.get(zoneId2);
    return !!zone && (zone.type === "open_space" || zone.type === "open_appliance" || zone.type === "fridge");
  };
  const panels = [];
  for (const ref of frontRefs) {
    const { zone, item, itemIndex } = ref;
    const warnings = [];
    let z0;
    let z1;
    let z0Source;
    let z1Source;
    let lowerFaceZ = null;
    let upperFaceZ = null;
    let lowerRefBoardId;
    let upperRefBoardId;
    const below = stackingItems[itemIndex - 1];
    const above = stackingItems[itemIndex + 1];
    if (ref === lowestRef && below?.type === "bottom_system") {
      if (params.bottomSystem.style === "style_1") {
        const b3 = boardById("B3");
        z0 = b3 ? b3.z0 : item.z0;
        z0Source = b3 ? "B3_cover" : "zone_fallback";
        lowerFaceZ = b3 ? b3.z1 : item.z0;
        lowerRefBoardId = b3 ? "B3" : void 0;
        if (!b3) warnings.push("B3 board not found; bottom edge fell back to zone z0.");
      } else {
        const fixed = boardById("BottomStyle2FixedFrontPanel");
        z0 = fixed ? fixed.z1 + FC : item.z0 + FC;
        z0Source = fixed ? "style2_fixed_panel" : "zone_fallback";
        lowerFaceZ = item.z0;
        lowerRefBoardId = fixed ? "BottomStyle2FixedFrontPanel" : void 0;
        if (!fixed) warnings.push("BottomStyle2FixedFrontPanel not found; bottom edge fell back to zone z0 + FC.");
      }
    } else if (below?.type === "boundary_panel") {
      const belowZone = stackingItems[itemIndex - 2];
      const centerZ = below.centerZ ?? (below.z0 + below.z1) / 2;
      if (zoneGeneratesFront(belowZone?.zoneId)) {
        z0 = centerZ + FC / 2;
        z0Source = "front_front_boundary";
      } else if (zoneIsOpen(belowZone?.zoneId)) {
        z0 = below.z0 + FC;
        z0Source = "open_zone_boundary";
      } else {
        z0 = centerZ + FC / 2;
        z0Source = "boundary_fallback";
        warnings.push("Unrecognized lower neighbor; used boundary center + FC/2.");
      }
      lowerFaceZ = below.z1;
      lowerRefBoardId = below.id;
    } else if (below?.type === "functional_zone") {
      z0 = zoneGeneratesFront(below.zoneId) ? item.z0 + FC / 2 : item.z0 + FC;
      z0Source = "zero_boundary";
      lowerFaceZ = item.z0;
    } else {
      z0 = item.z0 + FC / 2;
      z0Source = "zone_fallback";
      warnings.push("No lower reference; used zone z0 + FC/2.");
      lowerFaceZ = item.z0;
    }
    if (ref === highestRef && above?.type === "top_system") {
      if (params.topSystem.style === "style_1") {
        const t3 = boardById("T3");
        z1 = t3 ? t3.z1 : item.z1;
        z1Source = t3 ? "T3_cover" : "zone_fallback";
        upperFaceZ = t3 ? t3.z0 : item.z1;
        upperRefBoardId = t3 ? "T3" : void 0;
        if (!t3) warnings.push("T3 board not found; top edge fell back to zone z1.");
      } else {
        const fixed = boardById("TopStyle2FixedFrontPanel");
        z1 = fixed ? fixed.z0 - FC : item.z1 - FC;
        z1Source = fixed ? "style2_fixed_panel" : "zone_fallback";
        upperFaceZ = item.z1;
        upperRefBoardId = fixed ? "TopStyle2FixedFrontPanel" : void 0;
        if (!fixed) warnings.push("TopStyle2FixedFrontPanel not found; top edge fell back to zone z1 - FC.");
      }
    } else if (above?.type === "boundary_panel") {
      const aboveZone = stackingItems[itemIndex + 2];
      const centerZ = above.centerZ ?? (above.z0 + above.z1) / 2;
      if (zoneGeneratesFront(aboveZone?.zoneId)) {
        z1 = centerZ - FC / 2;
        z1Source = "front_front_boundary";
      } else if (zoneIsOpen(aboveZone?.zoneId)) {
        z1 = above.z1 - FC;
        z1Source = "open_zone_boundary";
      } else {
        z1 = centerZ - FC / 2;
        z1Source = "boundary_fallback";
        warnings.push("Unrecognized upper neighbor; used boundary center - FC/2.");
      }
      upperFaceZ = above.z0;
      upperRefBoardId = above.id;
    } else if (above?.type === "functional_zone") {
      z1 = zoneGeneratesFront(above.zoneId) ? item.z1 - FC / 2 : item.z1 - FC;
      z1Source = "zero_boundary";
      upperFaceZ = item.z1;
    } else {
      z1 = item.z1 - FC / 2;
      z1Source = "zone_fallback";
      warnings.push("No upper reference; used zone z1 - FC/2.");
      upperFaceZ = item.z1;
    }
    const isFixed = zone.type === "blank_panel";
    const leaves = [];
    if (zone.type === "double_door") {
      const vd = boardById(`VD_${zone.id}`);
      const seamX = vd ? (vd.x0 + vd.x1) / 2 : (frontX0 + frontX1) / 2;
      leaves.push(
        {
          idSuffix: "_L",
          resolvedType: "left_door",
          x0: frontX0 + FC,
          x1: seamX - FC / 2,
          hingeEdge: "left",
          handleEdge: "right",
          sideLockBoard: vd || null
        },
        {
          idSuffix: "_R",
          resolvedType: "right_door",
          x0: seamX + FC / 2,
          x1: frontX1 - FC,
          hingeEdge: "right",
          handleEdge: "left",
          sideLockBoard: vd || null
        }
      );
    } else if (zone.type === "left_side_door" || zone.type === "side_door") {
      leaves.push({
        idSuffix: "",
        resolvedType: "left_door",
        x0: frontX0 + FC,
        x1: frontX1 - FC,
        hingeEdge: "left",
        handleEdge: "right",
        sideLockBoard: boardById("V2") || null
      });
    } else if (zone.type === "right_side_door") {
      leaves.push({
        idSuffix: "",
        resolvedType: "right_door",
        x0: frontX0 + FC,
        x1: frontX1 - FC,
        hingeEdge: "right",
        handleEdge: "left",
        sideLockBoard: boardById("V1") || null
      });
    } else if (zone.type === "drawer") {
      leaves.push({
        idSuffix: "",
        resolvedType: "drawer",
        x0: frontX0 + FC,
        x1: frontX1 - FC,
        hingeEdge: null,
        handleEdge: null,
        sideLockBoard: null
      });
    } else if (zone.type === "top_flap" || zone.type === "bottom_flap") {
      leaves.push({
        idSuffix: "",
        resolvedType: zone.type,
        x0: frontX0 + FC,
        x1: frontX1 - FC,
        hingeEdge: zone.type === "top_flap" ? "top" : "bottom",
        handleEdge: null,
        sideLockBoard: null
      });
    } else {
      leaves.push({
        idSuffix: "",
        resolvedType: "fixed_panel",
        x0: frontX0,
        x1: frontX1,
        hingeEdge: null,
        handleEdge: null,
        sideLockBoard: null
      });
    }
    const hingeSettings = {
      ...hardware.defaultHingeSettings,
      ...zone.hingeSettings || {}
    };
    for (const leaf of leaves) {
      const panel = {
        id: `FP_${zone.id}${leaf.idSuffix}`,
        zoneId: zone.id,
        sourceZoneType: zone.type,
        resolvedType: leaf.resolvedType,
        x0: leaf.x0,
        x1: leaf.x1,
        y0: -FPT,
        y1: 0,
        z0,
        z1,
        width: leaf.x1 - leaf.x0,
        height: z1 - z0,
        thickness: FPT,
        z0Source,
        z1Source,
        warnings: [...warnings]
      };
      if (panel.width <= 0) panel.warnings.push("front panel width <= 0");
      if (panel.height <= 0) panel.warnings.push("front panel height <= 0");
      if (leaf.hingeEdge && !isFixed && zone.hingeEnabled !== false && leaf.resolvedType !== "drawer") {
        const isVerticalEdge = leaf.hingeEdge === "left" || leaf.hingeEdge === "right";
        const longSide = isVerticalEdge ? panel.height : panel.width;
        const sideDistance = hingeSettings.sideDistance === "auto" || !Number.isFinite(Number(hingeSettings.sideDistance)) ? gtDefaultHingeSideDistance(longSide) : Number(hingeSettings.sideDistance);
        const fromEdge = hingeSettings.cupCenterFromEdge;
        const holes = [];
        const push = (centerX, centerZ) => {
          holes.push({
            id: `${panel.id}_hinge_${holes.length + 1}`,
            diameter: hingeSettings.cupDiameter,
            depth: hingeSettings.cupDepth,
            centerX,
            centerY: 0,
            centerZ,
            drillFromFace: "rear"
          });
        };
        if (isVerticalEdge) {
          const cupX = leaf.hingeEdge === "left" ? panel.x0 + fromEdge : panel.x1 - fromEdge;
          push(cupX, panel.z1 - sideDistance);
          if (hingeSettings.useThreeHinges) push(cupX, (panel.z0 + panel.z1) / 2);
          push(cupX, panel.z0 + sideDistance);
        } else {
          const cupZ = leaf.hingeEdge === "top" ? panel.z1 - fromEdge : panel.z0 + fromEdge;
          push(panel.x0 + sideDistance, cupZ);
          if (hingeSettings.useThreeHinges) push((panel.x0 + panel.x1) / 2, cupZ);
          push(panel.x1 - sideDistance, cupZ);
        }
        const radius = hingeSettings.cupDiameter / 2;
        for (const hole of holes) {
          if (hole.centerX - radius < panel.x0 || hole.centerX + radius > panel.x1 || hole.centerZ - radius < panel.z0 || hole.centerZ + radius > panel.z1) {
            panel.warnings.push(`hinge cup ${hole.id} outside panel bounds`);
          }
        }
        panel.hingeHoles = holes;
      }
      const lockEnabled = hardware.locksEnabled && zone.lockEnabled !== false && leaf.resolvedType !== "fixed_panel";
      if (lockEnabled) {
        const lockSideDistance = n(zone.lockSideDistance, DEFAULT_LOCK_SIDE_DISTANCE);
        if (leaf.resolvedType === "drawer" || leaf.resolvedType === "bottom_flap") {
          if (upperFaceZ != null) {
            panel.lockCutout = gtLockCutoutFromCenter(
              (panel.x0 + panel.x1) / 2,
              upperFaceZ - LOCK_MOUNTING_SURFACE_TO_SLOT_CENTER,
              "horizontal",
              upperRefBoardId,
              "bottom",
              false
            );
          } else {
            panel.warnings.push("missing upper reference for lock placement");
          }
        } else if (leaf.resolvedType === "top_flap") {
          if (lowerFaceZ != null) {
            panel.lockCutout = gtLockCutoutFromCenter(
              (panel.x0 + panel.x1) / 2,
              lowerFaceZ + LOCK_MOUNTING_SURFACE_TO_SLOT_CENTER,
              "horizontal",
              lowerRefBoardId,
              "top",
              false
            );
          } else {
            panel.warnings.push("missing lower reference for lock placement");
          }
        } else {
          const requested = zone.lockPosition || (zone.type === "double_door" && leaf.sideLockBoard ? "side" : "top");
          let position = requested;
          let fallbackApplied = false;
          if (position === "side" && !leaf.sideLockBoard) {
            panel.warnings.push("side lock requested but no vertical board at handle edge; fell back to top");
            position = "top";
            fallbackApplied = true;
          }
          let shelfBoard = null;
          if (position === "shelf_top" || position === "shelf_bottom") {
            shelfBoard = boardById(`DS_${zone.id}${leaf.idSuffix}`) || boardById(`DS_${zone.id}`) || null;
            if (!shelfBoard) {
              panel.warnings.push(
                `${position} lock requested but no horizontal shelf board found for this leaf; fell back to top`
              );
              position = "top";
              fallbackApplied = true;
            }
          }
          if ((position === "shelf_top" || position === "shelf_bottom") && shelfBoard) {
            const centerX = leaf.handleEdge === "right" ? panel.x1 - lockSideDistance : panel.x0 + lockSideDistance;
            const centerZ = position === "shelf_top" ? shelfBoard.z1 + LOCK_MOUNTING_SURFACE_TO_SLOT_CENTER : shelfBoard.z0 - LOCK_MOUNTING_SURFACE_TO_SLOT_CENTER;
            panel.lockCutout = gtLockCutoutFromCenter(
              centerX,
              centerZ,
              "horizontal",
              shelfBoard.id,
              position === "shelf_top" ? "top" : "bottom",
              fallbackApplied
            );
          } else if (position === "side" && leaf.sideLockBoard) {
            const mount = leaf.sideLockBoard;
            const centerX = leaf.handleEdge === "right" ? mount.x0 - LOCK_MOUNTING_SURFACE_TO_SLOT_CENTER : mount.x1 + LOCK_MOUNTING_SURFACE_TO_SLOT_CENTER;
            let centerZ = panel.z1 - lockSideDistance;
            const lockHeight = zone.lockHeight;
            if (lockHeight !== void 0 && Number.isFinite(Number(lockHeight))) {
              centerZ = item.z0 + Number(lockHeight);
              if (centerZ < panel.z0 || centerZ > panel.z1) {
                panel.warnings.push(
                  `side lock height ${lockHeight} puts slot center Z ${centerZ} outside panel Z ${panel.z0}..${panel.z1}; clamped`
                );
                centerZ = Math.max(panel.z0 + LOCK_SLOT_LENGTH / 2, Math.min(panel.z1 - LOCK_SLOT_LENGTH / 2, centerZ));
              }
            }
            panel.lockCutout = gtLockCutoutFromCenter(
              centerX,
              centerZ,
              "vertical",
              mount.id,
              leaf.handleEdge === "right" ? "left" : "right",
              fallbackApplied
            );
          } else if (position === "bottom") {
            if (lowerFaceZ != null) {
              const centerX = leaf.handleEdge === "right" ? panel.x1 - lockSideDistance : panel.x0 + lockSideDistance;
              panel.lockCutout = gtLockCutoutFromCenter(
                centerX,
                lowerFaceZ + LOCK_MOUNTING_SURFACE_TO_SLOT_CENTER,
                "horizontal",
                lowerRefBoardId,
                "top",
                fallbackApplied
              );
            } else {
              panel.warnings.push("missing lower reference for lock placement");
            }
          } else {
            if (upperFaceZ != null) {
              const centerX = leaf.handleEdge === "right" ? panel.x1 - lockSideDistance : panel.x0 + lockSideDistance;
              panel.lockCutout = gtLockCutoutFromCenter(
                centerX,
                upperFaceZ - LOCK_MOUNTING_SURFACE_TO_SLOT_CENTER,
                "horizontal",
                upperRefBoardId,
                "bottom",
                fallbackApplied
              );
            } else {
              panel.warnings.push("missing upper reference for lock placement");
            }
          }
        }
        if (panel.lockCutout) {
          const cut = panel.lockCutout;
          if (cut.x0 < panel.x0 || cut.x1 > panel.x1 || cut.z0 < panel.z0 || cut.z1 > panel.z1) {
            panel.warnings.push("lock cutout outside panel bounds");
          }
        }
      }
      for (const warning of panel.warnings) {
        validation.warnings.push(`FrontPanel ${panel.id}: ${warning}`);
      }
      panels.push(panel);
    }
  }
  return panels;
}
function buildDebug(params) {
  const panelThickness = n(params.panelThickness, DEFAULT_PANEL_THICKNESS);
  const leftSidePanelThickness = n(params.leftSidePanelThickness, 0);
  const rightSidePanelThickness = n(params.rightSidePanelThickness, 0);
  const frontPanelThickness = n(
    params.frontPanelThickness,
    n(params.frontFaceAllowance, n(params.doorPanelThickness, DEFAULT_FRONT_FACE_ALLOWANCE))
  );
  return {
    midWidth: Number(params.cabinetWidth) - leftSidePanelThickness - rightSidePanelThickness,
    midDepth: Number(params.cabinetDepth) - frontPanelThickness,
    leftSidePanelThickness,
    rightSidePanelThickness,
    panelThickness,
    frontFaceAllowance: frontPanelThickness,
    ziThickness: n(params.ziThickness, DEFAULT_ZI_THICKNESS2),
    hThickness: n(params.hThickness, DEFAULT_H_THICKNESS),
    sideClearance: n(params.sideClearance, DEFAULT_SIDE_CLEARANCE),
    doorPanelThickness: frontPanelThickness
  };
}
function applyFridgeExteriorModel(params, notes) {
  const fridgeZones = (params.zones || []).filter((zone) => zone.type === "fridge");
  if (!fridgeZones.length) return params;
  const exteriorSide = params.exteriorSide === "left" || params.exteriorSide === "right" ? params.exteriorSide : "none";
  const SIDE_PANEL_MM = 16;
  const next = { ...params, exteriorSide };
  if (exteriorSide === "left") {
    next.leftSidePanelThickness = SIDE_PANEL_MM;
    notes.push("Fridge exteriorSide=left \u2192 SidePanel_L thickness 16mm.");
  } else if (exteriorSide === "right") {
    next.rightSidePanelThickness = SIDE_PANEL_MM;
    notes.push("Fridge exteriorSide=right \u2192 SidePanel_R thickness 16mm.");
  }
  const sync = params.syncCabinetWidthFromFridge !== false;
  const applianceWidth = Number(fridgeZones[0].applianceWidthMm);
  if (sync && Number.isFinite(applianceWidth) && applianceWidth > 0) {
    const allowance = exteriorSide === "none" ? 45 : 61;
    const targetWidth = applianceWidth + allowance;
    if (Math.abs(Number(params.cabinetWidth) - targetWidth) > 0.01) {
      notes.push(
        `Cabinet width synced from fridge appliance (${applianceWidth}+${allowance}=${targetWidth}).`
      );
    }
    next.cabinetWidth = targetWidth;
  }
  return next;
}
function generateGeneralTallCabinet(inputParams) {
  if (!inputParams || typeof inputParams !== "object") {
    throw new Error("generateGeneralTallCabinet requires params.");
  }
  const fridgeNotes = [];
  let params = {
    ...inputParams,
    zones: (inputParams.zones || []).map((zone) => {
      if (zone.type === "left_side_door" || zone.type === "right_side_door") {
        return { ...zone, type: "side_door" };
      }
      if (zone.type !== "fridge") return zone;
      const applianceHeight = Number(zone.applianceHeightMm);
      if (Number.isFinite(applianceHeight) && applianceHeight > 0) {
        if (Math.abs(Number(zone.height) - applianceHeight) > 0.01) {
          fridgeNotes.push(
            `Fridge zone ${zone.id} height synced to applianceHeightMm=${applianceHeight}.`
          );
        }
        return { ...zone, height: applianceHeight };
      }
      fridgeNotes.push(
        `Fridge zone ${zone.id} has no applianceHeightMm; using zone height ${Number(zone.height) || 0}.`
      );
      return zone;
    })
  };
  params = applyFridgeExteriorModel(params, fridgeNotes);
  const debug = buildDebug(params);
  const stacking = calculateZStacking({
    cabinetHeight: params.cabinetHeight,
    topSystem: params.topSystem,
    bottomSystem: params.bottomSystem,
    zones: params.zones,
    ziThickness: debug.ziThickness
  });
  const boards = [];
  const validation = {
    errors: [...stacking.validation.errors],
    warnings: [...stacking.validation.warnings, ...fridgeNotes]
  };
  for (const zone of params.zones) {
    if (zone.type !== "fridge") continue;
    const width = Number(zone.applianceWidthMm);
    const depth = Number(zone.applianceDepthMm);
    if (Number.isFinite(width) && width > debug.midWidth + 0.01) {
      validation.warnings.push(
        `Fridge zone ${zone.id} applianceWidthMm=${width} exceeds interior midWidth=${debug.midWidth}.`
      );
    }
    if (Number.isFinite(depth) && depth > debug.midDepth + 0.01) {
      validation.warnings.push(
        `Fridge zone ${zone.id} applianceDepthMm=${depth} exceeds interior midDepth=${debug.midDepth}.`
      );
    }
  }
  const avoidanceBase = resolveAvoidanceAdjustment(params, debug, validation);
  const avoidance = applyFridgeRaisedAvoidance(
    params,
    stacking.items,
    debug,
    avoidanceBase,
    validation
  );
  addVerticalBoards(boards, params, debug, Number(params.cabinetHeight));
  addSidePanelBoards(boards, params, debug, validation);
  addAvoidanceSupportBoards(boards, params, debug, validation, avoidance);
  addStyle1BottomSystemBoards(boards, params, debug);
  addStyle1TopSystemBoards(boards, params, debug);
  addStyle2SystemPanels(boards, params, debug);
  addStyle1InsertBoardProfileVectors(boards, debug);
  addSystemPlaceholders(boards, params, debug, stacking.topSystemHeight, stacking.bottomSystemHeight);
  addBoundaryZiBoards(boards, stacking.items, debug, params, avoidance);
  addFridgeV5Boards(boards, params, stacking.items, debug, validation.warnings);
  addZiBoardProfileVectors(boards, debug, validation);
  addHSupportBoards(boards, params, debug, avoidance);
  addFridgeRaisedHSetBoards(boards, stacking.items, params, debug, avoidance);
  addTopRearTBoards(boards, params, debug);
  detectMergeAndAdjustHConflicts(boards, params, debug, validation);
  addVerticalDividerBoards(boards, params, stacking.items, debug, validation);
  addDoorShelfBoards(boards, params, stacking.items, debug, validation, avoidance);
  addBlankPanelH12Boards(boards, params.zones, stacking.items, debug);
  addStyle2FixedFrontPanels(boards, params, debug);
  const ziGrooveFeatures = generateZiGrooveFeatures(boards, params, debug, validation);
  const features = [
    ...generateZiSlotFeatures(stacking.items, boards, debug, validation),
    ...generateDoorShelfZiSlotFeatures(boards, debug),
    ...ziGrooveFeatures,
    ...generateDividerTongueFeatures(boards, ziGrooveFeatures, debug, validation),
    ...generateH34ClearanceSlotFeatures(boards, debug, validation),
    ...generateStyle1T3B3FeaturePlaceholders(boards)
  ];
  addVerticalDividerH34ClearanceProfiles(boards, features, debug, validation);
  addVBoardSideProfileSkeletons(boards, features, params, debug, validation, avoidance);
  applyCoreBoardXOffset(boards, debug, params);
  updateSidePanelOverlapAudit(boards, debug, validation);
  updateAssemblyOverlapAudit(boards, debug, validation);
  const frontPanels = buildGeneralTallFrontPanels(inputParams, stacking.items, boards, debug, validation);
  const relationshipDeclarations = relationshipDeclarationsForBoards(boards);
  return {
    boards,
    features,
    frontPanels,
    stacking,
    boundaries: stacking.boundaryResolution.boundaries,
    validation,
    warnings: validation.warnings,
    debug,
    relationshipDeclarations
  };
}
export {
  generateGeneralTallCabinet
};
