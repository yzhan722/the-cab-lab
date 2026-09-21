/**
 * 高柜生成器 — cleanroom。docs/generalTall-cleanroom-spec.md
 * 坐标：一套最终柜体坐标。y=0 前柜身，门 −Y，墙侧 midDepth；x 含侧板（不再事后 +leftT）。
 * 冰箱 / style_2：模仿 Fusion 公式与规则，不搬 Fusion 代码。
 */
import { beginProvenance, dim, endProvenance, param } from "../_lib/dim.ts";
import { attachFaces } from "../_lib/model.ts";
import { recordBoardBox } from "../_lib/recordBox.ts";
import { buildTallFaces } from "./faces.ts";
import type {
  Board, GTParams, GTResult, GTZone, GTZoneType, HingeRecord, Joint,
  LockRecord, StackItem, BoundaryType, ZiGrooveRecord, ZiSlotRecord,
} from "./types.ts";
import { RULES as R } from "./rules.ts";

const asNum = (v: unknown, fb: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
};
const r2 = (v: number) => Math.round(v * 1000) / 1000;
const EPS = 0.001;

const PANEL_TYPES = new Set<GTZoneType>(["side_door", "left_side_door", "right_side_door", "double_door", "drawer", "top_flap", "bottom_flap"]);

/* ================= 参数解析 ================= */

interface S {
  CH: number; CW: number; CD: number;
  CPT: number; FPT: number; ziT: number; hT: number; dividerT: number;
  leftT: number; rightT: number;
  leftAdapt: boolean; rightAdapt: boolean;
  topSys: { style: string; railH: number; frontRail: number; insert: number };
  botSys: { style: string; railH: number; frontRail: number; insert: number };
  avoid: { enabled: boolean; depth: number; height: number };
  fc: number;
  locksOn: boolean;
  panelsOn: boolean;
  zones: GTZone[];
  midWidth: number;
  midDepth: number;
  dx: number; // core → 绝对 x 平移 = leftT
  sideClearance: number;
  exteriorSide: "left" | "right" | "none";
  syncCabinetWidthFromFridge: boolean;
}

function applyFridgePrep(input: GTParams, notes: string[]): GTParams {
  const zones = (input.zones ?? []).map((zone) => {
    if (zone.type !== "fridge") return zone;
    const applianceHeight = Number(zone.applianceHeightMm);
    if (Number.isFinite(applianceHeight) && applianceHeight > 0) {
      if (Math.abs(asNum(zone.height, 0) - applianceHeight) > 0.01) {
        notes.push(`Fridge zone ${zone.id} height synced to applianceHeightMm=${applianceHeight}.`);
      }
      return { ...zone, height: applianceHeight };
    }
    notes.push(`Fridge zone ${zone.id} has no applianceHeightMm; using zone height ${asNum(zone.height, 0)}.`);
    return zone;
  });
  const fridgeZones = zones.filter((zone) => zone.type === "fridge");
  if (!fridgeZones.length) return { ...input, zones };

  const exteriorSide = input.exteriorSide === "left" || input.exteriorSide === "right"
    ? input.exteriorSide
    : "none";
  const next: GTParams = { ...input, zones, exteriorSide };
  const sideMm = R.FRIDGE_EXTERIOR_THICKNESS.value;
  if (exteriorSide === "left") {
    next.leftSidePanelThickness = sideMm;
    notes.push("Fridge exteriorSide=left → SidePanel_L thickness 16mm.");
  } else if (exteriorSide === "right") {
    next.rightSidePanelThickness = sideMm;
    notes.push("Fridge exteriorSide=right → SidePanel_R thickness 16mm.");
  }

  const sync = input.syncCabinetWidthFromFridge !== false;
  const applianceWidth = Number(fridgeZones[0].applianceWidthMm);
  if (sync && Number.isFinite(applianceWidth) && applianceWidth > 0) {
    const allowance = exteriorSide === "none"
      ? R.FRIDGE_WIDTH_ALLOWANCE.value
      : R.FRIDGE_WIDTH_ALLOWANCE_WITH_EXTERIOR.value;
    const targetWidth = applianceWidth + allowance;
    if (Math.abs(asNum(input.cabinetWidth, 0) - targetWidth) > 0.01) {
      notes.push(`Cabinet width synced from fridge appliance (${applianceWidth}+${allowance}=${targetWidth}).`);
    }
    next.cabinetWidth = targetWidth;
  }
  return next;
}

function normalize(input: GTParams, errors: string[]): S {
  const CH = asNum(input.cabinetHeight, 0);
  const CW = asNum(input.cabinetWidth, 0);
  const CD = asNum(input.cabinetDepth, 0);
  const CPT = asNum(input.panelThickness, R.DEFAULT_PANEL_THICKNESS.value);
  // FPT 统一优先级：frontPanelThickness > frontFaceAllowance > doorPanelThickness > 16
  const FPT = asNum(input.frontPanelThickness ?? input.frontFaceAllowance ?? input.doorPanelThickness, R.DEFAULT_FRONT_FACE_ALLOWANCE.value);
  const ziT = asNum(input.ziThickness, R.DEFAULT_ZI_THICKNESS.value);
  const hT = asNum(input.hThickness, R.DEFAULT_H_THICKNESS.value);
  const dividerT = asNum(input.dividerThickness, R.DEFAULT_DIVIDER_THICKNESS.value);
  const fc = asNum(input.frontHardware?.frontClearance, R.DEFAULT_FRONT_CLEARANCE.value);

  const leftT = asNum(input.leftSidePanelThickness, 0);
  const rightT = asNum(input.rightSidePanelThickness, 0);
  for (const [name, t] of [["Left", leftT], ["Right", rightT]] as const) {
    if (t !== 0 && t !== R.SIDE_PANEL_WHITELIST_15.value && t !== R.SIDE_PANEL_WHITELIST_16.value) {
      errors.push(`${name} side panel thickness must be one of {0, 15, 16}.`);
    }
  }

  const topStyle = input.topSystem?.style ?? "style_1";
  const botStyle = input.bottomSystem?.style ?? "style_1";
  const topInsert = topStyle === "style_1"
    ? asNum((input.topSystem as { insertSlotThickness?: number })?.insertSlotThickness, R.STYLE_1_INSERT_SLOT_THICKNESS.value)
    : 0;
  const botInsert = botStyle === "style_1"
    ? asNum((input.bottomSystem as { insertSlotThickness?: number })?.insertSlotThickness, R.STYLE_1_INSERT_SLOT_THICKNESS.value)
    : 0;
  const topFront = topStyle === "style_1"
    ? Math.max(asNum((input.topSystem as { frontRailHeight?: number })?.frontRailHeight, 0), R.TOP_STYLE_1_MIN_FRONT_RAIL_HEIGHT.value)
    : asNum((input.topSystem as { height?: number })?.height, 0);
  const botFront = botStyle === "style_1"
    ? Math.max(asNum((input.bottomSystem as { frontRailHeight?: number })?.frontRailHeight, 0), R.BOTTOM_STYLE_1_MIN_FRONT_RAIL_HEIGHT.value)
    : asNum((input.bottomSystem as { height?: number })?.height, 0);
  const topRailH = topFront + topInsert;
  const botRailH = botFront + botInsert;
  if (topStyle === "style_2" && topFront < 60) errors.push("top/bottom Style 2 height must be >= 60 mm.");
  if (botStyle === "style_2" && botFront < 60) errors.push("top/bottom Style 2 height must be >= 60 mm.");

  const av = input.avoidance ?? {};
  const avoid = {
    enabled: av.enabled === true,
    depth: Math.min(Math.max(asNum(av.depth, 0), 0), CD),
    height: Math.min(Math.max(asNum(av.height, 0), 0), CH),
  };

  const midWidth = CW - leftT - rightT;
  if (midWidth <= 0) errors.push("MidWidth must be > 0 after side panel thickness (CabinetWidth too small).");

  return {
    CH, CW, CD, CPT, FPT, ziT, hT, dividerT, leftT, rightT,
    leftAdapt: input.leftSidePanelAdaptAvoidance ?? true,
    rightAdapt: input.rightSidePanelAdaptAvoidance ?? true,
    topSys: { style: topStyle, railH: topRailH, frontRail: topFront, insert: topInsert },
    botSys: { style: botStyle, railH: botRailH, frontRail: botFront, insert: botInsert },
    avoid,
    fc,
    locksOn: input.frontHardware?.locksEnabled !== false,
    panelsOn: input.frontHardware?.frontPanelsEnabled !== false,
    zones: input.zones ?? [],
    midWidth, midDepth: r2(CD - FPT),
    dx: leftT,
    sideClearance: asNum(input.sideClearance, R.DEFAULT_SIDE_CLEARANCE.value),
    exteriorSide: input.exteriorSide === "left" || input.exteriorSide === "right" ? input.exteriorSide : "none",
    syncCabinetWidthFromFridge: input.syncCabinetWidthFromFridge !== false,
  };
}

