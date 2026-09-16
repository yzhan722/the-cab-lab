import assert from "node:assert/strict";
import { generateOverheadCabinet } from "../overheadCabinet/generator.ts";
import { DEFAULT_ARM_DEPTH, generateUOverheadCabinet, MIN_ARM_RUN } from "./generator.ts";

function boardById(result: ReturnType<typeof generateUOverheadCabinet>, id: string) {
  return result.boards.find((b) => b.id === id);
}

const base = {
  cabinetWidth: 1400,
  cabinetDepth: 900,
  cabinetHeight: 400,
  armDepth: DEFAULT_ARM_DEPTH,
  featureWidth: 15,
  frontPanelThickness: 16,
  topClearanceHeight: 40,
  clearance: 2.5,
};

function testThreeOhcRunsMapped(): void {
  const result = generateUOverheadCabinet(base);
  assert.equal(result.validation.errors.length, 0, result.validation.errors.join("; "));
  const sideLen = base.cabinetDepth - base.armDepth;
  const back = generateOverheadCabinet({ ...base, cabinetWidth: 1400, cabinetDepth: base.armDepth });
  const side = generateOverheadCabinet({ ...base, cabinetWidth: sideLen, cabinetDepth: base.armDepth });
  assert.equal(result.boards.filter((b) => b.id.startsWith("B_")).length, back.boards.length);
  assert.equal(result.boards.filter((b) => b.id.startsWith("L_")).length, side.boards.length);
  assert.equal(result.boards.filter((b) => b.id.startsWith("R_")).length, side.boards.length);

  const bp = boardById(result, "B_BP");
  assert.ok(bp);
  assert.equal(bp.x0, 0);
  assert.equal(bp.x1, 1400);
  assert.equal(bp.y0, sideLen);
  assert.equal(bp.y1, base.cabinetDepth);

  const left = boardById(result, "L_BP");
  assert.ok(left);
  assert.equal(left.x0, 0);
  assert.equal(left.x1, base.armDepth);
  assert.equal(left.y0, 0);
  assert.equal(left.y1, sideLen);

  const right = boardById(result, "R_BP");
  assert.ok(right);
  assert.equal(right.x0, base.cabinetWidth - base.armDepth);
  assert.equal(right.x1, 1400);
  assert.equal(right.y0, 0);
  assert.equal(right.y1, sideLen);
}

function testOpeningAtY0(): void {
  const result = generateUOverheadCabinet(base);
  const inner = result.boards.filter((b) => b.x0 > 350 + 1 && b.x1 < 1050 - 1 && b.y1 <= 1);
  assert.equal(inner.length, 0, "no board closes the U at y = 0");
  const leftFront = result.boards.filter((b) => b.id.startsWith("L_") && b.category === "front_panel");
  for (const b of leftFront) {
    assert.ok(b.x0 >= 350 - 0.5, `${b.id} front should sit on the inner left face`);
  }
}

function testRejectsShallowU(): void {
  const result = generateUOverheadCabinet({ ...base, cabinetDepth: DEFAULT_ARM_DEPTH + MIN_ARM_RUN - 1 });
  assert.ok(result.validation.errors.some((e) => e.includes("cabinetDepth")));
  assert.equal(result.boards.length, 0);
  const narrow = generateUOverheadCabinet({ ...base, cabinetWidth: 2 * DEFAULT_ARM_DEPTH });
  assert.ok(narrow.validation.errors.some((e) => e.includes("cabinetWidth")));
  assert.equal(narrow.boards.length, 0);
}

const tests = [testThreeOhcRunsMapped, testOpeningAtY0, testRejectsShallowU];
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
