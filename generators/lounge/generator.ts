/**
 * 休闲柜生成器 — cleanroom。docs/lounge-cleanroom-spec.md
 * 前脸在 y=0（房间），+Y 朝墙。U = 包围盒内三条 I。
 * 轮拱在墙侧 y∈[D−AD, D]；Parallel 中柜贴墙。
 */
import { beginProvenance, dim, endProvenance, param } from "../_lib/dim.ts";
import { attachFaces } from "../_lib/model.ts";
import { recordBoardBox } from "../_lib/recordBox.ts";
import { buildLoungeFaces } from "./faces.ts";
import type {
  Board, Joint, LoungeGroove, LoungeHinge, LoungeLid, LoungeLock,
  LoungeOpening, LoungeParams, LoungeResult, LoungeStyle,
} from "./types.ts";
import { RULES as R } from "./rules.ts";
export {
  loungeFootprintBoxes,
  loungeFromPolyline,
  loungePolyline,
  pointInFootprintBoxes,
} from "./place.ts";

const asNum = (v: unknown, fb: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
};
const r2 = (v: number) => Math.round(v * 1000) / 1000;

function mkBoard(
  id: string, name: string, boardType: string, thickness: number,
  plane: "XY" | "XZ" | "YZ", axis: "X" | "Y" | "Z",
  x0: number, x1: number, y0: number, y1: number, z0: number, z1: number,
  profileVector?: Board["profileVector"],
): Board {
  const box = recordBoardBox(id, r2(x0), r2(x1), r2(y0), r2(y1), r2(z0), r2(z1));
  return {
    id, name, category: boardType, boardType,
    materialThickness: thickness, profilePlane: plane, thicknessAxis: axis,
    stock: { kind: "partition", thickness },
    ...box,
    profileVector,
  };
}

function openingAndLid(
  id: string, x0: number, y0: number, W: number, D: number, z0: number, z1: number, ppt: number,
  lidOn: boolean, boards: Board[], openings: LoungeOpening[], lids: LoungeLid[],
) {
  const ox = r2(x0 + W / 4), oy = r2(y0 + D / 4);
  const ow = r2(W / 2), od = r2(D / 2);
  openings.push({ id: `${id}_opening`, x0: ox, y0: oy, width: ow, depth: od });
  if (!lidOn) return;
  const c = R.LID_CLEARANCE_EACH_SIDE.value;
  lids.push({
    id: `${id}_lid`, x0: r2(ox + c), y0: r2(oy + c),
    width: r2(ow - 2 * c), depth: r2(od - 2 * c),
    holeDiameter: R.FINGER_HOLE_DIAMETER.value,
  });
  boards.push(mkBoard(`${id}_lid`, "Lid", "lid", ppt, "XY", "Z",
    ox + c, ox + ow - c, oy + c, oy + od - c, z0, z1));
}

function lSupportProfile(depth: number, Hprime: number): { y: number; z: number }[] {
  const L = r2(depth);
  const leg = Math.min(R.L_LEG_WIDTH.value, L);
  const strip = R.TOP_SUPPORT_STRIP_HEIGHT.value;
  return [
    { y: 0, z: 0 }, { y: 0, z: Hprime }, { y: L, z: Hprime },
    { y: L, z: r2(Hprime - strip) }, { y: leg, z: r2(Hprime - strip) }, { y: leg, z: 0 }, { y: 0, z: 0 },
  ];
}

function wallCutoutProfile(y0: number, y1: number, Hprime: number, AD: number, AH: number): { y: number; z: number }[] | undefined {
  const span = r2(y1 - y0);
  if (!(AD > 0 && AD < span && AH > 0 && AH < Hprime)) return undefined;
  const cut = r2(span - AD);
  return [
    { y: 0, z: 0 }, { y: cut, z: 0 }, { y: cut, z: AH }, { y: span, z: AH },
    { y: span, z: Hprime }, { y: 0, z: Hprime }, { y: 0, z: 0 },
  ];
}