/* ================= 边界解析（§7.2） ================= */

function resolveBoundary(above: GTZoneType | "top_system" | "bottom_system", below: GTZoneType | "bottom_system" | "blank_panel"): BoundaryType {
  if (below === "bottom_system") return "none";
  // blank 上方不再切边界（§8.2：blank→open 为 none）；进入 blank 仍按下列区类型出 Zi
  if (below === "blank_panel" || above === "top_system") return "none";
  if (above === "drawer" && below === "drawer") return "half_zi";
  if (above === "bottom_system") return "none";
  if (above === "drawer") return "full_zi";
  return "full_zi";
}

/* ================= 堆叠（§7.1，自下而上） ================= */

interface Boundary extends StackItem {
  boundaryType: BoundaryType;
  upgraded: boolean; // 双门升级
}

function computeStack(s: S, errors: string[], warnings: string[]): {
  zones: (StackItem & { zone: GTZone })[];
  boundaries: Boundary[];
  topSys: StackItem;
  botSys: StackItem;
  calculatedHeight: number;
} {
  const items: StackItem[] = [];
  const botSys: StackItem = {
    id: "bottom-system", kind: "bottom_system",
    z0: 0, z1: r2(s.botSys.railH), height: r2(s.botSys.railH), centerZ: r2(s.botSys.railH / 2),
  };
  items.push(botSys);
  let z = s.botSys.railH;
  const zoneItems: (StackItem & { zone: GTZone })[] = [];
  const boundaries: Boundary[] = [];
  const prevTypes: (GTZoneType | "bottom_system")[] = ["bottom_system"];

  s.zones.forEach((zone, i) => {
    if (asNum(zone.height, 0) <= 0) errors.push(`Zone ${zone.id} height must be > 0.`);
    {
      const above = zone.type;
      const below = prevTypes[prevTypes.length - 1];
      let bt = resolveBoundary(above, below);
      // 双门升级：double_door(verticalDivider) 的下边界强制 full_zi（对底系统仍 none）
      if (zone.verticalDivider === true && below !== "bottom_system") bt = "full_zi";
      if (bt !== "none") {
        const h = s.ziT;
        boundaries.push({
          id: `boundary-${zone.id}`,
          kind: "boundary_panel", boundaryType: bt,
          upgraded: zone.verticalDivider === true,
          z0: r2(z), z1: r2(z + h), height: h, centerZ: r2(z + h / 2),
        });
        items.push(boundaries[boundaries.length - 1]);
        z += h;
      }
    }
    const zoneH = asNum(zone.height, 0);
    zoneItems.push({
      id: `zone-${zone.id}`, kind: "functional_zone", zoneType: zone.type, zoneId: zone.id,
      z0: r2(z), z1: r2(z + zoneH), height: zoneH, centerZ: r2(z + zoneH / 2), zone,
    });
    items.push(zoneItems[zoneItems.length - 1]);
    z += zoneH;
    prevTypes.push(zone.type);
  });
  const topSys: StackItem = {
    id: "top-system", kind: "top_system",
    z0: r2(z), z1: r2(z + s.topSys.railH), height: r2(s.topSys.railH), centerZ: r2(z + s.topSys.railH / 2),
  };
  items.push(topSys);
  const diff = r2((z + s.topSys.railH) - s.CH);
  if (Math.abs(diff) > R.STACKING_HEIGHT_TOLERANCE.value) {
    warnings.push(`Height mismatch: expected CH = ${r2(s.CH)}; calculated CH = ${r2(z + s.topSys.railH)}; difference = ${diff}.`);
  }
  return { zones: zoneItems, boundaries, topSys, botSys, calculatedHeight: r2(z + s.topSys.railH) };
}

/* ================= 轮廓工具 ================= */

type P2 = { x: number; y: number } | { y: number; z: number } | { x: number; z: number };

function yz(pts: [number, number][]): P2[] {
  return pts.map(([y, z]) => ({ y: r2(y), z: r2(z) }));
}

function mkBoard(
  id: string, name: string, category: string, boardType: string, thickness: number,
  kind: "carcass" | "door",
  plane: "XY" | "XZ" | "YZ", axis: "X" | "Y" | "Z",
  x0: number, x1: number, y0: number, y1: number, z0: number, z1: number,
  profileVector: P2[] | undefined,
): Board {
  const box = recordBoardBox(id, r2(x0), r2(x1), r2(y0), r2(y1), r2(z0), r2(z1));
  return {
    id, name, category, boardType,
    materialThickness: thickness, profilePlane: plane, thicknessAxis: axis,
    stock: { kind, thickness },
    ...box,
    profileVector: profileVector ? profileVector.map((p) => ({ ...(p as object) })) as Board["profileVector"] : undefined,
  };
}

/* ================= V 立梃轮廓 ================= */

