import assert from "node:assert/strict";
import { axisLock, perpLock, loungeDraft, pointsNeeded, nextHover, LOUNGE_MIN_RUN } from "../../renderer/loungePlace.js";
import { generateLoungeGeometry } from "../lounge/generator.ts";
import { displayLounge } from "../../renderer/displayBoards.js";

function testAxisLock(): void {
  const a = { x: 0, y: 0, z: 0 };
  assert.deepEqual(axisLock(a, { x: 800, y: 20, z: 0 }), { x: 800, y: 0, z: 0 });
  assert.deepEqual(axisLock(a, { x: 20, y: 900, z: 0 }), { x: 0, y: 900, z: 0 });
}

function testIDraft(): void {
  const a = { x: 0, y: 2000, z: 0 };
  const b = { x: 1800, y: 2000, z: 0 };
  const d = loungeDraft("I_SHAPE", [a, b], null, 600, { x: 1000, y: 1000 });
  assert.equal(pointsNeeded("I_SHAPE"), 2);
  assert.ok(d.ready);
  assert.equal(d.rects.length, 1);
  assert.equal(d.params.style, "I_SHAPE");
  assert.equal(d.params.mainWidth, 1800);
  assert.ok(d.rects[0].D >= 600 || d.rects[0].W >= 600);
}

function testLDraft(): void {
  const pts = [
    { x: 0, y: 2000, z: 0 },
    { x: 2000, y: 2000, z: 0 },
    { x: 2000, y: 800, z: 0 },
  ];
  const d = loungeDraft("L_SHAPE", pts, null, 600, { x: 1000, y: 1000 });
  assert.equal(pointsNeeded("L_SHAPE"), 3);
  assert.ok(d.ready, d.tip);
  assert.equal(d.rects.length, 2);
  assert.equal(d.params.style, "L_SHAPE");
  assert.ok(d.params.mainWidth >= LOUNGE_MIN_RUN);
}

function testUDraft(): void {
  const pts = [
    { x: 400, y: 400, z: 0 },
    { x: 400, y: 1600, z: 0 },
    { x: 2000, y: 1600, z: 0 },
    { x: 2000, y: 400, z: 0 },
  ];
  const d = loungeDraft("U_SHAPE", pts, null, 350, { x: 1200, y: 1000 });
  assert.equal(pointsNeeded("U_SHAPE"), 4);
  assert.ok(d.ready, d.tip);
  assert.equal(d.rects.length, 3);
  assert.equal(d.params.style, "U_SHAPE");
  assert.deepEqual(d.door, { axis: "y", dir: -1 });
}

function testPerpAndHover(): void {
  const a = { x: 0, y: 0, z: 0 };
  const b = { x: 1000, y: 0, z: 0 };
  const p = perpLock(b, a, { x: 1080, y: 500, z: 0 });
  assert.equal(p.x, 1000);
  assert.equal(p.y, 500);
  const h = nextHover("L_SHAPE", [a, b], { x: 900, y: 400, z: 0 });
  assert.equal(h.x, 1000);
}

function boardsInside(label: string, boards: Array<{ id?: string; x0: number; x1: number; y0: number; y1: number; z0: number; z1: number }>, W: number, D: number, H: number) {
  for (const b of boards) {
    assert.ok(b.x0 >= -0.6 && b.x1 <= W + 0.6, `${label} ${b.id} X ${b.x0}..${b.x1} vs ${W}`);
    assert.ok(b.y0 >= -0.6 && b.y1 <= D + 0.6, `${label} ${b.id} Y ${b.y0}..${b.y1} vs ${D}`);
    assert.ok(b.z0 >= -0.6 && b.z1 <= H + 0.6, `${label} ${b.id} Z ${b.z0}..${b.z1} vs ${H}`);
  }
}

function testDraftsGenerate(): void {
  const H = 420;
  const i = loungeDraft("I_SHAPE", [{ x: 0, y: 2000, z: 0 }, { x: 1800, y: 2000, z: 0 }], null, 600, { x: 1000, y: 1000 });
  const iRes = displayLounge(generateLoungeGeometry({ ...i.params, height: H, partitionPanelThickness: 18, topLidEnabled: true }));
  assert.equal(iRes.validation.errors.length, 0, iRes.validation.errors.join("; "));
  assert.ok(iRes.boards.length > 0);
  boardsInside("I", iRes.boards, i.params.mainWidth, i.params.mainDepth, H);

  const l = loungeDraft("L_SHAPE", [
    { x: 0, y: 2000, z: 0 }, { x: 2000, y: 2000, z: 0 }, { x: 2000, y: 800, z: 0 },
  ], null, 600, { x: 1000, y: 1000 });
  const lRes = displayLounge(generateLoungeGeometry({ ...l.params, height: H, partitionPanelThickness: 18, topLidEnabled: true }));
  assert.equal(lRes.validation.errors.length, 0, lRes.validation.errors.join("; "));
  assert.ok(lRes.boards.length > iRes.boards.length);

  const u = loungeDraft("U_SHAPE", [
    { x: 400, y: 400, z: 0 }, { x: 400, y: 1600, z: 0 }, { x: 2000, y: 1600, z: 0 }, { x: 2000, y: 400, z: 0 },
  ], null, 350, { x: 1200, y: 1000 });
  const uRes = displayLounge(generateLoungeGeometry({
    ...u.params, height: H, partitionPanelThickness: 18, topLidEnabled: true,
  }));
  assert.equal(uRes.validation.errors.length, 0, uRes.validation.errors.join("; "));
  const prefixes = [...new Set(uRes.boards.map((b) => String(b.id).split(":")[0]))].sort();
  assert.deepEqual(prefixes, ["back", "left", "right"]);
  assert.ok(uRes.boards.length > lRes.boards.length);
  boardsInside("U", uRes.boards, u.params.totalWidth, u.params.depth, H);

  const p = loungeDraft("PARALLEL", [
    { x: 0, y: 400, z: 0 }, { x: 1800, y: 400, z: 0 }, { x: 900, y: 1600, z: 0 },
  ], null, 500, { x: 1000, y: 1000 });
  assert.ok(p.ready, p.tip);
  const pRes = displayLounge(generateLoungeGeometry({
    style: "PARALLEL",
    height: H,
    partitionPanelThickness: 18,
    topLidEnabled: true,
    totalWidth: p.params.totalWidth,
    singleLoungeWidth: p.params.singleLoungeWidth,
    depth: p.params.depth,
  }));
  assert.equal(pRes.validation.errors.length, 0, pRes.validation.errors.join("; "));
  assert.ok(pRes.boards.length > 0);
}

testAxisLock();
testIDraft();
testLDraft();
testUDraft();
testPerpAndHover();
testDraftsGenerate();
console.log("OK lounge place");
