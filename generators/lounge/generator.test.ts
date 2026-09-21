/**
 * Lounge 黄金测试 — L 默认参数按 spec §8，数值已翻到 Cab Lab（前脸 y∈[0,ppt]）。
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { generateLounge } from "./generator.ts";
import { checkPins, countPins, type PresetsFile } from "../_lib/pins.ts";
import { loungeFootprintBoxes, loungeFromPolyline, loungePolyline, pointInFootprintBoxes } from "./place.ts";

const r2 = (v: number) => Math.round(v * 1000) / 1000;
function b(id: string) {
  const board = r.boards.find((x) => x.id === id);
  assert.ok(board, `missing ${id}`);
  return board;
}
function place(id: string) {
  const board = b(id);
  const q = (v: number) => Math.round(v * 100) / 100;
  return { x0: q(board.x0), x1: q(board.x1), y0: q(board.y0), y1: q(board.y1), z0: q(board.z0), z1: q(board.z1) };
}

const r = generateLounge({
  style: "L_SHAPE",
  height: 420,
  partitionPanelThickness: 18,
  mainWidth: 2000,
  mainDepth: 600,
  lWidth: 1600,
  lDepth: 800,
  lPosition: "RIGHT",
  topLidEnabled: true,
});

assert.equal(r.validation.errors.length, 0);
assert.deepEqual(r.footprint.l, { x0: 400, x1: 2000, y0: 0, y1: 800 });
assert.equal(r.boards.filter((x) => x.boardType !== "lid").length, 8);
assert.equal(r.lids.length, 2);
assert.equal(r.openings.length, 2);
assert.equal(r.joints.length, 3);

assert.deepEqual(place("main_front"), { x0: 0, x1: 400, y0: 0, y1: 18, z0: 0, z1: 402 });
assert.deepEqual(place("l_front"), { x0: 418, x1: 2000, y0: 0, y1: 18, z0: 0, z1: 402 });
assert.deepEqual(place("l_side"), { x0: 400, x1: 418, y0: 0, y1: 800, z0: 0, z1: 402 });
assert.deepEqual(place("l_side_strip"), { x0: 1982, x1: 2000, y0: 18, y1: 800, z0: 302, z1: 402 });
assert.deepEqual(b("main_left_l_piece").profileVector, [
  { y: 0, z: 0 }, { y: 0, z: 402 }, { y: 582, z: 402 }, { y: 582, z: 302 },
  { y: 100, z: 302 }, { y: 100, z: 0 }, { y: 0, z: 0 },
]);

const op = r.openings.find((o) => o.id === "main_opening")!;
assert.deepEqual([op.width, op.depth], [200, 300]);
const lid = r.lids.find((o) => o.id === "main_lid")!;
assert.deepEqual([r2(lid.width), r2(lid.depth)], [197, 297]);
assert.equal(lid.holeDiameter, 40);
assert.equal(r.debug?.boardFrame, "final");

{
  const entries = r.debug.provenance.entries;
  assert.ok(Object.keys(entries).length > 0, "lounge provenance is not empty");
  for (const board of r.boards) {
    for (const face of ["x0", "x1", "y0", "y1", "z0", "z1"]) {
      const e = entries[`${board.id}.${face}`];
      assert.ok(e, `${board.id}.${face} has no provenance`);
      assert.equal(e.value, board[face]);
    }
  }
  assert.equal(entries["lounge.panelHeight"]?.formula, "H - ppt");
  for (const j of r.joints) {
    assert.equal(typeof j.a?.board, "string", `${j.id} a.board`);
    assert.equal(typeof j.b?.board, "string", `${j.id} b.board`);
  }
  const top = b("main_top");
  assert.ok(top.faces.find((f) => f.id === "A").features.some((x) => x.kind === "cutout"));
}

const i = generateLounge({ style: "I_SHAPE", mainWidth: 2000, mainDepth: 600, height: 420 });
assert.equal(i.boards.filter((x) => x.boardType !== "lid").length, 4);
assert.deepEqual({ x0: i.boards.find((x) => x.id === "i_front")!.x0, y0: i.boards.find((x) => x.id === "i_front")!.y0, y1: i.boards.find((x) => x.id === "i_front")!.y1 }, { x0: 0, y0: 0, y1: 18 });

const u = generateLounge({ style: "U_SHAPE", mainWidth: 2000, mainDepth: 1600, lDepth: 600, height: 420, topLidEnabled: false });
assert.ok(u.boards.some((x) => x.id === "left_front"));
assert.ok(u.boards.some((x) => x.id === "back_front"));
assert.ok(u.boards.some((x) => x.id === "right_front"));

/* ---------- 折线放置 + L 缺口不进包络 ---------- */
{
  const boxes = loungeFootprintBoxes({
    style: "L_SHAPE", mainWidth: 2000, mainDepth: 600, lWidth: 1600, lDepth: 800, lPosition: "RIGHT",
  }, r);
  assert.equal(boxes.length, 2);
  assert.ok(pointInFootprintBoxes(200, 300, boxes), "main leg");
  assert.ok(pointInFootprintBoxes(1200, 700, boxes), "L wing");
  assert.equal(pointInFootprintBoxes(200, 700, boxes), false, "L notch is empty");
  const poly = loungePolyline({ style: "L_SHAPE", mainWidth: 2000, mainDepth: 600, lWidth: 1600, lDepth: 800, lPosition: "RIGHT" });
  assert.equal(poly.length, 3);

  const iPlace = loungeFromPolyline([{ x: 100, y: 700 }, { x: 2100, y: 700 }], { mainDepth: 600, height: 420 });
  assert.equal(iPlace.params.style, "I_SHAPE");
  assert.equal(iPlace.params.mainWidth, 2000);
  assert.equal(iPlace.pose.rotZ, 0);

  const lPlace = loungeFromPolyline(
    [{ x: 0, y: 600 }, { x: 2000, y: 600 }, { x: 2000, y: 800 }],
    { mainDepth: 600, lWidth: 1600, height: 420 },
  );
  assert.equal(lPlace.params.style, "L_SHAPE");
  assert.equal(lPlace.params.lPosition, "RIGHT");
  assert.equal(lPlace.params.lDepth, 800);

  const pPlace = loungeFromPolyline(
    [{ x: 0, y: 800 }, { x: 1500, y: 800 }, { x: 4000, y: 800 }],
    { depth: 800, singleLoungeWidth: 1500 },
  );
  assert.equal(pPlace.params.style, "PARALLEL");
  assert.equal(pPlace.params.totalWidth, 4000);

  const uPlace = loungeFromPolyline(
    [{ x: 0, y: 0 }, { x: 0, y: 1600 }, { x: 2000, y: 1600 }, { x: 2000, y: 0 }],
    { lDepth: 600 },
  );
  assert.equal(uPlace.params.style, "U_SHAPE");
  assert.equal(uPlace.params.mainWidth, 2000);
  assert.equal(uPlace.params.mainDepth, 1600);
}

