// Module registry. Each entry wraps a shared generator bundle (renderer/gen/*)
// and describes its envelope: which params are the outer W/D/H and which
// divider handles exist. The renderer only reads this; formulas stay in the
// generators.
import { generateSmallCabinet } from "./gen/smallCabinet.js";
import { generateBedroom } from "./gen/bedroom.js";
import { generateBedBox, BED_BOX_DEFAULT_HEIGHT, BED_BOX_MIN } from "./gen/bedBox.js";
import { generateOverheadCabinet, generateOHCSvgPreview } from "./gen/overheadCabinet.js";
import { generateUShapeOverhead, resolveUOverheadLayout } from "./gen/uShapeOverhead.js";
import { generateBedSideTable, BED_SIDE_DEFAULT_HEIGHT, BED_SIDE_MIN } from "./gen/bedSideTable.js";
import { generateGeneralTallCabinet } from "./gen/generalTall.js";
import { generateKitchenCabinetGeometry } from "./gen/kitchen.js";
import { generateLoungeGeometry } from "./gen/lounge.js";
import { displayGeneralTall, displayKitchen, displayLounge, withKitchenVPanelPrefs } from "./displayBoards.js";
import { withTallFridgeDefaults } from "./panelDefaults.js";
export { isRailModule, MIGRATED_MODULE_IDS } from "./flags.js";
import { clearHeightAt, maxClearHeight } from "./spaces.js";
import { builtInFinish, builtInStock, cabinetColor, thickness } from "./materials.js";

function materialsOf(materials) {
  return {
    finish: materials && materials.finish ? materials.finish : builtInFinish(),
    stock: materials && materials.stock ? materials.stock : builtInStock(),
  };
}

export const MIN_ZONE_HEIGHT = 60;
const round1 = (v) => Math.round(v * 10) / 10;

/** Scale zone heights so they sum to `interior`, absorbing rounding in the last zone. */
export function fitZones(zones, interior) {
  if (!zones.length) return [];
  const sum = zones.reduce((s, z) => s + z.height, 0) || 1;
  // Whole millimetres for all but the last zone, which absorbs the remainder.
  const out = zones.map((z) => ({ ...z, height: Math.max(MIN_ZONE_HEIGHT, Math.round((z.height / sum) * interior)) }));
  const partial = out.slice(0, -1).reduce((s, z) => s + z.height, 0);
  out[out.length - 1].height = round1(interior - partial);
  if (out[out.length - 1].height < MIN_ZONE_HEIGHT) {
    // Interior too small for this many zones; distribute evenly instead.
    const even = round1(interior / out.length);
    out.forEach((z) => (z.height = even));
    out[out.length - 1].height = round1(interior - even * (out.length - 1));
  }
  return out;
}

const smallCabinet = {
  id: "smallCabinet",
  label: "Small",
  sub: "simple box",
  defaultSize: { W: 600, D: 560, H: 720 },
  minSize: { W: 120, D: 100, H: 120 },

  defaults(W, D, H, materials) {
    const { finish, stock } = materialsOf(materials);
    const cpt = thickness(stock, "carcass");
    const color = cabinetColor(finish);
    return {
      cabinetWidth: W,
      cabinetDepth: D,
      cabinetHeight: H,
      panelThickness: cpt,
      frontPanelThickness: thickness(stock, "door"),
      frontClearance: 2.5,
      carcassColor: color.carcassColor,
      carcassColorName: color.carcassColorName,
      doorSeries: color.doorSeries,
      doorColor: color.doorColor,
      doorColorName: color.doorColorName,
      colorSlot: color.colorSlot,
      zones: [{ id: "zone-1", type: "left_door", height: round1(H - 2 * cpt) }],
    };
  },

  generate(params) {
    return generateSmallCabinet(params);
  },

  envelope(params) {
    return { W: params.cabinetWidth, D: params.cabinetDepth, H: params.cabinetHeight };
  },

  /** Returns a new params object with the outer size changed. */
  setEnvelope(params, { W, D, H }) {
    const next = { ...params };
    if (W != null) next.cabinetWidth = round1(W);
    if (D != null) next.cabinetDepth = round1(D);
    if (H != null) {
      next.cabinetHeight = round1(H);
      const cpt = params.panelThickness ?? thickness(builtInStock(), "carcass");
      next.zones = fitZones(params.zones || [], round1(next.cabinetHeight - 2 * cpt));
    }
    return next;
  },

  /**
   * Divider handles on the front face. Small cabinet zones stack top→bottom,
   * so each boundary is a horizontal line at local z.
   */
  dividers(params, result) {
    const zones = result?.zones || [];
    const out = [];
    for (let i = 0; i < zones.length - 1; i += 1) {
      out.push({ index: i, axis: "z", pos: zones[i].zBottom, min: zones[i + 1].zBottom + MIN_ZONE_HEIGHT, max: zones[i].zTop - MIN_ZONE_HEIGHT });
    }
    return out;
  },

  /** Move boundary `index` to local z = pos; returns new params. */
  setDivider(params, result, index, pos) {
    const zones = result.zones;
    const above = zones[index];
    const below = zones[index + 1];
    if (!above || !below) return params;
    const z = Math.max(below.zBottom + MIN_ZONE_HEIGHT, Math.min(above.zTop - MIN_ZONE_HEIGHT, Math.round(pos)));
    const total = round1(above.height + below.height);
    const hAbove = round1(above.zTop - z);
    const hBelow = round1(total - hAbove);
    const nextZones = (params.zones || []).map((zn) => ({ ...zn }));
    nextZones[index].height = hAbove;
    nextZones[index + 1].height = hBelow;
    return { ...params, zones: nextZones };
  },

  zoneTypes: [
    { id: "left_door", label: "Door (hinge left)" },
    { id: "right_door", label: "Door (hinge right)" },
    { id: "drawer", label: "Drawer" },
  ],
};

