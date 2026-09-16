import assert from "node:assert/strict";
import { generateBedSideTable } from "./generator.ts";
import { BED_SIDE_MIN } from "./types.ts";

function testValidVolumeHasNoBoards(): void {
  const result = generateBedSideTable({
    width: 400,
    depth: 400,
    height: 420,
    side: "left",
    panelThickness: 15,
  });
  assert.equal(result.validation.errors.length, 0, result.validation.errors.join("; "));
  assert.equal(result.boards.length, 0);
  assert.equal(result.params.side, "left");
  assert.equal(result.params.width, 400);
  assert.equal(result.params.height, 420);
  assert.deepEqual(result.zones[0], { id: "table", x0: 0, x1: 400, y0: 0, y1: 400, z0: 0, z1: 420 });
}

function testDefaultsSideToLeft(): void {
  const result = generateBedSideTable({ width: 300, depth: 350, height: 420 });
  assert.equal(result.params.side, "left");
}

function testRejectsUndersize(): void {
  const result = generateBedSideTable({
    width: BED_SIDE_MIN.width - 1,
    depth: 100,
    height: 50,
    panelThickness: 0,
  });
  assert.ok(result.validation.errors.some((e) => e.includes("width")));
  assert.ok(result.validation.errors.some((e) => e.includes("depth")));
  assert.ok(result.validation.errors.some((e) => e.includes("height")));
  assert.ok(result.validation.errors.some((e) => e.includes("panelThickness")));
  assert.equal(result.boards.length, 0);
  assert.equal(result.zones.length, 0);
}

const tests = [testValidVolumeHasNoBoards, testDefaultsSideToLeft, testRejectsUndersize];
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
