import assert from "node:assert/strict";
import {
  carcassInteriorHeight,
  DEFAULT_PLINTH_HEIGHT,
  DEFAULT_PLINTH_SETBACK,
  generateKitchenCabinet,
  GROOVE_LENGTH_OVERSIZE,
  GROOVE_THICKNESS_OVERSIZE,
  shelfTongueYRange,
  sideProfileWithKick,
} from "./generator.ts";

function boardById(result: ReturnType<typeof generateKitchenCabinet>, id: string) {
  return result.boards.find((b) => b.id === id);
}

function testToeKickAndLiftedBottom(): void {
  const result = generateKitchenCabinet({
    cabinetWidth: 600,
    cabinetDepth: 560,
    cabinetHeight: 870,
    panelThickness: 16,
    frontPanelThickness: 16,
    frontClearance: 2.5,
    plinthHeight: 150,
    plinthSetback: 50,
    zones: [
      { id: "upper", type: "drawer", height: 200 },
      { id: "lower", type: "left_door", height: 488 },
    ],
  });
  assert.equal(result.validation.errors.length, 0, result.validation.errors.join("; "));
  assert.equal(carcassInteriorHeight(870, 150, 16), 688);

  const left = boardById(result, "SIDE_L");
  const right = boardById(result, "SIDE_R");
  const plinth = boardById(result, "PLINTH_FRONT");
  const bottom = boardById(result, "BOTTOM");
  const top = boardById(result, "TOP");
  const back = boardById(result, "BACK");
  const mid = boardById(result, "MID_1");
  const drawer = boardById(result, "FP_1");
  const door = boardById(result, "FP_2");
  assert.ok(left && right && plinth && bottom && top && back && mid && drawer && door);

  // Sides still span the envelope; the kick is a notch in the YZ outline, not a 150 mm stile.
  assert.equal(left.y0, 0);
  assert.equal(left.y1, 560);
  assert.equal(left.z0, 0);
  assert.equal(left.z1, 870);
  assert.equal(right.x0, 584);
  const outline = left.profileVector || [];
  assert.ok(outline.some((p) => "y" in p && p.y === 50 && p.z === 0));
  assert.ok(outline.some((p) => "y" in p && p.y === 0 && p.z === 150));
  assert.ok(outline.some((p) => "y" in p && p.y === 50 && p.z === 150));
  assert.equal(outline.length, sideProfileWithKick(560, 870, 150, 50).length);

  assert.equal(plinth.y0, 50);
  assert.equal(plinth.y1, 66);
  assert.equal(plinth.z0, 0);
  assert.equal(plinth.z1, 150);
  assert.equal(plinth.x0, 16);
  assert.equal(plinth.x1, 584);

  // Carcass floor on the plinth, not on z = 0.
  assert.equal(bottom.z0, 150);
  assert.equal(bottom.z1, 166);
  assert.equal(bottom.x0, 0);
  assert.equal(bottom.x1, 600);
  assert.equal(top.z0, 854);
  assert.equal(back.z0, 166);
  assert.equal(back.z1, 854);
  assert.equal(result.zones[1].zBottom, 166);

  // Fronts sit at −FPT and start above the plinth (BOTTOM top + FC).
  assert.equal(drawer.y0, -16);
  assert.equal(drawer.y1, 0);
  assert.equal(drawer.z0, 655.3);
  assert.equal(drawer.z1, 851.5);
  assert.equal(drawer.lockCutout, undefined);
  assert.equal(door.z0, 168.5);
  assert.equal(door.z1, 652.8);
  assert.ok(door.lockCutout);
  assert.ok(door.z0 > 150);

  const { tongueY0, tongueY1 } = shelfTongueYRange(0, 544);
  assert.ok(Math.abs(tongueY1 - tongueY0 - 544 / 3) < 0.15);
  // TOP + BOTTOM + MID + BACK → 8 grooves. Plinth has no joinery in v0.
  assert.equal(result.features.filter((f) => f.type === "side_groove").length, 8);
  assert.equal(result.features.filter((f) => f.type === "shelf_tongue").length, 6);
  assert.equal(result.features.filter((f) => f.type === "back_tongue").length, 2);
  assert.equal(result.features.filter((f) => f.type === "door_lock").length, 1);
  const bottomGrooves = result.features.filter((f) => f.type === "side_groove" && f.relatedBoardId === "BOTTOM");
  assert.equal(bottomGrooves.length, 2);
  for (const groove of bottomGrooves) {
    assert.equal(groove.y0, tongueY0 - GROOVE_LENGTH_OVERSIZE);
    assert.equal(groove.y1, tongueY1 + GROOVE_LENGTH_OVERSIZE);
    assert.equal(groove.z0, 150 - GROOVE_THICKNESS_OVERSIZE);
    assert.equal(groove.z1, 166 + GROOVE_THICKNESS_OVERSIZE);
  }
}

function testDefaultsMatchExportedConstants(): void {
  const result = generateKitchenCabinet({
    cabinetWidth: 600,
    cabinetDepth: 560,
    cabinetHeight: 870,
    zones: [{ type: "left_door", height: carcassInteriorHeight(870, DEFAULT_PLINTH_HEIGHT, 16) }],
  });
  assert.equal(result.validation.errors.length, 0, result.validation.errors.join("; "));
  assert.equal(result.params.plinthHeight, DEFAULT_PLINTH_HEIGHT);
  assert.equal(result.params.plinthSetback, DEFAULT_PLINTH_SETBACK);
  assert.equal(boardById(result, "BOTTOM")?.z0, DEFAULT_PLINTH_HEIGHT);
}

function testRejectsPlinthAndTypes(): void {
  const tooTall = generateKitchenCabinet({
    cabinetWidth: 600,
    cabinetDepth: 560,
    cabinetHeight: 870,
    plinthHeight: 850,
    zones: [{ type: "drawer", height: 100 }],
  });
  assert.ok(tooTall.validation.errors.some((e) => e.includes("no carcass interior")));

  const deepKick = generateKitchenCabinet({
    cabinetWidth: 600,
    cabinetDepth: 560,
    cabinetHeight: 870,
    plinthSetback: 560,
    zones: [{ type: "drawer", height: 688 }],
  });
  assert.ok(deepKick.validation.errors.some((e) => e.includes("plinthSetback")));

  const fridge = generateKitchenCabinet({
    cabinetWidth: 600,
    cabinetDepth: 560,
    cabinetHeight: 870,
    zones: [{ type: "fridge", height: 688 }],
  });
  assert.ok(fridge.validation.errors.some((e) => e.includes("unsupported type")));

  const badSum = generateKitchenCabinet({
    cabinetWidth: 600,
    cabinetDepth: 560,
    cabinetHeight: 870,
    panelThickness: 16,
    plinthHeight: 150,
    zones: [{ type: "drawer", height: 100 }],
  });
  assert.ok(badSum.validation.errors.some((e) => e.includes("carcass interior")));
}

const tests = [testToeKickAndLiftedBottom, testDefaultsMatchExportedConstants, testRejectsPlinthAndTypes];
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
