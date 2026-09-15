// Fusion-style 2D geometry view: display generator params as a schematic
// and write simple edits (select a cell, drag a boundary) back into params.
import { getModule, MIN_ZONE_HEIGHT, MIN_ZONE_WIDTH } from "./modules.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const round1 = (v) => Math.round(v * 10) / 10;

const FILLS = {
  drawer: "#dce8f8",
  left_door: "#c9dcf5",
  right_door: "#c9dcf5",
  double_door: "#b7d0f0",
  side_door: "#c9dcf5",
  left_side_door: "#c9dcf5",
  right_side_door: "#c9dcf5",
  up_flap: "#e5f2ff",
  top_flap: "#e5f2ff",
  down_flap: "#e5f2ff",
  bottom_flap: "#e5f2ff",
  fixed_panel: "#eef8ea",
  blank_panel: "#eef8ea",
  open: "#fff7dc",
  open_space: "#fff7dc",
  open_appliance: "#fff7dc",
  fridge: "#f3e8ff",
  stove: "#fde8d8",
  custom: "#eee",
  system: "#f4f0e6",
};

function typeFill(type) {
  return FILLS[type] || "#e5f2ff";
}

function svgEl(tag, attrs = {}, children = []) {
  const e = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    e.setAttribute(k, String(v));
  }
  for (const c of children) if (c) e.append(c);
  return e;
}

function shortType(mod, type) {
  const t = (mod.zoneTypes || []).find((z) => z.id === type);
  return t ? t.short || t.label : type;
}

export function usesGeometryPanel(mod) {
  return mod.panel === "ohc" || mod.panel === "uohc" || mod.panel === "kitchen"
    || mod.panel === "lounge" || mod.panel === "tall" || mod.id === "smallCabinet";
}

function selKey(sel) {
  if (sel == null) return "";
  if (typeof sel === "string" || typeof sel === "number") return String(sel);
  return JSON.stringify(sel);
}

function cellSelected(cell, sel) {
  return selKey(cell.sel) === selKey(sel);
}

