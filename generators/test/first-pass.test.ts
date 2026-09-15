import assert from "node:assert/strict";
import { generateSmallCabinet } from "../smallCabinet/generator.ts";
import { generateOverheadCabinet } from "../overheadCabinet/generator.ts";
import { generateGeneralTallCabinet } from "../generalTall/generator.ts";
import { generateKitchenCabinetGeometry } from "../kitchen/generator.ts";
import { generateLoungeGeometry } from "../lounge/generator.ts";
import { generateUShapeOverhead } from "../uShapeOverhead/generator.ts";
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

function testLoungeUShapeThreeIRuns(): void {
  const u = generateLoungeGeometry({
    ...defaultLoungeParams,
    style: "U_SHAPE",
    totalWidth: 2000,
    depth: 1200,
    mainDepth: 350,
  });
  assert.equal(u.validation.errors.length, 0, u.validation.errors.join("; "));
  const prefixes = new Set(u.panels.map((p) => String(p.id).split(":")[0]));
  assert.deepEqual([...prefixes].sort(), ["back", "left", "right"]);
  assert.ok(u.panels.length > 10, "three I runs");
}

function testUOverheadFirstPass(): void {
  const result = generateUShapeOverhead({
    cabinetWidth: 2000,
    outerDepth: 1200,
    cabinetHeight: 400,
    cabinetDepth: 350,
    featureWidth: 15,
    frontPanelThickness: 16,
    topClearanceHeight: 40,
    clearance: 2.5,
  });
  assert.equal(result.validation.errors.length, 0, result.validation.errors.join("; "));
  assert.ok(result.boards.length > 15, "u-overhead three runs");
}

const tests = [
  testExistingSmallCabinetStillGenerates,
  testExistingOverheadStillGenerates,
  testGeneralTallFirstPass,
  testKitchenFirstPass,
  testLoungeFirstPass,
  testLoungeUShapeThreeIRuns,
  testUOverheadFirstPass,
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