function addAvoidanceCovers(
  prefix: string, x0: number, x1: number, D: number, AD: number, AH: number, ppt: number, boards: Board[],
) {
  if (!(AD > 0 && AH > ppt)) return;
  boards.push(mkBoard(`${prefix}avoidance_top`, "Avoidance Top", "avoidance_top", ppt, "XY", "Z",
    x0, x1, r2(D - AD), D, r2(AH - ppt), AH));
  boards.push(mkBoard(`${prefix}avoidance_front`, "Avoidance Front", "avoidance_front", ppt, "XZ", "Y",
    x0, x1, r2(D - AD), r2(D - AD + ppt), 0, r2(AH - ppt)));
}

function addIRun(
  prefix: string, x0: number, x1: number, depth: number, H: number, ppt: number, Hprime: number,
  lidOn: boolean, boards: Board[], openings: LoungeOpening[], lids: LoungeLid[],
  wheel?: { AD: number; AH: number },
) {
  const W = r2(x1 - x0);
  const cut = wheel ? wallCutoutProfile(ppt, depth, Hprime, wheel.AD, wheel.AH) : undefined;
  boards.push(mkBoard(`${prefix}front`, "Front", "front", ppt, "XZ", "Y", x0, x1, 0, ppt, 0, Hprime));
  boards.push(mkBoard(`${prefix}left_side`, "Left Side", "side", ppt, "YZ", "X", x0, x0 + ppt, ppt, depth, 0, Hprime, cut));
  boards.push(mkBoard(`${prefix}right_side`, "Right Side", "side", ppt, "YZ", "X", x1 - ppt, x1, ppt, depth, 0, Hprime, cut));
  boards.push(mkBoard(`${prefix}top`, "Top", "top_panel", ppt, "XY", "Z", x0, x1, 0, depth, H - ppt, H));
  openingAndLid(prefix.replace(/_$/, "") || "i", x0, 0, W, depth, H - ppt, H, ppt, lidOn, boards, openings, lids);
  if (wheel && cut) addAvoidanceCovers(prefix, x0, x1, depth, wheel.AD, wheel.AH, ppt, boards);
}

function addParallelRun(
  prefix: "left" | "right", label: "Left" | "Right",
  xStart: number, xEnd: number, D: number, H: number, ppt: number, Hprime: number,
  lidOn: boolean, boards: Board[], openings: LoungeOpening[], lids: LoungeLid[],
  wheel?: { AD: number; AH: number },
) {
  const SW = r2(xEnd - xStart);
  const isLeft = prefix === "left";
  const sideX0 = isLeft ? xEnd - ppt : xStart;
  const frontX0 = isLeft ? xStart : xStart + ppt;
  const frontX1 = isLeft ? xEnd - ppt : xEnd;
  const stripX0 = isLeft ? xStart : xEnd - ppt;
  const cut = wheel ? wallCutoutProfile(0, D, Hprime, wheel.AD, wheel.AH) : undefined;
  boards.push(mkBoard(`${prefix}_front`, `${label} Front`, "front", ppt, "XZ", "Y",
    frontX0, frontX1, 0, ppt, 0, Hprime));
  boards.push(mkBoard(`${prefix}_side`, `${label} Side`, "side", ppt, "YZ", "X",
    sideX0, r2(sideX0 + ppt), 0, D, 0, Hprime, cut));
  boards.push(mkBoard(`${prefix}_top`, `${label} Top`, "top_panel", ppt, "XY", "Z",
    xStart, xEnd, 0, D, H - ppt, H));
  openingAndLid(prefix, xStart, 0, SW, D, H - ppt, H, ppt, lidOn, boards, openings, lids);
  const stripH = R.TOP_SUPPORT_STRIP_HEIGHT.value;
  boards.push(mkBoard(`${prefix}_support_strip`, `${label} Support Strip`, "support_strip", ppt, "YZ", "X",
    stripX0, r2(stripX0 + ppt), ppt, D, r2(Hprime - stripH), Hprime));
}