/** Front / plan schematic from millimetre cells (y0 at the bottom). */
export function schematicView(spec, handlers = {}) {
  const wrap = document.createElement("div");
  wrap.className = "sch-view";
  const svg = svgEl("svg", { viewBox: "0 0 100 100", role: "img", "aria-label": spec.title || "Geometry" });
  wrap.append(svg);
  let layout = { ox: 0, oy: 0, scale: 1, heightMm: 1, viewW: 100, viewH: 100 };

  function layoutOf(s) {
    const pad = 28;
    const wMm = Math.max(s.widthMm || 1, 1);
    const hMm = Math.max(s.heightMm || 1, 1);
    const viewW = 520;
    const viewH = Math.max(160, Math.round(520 * (hMm / wMm)));
    const scale = Math.min((viewW - pad * 2) / wMm, (viewH - pad * 2) / hMm);
    const bodyW = wMm * scale;
    const bodyH = hMm * scale;
    const ox = (viewW - bodyW) / 2;
    const oy = (viewH - bodyH) / 2;
    return { ox, oy, scale, heightMm: hMm, viewW, viewH, pad };
  }
  const xOf = (mm) => layout.ox + mm * layout.scale;
  const yOf = (mm) => layout.oy + (layout.heightMm - mm) * layout.scale;

  function paint(s, { live } = {}) {
    spec = s;
    layout = layoutOf(s);
    svg.setAttribute("viewBox", `0 0 ${layout.viewW} ${layout.viewH}`);
    if (!live) svg.replaceChildren();
    if (!live) {
      svg.append(svgEl("rect", { x: 0, y: 0, width: layout.viewW, height: layout.viewH, class: "sch-bg" }));
    }
    const cellLayer = live ? svg.querySelector(".sch-cells") : svgEl("g", { class: "sch-cells" });
    if (live && !cellLayer) {
      paint(s, { live: false });
      return;
    }
    if (!live) svg.append(cellLayer);
    cellLayer.replaceChildren();
    for (const c of s.cells || []) {
      const x = xOf(c.x0);
      const y = yOf(c.y1);
      const w = Math.max((c.x1 - c.x0) * layout.scale, 1);
      const h = Math.max((c.y1 - c.y0) * layout.scale, 1);
      const sel = cellSelected(c, s.selected);
      const g = svgEl("g", { class: `sch-cell${sel ? " sel" : ""}${c.mute ? " mute" : ""}`, "data-sel": selKey(c.sel) });
      g.append(svgEl("rect", {
        x, y, width: w, height: h,
        fill: c.fill || typeFill(c.type),
        stroke: sel ? "#0f6bff" : "#9db6d5",
        "stroke-width": sel ? 2 : 1,
      }));
      if (c.label && w > 28 && h > 16) {
        g.append(svgEl("text", {
          x: x + w / 2, y: y + h / 2 - (c.sub ? 4 : 0),
          "text-anchor": "middle", class: "sch-label",
        }, []));
        g.lastChild.textContent = c.label;
        if (c.sub && h > 28) {
          g.append(svgEl("text", {
            x: x + w / 2, y: y + h / 2 + 12,
            "text-anchor": "middle", class: "sch-sub",
          }, []));
          g.lastChild.textContent = c.sub;
        }
      }
      if (!c.mute && c.sel != null) {
        g.style.cursor = "pointer";
        g.addEventListener("click", (ev) => {
          ev.stopPropagation();
          handlers.onSelect?.(c.sel, ev);
        });
      }
      cellLayer.append(g);
    }
    if (live) return;
    const gripLayer = svgEl("g", { class: "sch-grips" });
    for (const g of s.grips || []) {
      const vertical = g.axis === "x";
      const x = vertical ? xOf(g.pos) - 4 : xOf(g.span0);
      const y = vertical ? yOf(g.span1) : yOf(g.pos) - 4;
      const w = vertical ? 8 : Math.max((g.span1 - g.span0) * layout.scale, 8);
      const h = vertical ? Math.max((g.span1 - g.span0) * layout.scale, 8) : 8;
      const hit = svgEl("rect", {
        class: `sch-grip axis-${g.axis}`,
        x, y, width: w, height: h,
        fill: "rgba(0,0,0,0)",
      });
      hit.style.cursor = vertical ? "ew-resize" : "ns-resize";
      bindGrip(hit, g);
      gripLayer.append(hit);
    }
    svg.append(gripLayer);
  }

  function bindGrip(el, grip) {
    el.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      try { el.setPointerCapture(e.pointerId); } catch (_) { /* */ }
      handlers.onDragStart?.(grip);
      const move = (ev) => {
        const pos = mmFromEvent(ev, grip.axis);
        handlers.onDrag?.(grip, pos, ev);
      };
      const end = (ev) => {
        el.removeEventListener("pointermove", move);
        el.removeEventListener("pointerup", end);
        el.removeEventListener("pointercancel", end);
        try { el.releasePointerCapture(ev.pointerId); } catch (_) { /* */ }
        handlers.onDragEnd?.(grip, ev);
      };
      el.addEventListener("pointermove", move);
      el.addEventListener("pointerup", end);
      el.addEventListener("pointercancel", end);
    });
  }

  function mmFromEvent(ev, axis) {
    const r = svg.getBoundingClientRect();
    const sx = ((ev.clientX - r.left) / r.width) * layout.viewW;
    const sy = ((ev.clientY - r.top) / r.height) * layout.viewH;
    if (axis === "x") return (sx - layout.ox) / layout.scale;
    return layout.heightMm - (sy - layout.oy) / layout.scale;
  }

  paint(spec);
  return {
    el: wrap,
    update(next) { paint(next, { live: true }); },
  };
}

