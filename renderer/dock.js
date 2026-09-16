// Dockable sub-windows. Parameters / Checks / Boards are panes; each pane sits
// in the left, right or bottom dock. Drag a tab onto another edge to move it
// there, click the active tab (or the arrow) to collapse the dock. The layout
// (dock per pane, sizes, collapsed state) is remembered in settings.json.
//
// Panes are moved, never rebuilt: `#rightpanel` and the `[data-dpane]` elements
// keep their identity, so panel.js writes into them wherever they are docked.
import { log } from "./log.js";
import { getSetting, setSetting } from "./settings.js";

const ZONES = ["left", "right", "bottom"];
const PANE_IDS = ["params", "checks", "boards"];
const SIDE_MIN = 200;
const SIDE_COLLAPSE_AT = 150;
const COLLAPSED_W = 30; // must match --dock-collapsed-w
const VIEWPORT_MIN = 260; // the 3D view never shrinks below this
const BOTTOM_MIN = 90;
const BOTTOM_COLLAPSE_AT = 70;
const DROP_STRIP = 200; // hint width for an empty side dock
const DROP_BAND = 180; // hint height for an empty bottom dock

const CARET = {
  left: { open: "◂", closed: "▸" },
  right: { open: "▸", closed: "◂" },
  bottom: { open: "▾", closed: "▴" },
};
const DROP_LABEL = { left: "Dock left", right: "Dock right", bottom: "Dock bottom" };

const defaults = () => ({
  zone: { params: "right", checks: "bottom", boards: "bottom" },
  active: { left: null, right: "params", bottom: "checks" },
  size: { left: 260, right: 280, bottom: 220 },
  collapsed: { left: false, right: false, bottom: true },
});

let state = defaults();
const labels = { params: "Parameters", checks: "Checks", boards: "Boards" };
const paneEl = {};
const docks = {};
const drops = {};
let dropRects = null;
let paramsWide = false;
let ready = false;

function load() {
  const raw = getSetting("layout.dock");
  if (!raw || typeof raw !== "object") return;
  const next = defaults();
  for (const id of PANE_IDS) if (ZONES.includes(raw.zone?.[id])) next.zone[id] = raw.zone[id];
  for (const z of ZONES) {
    if (Number.isFinite(raw.size?.[z])) next.size[z] = raw.size[z];
    if (typeof raw.collapsed?.[z] === "boolean") next.collapsed[z] = raw.collapsed[z];
    next.active[z] = PANE_IDS.includes(raw.active?.[z]) ? raw.active[z] : null;
  }
  state = next;
}

function save() {
  setSetting("layout.dock", state);
}

function panesIn(zone) {
  return PANE_IDS.filter((id) => state.zone[id] === zone);
}

function clampSize(zone, v) {
  if (zone === "bottom") {
    const h = document.getElementById("center")?.getBoundingClientRect().height || 600;
    const max = Math.max(BOTTOM_MIN, Math.round(h * 0.55));
    return Math.max(BOTTOM_MIN, Math.min(max, Math.round(v)));
  }
  const other = zone === "left" ? "right" : "left";
  const otherW = panesIn(other).length ? (state.collapsed[other] ? COLLAPSED_W : state.size[other]) : 0;
  const rail = document.getElementById("leftrail")?.getBoundingClientRect().width || 148;
  const max = Math.max(SIDE_MIN, Math.round(window.innerWidth - rail - otherW - VIEWPORT_MIN));
  return Math.max(SIDE_MIN, Math.min(max, Math.round(v)));
}

function applySize(zone) {
  const v = clampSize(zone, state.size[zone]);
  state.size[zone] = v;
  const prop = zone === "bottom" ? "--dock-bottom-h" : `--dock-${zone}-w`;
  document.documentElement.style.setProperty(prop, `${v}px`);
}

function render() {
  if (!ready) return;
  for (const zone of ZONES) {
    const dock = docks[zone];
    const ids = panesIn(zone);
    if (!ids.length) state.active[zone] = null;
    else if (!ids.includes(state.active[zone])) state.active[zone] = ids[0];
    for (const id of ids) {
      if (paneEl[id].parentElement !== dock.body) dock.body.append(paneEl[id]);
      paneEl[id].classList.toggle("active", id === state.active[zone]);
    }
    dock.root.classList.toggle("empty", ids.length === 0);
    dock.root.classList.toggle("collapsed", ids.length > 0 && !!state.collapsed[zone]);
    dock.root.classList.toggle("wide", zone !== "bottom" && paramsWide && state.active[zone] === "params");
    renderTabs(zone, ids);
    applySize(zone);
  }
}

