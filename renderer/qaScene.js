// Build a known layout of every wired module, using the same addCabinet
// path as a finished placement. This is visual QA, not click-to-place.
import * as THREE from "three";
import * as job from "./job.js";
import { getModule } from "./modules.js";
import { poseFits, groupFor, envelopeBox } from "./cabinets3d.js";
import { fitBoxFacing } from "./interact.js";
import { withKitchenVPanelPrefs } from "./displayBoards.js";
import { close as closeSpaceDialog } from "./spaceDialog.js";
import { frame, setView } from "./space.js";
import { log } from "./log.js";

const BOX = { width: 4000, depth: 3000, height: 2400, walls: [0, 1, 2, 3] };

function fpt() {
  const n = Number(job.getStock()?.door?.thickness);
  return Number.isFinite(n) && n > 0 ? n : 16;
}

function inspect(cab) {
  const result = job.resultFor(cab.id);
  const errors = result?.validation?.errors || result?.errors || [];
  return {
    id: cab.id,
    moduleId: cab.moduleId,
    pose: cab.pose,
    envelope: getModule(cab.moduleId).envelope(cab.params),
    boards: result?.boards?.length || 0,
    volumeOnly: !!getModule(cab.moduleId).volumeOnly,
    fits: poseFits(cab, cab.pose),
    errors,
  };
}

function addBox(moduleId, world, side) {
  const fit = fitBoxFacing(world, side, getModule(moduleId).noFrontAllowance ? 0 : fpt());
  return job.addCabinet(moduleId, fit.pose, { W: fit.W, D: fit.D, H: fit.H });
}

/**
 * Replace the job with a box space and one of each module.
 * Caller should confirm if the current job has cabinets.
 */
export function buildQaScene() {
  closeSpaceDialog();
  job.resetJob();
  job.defineSpace("box", { ...BOX });
  const door = fpt();
  const H = BOX.height;

  // Nose slab at the front of the van (rotZ 180, as placement does).
  job.addCabinet("bedroom", { x: BOX.width, y: 700, z: 0, rotZ: 180 }, { W: BOX.width, D: 700, H: 1965 });
  job.addCabinet("bedBox", { x: 0, y: 0, z: 0, rotZ: 180 }, { W: 1530, D: 1900, H: 420 });
  job.addCabinet("bedSideTable", { x: 400, y: 1100, z: 0, rotZ: 180 }, { W: 280, D: 400, H: 420 });

  // Left wall, doors into the room (+X), behind the bedroom.
  addBox("smallCabinet", { x0: 0, y0: 750, z0: 0, W: 560 + door, D: 600, H: 720 }, { axis: "x", dir: 1 });
  addBox("generalTallCabinet", { x0: 0, y0: 1400, z0: 0, W: 584 + door, D: 600, H: 2000 }, { axis: "x", dir: 1 });
  const kitchen = addBox("kitchenCabinet", { x0: 0, y0: 2050, z0: 0, W: 560 + door, D: 800, H: 720 }, { axis: "x", dir: 1 });
  const g = kitchen.params.globalSettings || {};
  const interior = Math.round((Number(g.height || 720) - (Number(g.bottomClearanceHeight) || 100) - (Number(g.materialThickness) || 15)) * 10) / 10;
  job.setParams(kitchen.id, withKitchenVPanelPrefs({
    ...kitchen.params,
    columns: [
      { id: "col-1", width: 400, columnType: "left_door", zones: [{ id: "z1", height: interior, zoneType: "left_door" }] },
      { id: "col-2", width: 400, columnType: "drawer", zones: [{ id: "z2", height: interior, zoneType: "drawer" }] },
    ],
  }));

  // Right wall, doors into the room (−X).
  addBox("loungeGenerator", { x0: BOX.width - 600, y0: 900, z0: 0, W: 600, D: 2000, H: 420 }, { axis: "x", dir: -1 });

  // Ceiling, back wall, doors into the room (−Y).
  addBox("overheadCabinet", {
    x0: 200, y0: BOX.depth - (350 + door), z0: H - 400, W: 1200, D: 350 + door, H: 400,
  }, { axis: "y", dir: -1 });
  addBox("uShapeOverheadCabinet", {
    x0: 1600, y0: BOX.depth - 1200, z0: H - 400, W: 2000, D: 1200, H: 400,
  }, { axis: "y", dir: -1 });

  const cabinets = job.getJob().cabinets.map(inspect);
  const failed = cabinets.filter((c) => c.errors.length || !c.fits);
  log("qa.scene", {
    space: BOX,
    count: cabinets.length,
    failed: failed.map((c) => ({ id: c.id, moduleId: c.moduleId, fits: c.fits, errors: c.errors })),
    cabinets,
  });
  return { cabinets, failed };
}