/** V1/V2 局部 YZ 轮廓：基线 13 点 + 每个 Zi 槽 4 点（沿后缘 y=150 上行插入）。 */
function v12Profile(s: S, slots: { z0: number; z1: number }[]): P2[] {
  const CH = s.CH;
  const tRear = R.V12_Y_REAR.value;
  const slotY = R.V12_ZI_SLOT_INNER.value;
  const frontY = R.V12_Y_FRONT_FACE.value;
  const stepY = R.V12_Y_STEP_INNER.value;
  const topStyle1 = s.topSys.style === "style_1";
  const botStyle1 = s.botSys.style === "style_1";
  const notchD = R.STYLE_2_END_NOTCH_DEPTH.value;
  const notchT = R.V34_END_NOTCH_THICKNESS.value;
  const pts: [number, number][] = botStyle1 ? [[frontY, 0], [tRear, 0]] : [[tRear, 0]];
  for (const sl of slots) {
    pts.push([tRear, r2(sl.z0)], [slotY, r2(sl.z0)], [slotY, r2(sl.z1)], [tRear, r2(sl.z1)]);
  }
  pts.push([tRear, CH]);
  if (topStyle1) {
    const insT = R.STYLE_1_INSERT_SLOT_THICKNESS.value;
    const topFrontRail = r2(CH - (s.topSys.railH - insT));
    pts.push(
      [frontY, CH], [frontY, topFrontRail], [stepY, topFrontRail],
      [stepY, r2(topFrontRail - insT)], [0, r2(topFrontRail - insT)],
    );
  } else {
    pts.push([notchD, CH], [notchD, r2(CH - notchT)], [0, r2(CH - notchT)]);
  }
  if (botStyle1) {
    const insT = R.STYLE_1_INSERT_SLOT_THICKNESS.value;
    const botRail = s.botSys.railH;
    pts.push(
      [0, r2(botRail)], [stepY, r2(botRail)], [stepY, r2(botRail - insT)],
      [frontY, r2(botRail - insT)], [frontY, 0],
    );
  } else {
    pts.push([0, notchT], [notchD, notchT], [notchD, 0], [tRear, 0]);
  }
  return yz(pts);
}

/**
 * V3/V4 轮廓，直接写成柜体 Y（后立梃贴墙：局部 0 = 柜体 yOff = midDepth−150）。
 * 路径与 spec §8.3 一致：底边 → 后缘上到顶 L 缺口 → 沿前缘下行插入 Zi 槽。
 */
function v34Profile(s: S, slots: { z0: number; z1: number }[], warnings: string[], yOff: number): P2[] {
  const CH = s.CH;
  const tRear = R.V34_Y_REAR.value;
  const slotY = R.V34_ZI_SLOT_INNER.value;
  const nh = R.V34_NOTCH_HEIGHT.value;
  const nf = R.V34_TOP_NOTCH_FRONT_Y.value;
  const ni = R.V34_TOP_NOTCH_INNER_Y.value;
  const nt = R.V34_END_NOTCH_THICKNESS.value;
  const Y = (y: number) => r2(y + yOff);
  const kept: { z0: number; z1: number }[] = [];
  for (const sl of slots) {
    if (sl.z0 < CH - nh && sl.z1 > 0) kept.push(sl);
    else warnings.push(`Zi slot at z [${r2(sl.z0)}, ${r2(sl.z1)}] intersects avoidance/edge on V3/V4; slot omitted.`);
  }
  kept.sort((a, b) => b.z1 - a.z1);
  let start: [number, number][];
  if (s.avoid.enabled && s.avoid.height > 0 && s.avoid.depth > 0) {
    const ah = s.avoid.height, ad = s.avoid.depth;
    if (ad <= 150) {
      start = [
        [0, 0], [R.V_AVOIDANCE_PARTIAL_FRONT_Y.value, 0],
        [R.V_AVOIDANCE_PARTIAL_FRONT_Y.value, ah], [tRear, ah],
      ];
    } else {
      start = [[0, ah], [tRear, ah]];
    }
  } else {
    start = [[0, 0], [tRear, 0]];
  }
  const pts: [number, number][] = [
    ...start,
    [tRear, r2(CH - nh)], [ni, r2(CH - nh)], [ni, r2(CH - nt)], [nf, r2(CH - nt)], [nf, CH], [0, CH],
  ];
  for (const sl of kept) {
    pts.push([0, r2(sl.z1)], [slotY, r2(sl.z1)], [slotY, r2(sl.z0)], [0, r2(sl.z0)]);
  }
  pts.push([0, start[0][1]]);
  return yz(pts.map(([y, z]) => [Y(y), z]));
}

/* ================= Zi 边界板轮廓（core 坐标） ================= */

function fullZiProfile(s: S): P2[] {
  const mw = s.midWidth, md = s.midDepth, nd = R.ZI_FULL_FRONT_REAR_NOTCH_DEPTH.value;
  return [
    { x: s.CPT, y: 0 }, { x: s.CPT, y: nd }, { x: 0, y: nd }, { x: 0, y: r2(md - nd) },
    { x: s.CPT, y: r2(md - nd) }, { x: s.CPT, y: md }, { x: r2(mw - s.CPT), y: md },
    { x: r2(mw - s.CPT), y: r2(md - nd) }, { x: mw, y: r2(md - nd) }, { x: mw, y: nd },
    { x: r2(mw - s.CPT), y: nd }, { x: r2(mw - s.CPT), y: 0 }, { x: s.CPT, y: 0 },
  ];
}
function halfZiProfile(s: S): P2[] {
  const mw = s.midWidth;
  const nd = R.ZI_HALF_FRONT_NOTCH_DEPTH.value;
  const dep = R.ZI_HALF_DEPTH.value;
  return [
    { x: 0, y: 0 }, { x: 0, y: nd }, { x: s.CPT, y: nd }, { x: s.CPT, y: dep },
    { x: r2(mw - s.CPT), y: dep }, { x: r2(mw - s.CPT), y: nd }, { x: mw, y: nd }, { x: mw, y: 0 }, { x: 0, y: 0 },
  ];
}

/* ================= 主流程 ================= */

