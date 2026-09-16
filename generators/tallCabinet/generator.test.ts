import assert from "node:assert/strict";
import { computeFrontPanelBounds } from "../smallCabinet/frontPanelCalculator.ts";
import { GROOVE_LENGTH_OVERSIZE, GROOVE_THICKNESS_OVERSIZE, generateTallCabinet, shelfTongueYRange } from "./generator.ts";

function boardById(result: ReturnType<typeof generateTallCabinet>, id: string) {
  return result.boards.find((b) => b.id === id);
}

function testFullDepthSidesAndFronts(): void {
  const result = generateTallCabinet({
    cabinetWidth: 600,
    cabinetDepth: 560,
    cabinetHeight: 2000,
    panelThickness: 16,
    frontPanelThickness: 16,
    frontClearance: 2.5,
    zones: [
      { id: "upper", type: "double_door", height: 900 },
      { id: "mid", type: "drawer", height: 300 },
      { id: "lower", type: "left_door", height: 768 },
    ],
  });
  assert.equal(result.validation.errors.length, 0, result.validation.errors.join("; "));

  const left = boardById(result, "SIDE_L");
  const right = boardById(result, "SIDE_R");
  const back = boardById(result, "BACK");
  const top = boardById(result, "TOP");
  const bottom = boardById(result, "BOTTOM");
  assert.ok(left && right && back && top && bottom);

  // Full-depth sides (not Fusion Style-1 150 mm stiles).
  assert.equal(left.y0, 0);
  assert.equal(left.y1, 560);
  assert.equal(left.z0, 0);
  assert.equal(left.z1, 2000);
  assert.equal(right.x0, 584);
  assert.equal(right.x1, 600);

  assert.equal(back.y0, 544);
  assert.equal(back.y1, 560);
  assert.equal(top.z0, 1984);
  assert.equal(top.z1, 2000);
  assert.equal(bottom.z0, 0);
  assert.equal(bottom.z1, 16);

  const mid1 = boardById(result, "MID_1");
  assert.ok(mid1);
  assert.equal(mid1.z0, 1076);
  assert.equal(mid1.z1, 1092);
  assert.equal(result.zones[0].zBottom, 1084);

  const leftLeaf = boardById(result, "FP_1L");
  const rightLeaf = boardById(result, "FP_1R");
  const drawer = boardById(result, "FP_2");
  const lower = boardById(result, "FP_3");
  assert.ok(leftLeaf && rightLeaf && drawer && lower);
  assert.equal(leftLeaf.y0, -16);
  assert.equal(leftLeaf.y1, 0);
  assert.equal(rightLeaf.y0, -16);
  assert.equal(Math.round((rightLeaf.x0 - leftLeaf.x1) * 10) / 10, 2.5);
  assert.equal(leftLeaf.hingeSide, "left");
  assert.equal(rightLeaf.hingeSide, "right");
  assert.ok(leftLeaf.lockCutout);
  assert.ok(rightLeaf.lockCutout);
  assert.equal(drawer.lockCutout, undefined);
  assert.ok(lower.lockCutout);

  const { tongueY0, tongueY1 } = shelfTongueYRange(0, 544);
  assert.ok(Math.abs(tongueY1 - tongueY0 - 544 / 3) < 0.15);
  // Through tongues expand the horizontal / back boards to the outer width.
  assert.equal(top.x0, 0);
  assert.equal(top.x1, 600);
  assert.equal(bottom.x0, 0);
  assert.equal(back.x0, 0);
  assert.equal(back.x1, 600);

  // Named contacts: double door / drawer share a middle with total FC across the seam.
  assert.equal(leftLeaf.z0, 1085.3);
  assert.equal(leftLeaf.z1, 1981.5);
  assert.equal(drawer.z0, 785.3);
  assert.equal(drawer.z1, 1082.8);
  assert.equal(Math.round((leftLeaf.z0 - drawer.z1) * 10) / 10, 2.5);
  assert.equal(lower.z0, 18.5);
  assert.equal(lower.z1, 782.8);

  // TOP+BOTTOM+2×MID+BACK → 5 boards × 2 sides = 10 grooves; 3 door locks (two leaves + lower).
  assert.equal(result.features.filter((f) => f.type === "side_groove").length, 10);
  assert.equal(result.features.filter((f) => f.type === "shelf_tongue").length, 8);
  assert.equal(result.features.filter((f) => f.type === "back_tongue").length, 2);
  assert.equal(result.features.filter((f) => f.type === "door_lock").length, 3);
  const midGrooves = result.features.filter((f) => f.type === "side_groove" && f.relatedBoardId === "MID_1");
  assert.equal(midGrooves.length, 2);
  for (const groove of midGrooves) {
    assert.equal(groove.y0, tongueY0 - GROOVE_LENGTH_OVERSIZE);
    assert.equal(groove.y1, tongueY1 + GROOVE_LENGTH_OVERSIZE);
    assert.equal(groove.z0, 1076 - GROOVE_THICKNESS_OVERSIZE);
    assert.equal(groove.z1, 1092 + GROOVE_THICKNESS_OVERSIZE);
  }
}