function renderTabs(zone, ids) {
  const dock = docks[zone];
  dock.tablist.replaceChildren(...ids.map((id) => {
    const btn = document.createElement("button");
    btn.className = `dtab${id === state.active[zone] ? " active" : ""}`;
    btn.dataset.pane = id;
    btn.textContent = labels[id];
    btn.title = `${labels[id]} — click to show, click again to collapse · drag onto another edge to dock it left / right / bottom`;
    bindTab(btn, id, zone);
    return btn;
  }));
  dock.toggle.textContent = CARET[zone][state.collapsed[zone] ? "closed" : "open"];
}

function activate(zone, id) {
  state.active[zone] = id;
  state.collapsed[zone] = false;
  save();
  render();
  log("dock.tab", { zone, pane: id });
}

function setCollapsed(zone, collapsed) {
  if (state.collapsed[zone] === collapsed) return;
  state.collapsed[zone] = collapsed;
  save();
  render();
  log("dock.collapse", { zone, collapsed, pane: state.active[zone] });
}

function movePane(id, zone) {
  const from = state.zone[id];
  if (from === zone) return;
  state.zone[id] = zone;
  state.active[zone] = id;
  state.collapsed[zone] = false;
  if (state.active[from] === id) state.active[from] = panesIn(from)[0] || null;
  save();
  render();
  log("dock.move", { pane: id, from, to: zone });
}

function measureDrops() {
  const center = document.getElementById("center").getBoundingClientRect();
  const rect = (zone) => {
    const dock = docks[zone];
    const thin = dock.root.classList.contains("empty") || state.collapsed[zone];
    const r = thin ? null : dock.root.getBoundingClientRect();
    if (zone === "bottom") {
      return r
        ? { x0: center.left, x1: center.right, y0: r.top, y1: r.bottom }
        : { x0: center.left, x1: center.right, y0: Math.max(center.top, center.bottom - DROP_BAND), y1: center.bottom };
    }
    if (r) return { x0: r.left, x1: r.right, y0: r.top, y1: r.bottom };
    return zone === "left"
      ? { x0: center.left, x1: center.left + DROP_STRIP, y0: center.top, y1: center.bottom }
      : { x0: center.right - DROP_STRIP, x1: center.right, y0: center.top, y1: center.bottom };
  };
  return { left: rect("left"), right: rect("right"), bottom: rect("bottom") };
}

function beginDrop(from) {
  dropRects = measureDrops();
  for (const zone of ZONES) {
    const r = dropRects[zone];
    const el = drops[zone];
    el.style.left = `${r.x0}px`;
    el.style.top = `${r.y0}px`;
    el.style.width = `${r.x1 - r.x0}px`;
    el.style.height = `${r.y1 - r.y0}px`;
    el.classList.toggle("here", zone === from);
    el.classList.remove("on");
  }
  document.getElementById("dockDrops").classList.remove("hidden");
}

function hitDrop(x, y) {
  if (!dropRects) return null;
  for (const zone of ZONES) {
    const r = dropRects[zone];
    if (x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1) return zone;
  }
  return null;
}

function paintDrop(target) {
  for (const zone of ZONES) drops[zone].classList.toggle("on", zone === target);
}

function endDrop() {
  dropRects = null;
  document.getElementById("dockDrops").classList.add("hidden");
}

function bindTab(btn, id, zone) {
  btn.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const x0 = e.clientX;
    const y0 = e.clientY;
    let dragging = false;
    let target = null;
    try { btn.setPointerCapture(e.pointerId); } catch (_) { /* synthetic pointer */ }
    const move = (ev) => {
      if (!dragging && Math.abs(ev.clientX - x0) < 5 && Math.abs(ev.clientY - y0) < 5) return;
      if (!dragging) {
        dragging = true;
        btn.classList.add("dragging");
        beginDrop(zone);
      }
      target = hitDrop(ev.clientX, ev.clientY);
      paintDrop(target);
    };
    const end = (ev) => {
      btn.removeEventListener("pointermove", move);
      btn.removeEventListener("pointerup", end);
      btn.removeEventListener("pointercancel", end);
      try { btn.releasePointerCapture(ev.pointerId); } catch (_) { /* released */ }
      btn.classList.remove("dragging");
      if (!dragging) {
        if (state.active[zone] === id && !state.collapsed[zone]) setCollapsed(zone, true);
        else activate(zone, id);
        return;
      }
      endDrop();
      if (ev.type === "pointercancel" || !target || target === zone) {
        if (state.active[zone] !== id) activate(zone, id);
        return;
      }
      movePane(id, target);
    };
    btn.addEventListener("pointermove", move);
    btn.addEventListener("pointerup", end);
    btn.addEventListener("pointercancel", end);
  });
}

