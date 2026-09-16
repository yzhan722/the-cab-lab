// Shell wiring: top bar, module rail, docks, status bar, file actions.
import { setView, drawSpace, floorPointAt, canvas, captureViewportViews, setQaCamera } from "./space.js";
import { initDock } from "./dock.js";
import * as job from "./job.js";
import { MODULES, MODULE_GROUPS, PLANNED_MODULES } from "./modules.js";
import { syncCabinets, syncPlanes } from "./cabinets3d.js";
import { armPlacement, disarm, onModeChange, getPlacingModule, getLoungeStyle, getMode, startMove, startOrient, startPlane } from "./interact.js";
import { renderPanel } from "./panel.js";
import { openSpaceDialog, isOpen as spaceDialogOpen } from "./spaceDialog.js";
import { loadSettings } from "./settings.js";
import { log, attachJob } from "./log.js";
import { buildQaScene, buildQaModule, QA_SHOTS, frameSelectedCabinet } from "./qaScene.js";

attachJob(job);

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

// --- module rail ---------------------------------------------------------------
const list = $("#moduleList");
const rail = $("#leftrail");
const grouped = new Set(MODULE_GROUPS.flatMap((g) => g.items.map((i) => i.moduleId).filter(Boolean)));

function moduleButton(mod, label = mod.label, sub = mod.sub, extras = {}) {
  const btn = document.createElement("button");
  btn.className = "rail-item";
  btn.dataset.module = mod.id;
  if (extras.style) btn.dataset.style = extras.style;
  if (mod.requires) btn.dataset.requires = mod.requires;
  btn.innerHTML = `<span class="rail-name"></span><span class="rail-sub"></span>`;
  $(".rail-name", btn).textContent = label;
  $(".rail-sub", btn).textContent = sub;
  btn.addEventListener("click", () => {
    const same = getPlacingModule() === mod.id && (!extras.style || getLoungeStyle() === extras.style);
    if (same) { disarm(); return; }
    const sel = job.getSelected();
    if (extras.style && sel && sel.moduleId === mod.id && getPlacingModule() !== mod.id) {
      if ((sel.params.style || "I") !== extras.style) {
        job.setParams(sel.id, mod.restyle(sel.params, extras.style));
        log("lounge.style", { id: sel.id, style: extras.style, n: (sel.params.path || []).length });
        return;
      }
    }
    armPlacement(mod.id, extras);
  });
  return btn;
}
function plannedButton(label, sub) {
  const btn = document.createElement("button");
  btn.className = "rail-item";
  btn.disabled = true;
  btn.title = "Not wired yet";
  btn.innerHTML = `<span class="rail-name"></span><span class="rail-sub"></span>`;
  $(".rail-name", btn).textContent = label;
  $(".rail-sub", btn).textContent = sub;
  return btn;
}

for (const mod of Object.values(MODULES)) {
  if (!grouped.has(mod.id)) list.append(moduleButton(mod));
}

// Groups: one rail entry; hovering it opens a flyout of sub-modules beside the rail.
let openFlyout = null;
function closeFlyout() {
  if (!openFlyout) return;
  openFlyout.classList.add("hidden");
  openFlyout.parentElement.classList.remove("open");
  openFlyout = null;
}
for (const group of MODULE_GROUPS) {
  const wrap = document.createElement("div");
  wrap.className = "rail-group";
  wrap.dataset.group = group.id;
  const head = document.createElement("button");
  head.className = "rail-item rail-group-head";
  head.dataset.group = group.id;
  head.innerHTML = `<span class="rail-name"></span><span class="rail-sub"></span><span class="rail-caret">›</span>`;
  $(".rail-name", head).textContent = group.label;
  $(".rail-sub", head).textContent = group.sub;
  const fly = document.createElement("div");
  fly.className = "rail-flyout hidden";
  fly.append(Object.assign(document.createElement("div"), { className: "rail-title", textContent: group.label }));
  for (const item of group.items) {
    if (item.moduleId && MODULES[item.moduleId]) fly.append(moduleButton(MODULES[item.moduleId], item.label, item.sub, item.style ? { style: item.style } : {}));
    else fly.append(plannedButton(item.label, item.sub));
  }
  const open = () => {
    if (openFlyout && openFlyout !== fly) closeFlyout();
    const r = head.getBoundingClientRect();
    const rr = rail.getBoundingClientRect();
    fly.style.left = `${rr.right}px`;
    fly.style.top = `${r.top}px`;
    fly.classList.remove("hidden");
    wrap.classList.add("open");
    openFlyout = fly;
    log("rail.group.open", { group: group.id });
  };
  wrap.addEventListener("mouseenter", open);
  wrap.addEventListener("mouseleave", closeFlyout);
  head.addEventListener("click", () => (openFlyout === fly ? closeFlyout() : open()));
  wrap.append(head, fly);
  list.append(wrap);
}
window.addEventListener("resize", closeFlyout);
rail.addEventListener("scroll", closeFlyout);
for (const mod of PLANNED_MODULES) list.append(plannedButton(mod.label, mod.sub));
$("[data-space]").addEventListener("click", () => {
  disarm();
  job.select(null);
});