/**
 * Bedroom: the vehicle's nose slab, for now one solid volume (tunnel boot,
 * robes and overhead are partitioned inside it later). Not a
 * free box: its front is the nose cross-section, its width the van's inside
 * width, its height the roof at the room face; only the depth (distance from
 * the nose) is chosen. Placement "nose" (see interact.js) puts it at the
 * front with pose { x: W, y: D, rotZ: 180 } so the room-side face is the
 * cabinet front (fronts at negative local Y, per the core contract) and local
 * Y runs from the room face toward the nose.
 */
const bedroom = {
  id: "bedroom",
  label: "Bedroom",
  sub: "nose volume",
  placement: "nose",
  single: true, // one per vehicle; picking the module again edits the existing one
  roofAware: true, // the envelope already follows the roof; fit checks skip the roof
  volumeOnly: true, // no boards yet: the envelope is drawn as the solid
  handles: ["D"],
  defaultSize: { W: 2100, D: 700, H: 1965 },
  minSize: { W: 600, D: 300, H: 600 },

  defaults(W, D, H, materials) {
    const { finish, stock } = materialsOf(materials);
    const color = cabinetColor(finish);
    return {
      width: round1(W),
      depth: round1(D),
      height: round1(H),
      roofProfile: [[0, round1(H)], [round1(D), round1(H)]],
      panelThickness: thickness(stock, "carcass"),
      frontPanelThickness: 0,
      carcassColor: color.carcassColor,
      doorSeries: color.doorSeries,
      doorColor: color.doorColor,
      colorSlot: color.colorSlot,
    };
  },

  generate(params) {
    return generateBedroom(params);
  },

  envelope(params) {
    return { W: params.width, D: params.depth, H: params.height };
  },

  setEnvelope(params, { W, D, H }) {
    const next = { ...params };
    if (W != null) next.width = round1(W);
    if (D != null) next.depth = round1(D);
    if (H != null) next.height = round1(H);
    return next;
  },

  /**
   * Bind the slab to the space: width = van width, height = roof at the room
   * face, roofProfile = the roof over the slab in local Y (0 at the room face,
   * increasing toward the nose). Returns the same object when nothing changed.
   */
  withSpace(params, resolved, pose) {
    if (!resolved) return params;
    const D = params.depth;
    const a = ((pose.rotZ || 0) * Math.PI) / 180;
    const cy = Math.cos(a);
    const worldY = (ly) => pose.y + ly * cy; // local X = 0 along the profile
    const yA = worldY(0);
    const yB = worldY(D);
    const ys = new Set([0, D]);
    for (const [y] of resolved.profile || []) {
      const ly = cy !== 0 ? (y - pose.y) / cy : null;
      if (ly != null && ly > 0.01 && ly < D - 0.01) ys.add(round1(ly));
    }
    const profile = [...ys].sort((p, q) => p - q).map((ly) => [ly, round1(clearHeightAt(resolved, 0, worldY(ly)))]);
    const height = round1(maxClearHeight(resolved, yA, yB));
    const width = round1(resolved.bounds.maxX - resolved.bounds.minX);
    const same = params.width === width && params.height === height
      && JSON.stringify(params.roofProfile) === JSON.stringify(profile);
    if (same) return params;
    return { ...params, width, height, roofProfile: profile };
  },

  /** Local YZ outline of the envelope (room face at y = 0) for the prism wireframe. */
  envelopeProfile(params) {
    return params.roofProfile || [[0, params.height], [params.depth, params.height]];
  },

  dividers() { return []; },
  setDivider(params) { return params; },
  zoneTypes: [],
};

/**
 * Bed Box: the bed base, attached to the Bedroom body. It sits against the
 * body's room-side face, centred on the van's centre line and symmetric about
 * it; height = tunnel boot height (420 until the boot is defined on the body).
 * Placement "bedBox" (interact.js): drag the width as a 2D line on the floor,
 * click, pull the depth into the room, click. `attach` keeps it glued to the
 * body whenever the body or the space changes.
 */