export function applySchematicGrip(cab, result, grip, pos) {
  const mod = getModule(cab.moduleId);
  const p = cab.params;
  if (grip.kind === "divider") return mod.setDivider(p, result, grip.index, pos);
  if (grip.kind === "kzone") return mod.setColumnZoneDivider(p, grip.col, grip.index, pos);
  if (grip.kind === "uohc") {
    const run = result?.layout?.run || p.cabinetDepth || 0;
    const env = mod.envelope(p);
    let along = pos;
    if (grip.run === "backZones") along = pos - run;
    else if (grip.run === "rightZones") along = env.D - pos;
    return mod.setRunDivider(p, grip.run, grip.index, along);
  }
  if (grip.kind === "loungeL") {
    const x = Math.round(pos);
    if ((p.lPosition || "RIGHT") === "LEFT") {
      return { ...p, lWidth: Math.max(400, Math.min((p.mainWidth || 0) - 200, x)) };
    }
    return { ...p, lWidth: Math.max(400, Math.min((p.mainWidth || 0) - 200, round1((p.mainWidth || 0) - x))) };
  }
  if (grip.kind === "loungeP") {
    const w = Math.max(400, Math.min(((p.totalWidth || 0) - 100) / 2, Math.round(pos)));
    return { ...p, singleLoungeWidth: w };
  }
  if (grip.kind === "uLoungeRun") {
    return { ...p, mainDepth: Math.max(200, Math.round(pos)) };
  }
  return p;
}

export function schematicSpec(cab, mod, result, selected) {
  if (mod.panel === "ohc") return ohcSpec(cab, mod, result, selected);
  if (mod.panel === "tall" || mod.id === "smallCabinet") return stackSpec(cab, mod, result, selected);
  if (mod.panel === "kitchen") return kitchenSpec(cab, mod, result, selected);
  if (mod.panel === "lounge") return loungeSpec(cab, mod, result, selected);
  if (mod.panel === "uohc") return uohcSpec(cab, mod, result, selected);
  return null;
}

function ohcSpec(cab, mod, result, selected) {
  const p = cab.params;
  const W = p.cabinetWidth || 1;
  const H = p.cabinetHeight || 1;
  const zones = p.zones || [];
  const cells = [];
  let x = 0;
  zones.forEach((z, i) => {
    cells.push({
      sel: i, type: z.type, x0: x, x1: x + z.width, y0: 0, y1: H,
      label: shortType(mod, z.type), sub: `${Math.round(z.width)} mm`,
    });
    x += z.width;
  });
  const grips = [];
  x = 0;
  for (let i = 0; i < zones.length - 1; i += 1) {
    x += zones[i].width;
    grips.push({ kind: "divider", index: i, axis: "x", pos: x, span0: 0, span1: H });
  }
  return { title: "Front view", hint: "Click a zone · drag a boundary", widthMm: W, heightMm: H, cells, grips, selected };
}

function stackSpec(cab, mod, result, selected) {
  const env = mod.envelope(cab.params);
  const p = cab.params;
  const zones = p.zones || [];
  const tall = mod.panel === "tall";
  const cells = [];
  const grips = [];
  if (tall && result?.stacking?.items) {
    for (const item of result.stacking.items) {
      const mute = item.type !== "functional_zone";
      const zi = zones.findIndex((z) => z.id === item.zoneId);
      cells.push({
        sel: mute ? null : zi,
        mute,
        type: mute ? "system" : (zones[zi] || {}).type,
        x0: 0, x1: env.W, y0: item.z0, y1: item.z1,
        label: mute ? item.type.replace("_", " ") : shortType(mod, (zones[zi] || {}).type),
        sub: mute ? "" : `${Math.round(item.height)} mm`,
        fill: mute ? FILLS.system : undefined,
      });
    }
    const items = result.stacking.items.filter((i) => i.type === "functional_zone");
    for (let i = 0; i < items.length - 1; i += 1) {
      grips.push({ kind: "divider", index: i, axis: "y", pos: items[i].z1, span0: 0, span1: env.W });
    }
  } else {
    const resolved = result?.zones || [];
    if (resolved.length) {
      resolved.forEach((z, i) => {
        cells.push({
          sel: i, type: z.type, x0: 0, x1: env.W, y0: z.zBottom, y1: z.zTop,
          label: shortType(mod, z.type), sub: `${Math.round(z.height)} mm`,
        });
      });
      for (let i = 0; i < resolved.length - 1; i += 1) {
        grips.push({ kind: "divider", index: i, axis: "y", pos: resolved[i].zBottom, span0: 0, span1: env.W });
      }
    } else {
      // Fallback: params only, stack top→bottom (small) or bottom→top (tall).
      let z = tall ? 0 : env.H;
      zones.forEach((zn, i) => {
        const y0 = tall ? z : z - zn.height;
        const y1 = tall ? z + zn.height : z;
        cells.push({ sel: i, type: zn.type, x0: 0, x1: env.W, y0, y1, label: shortType(mod, zn.type), sub: `${Math.round(zn.height)} mm` });
        if (i < zones.length - 1) grips.push({ kind: "divider", index: i, axis: "y", pos: tall ? y1 : y0, span0: 0, span1: env.W });
        z = tall ? y1 : y0;
      });
    }
  }
  return { title: "Front view", hint: "Click a zone · drag a boundary", widthMm: env.W, heightMm: env.H, cells, grips, selected };
}

