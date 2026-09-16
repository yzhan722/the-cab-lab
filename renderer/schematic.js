// Native 2D schematic: display generator params as a front elevation or
// plan and write simple edits (select a cell, drag a boundary) back into params.
import { getModule, DEFAULT_ARM_DEPTH } from "./modules.js";

const SVG_NS = "http://www.w3.org/2000/svg";

const FILLS = {
  drawer: "#dce8f8",
  left_door: "#c9dcf5",
  right_door: "#c9dcf5",
  double_door: "#b7d0f0",
  up_flap: "#e5f2ff",
  fixed_panel: "#eef8ea",
  open: "#fff7dc",
  fridge: "#f3e8ff",
  custom: "#eee",
  system: "#f4f0e6",
};

function typeFill(type) {
  return FILLS[type] || "#e5f2ff";
}

/** Pixel viewBox for the 2D schematic. Height is capped so a tall cabinet cannot dominate the panel. */
export function schematicFrame(widthMm, heightMm) {
  const viewW = 520;
  const wMm = Math.max(widthMm || 1, 1);
  const hMm = Math.max(heightMm || 1, 1);
  const viewH = Math.max(140, Math.min(280, Math.round(viewW * (hMm / wMm))));
  return { viewW, viewH };
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
  if (!t) return type;
  if (t.short) return t.short;
  const label = t.label || type;
  return label.split(" ")[0];
}

export function usesGeometryPanel(mod) {
  return mod.id === "smallCabinet" || mod.id === "tallCabinet" || mod.id === "kitchenCabinet"
    || mod.panel === "lounge" || mod.panel === "uohc";
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
    const { viewW, viewH } = schematicFrame(wMm, hMm);
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
  if (grip.kind === "uohc") {
    const arm = p.armDepth || DEFAULT_ARM_DEPTH;
    const env = mod.envelope(p);
    let along = pos;
    if (grip.run === "backZones") along = pos - arm;
    else if (grip.run === "rightZones") along = env.D - pos;
    return mod.setRunDivider(p, grip.run, grip.index, along);
  }
  if (grip.kind === "loungeDepth") {
    return { ...p, depth: Math.max(mod.minSize.D, Math.round(pos)) };
  }
  return p;
}

export function schematicSpec(cab, mod, result, selected) {
  if (mod.panel === "lounge") return loungeSpec(cab, mod, result, selected);
  if (mod.panel === "uohc") return uohcSpec(cab, mod, result, selected);
  if (mod.id === "smallCabinet" || mod.id === "tallCabinet" || mod.id === "kitchenCabinet") {
    return stackSpec(cab, mod, result, selected);
  }
  return null;
}

function stackSpec(cab, mod, result, selected) {
  const env = mod.envelope(cab.params);
  const p = cab.params;
  const resolved = result?.zones || [];
  const cells = [];
  const grips = [];
  if (mod.plinth) {
    const P = p.plinthHeight || 0;
    cells.push({
      sel: null, mute: true, type: "system", fill: FILLS.system,
      x0: 0, x1: env.W, y0: 0, y1: P, label: "Toe kick",
    });
  }
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
    let z = env.H;
    (p.zones || []).forEach((zn, i) => {
      const y1 = z;
      const y0 = z - zn.height;
      cells.push({ sel: i, type: zn.type, x0: 0, x1: env.W, y0, y1, label: shortType(mod, zn.type), sub: `${Math.round(zn.height)} mm` });
      if (i < (p.zones || []).length - 1) grips.push({ kind: "divider", index: i, axis: "y", pos: y0, span0: 0, span1: env.W });
      z = y0;
    });
  }
  return { title: "Front view", hint: "Click a zone · drag a boundary", widthMm: env.W, heightMm: env.H, cells, grips, selected };
}

function loungeSpec(cab, mod, result, selected) {
  const p = cab.params;
  const env = mod.envelope(p);
  const segs = result?.zones || [];
  const cells = [];
  const grips = [];
  const style = p.style || "I";
  segs.forEach((s, i) => {
    cells.push({
      sel: i, type: i % 2 ? "drawer" : "left_door",
      x0: s.x0, x1: s.x1, y0: s.y0, y1: s.y1,
      label: style === "P" ? (i === 0 ? "A" : "B") : (style === "U" ? ["L", "Back", "R"][i] : (i === 0 ? "Main" : "Return")),
      sub: `${Math.round(s.x1 - s.x0)} × ${Math.round(s.y1 - s.y0)}`,
    });
  });
  if (segs.length) {
    const first = segs[0];
    const alongX = (first.x1 - first.x0) >= (first.y1 - first.y0);
    if (alongX) grips.push({ kind: "loungeDepth", axis: "y", pos: first.y1, span0: first.x0, span1: first.x1 });
    else grips.push({ kind: "loungeDepth", axis: "x", pos: first.x1, span0: first.y0, span1: first.y1 });
  }
  return { title: "Plan", hint: "Click a run · drag seat depth", widthMm: env.W, heightMm: env.D, cells, grips, selected };
}

function uohcSpec(cab, mod, result, selected) {
  const p = cab.params;
  const env = mod.envelope(p);
  const arm = p.armDepth || DEFAULT_ARM_DEPTH;
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
    (y, w) => ({ x0: 0, x1: arm, y0: y, y1: y + w }),
    (pos) => ({ axis: "y", pos, span0: 0, span1: arm }));
  paintRun("backZones", p.backZones,
    (x, w) => ({ x0: arm + x, x1: arm + x + w, y0: D - arm, y1: D }),
    (pos) => ({ axis: "x", pos: arm + pos, span0: D - arm, span1: D }));
  paintRun("rightZones", p.rightZones,
    (y, w) => ({ x0: W - arm, x1: W, y0: D - y - w, y1: D - y }),
    (pos) => ({ axis: "y", pos: D - pos, span0: W - arm, span1: W }));
  return { title: "Plan", hint: "Click a zone · drag a run boundary", widthMm: W, heightMm: D, cells, grips, selected };
}