const bedBox = {
  id: "bedBox",
  label: "Bed Box",
  sub: "bed base",
  placement: "bedBox",
  single: true,
  requires: "bedroom", // usable only once the body exists
  attachesTo: "bedroom", // the body's depth drag ignores it
  volumeOnly: true,
  handles: ["D"],
  defaultSize: { W: 1530, D: 1900, H: BED_BOX_DEFAULT_HEIGHT },
  minSize: { W: BED_BOX_MIN.width, D: BED_BOX_MIN.depth, H: BED_BOX_MIN.height },

  defaults(W, D, H, materials) {
    const { finish, stock } = materialsOf(materials);
    const color = cabinetColor(finish);
    return {
      width: round1(W),
      depth: round1(D),
      height: round1(H),
      panelThickness: thickness(stock, "carcass"),
      frontPanelThickness: 0,
      carcassColor: color.carcassColor,
      doorSeries: color.doorSeries,
      doorColor: color.doorColor,
      colorSlot: color.colorSlot,
    };
  },
  generate(params) {
    return generateBedBox(params);
  },
  envelope(params) {
    return { W: params.width, D: params.depth, H: params.height };
  },
  setEnvelope(params, { W, D, H }) {
    const next = { ...params };
    if (W != null) next.width = round1(W);
    if (D != null) next.depth = round1(D);
    if (H != null) next.height = round1(H);
    return next;
  },

  /**
   * Glue to the body: room-side face of the box at the body's room-side
   * face, centred on the van. Returns { params, pose } or null when there is
   * no body (the box then stays where it is).
   */
  attach(params, pose, { cabinets, resolved }) {
    const body = cabinets.find((c) => c.moduleId === "bedroom");
    if (!body || !resolved) return null;
    const bodyD = getModule(body.moduleId).envelope(body.params).D;
    const cx = (resolved.bounds.minX + resolved.bounds.maxX) / 2;
    // rotZ 180: local X runs W→0 from pose.x, local Y from the room face (pose.y) toward the body.
    const next = { x: round1(cx + params.width / 2), y: round1(bodyD + params.depth), z: 0, rotZ: 180 };
    const same = pose.x === next.x && pose.y === next.y && pose.z === next.z && (pose.rotZ || 0) === next.rotZ;
    return { params, pose: same ? pose : next };
  },

  dividers() { return []; },
  setDivider(params) { return params; },
  zoneTypes: [],
};

/**
 * Overhead cabinet (OHC): hangs from the ceiling with its back on a wall.
 * The box is the whole solid — carcass + the 40 mm top structure + the door
 * thickness; doors may hang a little below it. Placement "ceiling"
 * (interact.js): the anchor is a point on a ceiling ∩ wall line, W runs along
 * that wall, doors face the room; the Face command is not available.
 * Zones run left → right along W and sum to W (the generator's zone frame).
 *
 * Adapter to the shared generator: its frame already matches ours — carcass
 * y 0..cabinetDepth, fronts at y −FPT..0 — so W/D/H map straight onto
 * cabinetWidth / cabinetDepth / cabinetHeight. Stock: every non-door board is
 * carcass stock (`featureWidth`), doors are door stock (`frontPanelThickness`).
 */
export const MIN_ZONE_WIDTH = 150;

/** Scale zone widths so they sum to `total` (whole mm, last zone absorbs the remainder, none under MIN_ZONE_WIDTH). */
export function fitZoneWidths(zones, total) {
  if (!zones.length) return [];
  const sum = zones.reduce((s, z) => s + z.width, 0) || 1;
  const out = zones.map((z) => ({ ...z, width: Math.max(MIN_ZONE_WIDTH, Math.round((z.width / sum) * total)) }));
  const partial = out.slice(0, -1).reduce((s, z) => s + z.width, 0);
  out[out.length - 1].width = round1(total - partial);
  if (out[out.length - 1].width < MIN_ZONE_WIDTH) {
    const even = round1(total / out.length);
    out.forEach((z) => (z.width = even));
    out[out.length - 1].width = round1(total - even * (out.length - 1));
  }
  return out;
}