function bindResize(zone) {
  const dock = docks[zone];
  const handle = dock.resize;
  handle.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const bottom = zone === "bottom";
    const start = bottom ? e.clientY : e.clientX;
    const was = state.collapsed[zone];
    const size0 = was
      ? clampSize(zone, state.size[zone])
      : (bottom ? dock.root.getBoundingClientRect().height : dock.root.getBoundingClientRect().width);
    state.collapsed[zone] = false;
    dock.root.classList.remove("collapsed");
    dock.root.classList.add("resizing");
    try { handle.setPointerCapture(e.pointerId); } catch (_) { /* synthetic pointer */ }
    const collapseAt = bottom ? BOTTOM_COLLAPSE_AT : SIDE_COLLAPSE_AT;
    const move = (ev) => {
      const pos = bottom ? ev.clientY : ev.clientX;
      const delta = zone === "left" ? pos - start : start - pos;
      const next = size0 + delta;
      if (next < collapseAt) {
        dock.root.classList.add("collapsed");
      } else {
        dock.root.classList.remove("collapsed");
        state.size[zone] = next;
        applySize(zone);
      }
    };
    const end = (ev) => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", end);
      handle.removeEventListener("pointercancel", end);
      try { handle.releasePointerCapture(ev.pointerId); } catch (_) { /* released */ }
      dock.root.classList.remove("resizing");
      state.collapsed[zone] = dock.root.classList.contains("collapsed");
      save();
      render();
      log("dock.resize", { zone, size: state.size[zone], collapsed: state.collapsed[zone] });
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", end);
    handle.addEventListener("pointercancel", end);
  });
  handle.addEventListener("dblclick", () => setCollapsed(zone, !state.collapsed[zone]));
}

/** Show a pane wherever it is docked (used when a board is picked in 3D). */
export function revealPane(id) {
  if (!ready) return;
  const zone = state.zone[id];
  if (!zone) return;
  state.active[zone] = id;
  state.collapsed[zone] = false;
  save();
  render();
}

/** Tab text, e.g. "Boards (34)". */
export function setPaneLabel(id, text) {
  labels[id] = text;
  if (!ready) return;
  for (const zone of ZONES) {
    const btn = docks[zone].tablist.querySelector(`[data-pane="${id}"]`);
    if (btn) btn.textContent = text;
  }
}

/** Geometry editors need a wider Parameters pane; ignored in the bottom dock. */
export function setParamsWide(on) {
  if (paramsWide === !!on) return;
  paramsWide = !!on;
  if (!ready) return;
  for (const zone of ZONES) {
    docks[zone].root.classList.toggle("wide", zone !== "bottom" && paramsWide && state.active[zone] === "params");
  }
}

/** Wire docks after settings.json is in memory. */
export function initDock() {
  if (ready) return;
  for (const zone of ZONES) {
    const root = document.getElementById(`dock-${zone}`);
    docks[zone] = {
      root,
      tablist: root.querySelector(".dock-tablist"),
      toggle: root.querySelector("[data-collapse]"),
      body: root.querySelector(".dock-body"),
      resize: root.querySelector(".dock-resize"),
    };
    docks[zone].toggle.addEventListener("click", () => setCollapsed(zone, !state.collapsed[zone]));
    bindResize(zone);
    drops[zone] = document.querySelector(`.dock-drop[data-zone="${zone}"]`);
    drops[zone].textContent = DROP_LABEL[zone];
  }
  for (const id of PANE_IDS) paneEl[id] = document.querySelector(`.pane[data-pane="${id}"]`);
  ready = true;
  load();
  render();
  window.addEventListener("resize", () => {
    for (const zone of ZONES) applySize(zone);
  });
}