function kitchenSpec(cab, mod, result, selected) {
  const p = cab.params;
  const g = p.globalSettings || {};
  const W = g.length || 1;
  const H = g.height || 1;
  const bch = g.bottomClearanceHeight || 0;
  const cols = p.columns || [];
  const cells = [];
  const grips = [];
  cells.push({
    sel: null, mute: true, type: "system", fill: FILLS.system,
    x0: 0, x1: W, y0: 0, y1: bch, label: "Toe kick",
  });
  let x = 0;
  cols.forEach((col, ci) => {
    let z = H;
    (col.zones || []).forEach((zn, zi) => {
      const y1 = z;
      const y0 = z - zn.height;
      cells.push({
        sel: { col: ci, zone: zi },
        type: zn.zoneType || col.columnType,
        x0: x, x1: x + col.width, y0, y1,
        label: shortType(mod, zn.zoneType || col.columnType),
        sub: `${Math.round(zn.height)} mm`,
      });
      if (zi < (col.zones || []).length - 1) {
        grips.push({ kind: "kzone", col: ci, index: zi, axis: "y", pos: y0, span0: x, span1: x + col.width });
      }
      z = y0;
    });
    if (ci < cols.length - 1) {
      grips.push({ kind: "divider", index: ci, axis: "x", pos: x + col.width, span0: bch, span1: H });
    }
    x += col.width;
  });
  return { title: "Front view", hint: "Click a cell · drag a column or zone boundary", widthMm: W, heightMm: H, cells, grips, selected };
}

function loungeSpec(cab, mod, result, selected) {
  const p = cab.params;
  const env = mod.envelope(p);
  const fp = result?.footprint || {};
  const cells = [];
  const grips = [];
  const add = (key, b, type, label) => {
    if (!b) return;
    cells.push({
      sel: key, type, x0: b.x0, x1: b.x1, y0: b.y0, y1: b.y1,
      label, sub: `${Math.round(b.x1 - b.x0)} × ${Math.round(b.y1 - b.y0)}`,
    });
  };
  if (p.style === "I_SHAPE") add("i", fp.i || { x0: 0, x1: env.W, y0: 0, y1: env.D }, "open", "I");
  else if (p.style === "L_SHAPE") {
    add("main", fp.main || { x0: 0, x1: p.mainWidth, y0: 0, y1: p.mainDepth }, "left_door", "Main");
    add("l", fp.l, "drawer", "L");
    const inner = (p.lPosition || "RIGHT") === "LEFT" ? p.lWidth : (p.mainWidth - p.lWidth);
    grips.push({ kind: "loungeL", axis: "x", pos: inner, span0: 0, span1: Math.max(p.mainDepth || 0, p.lDepth || 0) });
  } else if (p.style === "PARALLEL") {
    add("left", fp.left, "left_door", "Left");
    add("right", fp.right, "right_door", "Right");
    if (fp.left) grips.push({ kind: "loungeP", axis: "x", pos: fp.left.x1, span0: 0, span1: p.depth || env.D });
  } else if (p.style === "U_SHAPE") {
    add("left", fp.left, "left_door", "Left");
    add("back", fp.back, "up_flap", "Back");
    add("right", fp.right, "right_door", "Right");
    if (fp.left) grips.push({ kind: "uLoungeRun", axis: "x", pos: fp.left.x1, span0: 0, span1: env.D });
  }
  return { title: "Plan", hint: "Click a run · drag a boundary", widthMm: env.W, heightMm: env.D, cells, grips, selected };
}