const overheadCabinet = {
  id: "overheadCabinet",
  label: "Overhead",
  sub: "against the ceiling",
  placement: "ceiling",
  noOrient: true, // only one side can hold the doors: the one facing the room
  growsDown: true, // the top is glued to the ceiling; H changes move the bottom
  panel: "ohc", // wide right-hand editor: zone strip + front view
  defaultSize: { W: 1200, D: 350, H: 400 },
  minSize: { W: MIN_ZONE_WIDTH, D: 150, H: 150 },

  defaults(W, D, H, materials) {
    const { finish, stock } = materialsOf(materials);
    const color = cabinetColor(finish);
    return {
      cabinetWidth: round1(W),
      cabinetDepth: round1(D),
      cabinetHeight: round1(H),
      style: "style_1",
      featureWidth: thickness(stock, "carcass"),
      frontPanelThickness: thickness(stock, "door"),
      topClearanceHeight: 40,
      clearance: 2.5,
      ledGroove: false, // manufacturing option; exposed later with the other advanced fields
      carcassColor: color.carcassColor,
      carcassColorName: color.carcassColorName,
      doorSeries: color.doorSeries,
      doorColor: color.doorColor,
      doorColorName: color.doorColorName,
      colorSlot: color.colorSlot,
      zones: [{ id: "zone-1", type: "up_flap", width: round1(W) }],
    };
  },

  generate(params) {
    return generateOverheadCabinet(params);
  },

  /** 2D front elevation (SVG markup) from the last generation; `selectedZoneIndex` is outlined. */
  frontView(result, { selectedZoneIndex = -1 } = {}) {
    const geo = result?.debug?.legacyGeometry;
    if (!geo) return null;
    return generateOHCSvgPreview(geo, { selectedZoneIndex, showDimensions: true });
  },

  envelope(params) {
    return { W: params.cabinetWidth, D: params.cabinetDepth, H: params.cabinetHeight };
  },

  setEnvelope(params, { W, D, H }) {
    const next = { ...params };
    if (W != null) {
      next.cabinetWidth = round1(W);
      next.zones = fitZoneWidths(params.zones || [], next.cabinetWidth);
    }
    if (D != null) next.cabinetDepth = round1(D);
    if (H != null) next.cabinetHeight = round1(H);
    return next;
  },

  /** Zone boundaries: vertical lines on the front face at local x (left → right). */
  dividers(params) {
    const zones = params.zones || [];
    const out = [];
    let x = 0;
    for (let i = 0; i < zones.length - 1; i += 1) {
      x = round1(x + zones[i].width);
      out.push({ index: i, axis: "x", pos: x, min: x - zones[i].width + MIN_ZONE_WIDTH, max: x + zones[i + 1].width - MIN_ZONE_WIDTH });
    }
    return out;
  },

  /** Move boundary `index` to local x = pos; the two zones it separates trade width. */
  setDivider(params, result, index, pos) {
    const zones = (params.zones || []).map((z) => ({ ...z }));
    const left = zones[index];
    const right = zones[index + 1];
    if (!left || !right) return params;
    const x0 = zones.slice(0, index).reduce((s, z) => s + z.width, 0);
    const total = round1(left.width + right.width);
    const x = Math.max(x0 + MIN_ZONE_WIDTH, Math.min(x0 + total - MIN_ZONE_WIDTH, Math.round(pos)));
    left.width = round1(x - x0);
    right.width = round1(total - left.width);
    return { ...params, zones };
  },

  zoneTypes: [
    { id: "up_flap", label: "Up flap", short: "Flap" },
    { id: "fixed_panel", label: "Fixed panel", short: "Fixed" },
    { id: "open", label: "Open", short: "Open" },
  ],
};

/**
 * U-overhead: three OHC runs (left, back, right) inside one bounding box.
 * Reuses generateOverheadCabinet; placement is ceiling like a single OHC.
 * Envelope D is the U's outer depth; cabinetDepth is each run's carcass depth.
 * Doors hang into the opening, so the box has no extra front allowance.
 */