/* ---------- I / L / Parallel 轮拱在墙侧 y∈[D−AD, D] + Parallel 中柜 ---------- */
{
  const iw = generateLounge({
    style: "I_SHAPE", mainWidth: 2000, mainDepth: 600, height: 420,
    wheelAvoidanceEnabled: true, avoidanceDepth: 300, avoidanceHeight: 250,
  });
  const top = iw.boards.find((x) => x.id === "i_avoidance_top")!;
  assert.deepEqual(
    { y0: Math.round(top.y0), y1: Math.round(top.y1), z0: Math.round(top.z0), z1: Math.round(top.z1) },
    { y0: 300, y1: 600, z0: 232, z1: 250 },
  );
  const front = iw.boards.find((x) => x.id === "i_avoidance_front")!;
  assert.equal(Math.round(front.y0), 300);
  assert.equal(Math.round(front.y1), 318);
  const side = iw.boards.find((x) => x.id === "i_left_side")!;
  const prof = side.profileVector as { y: number; z: number }[];
  assert.ok(prof.some((p) => p.y === 282 && p.z === 0), "I side cutout at wall (local y = D−ppt−AD)");
  assert.ok(prof.some((p) => p.y === 582 && p.z === 250), "I side cutout top at wall");

  const lw = generateLounge({
    style: "L_SHAPE", height: 420, mainWidth: 2000, mainDepth: 600, lWidth: 1600, lDepth: 800,
    wheelAvoidanceEnabled: true, avoidanceDepth: 300, avoidanceHeight: 250,
  });
  const lTop = lw.boards.find((x) => x.id === "l_avoidance_top")!;
  assert.deepEqual({ y0: Math.round(lTop.y0), y1: Math.round(lTop.y1) }, { y0: 500, y1: 800 });
  assert.ok(lw.boards.some((x) => x.id === "main_avoidance_top"));

  const pw = generateLounge({
    style: "PARALLEL", totalWidth: 4000, singleLoungeWidth: 1500, depth: 800, height: 420,
    wheelAvoidanceEnabled: true, avoidanceDepth: 300, avoidanceHeight: 250,
    hasMiddleCabinet: true,
    middleCabinet: { width: 600, depth: 350, height: 500, startHeight: 300, doorPanelThickness: 15, doorClearance: 2 },
  });
  const pTop = pw.boards.find((x) => x.id === "parallel_avoidance_top")!;
  assert.deepEqual({ y0: Math.round(pTop.y0), y1: Math.round(pTop.y1), x0: pTop.x0, x1: pTop.x1 }, { y0: 500, y1: 800, x0: 0, x1: 4000 });
  const midBot = pw.boards.find((x) => x.id === "middle_cabinet_bottom")!;
  assert.deepEqual(
    { x0: Math.round(midBot.x0), x1: Math.round(midBot.x1), y0: Math.round(midBot.y0), y1: Math.round(midBot.y1), z0: Math.round(midBot.z0) },
    { x0: 1700, x1: 2300, y0: 450, y1: 800, z0: 300 },
  );
  assert.ok(pw.boards.some((x) => x.id === "middle_cabinet_left_door"));
  assert.ok(pw.boards.some((x) => x.id === "middle_cabinet_right_door"));
  assert.equal(pw.hinges.length, 4);
  assert.equal(pw.locks.length, 2);
  assert.equal(pw.grooves.length, 2);
}

{
  const file = join(dirname(fileURLToPath(import.meta.url)), "presets.json");
  const presets = JSON.parse(readFileSync(file, "utf8")) as PresetsFile;
  assert.equal(presets.module, "lounge");
  for (const preset of presets.presets) {
    const result = generateLounge(preset.params);
    assert.ok(countPins(preset.pins) > 0, `${preset.id}: no pins`);
    assert.deepEqual(checkPins(result, preset.pins), [], `${preset.id}: pin mismatch`);
  }
}

console.log("lounge: all golden tests passed");
