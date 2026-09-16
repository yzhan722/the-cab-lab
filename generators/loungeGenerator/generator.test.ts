import assert from "node:assert/strict";
import {
  generateLounge,
  loungeBounds,
  loungeSegments,
  loungeStyleFromCount,
  LOUNGE_MIN,
} from "./generator.ts";

function boardById(result: ReturnType<typeof generateLounge>, id: string) {
  return result.boards.find((b) => b.id === id);
}

function testIIsOneBox(): void {
  const result = generateLounge({
    path: [{ x: 0, y: 0 }, { x: 2000, y: 0 }],
    depth: 600,
    height: 420,
    inwardX: 1000,
    inwardY: 300,
  });
  assert.equal(result.validation.errors.length, 0, result.validation.errors.join("; "));
  assert.equal(result.params.style, "I");
  assert.equal(result.boards.length, 1);
  const seg = boardById(result, "SEG_1");
  assert.ok(seg);
  assert.equal(seg.x0, 0);
  assert.equal(seg.x1, 2000);
  assert.equal(seg.y0, 0);
  assert.equal(seg.y1, 600);
  assert.equal(seg.z0, 0);
  assert.equal(seg.z1, 420);
  assert.equal(seg.y0, 0);
  assert.deepEqual(loungeBounds(result.params.path, 600, { x: 1000, y: 300 }, 420), { W: 2000, D: 600, H: 420 });
}

function testLIsTwoSegmentsTowardRoom(): void {
  const result = generateLounge({
    path: [{ x: 0, y: 0 }, { x: 2000, y: 0 }, { x: 2000, y: 1500 }],
    depth: 600,
    height: 420,
    inwardX: 1000,
    inwardY: 300,
  });
  assert.equal(result.validation.errors.length, 0, result.validation.errors.join("; "));
  assert.equal(result.params.style, "L");
  assert.equal(result.boards.length, 2);
  const a = boardById(result, "SEG_1");
  const b = boardById(result, "SEG_2");
  assert.ok(a && b);
  assert.equal(a.y1, 600);
  // Second leg along +Y; room is −X of that run.
  assert.equal(b.x0, 1400);
  assert.equal(b.x1, 2000);
  assert.equal(b.y0, 0);
  assert.equal(b.y1, 1500);
}

function testUIsThreeISegments(): void {
  const result = generateLounge({
    path: [{ x: 0, y: 0 }, { x: 0, y: 1800 }, { x: 2000, y: 1800 }, { x: 2000, y: 0 }],
    depth: 600,
    height: 420,
    inwardX: 1000,
    inwardY: 900,
  });
  assert.equal(result.validation.errors.length, 0, result.validation.errors.join("; "));
  assert.equal(result.params.style, "U");
  assert.equal(result.boards.length, 3);
  assert.equal(loungeStyleFromCount(4), "U");
  assert.equal(loungeSegments(result.params.path, 600, { x: 1000, y: 900 }).length, 3);
}

function testOriginShiftKeepsBoardsAtZero(): void {
  const result = generateLounge({
    path: [{ x: 1000, y: 500 }, { x: 3000, y: 500 }],
    depth: 600,
    height: 420,
    inwardX: 2000,
    inwardY: 800,
  });
  assert.equal(result.validation.errors.length, 0, result.validation.errors.join("; "));
  const seg = boardById(result, "SEG_1");
  assert.ok(seg);
  assert.equal(seg.x0, 0);
  assert.equal(seg.y0, 0);
  assert.equal(seg.x1, 2000);
  assert.equal(seg.y1, 600);
  assert.equal(result.params.path[0].x, 0);
}

function testRejectsShortSegment(): void {
  const result = generateLounge({
    path: [{ x: 0, y: 0 }, { x: 50, y: 0 }],
    depth: 600,
    height: 420,
  });
  assert.ok(result.validation.errors.some((e) => e.includes("segment")));
  assert.equal(result.boards.length, 0);
  const shallow = generateLounge({
    path: [{ x: 0, y: 0 }, { x: 2000, y: 0 }],
    depth: LOUNGE_MIN.depth - 1,
    height: 420,
    inwardY: 100,
  });
  assert.ok(shallow.validation.errors.some((e) => e.includes("depth")));
}

const tests = [testIIsOneBox, testLIsTwoSegmentsTowardRoom, testUIsThreeISegments, testOriginShiftKeepsBoardsAtZero, testRejectsShortSegment];
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