export function generateGeneralTall(input: GTParams): GTResult {
  beginProvenance();
  const errors: string[] = [];
  const warnings: string[] = [];
  const fridgeNotes: string[] = [];
  const prepared = applyFridgePrep(input, fridgeNotes);
  const s = normalize(prepared, errors);
  warnings.push(...fridgeNotes);
  const P = param({ CH: s.CH, CW: s.CW, CD: s.CD, CPT: s.CPT, FPT: s.FPT });
  dim("tall.midDepth", { CD: P.CD, FPT: P.FPT }, (t) => t.CD - t.FPT);
  const boards: Board[] = [];
  const ziSlots: ZiSlotRecord[] = [];
  const ziGrooves: ZiGrooveRecord[] = [];
  const hinges: HingeRecord[] = [];
  const locks: LockRecord[] = [];

  const { zones: zoneItems, boundaries, topSys, botSys } = computeStack(s, errors, warnings);
  const CH = s.CH, CD = s.CD, FPT = s.FPT, CPT = s.CPT, mw = s.midWidth, md = s.midDepth, dx = s.dx;

  let fridgeMode: "none" | "normal" | "raised" = "none";
  let fridgeGap = 0;
  let fridgeBaseBottomZ = 0;
  const fridgeZoneItem = zoneItems.find((zi) => zi.zone.type === "fridge");
  if (fridgeZoneItem) {
    const below = boundaries.find((b) => b.id === `boundary-${fridgeZoneItem.zone.id}`);
    fridgeBaseBottomZ = below ? below.z0 : fridgeZoneItem.z0;
    const aw = Number(fridgeZoneItem.zone.applianceWidthMm);
    const adp = Number(fridgeZoneItem.zone.applianceDepthMm);
    if (Number.isFinite(aw) && aw > mw + 0.01) {
      warnings.push(`Fridge zone ${fridgeZoneItem.zone.id} applianceWidthMm=${aw} exceeds interior midWidth=${mw}.`);
    }
    if (Number.isFinite(adp) && adp > md + 0.01) {
      warnings.push(`Fridge zone ${fridgeZoneItem.zone.id} applianceDepthMm=${adp} exceeds interior midDepth=${md}.`);
    }
    if (s.avoid.enabled) {
      fridgeGap = fridgeBaseBottomZ - s.avoid.height;
      if (fridgeBaseBottomZ < s.avoid.height + CPT) {
        errors.push(
          `Fridge base bottom Z (${fridgeBaseBottomZ}) must be >= Avoidance Height + panel thickness (${s.avoid.height}+${CPT}).`,
        );
      } else if (fridgeGap < R.FRIDGE_RAISED_THRESHOLD.value) {
        fridgeMode = "raised";
        s.avoid.height = fridgeBaseBottomZ;
        warnings.push(
          `Fridge/avoidance gap ${fridgeGap.toFixed(1)} mm < 105 mm: raised avoidance mode and above-fridge HSet will be used.`,
        );
      } else {
        fridgeMode = "normal";
        warnings.push(`Fridge/avoidance gap ${fridgeGap.toFixed(1)} mm >= 105 mm: normal avoidance height kept.`);
      }
    }
  }

  /* ---- V1/V2 Zi 槽（full + half 边界都给前立梃） ---- */
  const v12Slots = boundaries
    .filter((b) => b.boundaryType === "full_zi" || b.boundaryType === "half_zi")
    .map((b) => ({ z0: r2(b.centerZ - (s.ziT + R.ZI_SLOT_CLEARANCE.value) / 2), z1: r2(b.centerZ + (s.ziT + R.ZI_SLOT_CLEARANCE.value) / 2), boundaryId: b.id }));
  /* ---- V3/V4 Zi 槽（仅 full） ---- */
  const v34Slots = boundaries
    .filter((b) => b.boundaryType === "full_zi")
    .map((b) => ({ z0: r2(b.centerZ - (s.ziT + R.ZI_SLOT_CLEARANCE.value) / 2), z1: r2(b.centerZ + (s.ziT + R.ZI_SLOT_CLEARANCE.value) / 2), boundaryId: b.id }));

  /* ---- V1/V2 前立梃：柜体 y∈[0, 150]；V1 x[0,CPT]，V2 依右板 ---- */
  const v12Y1 = R.V12_Y_REAR.value;
  const v2X0 = s.rightT > 0 ? r2(s.CW - s.rightT) : r2(s.CW - CPT);
  boards.push(mkBoard("V1", "Front Stile Left", "vertical_structure", "V1", CPT, "carcass",
    "YZ", "X", 0, CPT, 0, v12Y1, 0, CH, v12Profile(s, v12Slots)));
  boards.push(mkBoard("V2", "Front Stile Right", "vertical_structure", "V2", CPT, "carcass",
    "YZ", "X", v2X0, r2(v2X0 + CPT), 0, v12Y1, 0, CH, v12Profile(s, v12Slots)));

  /* ---- V3/V4 后立梃：柜体 y∈[midDepth−150, midDepth]，轮廓已是柜体 Y ---- */
  const v34Y0 = r2(Math.max(0, md - R.V34_Y_REAR.value));
  const v34Y1 = md;
  boards.push(mkBoard("V3", "Rear Stile Left", "vertical_structure", "V3", CPT, "carcass",
    "YZ", "X", 0, CPT, v34Y0, v34Y1, 0, CH, v34Profile(s, v34Slots, warnings, v34Y0)));
  boards.push(mkBoard("V4", "Rear Stile Right", "vertical_structure", "V4", CPT, "carcass",
    "YZ", "X", v2X0, r2(v2X0 + CPT), v34Y0, v34Y1, 0, CH, v34Profile(s, v34Slots, warnings, v34Y0)));

  if (fridgeZoneItem) {
    const v5OnLeft = s.exteriorSide !== "left";
    let v5x0: number, v5x1: number;
    if (v5OnLeft) {
      v5x0 = r2(s.leftT + CPT);
      v5x1 = r2(v5x0 + CPT);
    } else {
      v5x1 = r2(s.CW - s.rightT - CPT);
      v5x0 = r2(v5x1 - CPT);
    }
    boards.push(mkBoard("V5", "V5", "vertical_structure", "V5", CPT, "carcass",
      "YZ", "X", v5x0, v5x1, 0, md, fridgeZoneItem.z0, fridgeZoneItem.z1,
      yz([[0, 0], [md, 0], [md, fridgeZoneItem.height], [0, fridgeZoneItem.height], [0, 0]])));
    warnings.push(
      `Fridge zone ${fridgeZoneItem.zone.id}: V5 on ${v5OnLeft ? "left" : "right"} (exteriorSide=${s.exteriorSide}).`,
    );
  }

  for (const sl of v12Slots) {
    ziSlots.push({ id: `zi_slot_V1_${sl.boundaryId}`, vPanelId: "V1", y0: R.V12_ZI_SLOT_INNER.value, y1: R.V12_Y_REAR.value, z0: sl.z0, z1: sl.z1, depth: R.ZI_SLOT_DEPTH.value, boundaryId: sl.boundaryId });
    ziSlots.push({ id: `zi_slot_V2_${sl.boundaryId}`, vPanelId: "V2", y0: R.V12_ZI_SLOT_INNER.value, y1: R.V12_Y_REAR.value, z0: sl.z0, z1: sl.z1, depth: R.ZI_SLOT_DEPTH.value, boundaryId: sl.boundaryId });
  }
  for (const sl of v34Slots) {
    ziSlots.push({
      id: `zi_slot_V3_${sl.boundaryId}`, vPanelId: "V3",
      y0: r2(v34Y0 + R.V34_Y_FRONT.value), y1: r2(v34Y0 + R.V34_ZI_SLOT_INNER.value),
      z0: sl.z0, z1: sl.z1, depth: R.ZI_SLOT_DEPTH.value, boundaryId: sl.boundaryId,
    });
    ziSlots.push({
      id: `zi_slot_V4_${sl.boundaryId}`, vPanelId: "V4",
      y0: r2(v34Y0 + R.V34_Y_FRONT.value), y1: r2(v34Y0 + R.V34_ZI_SLOT_INNER.value),
      z0: sl.z0, z1: sl.z1, depth: R.ZI_SLOT_DEPTH.value, boundaryId: sl.boundaryId,
    });
  }

  /* ---- 端系统：style_1 / style_2 各自独立；T4/T5 始终贴 midDepth ---- */
  {
    const insDepth = R.STYLE_1_INSERT_BOARD_DEPTH.value;
    const notch = R.STYLE_1_INSERT_FRONT_NOTCH_DEPTH.value;
    const t1H = R.STYLE_1_FIRST_RAIL_THICKNESS.value;
    const t2H = R.STYLE_1_SECOND_RAIL_THICKNESS.value;
    const insT = R.STYLE_1_INSERT_SLOT_THICKNESS.value;
    const insertProfile = (): P2[] => [
      { x: r2(dx + CPT), y: 0 }, { x: r2(dx + CPT), y: notch }, { x: dx, y: notch }, { x: dx, y: insDepth },
      { x: r2(dx + mw), y: insDepth }, { x: r2(dx + mw), y: notch }, { x: r2(dx + mw - CPT), y: notch }, { x: r2(dx + mw - CPT), y: 0 },
    ];
    if (s.topSys.style === "style_1") {
      const topBand0 = r2(CH - s.topSys.railH);
      const topRail0 = r2(CH - s.topSys.frontRail);
      boards.push(mkBoard("T1", "Top Front Rail", "top_system", "T1", t1H, "carcass",
        "XZ", "Y", dx, r2(dx + mw), 0, t1H, topRail0, CH, undefined));
      boards.push(mkBoard("T2", "Top Second Rail", "top_system", "T2", t2H, "carcass",
        "XZ", "Y", dx, r2(dx + mw), t1H, r2(t1H + t2H), topRail0, CH, undefined));
      boards.push(mkBoard("T3", "Top Insert Board", "top_system", "T3", CPT, "carcass",
        "XY", "Z", dx, r2(dx + mw), 0, insDepth, topBand0, topRail0, insertProfile()));
    } else if (s.topSys.style === "style_2") {
      const sysH = s.topSys.frontRail;
      const th = R.STYLE_2_FRONT_SYSTEM_THICKNESS.value;
      const dep = R.STYLE_2_FRONT_SYSTEM_DEPTH.value;
      const inset = R.STYLE_2_FRONT_SYSTEM_Z_INSET.value;
      boards.push(mkBoard("TH1", "Top Style 2 Front System Panel", "top_system", "TH1", th, "carcass",
        "XY", "Z", dx, r2(dx + mw), 0, dep, r2(CH - 16), r2(CH - inset), undefined));
      boards.push(mkBoard("TopStyle2FixedFrontPanel", "Top Style 2 Fixed Front Panel", "top_system", "style2_fixed_front_panel", FPT, "door",
        "XZ", "Y", r2(dx + s.sideClearance), r2(dx + mw - s.sideClearance), -FPT, 0, r2(CH - sysH), CH, undefined));
    }
    if (s.botSys.style === "style_1") {
      const botRail1 = r2(s.botSys.frontRail);
      const botBand1 = r2(s.botSys.railH);
      boards.push(mkBoard("B1", "Bottom Front Rail", "bottom_system", "B1", t1H, "carcass",
        "XZ", "Y", dx, r2(dx + mw), 0, t1H, 0, botRail1, undefined));
      boards.push(mkBoard("B2", "Bottom Second Rail", "bottom_system", "B2", t2H, "carcass",
        "XZ", "Y", dx, r2(dx + mw), t1H, r2(t1H + t2H), 0, botRail1, undefined));
      boards.push(mkBoard("B3", "Bottom Insert Board", "bottom_system", "B3", CPT, "carcass",
        "XY", "Z", dx, r2(dx + mw), 0, insDepth, botRail1, botBand1, insertProfile()));
    } else if (s.botSys.style === "style_2") {
      const sysH = s.botSys.frontRail;
      const th = R.STYLE_2_FRONT_SYSTEM_THICKNESS.value;
      const dep = R.STYLE_2_FRONT_SYSTEM_DEPTH.value;
      const inset = R.STYLE_2_FRONT_SYSTEM_Z_INSET.value;
      boards.push(mkBoard("BH1", "Bottom Style 2 Front System Panel", "bottom_system", "BH1", th, "carcass",
        "XY", "Z", dx, r2(dx + mw), 0, dep, inset, r2(inset + 15), undefined));
      boards.push(mkBoard("BottomStyle2FixedFrontPanel", "Bottom Style 2 Fixed Front Panel", "bottom_system", "style2_fixed_front_panel", FPT, "door",
        "XZ", "Y", r2(dx + s.sideClearance), r2(dx + mw - s.sideClearance), -FPT, 0, 0, sysH, undefined));
    }
    const t45 = R.T45_THICKNESS.value;
    const wallIn = R.T45_WALL_INSET.value;
    boards.push(mkBoard("T5", "T5 Rear Vertical Top Board", "top_system", "T5", t45, "carcass",
      "XZ", "Y", dx, r2(dx + mw), r2(md - 16), r2(md - wallIn), r2(CH - R.T5_REAR_VERTICAL_HEIGHT.value), CH, undefined));
    boards.push(mkBoard("T4", "T4 Rear Horizontal Top Board", "top_system", "T4", t45, "carcass",
      "XY", "Z", dx, r2(dx + mw), r2(md - 16 - R.T4_REAR_HORIZONTAL_DEPTH.value), r2(md - 16), r2(CH - 16), r2(CH - wallIn), undefined));
  }

  /* ---- Zi 边界板：x 已是装配位（dx..dx+mw）；轮廓 x 相对本板（0..mw） ---- */
  // shortened：与后墙避让带 [md−ad, md] 相交的 full_zi 缩到 y1 = md − ad。
  const shortenZi = s.avoid.enabled && s.avoid.depth > 0 && s.avoid.height > 0 && s.avoid.depth < md;
  for (const b of boundaries) {
    if (b.boundaryType === "none") continue;
    let type = b.boundaryType;
    let y1 = md;
    let prof: P2[];
    if (type === "half_zi") {
      y1 = md; // bbox 用 midDepth（轮廓仅前 150，坑②：profile/bbox 双参考）
      prof = halfZiProfile(s);
    } else {
      prof = fullZiProfile(s);
      if (shortenZi) {
        type = "shortened_zi";
        y1 = r2(md - s.avoid.depth);
        prof = fullZiProfile(s).map((p) => ("y" in p && !("z" in p) ? { ...p, y: Math.min((p as { y: number }).y, y1) } : p));
      }
    }
    boards.push(mkBoard(`Zi_${b.id}`, `Boundary ${b.id}`, "boundary_panel", type, s.ziT, "carcass",
      "XY", "Z", dx, r2(dx + mw), 0, y1, b.z0, b.z1, prof));
  }

  /* ---- H 支撑（top：H13/H24；bottom/mid：H13/H24/H34；mid 冲突移动；blank → H12） ---- */
  interface HSpec { name: string; z0: number; z1: number; }
  const hTop: HSpec[] = [{ name: "H13_top", z0: r2(CH - R.H_SUPPORT_HEIGHT.value), z1: CH }, { name: "H24_top", z0: r2(CH - R.H_SUPPORT_HEIGHT.value), z1: CH }];
  const omitBottomForRaised = fridgeMode === "raised";
  const hBottom: HSpec[] = omitBottomForRaised ? [] : [
    { name: "H13_bottom", z0: 0, z1: R.H_SUPPORT_HEIGHT.value },
    { name: "H24_bottom", z0: 0, z1: R.H_SUPPORT_HEIGHT.value },
    { name: "H34_bottom", z0: 0, z1: R.H_SUPPORT_HEIGHT.value },
  ];
  let hMid: HSpec[] = [
    { name: "H13_mid", z0: r2(CH / 2 - R.H_SUPPORT_HEIGHT.value / 2), z1: r2(CH / 2 + R.H_SUPPORT_HEIGHT.value / 2) },
    { name: "H24_mid", z0: r2(CH / 2 - R.H_SUPPORT_HEIGHT.value / 2), z1: r2(CH / 2 + R.H_SUPPORT_HEIGHT.value / 2) },
    { name: "H34_mid", z0: r2(CH / 2 - R.H_SUPPORT_HEIGHT.value / 2), z1: r2(CH / 2 + R.H_SUPPORT_HEIGHT.value / 2) },
  ];
  // H mid 与 Zi 冲突移动（§8.8）：full/shortened → H13/H24 移 below [zi.z0−101, zi.z0−1]、H34 移 above；half 仅检测
  const hZiConflicts: string[] = [];
  for (const zi of boundaries) {
    if (zi.boundaryType !== "full_zi" && zi.boundaryType !== "shortened_zi") {
      if (zi.boundaryType === "half_zi" && hMid.some((h) => h.z0 < zi.z1 && h.z1 > zi.z0)) {
        warnings.push(`H mid overlaps half Zi ${zi.id}; half Zi movement rule deferred.`);
      }
      continue;
    }
    if (!hMid.some((h) => h.z0 < zi.z1 && h.z1 > zi.z0)) continue;
    const H = R.H_SUPPORT_HEIGHT.value;
    for (const h of hMid) {
      if (!(h.z0 < zi.z1 && h.z1 > zi.z0)) continue;
      if (h.name === "H34_mid") {
        const nz0 = r2(zi.z1 - 1), nz1 = r2(zi.z1 - 1 + H);
        if (nz1 > CH) { hZiConflicts.push(`${h.name} movement above Zi would exceed cabinet bounds; movement skipped.`); continue; }
        h.z0 = nz0; h.z1 = nz1;
      } else {
        const nz1 = r2(zi.z0 - 1), nz0 = r2(zi.z0 - 1 - H);
        if (nz0 < 0) { hZiConflicts.push(`${h.name} movement below Zi would exceed cabinet bounds; movement skipped.`); continue; }
        h.z0 = nz0; h.z1 = nz1;
      }
      warnings.push(`H ${h.name} overlaps ${zi.boundaryType} ${zi.id}; Stage 2 movement evaluated.`);
    }
  }
  for (const h of [...hTop, ...hBottom, ...hMid]) {
    if (h.name.startsWith("H13")) {
      boards.push(mkBoard(h.name, "H Bridge Left", "h_support", h.name, s.hT, "carcass",
        "YZ", "X", dx, r2(dx + R.H_SUPPORT_THICKNESS.value),
        R.H_SUPPORT_SIDE_DEPTH_START.value, r2(md - R.H_SUPPORT_SIDE_REAR_CLEARANCE.value), h.z0, h.z1, undefined));
    } else if (h.name.startsWith("H24")) {
      boards.push(mkBoard(h.name, "H Bridge Right", "h_support", h.name, s.hT, "carcass",
        "YZ", "X", r2(dx + mw - R.H_SUPPORT_THICKNESS.value), r2(dx + mw),
        R.H_SUPPORT_SIDE_DEPTH_START.value, r2(md - R.H_SUPPORT_SIDE_REAR_CLEARANCE.value), h.z0, h.z1, undefined));
    } else {
      boards.push(mkBoard(h.name, "H Bridge Rear", "h_support", h.name, s.hT, "carcass",
        "XZ", "Y", r2(dx + R.H_SUPPORT_THICKNESS.value), r2(dx + mw - R.H_SUPPORT_THICKNESS.value),
        r2(md - R.H34_DEPTH.value), md, h.z0, h.z1, undefined));
    }
  }
  if (fridgeMode === "raised" && fridgeZoneItem) {
    const below = boundaries.find((b) => b.id === `boundary-${fridgeZoneItem.zone.id}`);
    const hz0 = below ? below.z1 : fridgeZoneItem.z0;
    const hz1 = r2(hz0 + R.H_SUPPORT_HEIGHT.value);
    const hFridge: HSpec[] = [
      { name: "H13_fridge", z0: hz0, z1: hz1 },
      { name: "H24_fridge", z0: hz0, z1: hz1 },
      { name: "H34_fridge", z0: hz0, z1: hz1 },
    ];
    for (const h of hFridge) {
      if (h.name.startsWith("H13")) {
        boards.push(mkBoard(h.name, "H13 fridge", "h_support", "H13_fridge", s.hT, "carcass",
          "YZ", "X", dx, r2(dx + R.H_SUPPORT_THICKNESS.value),
          R.H_SUPPORT_SIDE_DEPTH_START.value, r2(md - R.H_SUPPORT_SIDE_REAR_CLEARANCE.value), h.z0, h.z1, undefined));
      } else if (h.name.startsWith("H24")) {
        boards.push(mkBoard(h.name, "H24 fridge", "h_support", "H24_fridge", s.hT, "carcass",
          "YZ", "X", r2(dx + mw - R.H_SUPPORT_THICKNESS.value), r2(dx + mw),
          R.H_SUPPORT_SIDE_DEPTH_START.value, r2(md - R.H_SUPPORT_SIDE_REAR_CLEARANCE.value), h.z0, h.z1, undefined));
      } else {
        boards.push(mkBoard(h.name, "H34 fridge", "h_support", "H34_fridge", s.hT, "carcass",
          "XZ", "Y", r2(dx + R.H_SUPPORT_THICKNESS.value), r2(dx + mw - R.H_SUPPORT_THICKNESS.value),
          r2(md - R.H34_DEPTH.value), md, h.z0, h.z1, undefined));
      }
    }
  }

  /* ---- blank_panel 区 H12 支撑 ---- */
  for (const zi of zoneItems) {
    if (zi.zone.type !== "blank_panel") continue;
    const H = R.H_SUPPORT_HEIGHT.value;
    if (zi.height >= R.H12_SPLIT_HEIGHT.value) {
      boards.push(mkBoard(`H12_${zi.zone.id}_top`, "H12 Support Top", "blank_panel_support", "H12", s.hT, "carcass",
        "XY", "Z", dx, r2(dx + mw), 0, R.H12_DEPTH.value, r2(zi.z1 - H), zi.z1, undefined));
      boards.push(mkBoard(`H12_${zi.zone.id}_bottom`, "H12 Support Bottom", "blank_panel_support", "H12", s.hT, "carcass",
        "XY", "Z", dx, r2(dx + mw), 0, R.H12_DEPTH.value, zi.z0, r2(zi.z0 + H), undefined));
    } else {
      boards.push(mkBoard(`H12_${zi.zone.id}`, "H12 Support", "blank_panel_support", "H12", s.hT, "carcass",
        "XY", "Z", dx, r2(dx + mw), 0, R.H12_DEPTH.value, zi.z0, zi.z1, undefined));
    }
  }

  /* ---- VD 竖分隔（double_door + verticalDivider）+ 舌 + zi_groove + h34 槽 ---- */
  const vdBoards: { id: string; zoneItem: StackItem & { zone: GTZone }; coreX: number }[] = [];
  for (const zi of zoneItems) {
    if (zi.zone.type !== "double_door" || zi.zone.verticalDivider !== true) continue;
    const coreX = asNum(zi.zone.dividerCenterX, mw / 2);
    if (coreX <= 0 || coreX >= mw) {
      errors.push(`Divider center X ${coreX} for zone ${zi.zone.id} is outside MidWidth.`);
      continue;
    }
    vdBoards.push({ id: `VD_${zi.zone.id}`, zoneItem: zi, coreX });
  }
  for (const vd of vdBoards) {
    const { zoneItem, coreX } = vd;
    const z0 = zoneItem.z0, z1 = zoneItem.z1;
    const x0 = r2(dx + coreX - s.dividerT / 2), x1 = r2(dx + coreX + s.dividerT / 2);
    const tongue = r2(CPT / 2 - R.DIVIDER_TONGUE_GROOVE_CLEARANCE.value);
    const ty0 = r2(md / 3), ty1 = r2((2 * md) / 3);
    const h34CutY0 = r2(md - R.H34_CLEARANCE_DEPTH.value);
    // cutProfile（YZ 局部）：矩形 y[0, midDepth−16] × z[底舌底, VD.z1]，底舌中段下凸
    const prof: P2[] = yz([
      [0, r2(z0 - tongue)], [ty0, r2(z0 - tongue)], [ty0, z0], [ty1, z0], [ty1, r2(z0 - tongue)],
      [h34CutY0, r2(z0 - tongue)], [h34CutY0, z1], [0, z1], [0, r2(z0 - tongue)],
    ]);
    boards.push(mkBoard(vd.id, `Vertical Divider ${zoneItem.zone.id}`, "vertical_divider", "vertical_divider",
      s.dividerT, "carcass", "YZ", "X", x0, x1, 0, md, z0, z1, prof));
    // 上下边界的 full_zi 挂 zi_groove（x 已是装配位 = dx + core）
    for (const b of boundaries) {
      if (b.boundaryType !== "full_zi") continue;
      const isUpper = Math.abs(b.z0 - z1) < EPS;
      const isLower = Math.abs(b.z1 - z0) < EPS;
      if (!isUpper && !isLower) continue;
      ziGrooves.push({
        id: `zi_groove_${vd.id}_${b.id}`, boardId: `Zi_${b.id}`,
        face: isLower ? "top" : "bottom",
        x0: r2(dx + coreX - (s.dividerT + R.ZI_GROOVE_WIDTH_CLEARANCE.value) / 2),
        x1: r2(dx + coreX + (s.dividerT + R.ZI_GROOVE_WIDTH_CLEARANCE.value) / 2),
        y0: r2(md / 3 - R.ZI_GROOVE_Y_OVERHANG.value), y1: r2((2 * md) / 3 + R.ZI_GROOVE_Y_OVERHANG.value),
        depth: r2(CPT / 2),
      });
    }
  }

  /* ---- DS 门层板（门板区 shelfEnabled；双门 VD 拆 _L/_R） ---- */
  const dsBoards: { id: string; zone: StackItem & { zone: GTZone }; x0: number; x1: number; z0: number; z1: number }[] = [];
  for (const zi of zoneItems) {
    const zt = zi.zone.type;
    if (!PANEL_TYPES.has(zt) || zt === "drawer" || zt === "top_flap" || zt === "bottom_flap") continue;
    if (zi.zone.shelfEnabled !== true) continue;
    if (zi.height < R.DOOR_SHELF_MIN_ZONE_HEIGHT.value) continue;
    const shelfTopZ = r2(zi.z0 + asNum(zi.zone.shelfHeight, Math.round(zi.height / 2)));
    if (!(shelfTopZ > zi.z0 && shelfTopZ < zi.z1)) continue;
    const th = CPT;
    const z0 = r2(shelfTopZ - th), z1 = shelfTopZ;
    const vd = vdBoards.find((v) => v.zoneItem.zone.id === zi.zone.id);
    if (zt === "double_door" && vd) {
      const vx0 = r2(dx + vd.coreX - s.dividerT / 2), vx1 = r2(dx + vd.coreX + s.dividerT / 2);
      dsBoards.push({ id: `DS_${zi.zone.id}_L`, zone: zi, x0: dx, x1: vx0, z0, z1 });
      dsBoards.push({ id: `DS_${zi.zone.id}_R`, zone: zi, x0: vx1, x1: r2(dx + mw), z0, z1 });
    } else {
      dsBoards.push({ id: `DS_${zi.zone.id}`, zone: zi, x0: dx, x1: r2(dx + mw), z0, z1 });
    }
  }
  for (const ds of dsBoards) {
    boards.push(mkBoard(ds.id, "Door Shelf", "door_shelf", "door_shelf", CPT, "carcass",
      "XY", "Z", ds.x0, ds.x1, 0, md, ds.z0, ds.z1, undefined));
  }

  /* ---- frontPanels（数据层：叶解析 + 铰链 + 锁） ---- */
  const frontPanels: { id: string; zone: StackItem & { zone: GTZone }; x0: number; x1: number; z0: number; z1: number; leaf: "single" | "L" | "R" }[] = [];
  if (s.panelsOn) {
    for (const zi of zoneItems) {
      const zt = zi.zone.type;
      if (!PANEL_TYPES.has(zt)) continue; // open/fridge/blank 无面板
      const idx = zoneItems.indexOf(zi);
      const below = zoneItems[idx - 1];
      const above = zoneItems[idx + 1];
      const belowHasPanel = !!below && PANEL_TYPES.has(below.zone.type);
      const aboveHasPanel = !!above && PANEL_TYPES.has(above.zone.type);
      let z0 = belowHasPanel ? r2(zi.z0 + s.fc / 2) : zi.z0; // 邻开放区延伸（+ziT/2 TODO 校准）
      let z1 = aboveHasPanel ? r2(zi.z1 - s.fc / 2) : zi.z1;
      const x0 = dx, x1 = r2(dx + mw);
      if (zt === "double_door") {
        const mid = r2((x0 + x1) / 2);
        frontPanels.push({ id: `FP_${zi.zone.id}_L`, zone: zi, x0, x1: r2(mid - s.fc / 2), z0, z1, leaf: "L" });
        frontPanels.push({ id: `FP_${zi.zone.id}_R`, zone: zi, x0: r2(mid + s.fc / 2), x1, z0, z1, leaf: "R" });
      } else {
        frontPanels.push({ id: `FP_${zi.zone.id}`, zone: zi, x0, x1, z0, z1, leaf: "single" });
      }
    }
  }
  for (const fp of frontPanels) {
    boards.push(mkBoard(fp.id, "Front Panel", "front", "front_panel", FPT, "door",
      "XZ", "Y", fp.x0, fp.x1, -FPT, 0, fp.z0, fp.z1, undefined));
    const hs = { ...fp.zone.zone.hingeSettings };
    const cupD = asNum(hs.cupDiameter, R.HINGE_CUP_DIAMETER.value);
    const cupDepth = asNum(hs.cupDepth, R.HINGE_CUP_DEPTH.value);
    const fromEdge = asNum(hs.cupCenterFromEdge, R.HINGE_CUP_FROM_EDGE.value);
    const zt = fp.zone.zone.type;
    if (zt !== "drawer") {
      const h = r2(fp.z1 - fp.z0);
      let sd: number;
      if (hs.sideDistance && hs.sideDistance !== "auto" && Number.isFinite(Number(hs.sideDistance))) {
        sd = Number(hs.sideDistance);
      } else {
        sd = R.HINGE_SD_MIN.value + (h - R.HINGE_SD_SPAN.value) * R.SD_GAIN_NUM.value / R.SD_GAIN_DEN.value;
        sd = Math.min(R.HINGE_SD_MAX.value, Math.max(R.HINGE_SD_MIN.value, sd));
      }
      const hingeLeft = zt === "left_side_door" || zt === "side_door" || (zt === "double_door" && fp.leaf === "L");
      const cx = hingeLeft ? r2(fp.x0 + fromEdge) : r2(fp.x1 - fromEdge);
      const centers = [{ z: r2(fp.z1 - sd) }, { z: r2(fp.z0 + sd) }];
      if (hs.useThreeHinges) centers.push({ z: r2((fp.z0 + fp.z1) / 2) });
      centers.forEach((c, i) => {
        hinges.push({ id: `${fp.id}_hinge_${i + 1}`, panelId: fp.id, centerX: cx, centerZ: c.z, diameter: cupD, depth: cupDepth });
      });
    }
    // 锁（五种 lockPosition）
    if (s.locksOn && fp.zone.zone.lockPosition) {
      const lw = R.LOCK_SLOT_LENGTH.value, lh = R.LOCK_SLOT_WIDTH.value;
      const cx = r2((fp.x0 + fp.x1) / 2);
      const zt2 = fp.zone.zone;
      let cz: number | null = null;
      let mountingFace: "top" | "bottom" | "side" = "bottom";
      let mountingBoardId: string | undefined;
      const lp = zt2.lockPosition;
      if (lp === "top") { cz = r2(fp.z1 - R.LOCK_MOUNTING_SURFACE_TO_SLOT_CENTER.value); mountingFace = "top"; }
      else if (lp === "bottom") { cz = r2(fp.z0 + R.LOCK_MOUNTING_SURFACE_TO_SLOT_CENTER.value); mountingFace = "bottom"; }
      else if (lp === "side") {
        mountingFace = "side";
        mountingBoardId = `VD_${fp.zone.zone.id}`;
        cz = r2(fp.zone.z0 + asNum(zt2.lockHeight, 0));
        if (cz > fp.z1) {
          cz = fp.z1;
          warnings.push(`Zone ${fp.zone.zone.id}: side lock center Z outside panel Z; clamped.`);
        }
      } else {
        const ds = dsBoards.find((d) => d.zone.zone.id === fp.zone.zone.id
          && (fp.leaf === "single" || d.id.endsWith(`_${fp.leaf}`)));
        if (ds) {
          cz = lp === "shelf_top" ? r2(ds.z1 + R.LOCK_MOUNTING_SURFACE_TO_SLOT_CENTER.value) : r2(ds.z0 - R.LOCK_MOUNTING_SURFACE_TO_SLOT_CENTER.value);
          mountingFace = lp === "shelf_top" ? "top" : "bottom";
        } else {
          cz = r2(fp.z0 + R.LOCK_MOUNTING_SURFACE_TO_SLOT_CENTER.value);
          warnings.push(`Zone ${fp.zone.zone.id}: no horizontal shelf board found for ${lp} lock; fallback to bottom face.`);
        }
      }
      if (cz != null) {
        locks.push({
          id: `${fp.id}_lock`, panelId: fp.id, centerX: cx, centerZ: cz,
          width: lw, height: lh, radius: r2(lh / 2), mountingFace, mountingBoardId,
        });
      }
    }
  }

  /* ---- 侧板：y∈[−FPT, midDepth]；避让缺口用柜体 Y ---- */
  const mkSidePanel = (side: "L" | "R", t: number, adapt: boolean) => {
    const x0 = side === "L" ? 0 : r2(s.CW - t);
    let prof: P2[] | undefined;
    if (s.avoid.enabled && s.avoid.depth > 0 && s.avoid.height > 0 && adapt) {
      const ad = s.avoid.depth, ah = s.avoid.height;
      prof = yz([[-FPT, 0], [r2(md - ad), 0], [r2(md - ad), ah], [md, ah], [md, CH], [-FPT, CH]]);
    }
    boards.push(mkBoard(`SidePanel_${side}`, `Side Panel ${side === "L" ? "Left" : "Right"}`, "side_panel", "side_panel",
      t, "carcass", "YZ", "X", x0, r2(x0 + t), -FPT, md, 0, CH, prof));
  };
  if (s.leftT > 0) mkSidePanel("L", s.leftT, s.leftAdapt);
  if (s.rightT > 0) mkSidePanel("R", s.rightT, s.rightAdapt);

  /* ---- 避让支撑 ---- */
  if (s.avoid.enabled && s.avoid.depth > 0 && s.avoid.height > R.AVOIDANCE_SUPPORT_THICKNESS.value) {
    const ad = s.avoid.depth, ah = s.avoid.height;
    const at = R.AVOIDANCE_SUPPORT_THICKNESS.value;
    boards.push(mkBoard("avoidance_horizontal", "Avoidance Horizontal", "avoidance_support", "avoidance_horizontal",
      at, "carcass", "XY", "Z", dx, r2(dx + mw), r2(md - ad), md, r2(ah - at), ah, undefined));
    boards.push(mkBoard("Avoidance_Vertical", "Avoidance Vertical", "avoidance_support", "avoidance_vertical",
      at, "carcass", "XZ", "Y", dx, r2(dx + mw), r2(md - ad), r2(md - ad + at), 0, r2(ah - at), undefined));
  }

  /* ---- 组装 ---- */
  attachFaces(boards);
  const joints: Joint[] = buildTallFaces({ boards, ziSlots, ziGrooves, hinges, locks });

  const result: GTResult = {
    params: {
      cabinetHeight: CH, cabinetWidth: s.CW, cabinetDepth: CD,
      midWidth: mw, midDepth: md,
      panelThickness: CPT, frontPanelThickness: FPT, ziThickness: s.ziT,
    },
    boards,
    stack: [
      botSys,
      ...(() => {
        const out: StackItem[] = [];
        for (const zi of zoneItems) {
          const b = boundaries.find((x) => x.id === `boundary-${zi.zone.id}`);
          if (b) out.push(b);
          out.push(zi);
        }
        return out;
      })(),
      topSys,
    ],
    ziSlots, ziGrooves, hinges, locks, joints,
    validation: { errors, warnings },
  };
  result.debug = {
    provenance: endProvenance(), boardFrame: "final",
    midWidth: mw, midDepth: md, hZiConflicts,
    fridgeAvoidance: { finalMode: fridgeMode, fridgeGap, fridgeBaseBottomZ },
  };
  return result;
}