function addMiddleCabinet(
  raw: LoungeParams, totalW: number, D: number,
  boards: Board[], hinges: LoungeHinge[], locks: LoungeLock[], grooves: LoungeGroove[], warnings: string[],
) {
  const mc = raw.middleCabinet ?? {};
  const CW = asNum(mc.width, R.MIDDLE_CABINET_WIDTH.value);
  const CD = asNum(mc.depth, R.MIDDLE_CABINET_DEPTH.value);
  const CH = asNum(mc.height, R.MIDDLE_CABINET_HEIGHT.value);
  const CSH = asNum(mc.startHeight, R.MIDDLE_CABINET_START_HEIGHT.value);
  const dpt = Math.max(1, asNum(mc.doorPanelThickness, R.MIDDLE_CABINET_DOOR_THICKNESS.value));
  const dc = Math.max(0, asNum(mc.doorClearance, R.MIDDLE_CABINET_DOOR_CLEARANCE.value));
  const lockStyle = mc.doorLockStyle === "NONE" ? "NONE" : "RAZOR_ROUNDED";
  const lockSide = asNum(mc.lockSideDistance, R.MIDDLE_CABINET_LOCK_SIDE.value);
  const hingeSide = asNum(mc.hingeSideDistance, R.MIDDLE_CABINET_HINGE_SIDE.value);
  const hingeEdge = asNum(mc.hingeCupCenterFromEdge, R.MIDDLE_CABINET_HINGE_FROM_EDGE.value);
  const cupD = asNum(mc.hingeCupDiameter, R.MIDDLE_CABINET_HINGE_DIAMETER.value);
  const cupDepth = Math.min(Math.max(0.5, asNum(mc.hingeCupDepth, R.MIDDLE_CABINET_HINGE_DEPTH.value)), dpt);
  const gap = totalW - asNum(raw.singleLoungeWidth, 1500) * 2;
  if (raw.wheelAvoidanceEnabled && !(CSH > asNum(raw.avoidanceHeight, R.DEFAULT_AVOIDANCE_HEIGHT.value))) {
    warnings.push("Middle cabinet start height must be greater than avoidance height.");
  }
  if (CW > Math.max(0, gap)) warnings.push("Middle cabinet width exceeds the middle gap.");
  if (CD > D) warnings.push("Middle cabinet depth exceeds lounge depth.");
  if (!(CW > 3 * dc)) warnings.push("Middle cabinet width must exceed 3 x door clearance.");
  if (!(CH > 2 * dc)) warnings.push("Middle cabinet height must exceed 2 x door clearance.");
  if (!(hingeSide * 2 < CH - 2 * dc)) warnings.push("Hinge side distance is too large for the door height.");

  const x0 = r2((totalW - CW) / 2);
  const y0 = r2(D - CD);
  const dividerDepth = Math.max(0, CD - dpt);
  const tongueWidth = dividerDepth / 2;
  const tongueDepth = dpt / 2 - 0.5;
  const dividerBodyWidth = Math.max(0, CW - 2 * dpt);
  const doorSlotWidth = Math.max(0, (CW - 3 * dc) / 2);
  const doorWidth = Math.max(0, doorSlotWidth - dpt);
  const doorHeight = Math.max(0, CH - 2 * dc - 2 * dpt);

  boards.push(mkBoard("middle_cabinet_bottom", "Middle Cabinet Bottom", "cabinet_bottom", dpt, "XY", "Z",
    x0, r2(x0 + CW), y0, D, CSH, r2(CSH + dpt)));
  boards.push(mkBoard("middle_cabinet_top", "Middle Cabinet Top", "cabinet_top", dpt, "XY", "Z",
    x0, r2(x0 + CW), y0, D, r2(CSH + CH - dpt), r2(CSH + CH)));
  const sideH = Math.max(0, CH - 2 * dpt);
  boards.push(mkBoard("middle_cabinet_left", "Middle Cabinet Left", "cabinet_side", dpt, "YZ", "X",
    x0, r2(x0 + dpt), y0, D, r2(CSH + dpt), r2(CSH + dpt + sideH)));
  boards.push(mkBoard("middle_cabinet_right", "Middle Cabinet Right", "cabinet_side", dpt, "YZ", "X",
    r2(x0 + CW - dpt), r2(x0 + CW), y0, D, r2(CSH + dpt), r2(CSH + dpt + sideH)));
  const grooveU0 = Math.max(0, CD - tongueWidth - 5);
  const grooveV0 = (CH - dpt) / 2 - dpt - 0.5;
  grooves.push({
    id: "middle_cabinet_left_groove", boardId: "middle_cabinet_left", face: "A",
    u0: grooveU0, u1: CD, v0: grooveV0, v1: grooveV0 + dpt + 1, depth: dpt / 2,
  });
  grooves.push({
    id: "middle_cabinet_right_groove", boardId: "middle_cabinet_right", face: "B",
    u0: grooveU0, u1: CD, v0: grooveV0, v1: grooveV0 + dpt + 1, depth: dpt / 2,
  });
  const dividerZ0 = CSH + (CH - dpt) / 2;
  boards.push(mkBoard("middle_cabinet_mid_divider", "Middle Cabinet Mid Horizontal Divider", "cabinet_divider", dpt, "XY", "Z",
    r2(x0 + dpt), r2(x0 + CW - dpt), r2(y0 + dpt), D, dividerZ0, r2(dividerZ0 + dpt), [
      { x: 0, y: 0 }, { x: dividerBodyWidth, y: 0 },
      { x: dividerBodyWidth, y: dividerDepth - tongueWidth },
      { x: dividerBodyWidth + tongueDepth, y: dividerDepth - tongueWidth },
      { x: dividerBodyWidth + tongueDepth, y: dividerDepth },
      { x: -tongueDepth, y: dividerDepth },
      { x: -tongueDepth, y: dividerDepth - tongueWidth },
      { x: 0, y: dividerDepth - tongueWidth }, { x: 0, y: 0 },
    ]));

  const lockCenterZ = CSH + dc + dpt + (CH - dc - 2 * dpt - R.LOCK_DROP.value);
  const addDoor = (id: string, doorX0: number, isLeft: boolean) => {
    boards.push(mkBoard(id, isLeft ? "Middle Cabinet Left Door" : "Middle Cabinet Right Door", "cabinet_door", dpt, "XZ", "Y",
      doorX0, r2(doorX0 + doorWidth), y0, r2(y0 + dpt), r2(CSH + dc + dpt), r2(CSH + dc + dpt + doorHeight)));
    const hingeX = isLeft ? doorX0 + hingeEdge : doorX0 + doorWidth - hingeEdge;
    const z0 = CSH + dc + dpt;
    hinges.push({ id: `${id}_hinge_bottom`, panelId: id, centerX: hingeX, centerZ: z0 + hingeSide, diameter: cupD, depth: cupDepth });
    hinges.push({ id: `${id}_hinge_top`, panelId: id, centerX: hingeX, centerZ: z0 + doorHeight - hingeSide, diameter: cupD, depth: cupDepth });
    if (lockStyle !== "NONE") {
      const lockX = isLeft ? doorX0 + doorWidth - lockSide : doorX0 + lockSide;
      locks.push({
        id: `${id}_lock`, panelId: id, centerX: lockX, centerZ: lockCenterZ,
        width: R.LOCK_WIDTH.value, height: R.LOCK_HEIGHT.value, radius: R.LOCK_HEIGHT.value / 2,
      });
    }
  };
  addDoor("middle_cabinet_left_door", x0 + dc + dpt, true);
  addDoor("middle_cabinet_right_door", x0 + dc + doorSlotWidth + dc, false);
}