function refreshRail() {
  const placing = getPlacingModule();
  const sel = job.getSelected();
  $$("#leftrail .rail-item").forEach((b) => {
    if (b.dataset.requires) {
      // Attached modules wait for the cabinet they attach to (Bed Box needs the Bedroom body).
      const has = job.getJob().cabinets.some((c) => c.moduleId === b.dataset.requires);
      b.disabled = !has;
      b.title = has ? "" : `Place the ${MODULES[b.dataset.requires].label} body first`;
    }
    if (b.dataset.group) {
      const group = MODULE_GROUPS.find((g) => g.id === b.dataset.group);
      b.classList.toggle("active", !!placing && group.items.some((i) => i.moduleId === placing));
      return;
    }
    const styleOn = !b.dataset.style || b.dataset.style === (getLoungeStyle() || job.getSelected()?.params?.style || "");
    b.classList.toggle("active", b.dataset.module ? b.dataset.module === placing && styleOn : (!placing && !sel && b.hasAttribute("data-space")));
  });
  const mode = getMode();
  const HINTS = {
    armed: placing
      ? MODULES[placing].placement === "ceiling"
        ? `Placing ${MODULES[placing].label} — click anywhere on a ceiling edge (where a wall meets the ceiling) · W runs along that wall · draw on the ceiling, the wall or a side face · Esc to stop`
        : `Placing ${MODULES[placing].label} — click a point on the floor to start · Shift+click repeats the last size · digits re-size the last box · Esc to stop`
      : "",
    face: "Draw the rectangle on this face · Tab / digits type its two sizes · click the opposite corner · Enter creates with the preset depth",
    extrude: "Pull the rectangle off the face (one way only) · snaps to faces and corners · click or Enter to create · Esc to restart",
    "move.grab": "Move — click the point to grab (a corner of the cabinet works best) · Esc to cancel",
    "move.drop": "Move — click the target point · Tab types ΔX ΔY ΔZ · Ctrl+click copies · Esc to cancel",
    "orient.pick": "Face — click a side of the cabinet; its doors will face that way · Esc to cancel",
    "orient.pending": "Face — orange side is pending · click another side to change · click elsewhere or Enter to confirm · Esc restores",
    "nose.ready": "Bedroom fills the nose at the preset depth — click to drag its room-side face · Enter takes it as shown · digits type the depth · Esc cancels",
    "nose.drag": "Drag the room-side face along the van · snaps to roof breaks, the seam and cabinet faces · type “From front” · click or Enter to create · Esc cancels",
    "bedbox.width": "Bed Box — width: move sideways, the line grows symmetrically from the centre line · type W · click or Enter to lock · Esc cancels",
    "bedbox.depth": "Bed Box — length: pull into the room from the body face · snaps to cabinet faces · type D · click or Enter to create · Esc cancels",
    "bedside.width": "Bed Side Table — move to a side wall; width grows from that wall · type W · click or Enter to lock · Esc cancels",
    "bedside.depth": "Bed Side Table — length: pull into the room from the body face · type D · click or Enter to create · Esc cancels",
    "lounge.path": "Lounge — click the back edge on the floor · I two clicks, L three, U four, Parallel three (opposite run) · Enter pads missing points and pulls depth · Shift keeps the next vertex on axis · Esc cancels",
    "lounge.depth": "Lounge — pull the seat toward the room · type D · click or Enter to create · Esc cancels",
    "plane.pick": "Plane — click a wall or a cabinet face to offset from · Esc cancels",
    "plane.offset": "Plane — pull a parallel copy into the room · type Offset · snaps to faces · click or Enter to place · Esc cancels",
    "view.orbit": "Orbit — release to stop",
  };
  $("#modeHint").textContent = HINTS[mode] || "";
}

// --- view buttons ---------------------------------------------------------------
$$("#viewGroup [data-view]").forEach((btn) => {
  btn.addEventListener("click", () => {
    $$("#viewGroup [data-view]").forEach((b) => b.classList.toggle("active", b === btn));
    setView(btn.dataset.view);
    log("view", { view: btn.dataset.view });
    $("#viewLabel").textContent = btn.textContent;
  });
});