const uShapeOverheadCabinet = {
  id: "uShapeOverheadCabinet",
  label: "U overhead",
  sub: "three OHC runs",
  placement: "ceiling",
  noOrient: true,
  growsDown: true,
  noFrontAllowance: true,
  panel: "uohc",
  defaultSize: { W: 2000, D: 1200, H: 400 },
  minSize: { W: 2 * MIN_ZONE_WIDTH + 150, D: MIN_ZONE_WIDTH + 150, H: 150 },

  defaults(W, D, H, materials) {
    const { finish, stock } = materialsOf(materials);
    const color = cabinetColor(finish);
    const run = 350;
    const back = Math.max(MIN_ZONE_WIDTH, round1(W - 2 * run));
    return {
      cabinetWidth: round1(W),
      outerDepth: round1(D),
      cabinetHeight: round1(H),
      cabinetDepth: run,
      style: "style_1",
      featureWidth: thickness(stock, "carcass"),
      frontPanelThickness: thickness(stock, "door"),
      topClearanceHeight: 40,
      clearance: 2.5,
      carcassColor: color.carcassColor,
      carcassColorName: color.carcassColorName,
      doorSeries: color.doorSeries,
      doorColor: color.doorColor,
      doorColorName: color.doorColorName,
      colorSlot: color.colorSlot,
      leftZones: [{ id: "left-1", type: "up_flap", width: round1(D) }],
      backZones: [{ id: "back-1", type: "up_flap", width: back }],
      rightZones: [{ id: "right-1", type: "up_flap", width: round1(D) }],
    };
  },

  generate(params) {
    return generateUShapeOverhead(params);
  },

  envelope(params) {
    return { W: params.cabinetWidth, D: params.outerDepth, H: params.cabinetHeight };
  },

  setEnvelope(params, { W, D, H }) {
    const next = { ...params };
    if (W != null) next.cabinetWidth = round1(W);
    if (D != null) next.outerDepth = round1(D);
    if (H != null) next.cabinetHeight = round1(H);
    const layout = resolveUOverheadLayout(next);
    next.cabinetDepth = layout.run;
    next.leftZones = fitZoneWidths(next.leftZones || [], layout.leftLen);
    next.rightZones = fitZoneWidths(next.rightZones || [], layout.rightLen);
    next.backZones = fitZoneWidths(next.backZones || [], layout.backLen);
    return next;
  },

  dividers() { return []; },
  setDivider(params) { return params; },
  setRunDivider(params, runKey, index, pos) {
    const layout = resolveUOverheadLayout(params);
    const total = runKey === "backZones" ? layout.backLen : layout.leftLen;
    const zones = (params[runKey] || []).map((z) => ({ ...z }));
    const left = zones[index];
    const right = zones[index + 1];
    if (!left || !right) return params;
    const x0 = zones.slice(0, index).reduce((s, z) => s + z.width, 0);
    const span = round1(left.width + right.width);
    const x = Math.max(x0 + MIN_ZONE_WIDTH, Math.min(x0 + Math.min(span, total) - MIN_ZONE_WIDTH, Math.round(pos)));
    left.width = round1(x - x0);
    right.width = round1(span - left.width);
    return { ...params, [runKey]: zones };
  },
  zoneTypes: [
    { id: "up_flap", label: "Up flap", short: "Flap" },
    { id: "fixed_panel", label: "Fixed panel", short: "Fixed" },
    { id: "open", label: "Open", short: "Open" },
  ],
};

/**
 * Bed Side Table: volume beside the bed, against the Bedroom body and a
 * side wall. One per side. Placement "bedSide" (interact.js).
 */
const bedSideTable = {
  id: "bedSideTable",
  label: "Bed Side Table",
  sub: "beside the bed · needs the body",
  placement: "bedSide",
  requires: "bedroom",
  attachesTo: "bedroom",
  volumeOnly: true,
  handles: ["W", "D", "H"],
  defaultSize: { W: 400, D: 400, H: BED_SIDE_DEFAULT_HEIGHT },
  minSize: { W: BED_SIDE_MIN.width, D: BED_SIDE_MIN.depth, H: BED_SIDE_MIN.height },

  defaults(W, D, H, materials) {
    const { finish, stock } = materialsOf(materials);
    const color = cabinetColor(finish);
    return {
      width: round1(W),
      depth: round1(D),
      height: round1(H),
      side: "left",
      panelThickness: thickness(stock, "carcass"),
      frontPanelThickness: 0,
      carcassColor: color.carcassColor,
      doorSeries: color.doorSeries,
      doorColor: color.doorColor,
      colorSlot: color.colorSlot,
    };
  },
  generate(params) {
    return generateBedSideTable(params);
  },
  envelope(params) {
    return { W: params.width, D: params.depth, H: params.height };
  },
  setEnvelope(params, { W, D, H }) {
    const next = { ...params };
    if (W != null) next.width = round1(W);
    if (D != null) next.depth = round1(D);
    if (H != null) next.height = round1(H);
    return next;
  },

  attach(params, pose, { cabinets, resolved }) {
    const body = cabinets.find((c) => c.moduleId === "bedroom");
    if (!body || !resolved) return null;
    const bodyD = getModule(body.moduleId).envelope(body.params).D;
    const side = params.side === "right" ? "right" : "left";
    const minX = resolved.bounds.minX;
    const maxX = resolved.bounds.maxX;
    const bed = cabinets.find((c) => c.moduleId === "bedBox");
    let W = params.width;
    if (bed) {
      const bedEnv = getModule(bed.moduleId).envelope(bed.params);
      const cx = (resolved.bounds.minX + resolved.bounds.maxX) / 2;
      const bed0 = cx - bedEnv.W / 2;
      const bed1 = cx + bedEnv.W / 2;
      const gap = side === "left" ? bed0 - minX : maxX - bed1;
      if (gap + 0.5 < getModule("bedSideTable").minSize.W) return { params, pose };
      W = round1(Math.min(W, Math.max(getModule("bedSideTable").minSize.W, gap)));
    }
    const x = side === "left" ? round1(minX + W) : round1(maxX);
    const nextPose = { x, y: round1(bodyD + params.depth), z: 0, rotZ: 180 };
    const nextParams = W === params.width && params.side === side ? params : { ...params, width: W, side };
    const same = pose.x === nextPose.x && pose.y === nextPose.y && pose.z === nextPose.z && (pose.rotZ || 0) === nextPose.rotZ
      && nextParams === params;
    return { params: nextParams, pose: same ? pose : nextPose };
  },

  dividers() { return []; },
  setDivider(params) { return params; },
  zoneTypes: [],
};