/** One isolated cabinet per shot so a capture can fill the frame. */
export const QA_SHOTS = [
  { tag: "bedroom", moduleId: "bedroom" },
  { tag: "bedBox", moduleId: "bedBox" },
  { tag: "smallCabinet", moduleId: "smallCabinet" },
  { tag: "generalTallCabinet", moduleId: "generalTallCabinet" },
  { tag: "kitchenCabinet", moduleId: "kitchenCabinet" },
  { tag: "lounge-I", moduleId: "loungeGenerator", style: "I_SHAPE" },
  { tag: "lounge-L", moduleId: "loungeGenerator", style: "L_SHAPE" },
  { tag: "lounge-U", moduleId: "loungeGenerator", style: "U_SHAPE" },
  { tag: "lounge-P", moduleId: "loungeGenerator", style: "PARALLEL" },
  { tag: "overheadCabinet", moduleId: "overheadCabinet" },
  { tag: "uShapeOverheadCabinet", moduleId: "uShapeOverheadCabinet" },
  { tag: "bedSideTable", moduleId: "bedSideTable" },
];

export function buildQaModule(shot) {
  closeSpaceDialog();
  job.resetJob();
  job.defineSpace("box", { ...BOX });
  const door = fpt();
  let target;
  if (shot.moduleId === "bedroom") {
    target = job.addCabinet("bedroom", { x: BOX.width, y: 700, z: 0, rotZ: 180 }, { W: BOX.width, D: 700, H: 1965 });
  } else if (shot.moduleId === "bedBox") {
    job.addCabinet("bedroom", { x: BOX.width, y: 700, z: 0, rotZ: 180 }, { W: BOX.width, D: 700, H: 1965 });
    target = job.addCabinet("bedBox", { x: 0, y: 0, z: 0, rotZ: 180 }, { W: 1530, D: 1900, H: 420 });
  } else if (shot.moduleId === "smallCabinet") {
    target = addBox("smallCabinet", { x0: 200, y0: 200, z0: 0, W: 600, D: 560 + door, H: 720 }, { axis: "y", dir: -1 });
  } else if (shot.moduleId === "generalTallCabinet") {
    target = addBox("generalTallCabinet", { x0: 200, y0: 200, z0: 0, W: 600, D: 584 + door, H: 2000 }, { axis: "y", dir: -1 });
  } else if (shot.moduleId === "kitchenCabinet") {
    target = addBox("kitchenCabinet", { x0: 200, y0: 200, z0: 0, W: 1600, D: 560 + door, H: 720 }, { axis: "y", dir: -1 });
    const g = target.params.globalSettings || {};
    const interior = Math.round((Number(g.height || 720) - (Number(g.bottomClearanceHeight) || 100) - (Number(g.materialThickness) || 15)) * 10) / 10;
    job.setParams(target.id, withKitchenVPanelPrefs({
      ...target.params,
      columns: [
        { id: "col-1", width: 800, columnType: "left_door", zones: [{ id: "z1", height: interior, zoneType: "left_door" }] },
        { id: "col-2", width: 800, columnType: "drawer", zones: [{ id: "z2", height: interior, zoneType: "drawer" }] },
      ],
    }));
  } else if (shot.moduleId === "loungeGenerator" && shot.style === "U_SHAPE") {
    target = addBox("loungeGenerator", { x0: 200, y0: 200, z0: 0, W: 2000, D: 1200, H: 420 }, { axis: "y", dir: -1 });
    job.setParams(target.id, {
      ...target.params,
      style: "U_SHAPE",
      totalWidth: 2000,
      depth: 1200,
      mainDepth: 350,
    });
  } else if (shot.moduleId === "loungeGenerator" && shot.style === "L_SHAPE") {
    target = addBox("loungeGenerator", { x0: 200, y0: 200, z0: 0, W: 2000, D: 800, H: 420 }, { axis: "y", dir: -1 });
    job.setParams(target.id, {
      ...target.params,
      style: "L_SHAPE",
      mainWidth: 2000,
      mainDepth: 600,
      lWidth: 1600,
      lDepth: 800,
      lPosition: "RIGHT",
    });
  } else if (shot.moduleId === "loungeGenerator" && shot.style === "PARALLEL") {
    target = addBox("loungeGenerator", { x0: 200, y0: 200, z0: 0, W: 2000, D: 800, H: 420 }, { axis: "y", dir: -1 });
    job.setParams(target.id, {
      ...target.params,
      style: "PARALLEL",
      totalWidth: 2000,
      depth: 800,
      singleLoungeWidth: 600,
    });
  } else if (shot.moduleId === "loungeGenerator") {
    target = addBox("loungeGenerator", { x0: 200, y0: 200, z0: 0, W: 2000, D: 600, H: 420 }, { axis: "y", dir: -1 });
  } else if (shot.moduleId === "overheadCabinet") {
    target = addBox("overheadCabinet", {
      x0: 200, y0: BOX.depth - (350 + door), z0: BOX.height - 400, W: 1200, D: 350 + door, H: 400,
    }, { axis: "y", dir: -1 });
  } else if (shot.moduleId === "uShapeOverheadCabinet") {
    target = addBox("uShapeOverheadCabinet", {
      x0: 200, y0: BOX.depth - 1200, z0: BOX.height - 400, W: 2000, D: 1200, H: 400,
    }, { axis: "y", dir: -1 });
  } else if (shot.moduleId === "bedSideTable") {
    job.addCabinet("bedroom", { x: BOX.width, y: 700, z: 0, rotZ: 180 }, { W: BOX.width, D: 700, H: 1965 });
    job.addCabinet("bedBox", { x: 0, y: 0, z: 0, rotZ: 180 }, { W: 1530, D: 1900, H: 420 });
    target = job.addCabinet("bedSideTable", { x: 400, y: 1100, z: 0, rotZ: 180 }, { W: 280, D: 400, H: 420 });
  }
  if (target) job.select(target.id);
  const info = target ? inspect(job.getJob().cabinets.find((c) => c.id === target.id) || target) : null;
  log("qa.module", { tag: shot.tag, moduleId: shot.moduleId, style: shot.style, cabinet: info });
  return { shot, cabinet: info };
}

export function frameSelectedCabinet() {
  const cab = job.getSelected();
  if (!cab) return false;
  setView("3d");
  const env = envelopeBox(cab, job.resultFor(cab.id));
  const group = groupFor(cab.id);
  if (!group) return false;
  group.updateMatrixWorld(true);
  const center = new THREE.Vector3(
    (env.x0 + env.x1) / 2,
    (env.y0 + env.y1) / 2,
    (env.z0 + env.z1) / 2,
  ).applyMatrix4(group.matrixWorld);
  const radius = Math.hypot(env.W, env.D + env.fpt, env.H) / 2;
  const pad = getModule(cab.moduleId).volumeOnly ? 2.4 : 1;
  frame(center, radius * pad);
  return true;
}