// --- status bar -------------------------------------------------------------------
const stCursor = $("#stCursor");
canvas.addEventListener("pointermove", (e) => {
  const p = floorPointAt(e.clientX, e.clientY);
  stCursor.textContent = p ? `X ${Math.round(p.x)}  Y ${Math.round(p.y)}` : "X — Y —";
});
canvas.addEventListener("pointerleave", () => { stCursor.textContent = "X — Y —"; });

function refreshStatus() {
  const sel = job.getSelected();
  $("#stSelection").textContent = sel ? `Selection: ${sel.id} (${MODULES[sel.moduleId].label})` : "Selection: —";
  const path = job.getFilePath();
  const name = path ? path.split(/[\\/]/).pop() : "Untitled";
  $("#stFile").textContent = job.isDirty() ? `${name} · unsaved` : name;
  document.title = `${job.isDirty() ? "• " : ""}${name} — The Cab Lab`;
  $('[data-action="undo"]').disabled = !job.canUndo();
  $('[data-action="redo"]').disabled = !job.canRedo();
  $('[data-action="move"]').disabled = !sel;
  $('[data-action="move"]').classList.toggle("active", getMode().startsWith("move"));
  // Face: not for modules with a fixed door side (an overhead's doors always face the room).
  const orientable = job.getJob().cabinets.some((c) => !MODULES[c.moduleId].noOrient);
  $('[data-action="orient"]').disabled = sel ? !!MODULES[sel.moduleId].noOrient : !orientable;
  $('[data-action="orient"]').title = sel && MODULES[sel.moduleId].noOrient
    ? `Face — ${MODULES[sel.moduleId].label} has one door side (toward the room)`
    : "Face (O) — click a side; doors face that way · Enter confirms · Esc restores";
  $('[data-action="orient"]').classList.toggle("active", getMode().startsWith("orient"));
  $('[data-action="plane"]').disabled = !job.hasSpace();
  $('[data-action="plane"]').classList.toggle("active", getMode().startsWith("plane"));
  const pl = job.getSelectedPlane();
  if (pl) $("#stSelection").textContent = `Selection: ${pl.id} (Plane)`;
}

// --- file actions -------------------------------------------------------------------
const bridge = window.cablab || null;

async function doNew() {
  if (job.isDirty() && !window.confirm("Discard unsaved changes?")) return;
  disarm();
  job.resetJob();
  openSpaceDialog();
}
async function doOpen() {
  if (!bridge) return console.warn("[ui] file bridge unavailable");
  if (job.isDirty() && !window.confirm("Discard unsaved changes?")) return;
  const res = await bridge.openJob();
  if (!res) return;
  try {
    job.loadJob(JSON.parse(res.text), res.path);
  } catch (err) {
    log("file.open.failed", { path: res.path, message: err.message });
    window.alert(`Could not open: ${err.message}`);
  }
}
async function doSave(forceDialog = false) {
  if (!bridge) return console.warn("[ui] file bridge unavailable");
  const path = await bridge.saveJob(forceDialog ? null : job.getFilePath(), job.serialize());
  if (path) job.markSaved(path);
}

async function captureViews(opts = {}) {
  if (!bridge || !bridge.logCapture) return;
  const cap = captureViewportViews();
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const space = job.getSpace();
  const j = job.getJob();
  try {
    const res = await bridge.logCapture({
      stamp,
      images: cap.images,
      subdir: opts.subdir,
      latest: opts.latest,
    });
    log("view.capture", {
      ok: !!(res && res.ok),
      dir: res && res.dir,
      latestDir: res && res.latestDir,
      files: res && res.files,
      subdir: opts.subdir || null,
      pixels: { w: cap.width, h: cap.height },
      camera: cap.camera,
      view: $("#viewGroup .active")?.dataset.view || "3d",
      selected: job.getSelectedId(),
      cabinets: (j.cabinets || []).map((c) => ({ id: c.id, moduleId: c.moduleId })),
      space: space
        ? {
          kind: job.getJob().space?.kind,
          W: Math.round(space.bounds.maxX - space.bounds.minX),
          D: Math.round(space.bounds.maxY - space.bounds.minY),
          H: Math.round(space.height),
        }
        : null,
    });
    if (opts.hint !== false) {
      const hint = $("#modeHint");
      if (hint) {
        hint.textContent = res && res.ok
          ? "Views saved — Ctrl+Shift+L opens the log folder"
          : "View capture wrote no images";
        setTimeout(() => refreshRail(), 2500);
      }
    }
  } catch (err) {
    log("view.capture", { ok: false, error: err && err.message });
  }
}