/**
 * General tall: Fusion 89bedb2 stacking (bottom system → zones + Zi → top system).
 * Zones in params are bottom → top. Fridge is a zone, not a separate module.
 * Cab Lab OHC is not replaced; this is the floor-standing tall unit.
 */
function kitchenInteriorH(params) {
  const g = params.globalSettings || {};
  return round1((g.height || 0) - (g.bottomClearanceHeight || 0) - (g.materialThickness || 0));
}

const generalTallCabinet = {
  id: "generalTallCabinet",
  label: "Tall",
  sub: "general tall",
  panel: "tall",
  defaultSize: { W: 600, D: 584, H: 2000 },
  minSize: { W: 300, D: 250, H: 600 },

  defaults(W, D, H, materials) {
    const { finish, stock } = materialsOf(materials);
    const cpt = thickness(stock, "carcass");
    const color = cabinetColor(finish);
    const fpt = thickness(stock, "door");
    const zones = [
      { id: "zone-1", type: "side_door", height: 600 },
      { id: "zone-2", type: "drawer", height: 300 },
      { id: "zone-3", type: "double_door", height: 945, verticalDivider: true },
    ];
    const rawH = 2000;
    const next = {
      cabinetWidth: W,
      cabinetDepth: D,
      cabinetHeight: H,
      panelThickness: cpt,
      frontFaceAllowance: fpt,
      doorPanelThickness: fpt,
      frontClearance: 2.5,
      sideClearance: 3,
      carcassColor: color.carcassColor,
      carcassColorName: color.carcassColorName,
      doorSeries: color.doorSeries,
      doorColor: color.doorColor,
      doorColorName: color.doorColorName,
      colorSlot: color.colorSlot,
      topSystem: { style: "style_1", frontRailHeight: 40 },
      bottomSystem: { style: "style_1", frontRailHeight: 53 },
      avoidance: { enabled: false, depth: 200, height: 400 },
      zones: H === rawH ? zones : fitZones(zones, round1(zones.reduce((s, z) => s + z.height, 0) + (H - rawH))),
    };
    return next;
  },

  generate(params) {
    return displayGeneralTall(generateGeneralTallCabinet(withTallFridgeDefaults(params)));
  },

  envelope(params) {
    return { W: params.cabinetWidth, D: params.cabinetDepth, H: params.cabinetHeight };
  },

  setEnvelope(params, { W, D, H }) {
    const next = { ...params };
    if (W != null) next.cabinetWidth = round1(W);
    if (D != null) next.cabinetDepth = round1(D);
    if (H != null && H !== params.cabinetHeight) {
      next.cabinetHeight = round1(H);
      const sum = (params.zones || []).reduce((s, z) => s + z.height, 0);
      next.zones = fitZones(params.zones || [], round1(sum + (next.cabinetHeight - params.cabinetHeight)));
    }
    return next;
  },

  dividers(params, result) {
    const items = (result?.stacking?.items || []).filter((i) => i.type === "functional_zone");
    const out = [];
    for (let i = 0; i < items.length - 1; i += 1) {
      const a = items[i];
      const b = items[i + 1];
      out.push({
        index: i,
        axis: "z",
        pos: a.z1,
        min: a.z0 + MIN_ZONE_HEIGHT,
        max: b.z1 - MIN_ZONE_HEIGHT,
      });
    }
    return out;
  },

  setDivider(params, result, index, pos) {
    const items = (result?.stacking?.items || []).filter((i) => i.type === "functional_zone");
    const a = items[index];
    const b = items[index + 1];
    if (!a || !b) return params;
    const z = Math.max(a.z0 + MIN_ZONE_HEIGHT, Math.min(b.z1 - MIN_ZONE_HEIGHT, Math.round(pos)));
    const delta = z - a.z1;
    const nextZones = (params.zones || []).map((zn) => ({ ...zn }));
    if (!nextZones[index] || !nextZones[index + 1]) return params;
    nextZones[index].height = round1(nextZones[index].height + delta);
    nextZones[index + 1].height = round1(nextZones[index + 1].height - delta);
    if (nextZones[index].height < MIN_ZONE_HEIGHT || nextZones[index + 1].height < MIN_ZONE_HEIGHT) return params;
    return { ...params, zones: nextZones };
  },

  zoneTypes: [
    { id: "side_door", label: "Side door" },
    { id: "left_side_door", label: "Door (hinge left)" },
    { id: "right_side_door", label: "Door (hinge right)" },
    { id: "double_door", label: "Double door" },
    { id: "drawer", label: "Drawer" },
    { id: "open_space", label: "Open" },
    { id: "open_appliance", label: "Appliance opening" },
    { id: "fridge", label: "Fridge" },
    { id: "top_flap", label: "Top flap" },
    { id: "bottom_flap", label: "Bottom flap" },
    { id: "blank_panel", label: "Blank panel" },
  ],
};