function testOpenZoneEmitsNoFront(): void {
  const result = generateTallCabinet({
    cabinetWidth: 600,
    cabinetDepth: 500,
    cabinetHeight: 800,
    panelThickness: 16,
    frontPanelThickness: 16,
    frontClearance: 2.5,
    zones: [
      { type: "right_door", height: 384 },
      { type: "open", height: 200 },
      { type: "drawer", height: 184 },
    ],
  });
  assert.equal(result.validation.errors.length, 0, result.validation.errors.join("; "));
  assert.equal(result.boards.filter((b) => b.category === "front_panel").length, 2);
  assert.equal(boardById(result, "FP_2"), undefined);
  const upper = boardById(result, "FP_1");
  const lower = boardById(result, "FP_3");
  assert.ok(upper && lower);
  assert.ok(upper.notes?.[0]?.includes("clear_plus_fc_open_neighbor"));
  assert.ok(lower.notes?.[0]?.includes("clear_minus_fc_open_neighbor"));
}

function testDoubleDoorNeighborUsesHalfClearance(): void {
  const zones = [
    {
      type: "double_door",
      zTop: 784,
      zBottom: 384,
      clearZ0: 392,
      clearZ1: 784,
    },
    {
      type: "drawer",
      zTop: 384,
      zBottom: 16,
      clearZ0: 16,
      clearZ1: 376,
    },
  ];
  const upper = computeFrontPanelBounds({
    cabinetWidth: 600,
    cabinetHeight: 800,
    panelThickness: 16,
    frontClearance: 2.5,
    zone: zones[0],
    zoneIndex: 0,
    zones,
  });
  const lower = computeFrontPanelBounds({
    cabinetWidth: 600,
    cabinetHeight: 800,
    panelThickness: 16,
    frontClearance: 2.5,
    zone: zones[1],
    zoneIndex: 1,
    zones,
  });
  assert.equal(Math.round((upper.z0 - lower.z1) * 10) / 10, 2.5);
  assert.equal(upper.sources.z0, "mid_center_plus_half_fc");
  assert.equal(lower.sources.z1, "mid_center_minus_half_fc");
}

function testAllOpenHasNoFronts(): void {
  const result = generateTallCabinet({
    cabinetWidth: 500,
    cabinetDepth: 400,
    cabinetHeight: 800,
    panelThickness: 16,
    zones: [
      { type: "open", height: 256 },
      { type: "open", height: 256 },
      { type: "open", height: 256 },
    ],
  });
  assert.equal(result.validation.errors.length, 0, result.validation.errors.join("; "));
  assert.equal(result.boards.filter((b) => b.category === "front_panel").length, 0);
  assert.ok(boardById(result, "MID_1"));
  assert.ok(boardById(result, "MID_2"));
  assert.equal(result.features.filter((f) => f.type === "door_lock").length, 0);
}

function testLocksCanBeDisabled(): void {
  const result = generateTallCabinet({
    cabinetWidth: 600,
    cabinetDepth: 500,
    cabinetHeight: 800,
    panelThickness: 16,
    locksEnabled: false,
    zones: [{ type: "double_door", height: 768 }],
  });
  assert.equal(result.validation.errors.length, 0, result.validation.errors.join("; "));
  assert.equal(boardById(result, "FP_1L")?.lockCutout, undefined);
  assert.equal(boardById(result, "FP_1R")?.lockCutout, undefined);
  assert.equal(result.features.filter((f) => f.type === "door_lock").length, 0);
}

function testRejectsBadTypeAndHeightSum(): void {
  const badType = generateTallCabinet({
    cabinetWidth: 600,
    cabinetDepth: 500,
    cabinetHeight: 800,
    zones: [{ type: "fridge", height: 768 }],
  });
  assert.ok(badType.validation.errors.some((e) => e.includes("unsupported type")));

  const badSum = generateTallCabinet({
    cabinetWidth: 600,
    cabinetDepth: 500,
    cabinetHeight: 800,
    panelThickness: 16,
    zones: [{ type: "open", height: 100 }],
  });
  assert.ok(badSum.validation.errors.some((e) => e.includes("interior height")));
}

const tests = [
  testFullDepthSidesAndFronts,
  testOpenZoneEmitsNoFront,
  testDoubleDoorNeighborUsesHalfClearance,
  testAllOpenHasNoFronts,
  testLocksCanBeDisabled,
  testRejectsBadTypeAndHeightSum,
];
let failed = 0;
for (const test of tests) {
  try {
    test();
    console.log(`PASS ${test.name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL ${test.name}`);
    console.error(error);
  }
}
if (failed > 0) {
  console.error(`${failed}/${tests.length} failed`);
  process.exitCode = 1;
} else {
  console.log(`OK ${tests.length}/${tests.length}`);
}
