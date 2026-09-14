import assert from "node:assert/strict";
import { generateSmallCabinet } from "../smallCabinet/generator.ts";
import { generateOverheadCabinet } from "../overheadCabinet/generator.ts";
import { generateGeneralTallCabinet } from "../generalTall/generator.ts";
import { generateKitchenCabinetGeometry } from "../kitchen/generator.ts";
import { generateLoungeGeometry } from "../lounge/generator.ts";
import { defaultKitchenParams, defaultLoungeParams, defaultTallParams } from "./defaults.ts";

function testExistingSmallCabinetStillGenerates(): void {
  const result = generateSmallCabinet({
    cabinetWidth: 600,
    cabinetDepth: 560,
    cabinetHeight: 720,
    panelThickness: 16,
    frontPanelThickness: 16,
    zones: [{ id: "zone-1", type: "left_door", height: 688 }],
  });
  assert.equal(result.validation.errors.length, 0, result.validation.errors.join("; "));
  assert.ok(result.boards.length > 0);
}

function testExistingOverheadStillGenerates(): void {
  const result = generateOverheadCabinet({
    style: "style_1",
    cabinetWidth: 1200,
    cabinetDepth: 350,
    cabinetHeight: 400,
    topClearanceHeight: 40,
    featureWidth: 15,
    frontPanelThickness: 16,
    clearance: 2.5,
    zones: [{ id: "zone-1", type: "up_flap", width: 1200 }],
  });
  assert.equal(result.validation.errors.length, 0, result.validation.errors.join("; "));
  assert.ok(result.boards.length > 0);
}

function testGeneralTallFirstPass(): void {
  const result = generateGeneralTallCabinet(defaultTallParams as never);
  assert.equal(result.validation.errors.length, 0, result.validation.errors.join("; "));
  assert.ok(result.boards.length > 0, "tall carcass boards");
  assert.ok(result.frontPanels.length > 0, "tall fronts");
}

function testKitchenFirstPass(): void {
  const result = generateKitchenCabinetGeometry(defaultKitchenParams as never);
  assert.equal((result.errors || []).length, 0, (result.errors || []).join("; "));
  assert.ok(result.boards.length > 0, "kitchen boards");
  assert.ok(result.vPanels.length > 0, "kitchen v-panels");
}

function testLoungeFirstPass(): void {
  const result = generateLoungeGeometry(defaultLoungeParams);
  assert.equal(result.validation.errors.length, 0, result.validation.errors.join("; "));
  assert.ok(result.panels.length > 0, "lounge panels");
}

function testLoungeUShapeFallsThroughToL(): void {
  const l = generateLoungeGeometry({ ...defaultLoungeParams, style: "L_SHAPE" });
  const u = generateLoungeGeometry({ ...defaultLoungeParams, style: "U_SHAPE" });
  assert.equal(u.panels.length, l.panels.length);
  assert.deepEqual(
    u.panels.map((p) => p.id),
    l.panels.map((p) => p.id),
  );
}

const tests = [
  testExistingSmallCabinetStillGenerates,
  testExistingOverheadStillGenerates,
  testGeneralTallFirstPass,
  testKitchenFirstPass,
  testLoungeFirstPass,
  testLoungeUShapeFallsThroughToL,
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
  console.log(`OK ${tests.length}/${tests.length} first-pass`);
}