function waitFrames(n = 2) {
  return new Promise((resolve) => {
    const step = (left) => (left <= 0 ? resolve() : requestAnimationFrame(() => step(left - 1)));
    step(n);
  });
}

async function runQaSceneAndCapture() {
  const n = (job.getJob().cabinets || []).length;
  if (n && !window.confirm("Replace this job with a QA layout of every module?")) return;
  disarm();
  const report = buildQaScene();
  setQaCamera();
  await waitFrames(2);
  await captureViews({ hint: false });
  const isolated = [];
  for (const shot of QA_SHOTS) {
    const one = buildQaModule(shot);
    await waitFrames(2);
    frameSelectedCabinet();
    await waitFrames(1);
    await captureViews({ subdir: `qa/${shot.tag}`, latest: false, hint: false });
    isolated.push({ tag: shot.tag, ...(one.cabinet || {}) });
  }
  buildQaScene();
  setQaCamera();
  const failed = [
    ...report.failed,
    ...isolated.filter((c) => c && (c.errors?.length || !c.fits)),
  ];
  log("qa.visual", { overviewFailed: report.failed, isolated: isolated.map((c) => c && ({ tag: c.tag, moduleId: c.moduleId, boards: c.boards, fits: c.fits, errors: c.errors })) });
  const hint = $("#modeHint");
  if (hint) {
    hint.textContent = failed.length
      ? `QA: ${failed.length} issue(s) — per-module shots in logs/qa/`
      : "QA: all modules captured — logs/qa/";
    setTimeout(() => refreshRail(), 4000);
  }
}

const ACTIONS = {
  new: doNew,
  open: doOpen,
  save: () => doSave(false),
  undo: () => job.undo(),
  redo: () => job.redo(),
  move: () => startMove(),
  orient: () => startOrient(),
  plane: () => startPlane(),
  capture: () => captureViews(),
  qa: () => runQaSceneAndCapture(),
};
$$("[data-action]").forEach((btn) => {
  btn.addEventListener("click", () => ACTIONS[btn.dataset.action]?.());
});

window.addEventListener("keydown", (e) => {
  if (!e.ctrlKey) return;
  const k = e.key.toLowerCase();
  const inField = e.target && /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName);
  if (k === "p" && e.shiftKey) { e.preventDefault(); captureViews(); return; }
  if ((k === "q" || k === "g") && e.shiftKey) { e.preventDefault(); runQaSceneAndCapture(); return; }
  if (spaceDialogOpen()) return;
  if (k === "l" && e.shiftKey) { e.preventDefault(); log("logs.open"); bridge?.openLogs?.(); }
  else if (k === "n") { e.preventDefault(); doNew(); }
  else if (k === "o") { e.preventDefault(); doOpen(); }
  else if (k === "s") { e.preventDefault(); doSave(e.shiftKey); }
  else if (k === "z" && !inField) { e.preventDefault(); job.undo(); }
  else if (k === "y" && !inField) { e.preventDefault(); job.redo(); }
});

// --- sync --------------------------------------------------------------------------
let panelPending = false;
const rightpanel = $("#rightpanel");
function maybeRenderPanel() {
  if (rightpanel.contains(document.activeElement)) {
    panelPending = true;
    return;
  }
  panelPending = false;
  renderPanel();
}
rightpanel.addEventListener("focusout", () => {
  // Wait for focus to settle, then re-render if a job change was skipped.
  setTimeout(() => { if (panelPending && !rightpanel.contains(document.activeElement)) maybeRenderPanel(); }, 0);
});

let lastSpace = undefined;
function refreshAll() {
  const resolved = job.getSpace();
  if (resolved !== lastSpace) {
    const firstDefinition = !lastSpace && resolved;
    lastSpace = resolved;
    drawSpace(resolved);
    if (firstDefinition) setView($("#viewGroup .active")?.dataset.view || "3d");
  }
  $("#emptyState").classList.toggle("hidden", job.hasSpace());
  $$("#moduleList .rail-item[data-module]").forEach((b) => { b.disabled = !job.hasSpace(); });
  syncCabinets();
  syncPlanes();
  maybeRenderPanel();
  refreshRail();
  refreshStatus();
}

$("[data-define-space]").addEventListener("click", () => openSpaceDialog());

job.onChange(refreshAll);
onModeChange(() => { refreshRail(); refreshStatus(); });
// User defaults (settings.json) must be in memory before docks restore and
// the dialog offers them.
await loadSettings();
initDock();
refreshAll();
setView("3d");
if (!job.hasSpace()) openSpaceDialog();
