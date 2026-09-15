/**
 * U-overhead composes three existing OHC generators; boards fill a U.
 */
import assert from "node:assert/strict";
import { generateUShapeOverhead, resolveUOverheadLayout, U_OHC_MIN_ZONE } from "../uShapeOverhead/generator.ts";
import { generateBedSideTable, BED_SIDE_MIN } from "../bedSideTable/generator.ts";

function testUOverheadThreeRuns(): void {
  const r = generateUShapeOverhead({
    cabinetWidth: 2000,
    outerDepth: 1200,
    cabinetHeight: 400,
    cabinetDepth: 350,
    featureWidth: 15,
    frontPanelThickness: 16,
    topClearanceHeight: 40,
    clearance: 2.5,
  });
  assert.equal(r.validation.errors.length, 0, r.validation.errors.join("; "));
  assert.ok(r.boards.length > 15, `expected three OHC runs, got ${r.boards.length} boards`);
  const prefixes = new Set(r.boards.map((b) => String(b.id).split(":")[0]));
  assert.deepEqual([...prefixes].sort(), ["back", "left", "right"]);
  const layout = resolveUOverheadLayout({
    cabinetWidth: 2000, outerDepth: 1200, cabinetHeight: 400, cabinetDepth: 350,
  });
  assert.equal(layout.backLen, 2000 - 2 * 350);
  assert.equal(layout.leftLen, 1200);
  const ids = new Set<string>();
  const pad = 80;
  for (const b of r.boards) {
    assert.equal(ids.has(b.id), false, `duplicate ${b.id}`);
    ids.add(b.id);
    assert.ok(b.x0 >= -pad && b.x1 <= 2000 + pad, `${b.id} X`);
    assert.ok(b.y0 >= -pad && b.y1 <= 1200 + pad, `${b.id} Y`);
    assert.ok(b.z0 >= -pad && b.z1 <= 400 + pad, `${b.id} Z`);
  }
}

function testUOverheadShrinksRun(): void {
  const r = generateUShapeOverhead({
    cabinetWidth: 800,
    outerDepth: 500,
    cabinetHeight: 400,
    cabinetDepth: 350,
    featureWidth: 15,
    frontPanelThickness: 16,
  });
  assert.equal(r.validation.errors.length, 0, r.validation.errors.join("; "));
  assert.ok(r.layout.backLen >= U_OHC_MIN_ZONE);
  assert.ok(r.boards.length > 0);
}

function testBedSideTableVolume(): void {
  const r = generateBedSideTable({ width: 400, depth: 400, height: 420, side: "left" });
  assert.equal(r.validation.errors.length, 0, r.validation.errors.join("; "));
  assert.equal(r.boards.length, 0);
  assert.equal(r.params.side, "left");
  const small = generateBedSideTable({ width: BED_SIDE_MIN.width - 1, depth: 400, height: 420 });
  assert.ok(small.validation.errors.length > 0);
}

const tests = [testUOverheadThreeRuns, testUOverheadShrinksRun, testBedSideTableVolume];
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
  console.log(`OK ${tests.length}/${tests.length} u-overhead + bedside`);
}