/**
 * Kitchen base run: Fusion columns along W, zones stacked in each column.
 * V-panel machining prefs stay on params (manufacturing, not envelope).
 */
const kitchenCabinet = {
  id: "kitchenCabinet",
  label: "Base",
  sub: "kitchen run",
  panel: "kitchen",
  defaultSize: { W: 800, D: 560, H: 720 },
  minSize: { W: 300, D: 250, H: 400 },

  defaults(W, D, H, materials) {
    const { finish, stock } = materialsOf(materials);
    const cpt = thickness(stock, "carcass");
    const color = cabinetColor(finish);
    const kick = 100;
    const interior = Math.max(MIN_ZONE_HEIGHT, round1(H - kick - cpt));
    return {
      carcassColor: color.carcassColor,
      carcassColorName: color.carcassColorName,
      doorSeries: color.doorSeries,
      doorColor: color.doorColor,
      doorColorName: color.doorColorName,
      colorSlot: color.colorSlot,
      globalSettings: {
        length: W,
        depth: D,
        height: H,
        materialThickness: cpt,
        frontThickness: thickness(stock, "door"),
        bottomClearanceHeight: kick,
        bottomClearanceStyle: "style_1",
      },
      columns: [
        {
          id: "col-1",
          width: W,
          columnType: "left_door",
          zones: [{ id: "zone-1", height: interior, zoneType: "left_door" }],
        },
      ],
      wheelAvoidances: [],
      vPanelMachiningPreferences: [],
    };
  },

  generate(params) {
    return displayKitchen(generateKitchenCabinetGeometry(withKitchenVPanelPrefs(params)));
  },

  envelope(params) {
    const g = params.globalSettings || {};
    return { W: g.length, D: g.depth, H: g.height };
  },

  setEnvelope(params, { W, D, H }) {
    const g = { ...(params.globalSettings || {}) };
    let columns = (params.columns || []).map((c) => ({ ...c, zones: (c.zones || []).map((z) => ({ ...z })) }));
    if (W != null) {
      g.length = round1(W);
      columns = fitZoneWidths(columns, g.length);
    }
    if (D != null) g.depth = round1(D);
    if (H != null && H !== g.height) {
      g.height = round1(H);
      const interior = kitchenInteriorH({ ...params, globalSettings: g });
      columns = columns.map((c) => ({ ...c, zones: fitZones(c.zones || [], Math.max(MIN_ZONE_HEIGHT, interior)) }));
    }
    return { ...params, globalSettings: g, columns };
  },

  dividers(params) {
    const cols = params.columns || [];
    const out = [];
    let x = 0;
    for (let i = 0; i < cols.length - 1; i += 1) {
      x = round1(x + cols[i].width);
      out.push({
        index: i,
        axis: "x",
        pos: x,
        min: x - cols[i].width + MIN_ZONE_WIDTH,
        max: x + cols[i + 1].width - MIN_ZONE_WIDTH,
      });
    }
    return out;
  },

  setDivider(params, result, index, pos) {
    const columns = (params.columns || []).map((c) => ({ ...c }));
    const left = columns[index];
    const right = columns[index + 1];
    if (!left || !right) return params;
    const x0 = columns.slice(0, index).reduce((s, c) => s + c.width, 0);
    const total = round1(left.width + right.width);
    const x = Math.max(x0 + MIN_ZONE_WIDTH, Math.min(x0 + total - MIN_ZONE_WIDTH, Math.round(pos)));
    left.width = round1(x - x0);
    right.width = round1(total - left.width);
    return { ...params, columns };
  },

  /** Horizontal boundary under kitchen zone `zoneIndex` in column `colIndex` (zones stack top → bottom). */
  setColumnZoneDivider(params, colIndex, zoneIndex, posZ) {
    const g = params.globalSettings || {};
    const columns = (params.columns || []).map((c, i) => (
      i === colIndex ? { ...c, zones: (c.zones || []).map((z) => ({ ...z })) } : c
    ));
    const col = columns[colIndex];
    if (!col || zoneIndex >= (col.zones || []).length - 1) return params;
    const ch = g.height || 0;
    let top = ch;
    for (let i = 0; i < zoneIndex; i += 1) top -= col.zones[i].height;
    const bot = top - col.zones[zoneIndex].height - col.zones[zoneIndex + 1].height;
    const z = Math.max(bot + MIN_ZONE_HEIGHT, Math.min(top - MIN_ZONE_HEIGHT, Math.round(posZ)));
    col.zones[zoneIndex].height = round1(top - z);
    col.zones[zoneIndex + 1].height = round1(z - bot);
    if (col.zones[zoneIndex].height < MIN_ZONE_HEIGHT || col.zones[zoneIndex + 1].height < MIN_ZONE_HEIGHT) return params;
    return { ...params, columns };
  },

  zoneTypes: [
    { id: "left_door", label: "Door (hinge left)" },
    { id: "right_door", label: "Door (hinge right)" },
    { id: "double_door", label: "Double door" },
    { id: "drawer", label: "Drawer" },
    { id: "open", label: "Open" },
    { id: "down_flap", label: "Down flap" },
    { id: "stove", label: "Stove" },
    { id: "custom", label: "Custom" },
  ],
};