function uohcSpec(cab, mod, result, selected) {
  const p = cab.params;
  const env = mod.envelope(p);
  const layout = result?.layout || { run: p.cabinetDepth, leftLen: env.D, backLen: env.W, rightLen: env.D };
  const run = layout.run || p.cabinetDepth || 350;
  const W = env.W;
  const D = env.D;
  const cells = [];
  const grips = [];
  const paintRun = (key, zones, mapCell, mapGrip) => {
    let acc = 0;
    (zones || []).forEach((z, i) => {
      cells.push({ sel: { run: key, zone: i }, type: z.type, ...mapCell(acc, z.width), label: shortType(mod, z.type), sub: `${Math.round(z.width)}` });
      if (i < zones.length - 1) grips.push({ kind: "uohc", run: key, index: i, ...mapGrip(acc + z.width) });
      acc += z.width;
    });
  };
  paintRun("leftZones", p.leftZones,
    (y, w) => ({ x0: 0, x1: run, y0: y, y1: y + w }),
    (pos) => ({ axis: "y", pos, span0: 0, span1: run }));
  paintRun("backZones", p.backZones,
    (x, w) => ({ x0: run + x, x1: run + x + w, y0: D - run, y1: D }),
    (pos) => ({ axis: "x", pos: run + pos, span0: D - run, span1: D }));
  paintRun("rightZones", p.rightZones,
    (y, w) => ({ x0: W - run, x1: W, y0: D - y - w, y1: D - y }),
    (pos) => ({ axis: "y", pos: D - pos, span0: W - run, span1: W }));
  return { title: "Plan", hint: "Click a zone · drag a run boundary", widthMm: W, heightMm: D, cells, grips, selected };
}

/** Bind click / drag on the generator OHC SVG (data-zone / data-boundary). */
export function bindOhcSvg(root, handlers) {
  const svg = root.querySelector("svg");
  if (!svg) return;
  const scale = Number(svg.dataset.scale) || 1;
  const ox = Number(svg.dataset.originX) || 0;
  root.querySelectorAll("[data-zone]").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      handlers.onSelect?.(Number(el.getAttribute("data-zone")), e);
    });
  });
  root.querySelectorAll("[data-boundary]").forEach((el) => {
    el.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const index = Number(el.getAttribute("data-boundary"));
      try { el.setPointerCapture(e.pointerId); } catch (_) { /* */ }
      handlers.onDragStart?.({ kind: "divider", index });
      const move = (ev) => {
        const r = svg.getBoundingClientRect();
        const vb = svg.viewBox.baseVal;
        const sx = ((ev.clientX - r.left) / r.width) * vb.width;
        const mm = (sx - ox) / scale;
        handlers.onDrag?.({ kind: "divider", index }, mm, ev);
      };
      const end = (ev) => {
        el.removeEventListener("pointermove", move);
        el.removeEventListener("pointerup", end);
        el.removeEventListener("pointercancel", end);
        try { el.releasePointerCapture(ev.pointerId); } catch (_) { /* */ }
        handlers.onDragEnd?.({ kind: "divider", index }, ev);
      };
      el.addEventListener("pointermove", move);
      el.addEventListener("pointerup", end);
      el.addEventListener("pointercancel", end);
    });
  });
}