export function generateLounge(raw: LoungeParams): LoungeResult {
  beginProvenance();
  const warnings: string[] = [];
  const errors: string[] = [];
  const style: LoungeStyle = raw.style ?? "L_SHAPE";
  const H = asNum(raw.height, R.DEFAULT_HEIGHT.value);
  const ppt = Math.max(1, asNum(raw.partitionPanelThickness, R.DEFAULT_PPT.value));
  const P = param({ H, ppt });
  const Hprime = dim("lounge.panelHeight", { H: P.H, ppt: P.ppt }, (t) => t.H - t.ppt);
  const lidOn = raw.topLidEnabled !== false;
  const boards: Board[] = [];
  const openings: LoungeOpening[] = [];
  const lids: LoungeLid[] = [];
  const hinges: LoungeHinge[] = [];
  const locks: LoungeLock[] = [];
  const grooves: LoungeGroove[] = [];
  const footprint: LoungeResult["footprint"] = {};
  const AD = asNum(raw.avoidanceDepth, R.DEFAULT_AVOIDANCE_DEPTH.value);
  const AH = asNum(raw.avoidanceHeight, R.DEFAULT_AVOIDANCE_HEIGHT.value);
  const wheelOn = raw.wheelAvoidanceEnabled === true;
  const wheel = wheelOn ? { AD, AH } : undefined;

  if (H <= ppt) warnings.push("Height should be greater than panel thickness.");
  if (raw.lFrontAccess && raw.lFrontAccess !== "NONE") warnings.push("lFrontAccess is a placeholder and does not change geometry.");

  if (style === "I_SHAPE") {
    const W = asNum(raw.mainWidth, 2000);
    const D = asNum(raw.mainDepth, 600);
    if (!(W > 2 * ppt && D > 2 * ppt && H > ppt)) warnings.push("I-shape sizes should exceed two panel thicknesses.");
    if (wheelOn) {
      if (!(AD < D)) warnings.push("Avoidance Depth must be less than Depth.");
      if (!(AH < H - ppt)) warnings.push("Avoidance Height must be less than Height - PPT.");
    }
    footprint.i = { x0: 0, x1: W, y0: 0, y1: D };
    addIRun("i_", 0, W, D, H, ppt, Hprime, lidOn, boards, openings, lids, wheel);
  } else if (style === "U_SHAPE") {
    const W = asNum(raw.mainWidth, 2000);
    const D = asNum(raw.mainDepth, 1600);
    const runD = asNum(raw.lDepth, 600);
    footprint.main = { x0: 0, x1: W, y0: 0, y1: D };
    addIRun("left_", 0, runD, D, H, ppt, Hprime, lidOn, boards, openings, lids);
    addIRun("back_", 0, W, runD, H, ppt, Hprime, lidOn, boards, openings, lids);
    addIRun("right_", r2(W - runD), W, D, H, ppt, Hprime, lidOn, boards, openings, lids);
  } else if (style === "PARALLEL") {
    const totalW = asNum(raw.totalWidth, 4000);
    const SW = asNum(raw.singleLoungeWidth, 1500);
    const D = asNum(raw.depth, 800);
    if (totalW < 2 * SW) warnings.push("PARALLEL totalWidth < 2×singleLoungeWidth; runs overlap.");
    if (wheelOn) {
      if (!(AD < D)) warnings.push("Avoidance Depth must be less than Depth.");
      if (!(AH < H - ppt)) warnings.push("Avoidance Height must be less than Height - PPT.");
    }
    footprint.left = { x0: 0, x1: SW, y0: 0, y1: D };
    footprint.right = { x0: r2(totalW - SW), x1: totalW, y0: 0, y1: D };
    addParallelRun("left", "Left", 0, SW, D, H, ppt, Hprime, lidOn, boards, openings, lids, wheel);
    addParallelRun("right", "Right", r2(totalW - SW), totalW, D, H, ppt, Hprime, lidOn, boards, openings, lids, wheel);
    if (wheelOn) addAvoidanceCovers("parallel_", 0, totalW, D, AD, AH, ppt, boards);
    if (raw.hasMiddleCabinet) addMiddleCabinet(raw, totalW, D, boards, hinges, locks, grooves, warnings);
  } else {
    const mainW = asNum(raw.mainWidth, 2000);
    const mainD = asNum(raw.mainDepth, 600);
    const lW = asNum(raw.lWidth, 1600);
    const lD = asNum(raw.lDepth, 800);
    const right = (raw.lPosition ?? "RIGHT") !== "LEFT";
    if (!(lW < mainW)) warnings.push("L: lWidth should be less than mainWidth.");
    if (wheelOn) {
      if (!(AD < Math.min(mainD, lD))) warnings.push("Avoidance Depth must be less than both run depths.");
      if (!(AH < H - ppt)) warnings.push("Avoidance Height must be less than Height - PPT.");
    }
    const visW = r2(mainW - lW);
    const lX0 = right ? visW : 0;
    const lX1 = right ? mainW : lW;
    footprint.main = { x0: 0, x1: mainW, y0: 0, y1: mainD };
    footprint.l = { x0: lX0, x1: lX1, y0: 0, y1: lD };

    const frontW = visW;
    const frontX0 = right ? 0 : lW;
    boards.push(mkBoard("main_front", "Main Front", "front", ppt, "XZ", "Y",
      frontX0, r2(frontX0 + frontW), 0, ppt, 0, Hprime));
    boards.push(mkBoard("main_top", "Main Top", "top_panel", ppt, "XY", "Z",
      frontX0, r2(frontX0 + frontW), 0, mainD, H - ppt, H));
    openingAndLid("main", frontX0, 0, frontW, mainD, H - ppt, H, ppt, lidOn, boards, openings, lids);

    const supportL = r2(mainD - ppt);
    const prof = lSupportProfile(supportL, Hprime);
    boards.push(mkBoard("main_left_l_piece", "Main Left L", "l_support_profile", ppt, "YZ", "X",
      frontX0, r2(frontX0 + ppt), ppt, mainD, 0, Hprime, prof));
    boards.push(mkBoard("main_right_l_piece", "Main Right L", "l_support_profile", ppt, "YZ", "X",
      r2(frontX0 + frontW - ppt), r2(frontX0 + frontW), ppt, mainD, 0, Hprime, prof));

    const lFrontW = r2(lW - ppt);
    const lFrontX0 = right ? r2(lX0 + ppt) : lX0;
    boards.push(mkBoard("l_front", "L Front", "front", ppt, "XZ", "Y",
      lFrontX0, r2(lFrontX0 + lFrontW), 0, ppt, 0, Hprime));
    const sideX0 = right ? lX0 : r2(lX1 - ppt);
    const lCut = wheel ? wallCutoutProfile(0, lD, Hprime, AD, AH) : undefined;
    boards.push(mkBoard("l_side", "L Side", "side", ppt, "YZ", "X",
      sideX0, r2(sideX0 + ppt), 0, lD, 0, Hprime, lCut));
    const stripH = R.TOP_SUPPORT_STRIP_HEIGHT.value;
    const stripX0 = right ? r2(lX1 - ppt) : lX0;
    boards.push(mkBoard("l_side_strip", "L Side Strip", "support_strip", ppt, "YZ", "X",
      stripX0, r2(stripX0 + ppt), ppt, lD, r2(Hprime - stripH), Hprime));
    boards.push(mkBoard("l_top", "L Top", "top_panel", ppt, "XY", "Z",
      lX0, lX1, 0, lD, H - ppt, H));
    openingAndLid("l", lX0, 0, lW, lD, H - ppt, H, ppt, lidOn, boards, openings, lids);
    if (wheel && lCut) {
      addAvoidanceCovers("l_", lX0, lX1, lD, AD, AH, ppt, boards);
      addAvoidanceCovers("main_", frontX0, r2(frontX0 + frontW), mainD, AD, AH, ppt, boards);
    }
  }

  attachFaces(boards);
  const joints: Joint[] = buildLoungeFaces({ boards, openings, lids, hinges, locks, grooves });

  return {
    params: { style, height: H, partitionPanelThickness: ppt, panelHeight: Hprime },
    boards, openings, lids, footprint, hinges, locks, grooves, joints,
    validation: { errors, warnings },
    debug: { provenance: endProvenance(), boardFrame: "final" },
  };
}