function loungeEnvelope(params) {
  const style = params.style || "I_SHAPE";
  const H = params.height;
  if (style === "I_SHAPE") return { W: params.mainWidth, D: params.mainDepth, H };
  if (style === "PARALLEL") return { W: params.totalWidth, D: params.depth, H };
  if (style === "U_SHAPE") return { W: params.totalWidth || params.mainWidth, D: params.depth || params.mainDepth, H };
  return { W: params.mainWidth, D: Math.max(params.mainDepth || 0, params.lDepth || 0), H };
}

const loungeGenerator = {
  id: "loungeGenerator",
  label: "Lounge",
  sub: "I / L / U / Parallel",
  panel: "lounge",
  placement: "lounge",
  noFrontAllowance: true,
  defaultSize: { W: 2000, D: 600, H: 420 },
  minSize: { W: 800, D: 400, H: 200 },

  defaults(W, D, H, materials) {
    const { finish, stock } = materialsOf(materials);
    const color = cabinetColor(finish);
    const ppt = thickness(stock, "partition") || thickness(stock, "carcass");
    return {
      style: "I_SHAPE",
      height: H,
      partitionPanelThickness: ppt,
      wheelAvoidanceEnabled: false,
      mainWidth: W,
      mainDepth: D,
      lWidth: 1600,
      lDepth: Math.max(D, 800),
      lPosition: "RIGHT",
      topLidEnabled: true,
      lFrontAccess: "NONE",
      totalWidth: Math.max(W, 4000),
      singleLoungeWidth: 1500,
      depth: Math.max(D, 800),
      avoidanceDepth: 300,
      avoidanceHeight: 250,
      hasMiddleCabinet: false,
      carcassColor: color.carcassColor,
      carcassColorName: color.carcassColorName,
      doorSeries: color.doorSeries,
      doorColor: color.doorColor,
      doorColorName: color.doorColorName,
      colorSlot: color.colorSlot,
    };
  },

  generate(params) {
    return displayLounge(generateLoungeGeometry(params));
  },

  envelope: loungeEnvelope,

  setEnvelope(params, { W, D, H }) {
    const next = { ...params };
    const style = params.style || "I_SHAPE";
    if (H != null) next.height = round1(H);
    if (style === "I_SHAPE") {
      if (W != null) next.mainWidth = round1(W);
      if (D != null) next.mainDepth = round1(D);
    } else if (style === "PARALLEL") {
      if (W != null) next.totalWidth = round1(W);
      if (D != null) next.depth = round1(D);
    } else if (style === "U_SHAPE") {
      if (W != null) next.totalWidth = round1(W);
      if (D != null) next.depth = round1(D);
    } else {
      if (W != null) next.mainWidth = round1(W);
      if (D != null) next.lDepth = round1(D);
    }
    return next;
  },

  dividers() { return []; },
  setDivider(params) { return params; },
  zoneTypes: [],
};

export const MODULES = {
  smallCabinet,
  overheadCabinet,
  uShapeOverheadCabinet,
  bedroom,
  bedBox,
  bedSideTable,
  generalTallCabinet,
  kitchenCabinet,
  loungeGenerator,
};

/**
 * Rail groups: one rail entry that opens a flyout of sub-modules on hover.
 * `moduleId` items arm that module; `planned` items are listed but disabled.
 */
export const MODULE_GROUPS = [
  {
    id: "bedroom",
    label: "Bedroom",
    sub: "3 sub-modules",
    items: [
      { moduleId: "bedroom", label: "Body", sub: "nose volume" },
      { moduleId: "bedBox", label: "Bed Box", sub: "bed base · needs the body" },
      { moduleId: "bedSideTable", label: "Bed Side Table", sub: "beside the bed · needs the body" },
    ],
  },
  {
    id: "lounge",
    label: "Lounge",
    sub: "I / L / U / Parallel",
    items: [
      { moduleId: "loungeGenerator", style: "I_SHAPE", label: "I", sub: "one run · two clicks" },
      { moduleId: "loungeGenerator", style: "L_SHAPE", label: "L", sub: "two runs · three clicks" },
      { moduleId: "loungeGenerator", style: "U_SHAPE", label: "U", sub: "three runs · four clicks" },
      { moduleId: "loungeGenerator", style: "PARALLEL", label: "Parallel", sub: "two facing · three clicks" },
    ],
  },
];

/** Placeholders shown in the rail but not yet wired. */
export const PLANNED_MODULES = [];

export function getModule(id) {
  const m = MODULES[id];
  if (!m) throw new Error(`Unknown module: ${id}`);
  return m;
}
