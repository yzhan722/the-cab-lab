// Right panel: shows the space when nothing is selected, otherwise the
// selected cabinet's params. Every edit writes into job.js and regenerates.
import * as job from "./job.js";
import { getModule, fitZones, MIN_ZONE_HEIGHT, MIN_ZONE_WIDTH, fitZoneWidths } from "./modules.js";
import { withKitchenVPanelPrefs } from "./displayBoards.js";
import { withTallFridgeDefaults, loungeWithStyle } from "./panelDefaults.js";
import { getSpaceKind } from "./spaces.js";
import { openSpaceDialog } from "./spaceDialog.js";
import { poseFits } from "./cabinets3d.js";
import { describeMaterials, thickness } from "./materials.js";
import { sideOfRotZ, sideLabel } from "./interact.js";
import { log } from "./log.js";
import { schematicView, schematicSpec, applySchematicGrip, usesGeometryPanel } from "./schematic.js";

const panel = document.getElementById("rightpanel");
const app = document.getElementById("app");
const drawerChecks = document.querySelector('[data-dpane="checks"]');
const drawerBoards = document.querySelector('[data-dpane="boards"]');

function el(tag, attrs = {}, children = []) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") e.className = v;
    else if (k === "text") e.textContent = v;
    else if (k === "style") e.style.cssText = v; // CSSOM: allowed by the CSP, unlike a style attribute
    else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
    else if (v === false || v == null) continue;
    else e.setAttribute(k, v === true ? "" : v);
  }
  for (const c of children) if (c) e.append(c);
  return e;
}

function numField(label, value, onCommit, opts = {}) {
  const input = el("input", { type: "number", value, step: opts.step ?? 10, min: opts.min ?? 0 });
  if (opts.readOnly) {
    input.readOnly = true;
    input.title = opts.readOnly;
    return el("label", { class: "field readonly" }, [el("span", { text: label }), input]);
  }
  const commit = () => {
    const v = Number(input.value);
    if (!Number.isFinite(v)) { input.value = value; return; }
    if (v === Number(value)) return;
    onCommit(v);
  };
  input.addEventListener("change", commit);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); input.blur(); } });
  return el("label", { class: "field" }, [el("span", { text: label }), input]);
}

function selectField(label, value, onCommit, options) {
  const sel = el("select", {}, options.map((o) => el("option", { value: o.id, text: o.label, selected: o.id === value })));
  sel.addEventListener("change", () => { onCommit(sel.value); sel.blur(); });
  return el("label", { class: "field" }, [el("span", { text: label }), sel]);
}

function checkField(label, value, onCommit) {
  const input = el("input", { type: "checkbox" });
  input.checked = !!value;
  input.addEventListener("change", () => onCommit(input.checked));
  return el("label", { class: "field check" }, [el("span", { text: label }), input]);
}

function section(title, children) {
  return el("div", { class: "panel-section" }, [el("div", { class: "sec-title", text: title }), ...children]);
}

// --- space ---------------------------------------------------------------------

/** Cabinets that no longer fit the space (after a space edit, for instance). */
export function spaceFitIssues() {
  const issues = [];
  if (!job.hasSpace()) return issues;
  for (const cab of job.getJob().cabinets) {
    if (!poseFits(cab, cab.pose)) issues.push(`${cab.id} is outside the space or overlaps an obstacle.`);
  }
  return issues;
}

function renderSpace() {
  const space = job.getJob().space;
  const resolved = job.getSpace();
  const count = job.getJob().cabinets.length;

  if (!space) {
    panel.replaceChildren(
      el("div", { class: "panel-head" }, [
        el("div", { class: "panel-title", text: "Space" }),
        el("div", { class: "panel-sub", text: "not defined" }),
      ]),
      section("Step 1", [
        el("div", { class: "empty small", text: "Define the space first: a box room, or a vehicle (box rear + side-profile nose); imported floor plans later." }),
        el("button", { class: "tb primary wide-solid", text: "Define the space", onclick: () => openSpaceDialog() }),
      ]),
    );
    drawerChecks.replaceChildren(el("div", { class: "empty", text: "No space defined." }));
    drawerBoards.replaceChildren(el("div", { class: "empty", text: "No space defined." }));
    return;
  }

  const kind = getSpaceKind(space.kind);
  const issues = spaceFitIssues();
  panel.replaceChildren(...[
    el("div", { class: "panel-head" }, [
      el("div", { class: "panel-title", text: "Space" }),
      el("div", { class: "panel-sub", text: `${kind.label} · ${resolved.summary} · ${count} cabinet(s)` }),
    ]),
    section(kind.label, [
      ...(kind.describe
        ? kind.describe(space.params)
        : kind.fields.filter((f) => !f.type || f.type === "number").map((f) => [f.label, String(space.params[f.key])])
      ).map(([label, value]) => el("div", { class: "kv" }, [el("span", { text: label }), el("b", { text: value })])),
      el("button", { class: "tb wide", text: "Edit space…", onclick: () => openSpaceDialog() }),
    ]),
    section("Cabinets", [
      ...describeMaterials(job.getFinish(), job.getStock()).map(([label, value]) =>
        el("div", { class: "kv" }, [el("span", { text: label }), el("b", { text: value })])),
    ]),
    issues.length
      ? el("div", { class: "panel-section" }, [
          el("div", { class: "sec-title", text: "Checks" }),
          ...issues.map((m) => el("div", { class: "msg err", text: m })),
        ])
      : null,
    el("div", { class: "panel-section muted" }, [
      el("div", { class: "sec-title", text: "Next" }),
      el("div", { class: "empty small", text: "Pick a module on the left. Floor cabinets start on the floor (click a corner or a grid point). Overhead starts on a ceiling edge. After it is generated, the right panel shows a 2D view you can click and drag. Pull the blue faces to change W / D / H, drag the orange bars to move zone boundaries." }),
    ]),
  ].filter(Boolean));
  drawerChecks.replaceChildren(
    issues.length
      ? el("div", {}, issues.map((m) => el("div", { class: "msg err", text: m })))
      : el("div", { class: "empty", text: count ? "All cabinets fit the space. Select one to see its checks." : "Select a cabinet to see its checks." }),
  );
  drawerBoards.replaceChildren(el("div", { class: "empty", text: "Select a cabinet to list its boards." }));
}

// --- overhead editor ---------------------------------------------------------------
//
// Wide page while a geometry module is selected: Fusion-style 2D schematic
// (click a cell, drag a boundary), then the module fields. OHC also keeps
// the zone strip. Every edit is one undo step; a boundary drag commits once
// on release.

const ohcSel = { cabId: null, indices: [] }; // zone selection, kept across re-renders
const geoSel = { cabId: null, sel: null };
let geoDrag = null; // { cabId, refresh } while a 2D boundary is dragged

function geoSelected(cabId) {
  if (geoSel.cabId !== cabId) { geoSel.cabId = cabId; geoSel.sel = null; }
  return geoSel.sel;
}
function geoSelect(cabId, sel) {
  geoSel.cabId = cabId;
  geoSel.sel = sel;
}

function mountSchematic(cab, mod, result) {
  const spec = schematicSpec(
    cab,
    mod,
    result,
    mod.panel === "ohc" ? (ohcSelected(cab.id)[0] ?? -1) : geoSelected(cab.id),
  );
  if (!spec) return null;
  const view = schematicView(spec, {
    onSelect(sel, ev) {
      const cur = geoSelected(cab.id);
      if (mod.panel === "ohc") {
        const i = sel;
        const list = ohcSelected(cab.id);
        if (ev.ctrlKey || ev.metaKey) ohcSelect(cab.id, list.includes(i) ? list.filter((k) => k !== i) : [...list, i]);
        else ohcSelect(cab.id, [i]);
        geoSelect(cab.id, i);
      } else {
        geoSelect(cab.id, sel);
        log("schematic.select", { id: cab.id, moduleId: cab.moduleId, sel });
      }
      renderPanel();
    },
    onDragStart() {
      const before = job.snapshot();
      geoDrag = {
        cabId: cab.id,
        before,
        refresh: (nextCab, nextResult) => {
          const s = schematicSpec(nextCab, getModule(nextCab.moduleId), nextResult, geoSelected(nextCab.id));
          if (s) view.update(s);
        },
      };
    },
    onDrag(grip, pos, ev) {
      const step = ev.shiftKey ? 1 : 10;
      const snapped = Math.round(pos / step) * step;
      const now = job.getSelected();
      if (!now) return;
      const next = applySchematicGrip(now, job.resultFor(now.id), grip, snapped);
      if (next && next !== now.params) job.setParams(now.id, next, { history: false });
    },
    onDragEnd(grip) {
      const before = geoDrag && geoDrag.before;
      geoDrag = null;
      const changed = before ? job.commitSnapshot(before) : false;
      const now = job.getSelected();
      if (mod.panel === "ohc") {
        log("ohc.zone.drag", { id: cab.id, boundary: grip.index, changed, widths: now ? now.params.zones.map((z) => z.width) : null });
      } else {
        log("schematic.drag", { id: cab.id, moduleId: cab.moduleId, grip, changed });
      }
      renderPanel();
    },
  });
  return el("div", { class: "panel-section" }, [
    el("div", { class: "sec-title", text: spec.title || "Geometry" }),
    el("div", { class: "sch-hint", text: spec.hint || "Click a region · drag a boundary" }),
    view.el,
  ]);
}

function ohcSelected(cabId) {
  if (ohcSel.cabId !== cabId) { ohcSel.cabId = cabId; ohcSel.indices = []; }
  return ohcSel.indices;
}
function ohcSelect(cabId, indices) {
  ohcSel.cabId = cabId;
  ohcSel.indices = indices.slice().sort((a, b) => a - b);
  log("ohc.zone.select", { id: cabId, zones: ohcSel.indices });
}

function ohcTypeShort(mod, type) {
  const t = mod.zoneTypes.find((z) => z.id === type);
  return t ? t.short || t.label : type;
}

/** The zone strip: proportional cells with draggable boundaries; returns { strip, refresh }. */
function zoneStrip(cab, mod) {
  const p = cab.params;
  const zones = p.zones || [];
  const total = p.cabinetWidth;
  const selected = ohcSelected(cab.id);
  const strip = el("div", { class: "zs-strip" });
  const widthRow = el("div", { class: "zs-row" });
  const cumRow = el("div", { class: "zs-row cum" });

  const cells = zones.map((z, i) => {
    const cell = el("div", { class: `zs-zone t-${z.type}${selected.includes(i) ? " sel" : ""}` }, [
      el("span", { class: "zs-type", text: ohcTypeShort(mod, z.type) }),
      el("span", { class: "zs-w", text: String(Math.round(z.width)) }),
    ]);
    cell.addEventListener("click", (e) => {
      const cur = ohcSelected(cab.id);
      if (e.ctrlKey || e.metaKey) ohcSelect(cab.id, cur.includes(i) ? cur.filter((k) => k !== i) : [...cur, i]);
      else ohcSelect(cab.id, [i]);
      renderPanel();
    });
    return cell;
  });

  const layout = (zs) => {
    let x = 0;
    zs.forEach((z, i) => {
      cells[i].style.flexBasis = `${(z.width / total) * 100}%`;
      cells[i].querySelector(".zs-w").textContent = String(Math.round(z.width));
      x += z.width;
    });
    widthRow.replaceChildren(...zs.map((z) => el("span", { style: `flex-basis:${(z.width / total) * 100}%`, text: String(Math.round(z.width)) })));
    let acc = 0;
    cumRow.replaceChildren(...zs.slice(0, -1).map((z) => { acc += z.width; return el("span", { style: `left:${(acc / total) * 100}%`, text: String(Math.round(acc)) }); }));
  };

  // Boundaries: a grip between neighbouring cells; drag moves the boundary (10 mm steps, Shift = 1 mm).
  for (let i = 0; i < zones.length; i += 1) {
    strip.append(cells[i]);
    if (i === zones.length - 1) break;
    const grip = el("div", { class: "zs-grip", title: "Drag to move the boundary · Shift = 1 mm" });
    grip.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const before = job.snapshot();
      const params0 = job.getSelected().params;
      const result0 = job.resultFor(cab.id);
      const rect = strip.getBoundingClientRect();
      const x0 = params0.zones.slice(0, i + 1).reduce((s, z) => s + z.width, 0);
      const startX = e.clientX;
      try { grip.setPointerCapture(e.pointerId); } catch (_) { /* synthetic pointer */ }
      grip.classList.add("active");
      geoDrag = { cabId: cab.id, refresh: () => layout(job.getSelected().params.zones) };
      const move = (ev) => {
        const mm = ((ev.clientX - startX) / rect.width) * total;
        const step = ev.shiftKey ? 1 : 10;
        const pos = Math.round((x0 + mm) / step) * step;
        job.setParams(cab.id, mod.setDivider(params0, result0, i, pos), { history: false });
      };
      const end = (ev) => {
        grip.removeEventListener("pointermove", move);
        grip.removeEventListener("pointerup", end);
        grip.removeEventListener("pointercancel", end);
        try { grip.releasePointerCapture(ev.pointerId); } catch (_) { /* released */ }
        grip.classList.remove("active");
        geoDrag = null;
        const changed = job.commitSnapshot(before);
        const now = job.getSelected();
        log("ohc.zone.drag", { id: cab.id, boundary: i, changed, widths: now ? now.params.zones.map((z) => z.width) : null });
        renderPanel();
      };
      grip.addEventListener("pointermove", move);
      grip.addEventListener("pointerup", end);
      grip.addEventListener("pointercancel", end);
    });
    strip.append(grip);
  }
  layout(zones);
  return { strip, widthRow, cumRow, refresh: layout };
}

function renderOverhead(cab, mod, result, shared) {
  const p = cab.params;
  const env = mod.envelope(p);
  const zones = p.zones || [];
  const total = p.cabinetWidth;
  const selected = ohcSelected(cab.id).filter((i) => i < zones.length);
  const cpt = p.featureWidth ?? thickness(job.getStock(), "carcass");
  const fpt = p.frontPanelThickness ?? thickness(job.getStock(), "door");
  const setZones = (next, kind, extra = {}) => {
    job.setParams(cab.id, { ...p, zones: next });
    log(`ohc.zone.${kind}`, { id: cab.id, widths: next.map((z) => z.width), types: next.map((z) => z.type), ...extra });
  };

  const { strip, widthRow, cumRow } = zoneStrip(cab, mod);

  const addZone = el("button", { class: "tb", text: "+ Add zone", onclick: () => {
    // The new zone takes up to 300 mm from the widest one (or everything is re-fitted).
    const next = zones.map((z) => ({ ...z }));
    const widest = next.reduce((a, b) => (b.width > a.width ? b : a), next[0]);
    const take = Math.min(300, widest.width - MIN_ZONE_WIDTH);
    const zone = { id: `zone-${Date.now().toString(36)}`, type: "up_flap", width: Math.max(MIN_ZONE_WIDTH, take) };
    if (take >= MIN_ZONE_WIDTH) { widest.width = Math.round((widest.width - take) * 10) / 10; next.push(zone); setZones(next, "add"); }
    else if ((next.length + 1) * MIN_ZONE_WIDTH <= total) { next.push(zone); setZones(fitZoneWidths(next, total), "add"); }
    else log("ohc.zone.blocked", { id: cab.id, reason: `no room for another ${MIN_ZONE_WIDTH} mm zone`, total });
    ohcSelect(cab.id, [next.length - 1]);
  } });
  const delZone = el("button", { class: "tb", text: "Delete", disabled: !selected.length || zones.length - selected.length < 1, onclick: () => {
    const next = zones.filter((_, i) => !selected.includes(i)).map((z) => ({ ...z }));
    setZones(fitZoneWidths(next, total), "remove", { removed: selected });
    ohcSelect(cab.id, []);
  } });
  const avgZone = el("button", { class: "tb", text: "Average selected", disabled: selected.length < 2, title: "Give the selected zones equal widths (their total stays)", onclick: () => {
    const next = zones.map((z) => ({ ...z }));
    const sum = selected.reduce((s, i) => s + next[i].width, 0);
    const each = Math.round((sum / selected.length) * 10) / 10;
    selected.forEach((i, k) => { next[i].width = k === selected.length - 1 ? Math.round((sum - each * (selected.length - 1)) * 10) / 10 : each; });
    setZones(next, "average", { zones: selected });
  } });

  const geo = mountSchematic(cab, mod, result);

  // Selected zone card.
  let zoneCard = null;
  if (selected.length === 1) {
    const i = selected[0];
    const z = zones[i];
    const type = el("select", { onchange: (e) => {
      const next = zones.map((zz) => ({ ...zz }));
      next[i].type = e.target.value;
      e.target.blur();
      setZones(next, "type", { zone: i, type: e.target.value });
    } }, mod.zoneTypes.map((t) => el("option", { value: t.id, text: t.label, selected: t.id === z.type })));
    const neighbour = i < zones.length - 1 ? i + 1 : i - 1;
    const maxW = neighbour >= 0 ? z.width + zones[neighbour].width - MIN_ZONE_WIDTH : total;
    zoneCard = section(`Zone ${i + 1} of ${zones.length}`, [
      el("label", { class: "field" }, [el("span", { text: "Type" }), type]),
      numField("Width (mm)", z.width, (v) => {
        // The neighbour to the right (or left for the last zone) absorbs the difference.
        const w = Math.max(MIN_ZONE_WIDTH, Math.min(maxW, Math.round(v)));
        if (neighbour < 0) return;
        const next = zones.map((zz) => ({ ...zz }));
        const delta = w - next[i].width;
        next[i].width = w;
        next[neighbour].width = Math.round((next[neighbour].width - delta) * 10) / 10;
        setZones(next, "width", { zone: i, width: w });
      }, { step: 10, min: MIN_ZONE_WIDTH }),
      el("div", { class: "kv" }, [el("span", { text: "From left" }), el("b", { text: `${Math.round(zones.slice(0, i).reduce((s, zz) => s + zz.width, 0))} – ${Math.round(zones.slice(0, i + 1).reduce((s, zz) => s + zz.width, 0))} mm` })]),
    ]);
  } else if (selected.length > 1) {
    zoneCard = section(`${selected.length} zones selected`, [
      el("div", { class: "empty small", text: `Total ${Math.round(selected.reduce((s, i) => s + zones[i].width, 0))} mm · "Average selected" shares it equally.` }),
    ]);
  }

  // Cabinet-level fields, folded.
  const setEnv = (k) => (v) => job.setParams(cab.id, mod.setEnvelope(p, { [k]: Math.max(mod.minSize[k], v) }));
  const setHeightDown = (v) => {
    // The top stays on the ceiling: a taller box moves its bottom down.
    const H = Math.max(mod.minSize.H, v);
    const before = job.snapshot();
    job.updateCabinet(cab.id, (c) => { c.params = mod.setEnvelope(c.params, { H }); c.pose = { ...c.pose, z: c.pose.z + (env.H - H) }; });
    job.commitSnapshot(before);
  };
  const fold = el("details", { class: "panel-fold" }, [
    el("summary", { text: `Cabinet · ${Math.round(env.W)} × ${Math.round(env.D + fpt)} × ${Math.round(env.H)} · ${result?.boards?.length || 0} boards` }),
    section("Outer size (= box, doors included)", [
      numField("Width (mm)", env.W, setEnv("W")),
      numField("Depth (mm)", env.D + fpt, (v) => setEnv("D")(v - fpt)),
      numField("Height (mm)", env.H, setHeightDown),
      el("div", { class: "kv" }, [el("span", { text: "Bottom above floor" }), el("b", { text: `${Math.round(cab.pose.z)} mm` })]),
    ]),
    section("Material (job stock)", [
      el("div", { class: "kv" }, [el("span", { text: "Carcass" }), el("b", { text: `${p.carcassColorName || "White Stipple"} · ${cpt} mm` })]),
      el("div", { class: "kv" }, [el("span", { text: "Door" }), el("b", { text: `${p.doorColorName || p.doorColor || "—"} · ${fpt} mm` })]),
      el("div", { class: "empty small", text: "Every board except the doors is carcass stock; the doors are door stock. Thicknesses come from the space's catalogue." }),
    ]),
  ]);

  panel.replaceChildren(...[
    el("div", { class: "panel-head" }, [
      el("div", { class: "panel-title", text: `${mod.label} cabinet` }),
      el("div", { class: "panel-sub", text: `${cab.id} · doors ${sideLabel(sideOfRotZ(cab.pose.rotZ))} · ${Math.round(env.W)} × ${Math.round(env.D + fpt)} × ${Math.round(env.H)} mm · top on the ceiling` }),
    ]),
    section(`Zones · left → right · ${zones.length} · ${Math.round(total)} mm`, [
      el("div", { class: "zs-tools" }, [addZone, delZone, avgZone, el("span", { class: "zs-hint", text: "Drag a boundary · click a zone · Ctrl+click adds to the selection" })]),
      strip,
      widthRow,
      cumRow,
    ]),
    zoneCard,
    geo,
    fold,
    shared.checks,
    el("div", { class: "panel-foot" }, [shared.remove]),
  ].filter(Boolean));
}

function uohcRunBlock(cab, mod, p, key, title, total) {
  const zones = p[key] || [];
  const setRun = (next) => job.setParams(cab.id, { ...p, [key]: fitZoneWidths(next, total) });
  const rows = zones.map((z, i) => {
    const type = el("select", {
      onchange: (e) => {
        const next = zones.map((zz) => ({ ...zz }));
        next[i].type = e.target.value;
        e.target.blur();
        job.setParams(cab.id, { ...p, [key]: next });
      },
    }, mod.zoneTypes.map((t) => el("option", { value: t.id, text: t.label, selected: t.id === z.type })));
    const width = el("input", { type: "number", value: z.width, step: 1, min: MIN_ZONE_WIDTH });
    width.addEventListener("change", () => {
      const v = Number(width.value);
      if (!Number.isFinite(v) || v < MIN_ZONE_WIDTH) { width.value = z.width; return; }
      const next = zones.map((zz) => ({ ...zz }));
      const j = i < next.length - 1 ? i + 1 : i - 1;
      const delta = v - next[i].width;
      if (j >= 0 && next[j].width - delta >= MIN_ZONE_WIDTH) {
        next[i].width = v;
        next[j].width = Math.round((next[j].width - delta) * 10) / 10;
        job.setParams(cab.id, { ...p, [key]: next });
      } else width.value = z.width;
    });
    const rm = el("button", {
      class: "icon", title: "Remove zone", text: "×", disabled: zones.length <= 1,
      onclick: () => setRun(zones.filter((_, j) => j !== i)),
    });
    return el("div", { class: "zone-row" }, [type, width, rm]);
  });
  const add = el("button", { class: "tb", text: "+ Zone", onclick: () => {
    const next = zones.map((z) => ({ ...z }));
    next.push({ id: `${key}-${Date.now().toString(36)}`, type: "up_flap", width: MIN_ZONE_WIDTH });
    if (next.length * MIN_ZONE_WIDTH <= total) setRun(next);
  } });
  return section(`${title} · ${Math.round(total)} mm`, [
    el("div", { class: "zone-list" }, rows),
    add,
  ]);
}

function renderUOverhead(cab, mod, result, { checks, remove }) {
  const p = cab.params;
  const env = mod.envelope(p);
  const layout = result?.layout || { run: p.cabinetDepth, leftLen: env.D, backLen: env.W, rightLen: env.D };
  const setEnv = (k) => (v) => job.setParams(cab.id, mod.setEnvelope(p, { [k]: Math.max(mod.minSize[k], v) }));
  const setPose = (k) => (v) => job.setPose(cab.id, { [k]: v });
  const setRun = (v) => job.setParams(cab.id, mod.setEnvelope({ ...p, cabinetDepth: Math.max(150, v) }, {}));
  panel.replaceChildren(
    el("div", { class: "panel-head" }, [
      el("div", { class: "panel-title", text: `${mod.label}` }),
      el("div", { class: "panel-sub", text: `${cab.id} · ${result?.boards?.length || 0} boards · three OHC runs` }),
    ]),
    mountSchematic(cab, mod, result),
    section("Bounding box", [
      numField("Width (mm)", env.W, setEnv("W")),
      numField("Depth (mm)", env.D, setEnv("D")),
      numField("Height (mm)", env.H, setEnv("H")),
      numField("Run depth (mm)", layout.run, setRun),
    ]),
    uohcRunBlock(cab, mod, p, "leftZones", "Left run", layout.leftLen),
    uohcRunBlock(cab, mod, p, "backZones", "Back run", layout.backLen),
    uohcRunBlock(cab, mod, p, "rightZones", "Right run", layout.rightLen),
    section("Position", [
      numField("X (mm)", cab.pose.x, setPose("x"), { min: -1e6 }),
      numField("Y (mm)", cab.pose.y, setPose("y"), { min: -1e6 }),
      numField("Rotation (°)", cab.pose.rotZ || 0, (v) => job.setPose(cab.id, { rotZ: ((Math.round(v / 90) * 90) % 360 + 360) % 360 }), { step: 90, min: -1e6 }),
    ]),
    checks,
    el("div", { class: "panel-foot" }, [remove]),
  );
}

// --- kitchen / lounge (Fusion-migrated; first-pass editors) ---------------------

function renderKitchen(cab, mod, result, { checks, remove }) {
  const p = cab.params;
  const g = p.globalSettings || {};
  const env = mod.envelope(p);
  const columns = p.columns || [];
  const interior = Math.round((g.height - (g.bottomClearanceHeight || 0) - (g.materialThickness || 0)) * 10) / 10;
  const setEnv = (k) => (v) => job.setParams(cab.id, mod.setEnvelope(p, { [k]: Math.max(mod.minSize[k], v) }));
  const setG = (k, min = 0) => (v) => job.setParams(cab.id, { ...p, globalSettings: { ...g, [k]: Math.max(min, v) } });
  const setPose = (k) => (v) => job.setPose(cab.id, { [k]: v });

  const columnBlocks = columns.map((col, ci) => {
    const zones = col.zones || [];
    const zoneRows = zones.map((z, i) => {
      const type = el("select", {
        onchange: (e) => {
          const next = columns.map((c, k) => (k !== ci ? c : { ...c, zones: zones.map((zz, j) => (j === i ? { ...zz, zoneType: e.target.value } : { ...zz })) }));
          e.target.blur();
          job.setParams(cab.id, { ...p, columns: next });
        },
      }, mod.zoneTypes.map((t) => el("option", { value: t.id, text: t.label, selected: t.id === z.zoneType })));
      const height = el("input", { type: "number", value: z.height, step: 1, min: 0 });
      height.addEventListener("change", () => {
        const v = Number(height.value);
        if (!Number.isFinite(v) || v <= 0) { height.value = z.height; return; }
        const nextZ = zones.map((zz) => ({ ...zz }));
        const j = i < nextZ.length - 1 ? i + 1 : i - 1;
        const delta = v - nextZ[i].height;
        if (j >= 0 && nextZ[j].height - delta >= MIN_ZONE_HEIGHT) {
          nextZ[i].height = v;
          nextZ[j].height = Math.round((nextZ[j].height - delta) * 10) / 10;
          job.setParams(cab.id, { ...p, columns: columns.map((c, k) => (k !== ci ? c : { ...c, zones: nextZ })) });
        } else {
          height.value = z.height;
        }
      });
      const rmz = el("button", {
        class: "icon", title: "Remove zone", text: "×", disabled: zones.length <= 1,
        onclick: () => {
          const nextZ = fitZones(zones.filter((_, k) => k !== i), interior);
          job.setParams(cab.id, { ...p, columns: columns.map((c, k) => (k !== ci ? c : { ...c, zones: nextZ })) });
        },
      });
      return el("div", { class: "zone-row" }, [el("span", { class: "zone-idx", text: String(i + 1) }), type, height, rmz]);
    });
    const addZone = el("button", { class: "tb wide", text: "+ Zone", onclick: () => {
      const nextZ = zones.map((zz) => ({ ...zz }));
      const tallest = nextZ.reduce((a, b) => (b.height > a.height ? b : a), nextZ[0]);
      const take = Math.min(150, tallest.height - MIN_ZONE_HEIGHT);
      const zone = { id: `zone-${Date.now().toString(36)}`, zoneType: "drawer", height: take >= MIN_ZONE_HEIGHT ? take : MIN_ZONE_HEIGHT };
      if (take >= MIN_ZONE_HEIGHT) {
        tallest.height = Math.round((tallest.height - take) * 10) / 10;
        nextZ.push(zone);
        job.setParams(cab.id, { ...p, columns: columns.map((c, k) => (k !== ci ? c : { ...c, zones: nextZ })) });
      } else {
        nextZ.push(zone);
        job.setParams(cab.id, { ...p, columns: columns.map((c, k) => (k !== ci ? c : { ...c, zones: fitZones(nextZ, interior) })) });
      }
    } });
    const colType = el("select", {
      onchange: (e) => {
        job.setParams(cab.id, { ...p, columns: columns.map((c, k) => (k !== ci ? c : { ...c, columnType: e.target.value })) });
        e.target.blur();
      },
    }, mod.zoneTypes.map((t) => el("option", { value: t.id, text: t.label, selected: t.id === col.columnType })));
    const width = numField("Width (mm)", col.width, (v) => {
      const next = columns.map((c) => ({ ...c }));
      const neighbour = ci < next.length - 1 ? ci + 1 : ci - 1;
      const delta = v - next[ci].width;
      if (neighbour >= 0 && next[neighbour].width - delta >= MIN_ZONE_WIDTH && v >= MIN_ZONE_WIDTH) {
        next[ci].width = v;
        next[neighbour].width = Math.round((next[neighbour].width - delta) * 10) / 10;
        job.setParams(cab.id, { ...p, columns: next });
      }
    }, { step: 10, min: MIN_ZONE_WIDTH });
    const rmCol = el("button", {
      class: "tb", text: "Remove column", disabled: columns.length <= 1,
      onclick: () => {
        const columnsNext = fitZoneWidths(columns.filter((_, k) => k !== ci), g.length);
        job.setParams(cab.id, withKitchenVPanelPrefs({ ...p, columns: columnsNext }));
      },
    });
    return section(`Column ${ci + 1}`, [
      el("label", { class: "field" }, [el("span", { text: "Type" }), colType]),
      width,
      el("div", { class: "zone-list" }, zoneRows),
      addZone,
      rmCol,
    ]);
  });

  const addCol = el("button", { class: "tb wide", text: "+ Add column", onclick: () => {
    const next = columns.map((c) => ({ ...c }));
    const last = next[next.length - 1];
    const take = Math.min(300, last.width - MIN_ZONE_WIDTH);
    if (take < MIN_ZONE_WIDTH) return;
    last.width = Math.round((last.width - take) * 10) / 10;
    next.push({
      id: `col-${Date.now().toString(36)}`,
      width: take,
      columnType: "drawer",
      zones: [{ id: `zone-${Date.now().toString(36)}`, height: Math.max(MIN_ZONE_HEIGHT, interior), zoneType: "drawer" }],
    });
    job.setParams(cab.id, withKitchenVPanelPrefs({ ...p, columns: next }));
  } });

  panel.replaceChildren(
    el("div", { class: "panel-head" }, [
      el("div", { class: "panel-title", text: `${mod.label} cabinet` }),
      el("div", { class: "panel-sub", text: `${cab.id} · ${result?.boards?.length || 0} boards` }),
    ]),
    mountSchematic(cab, mod, result),
    section("Outer size (= box)", [
      numField("Width (mm)", env.W, setEnv("W")),
      numField("Depth (mm)", env.D, setEnv("D")),
      numField("Height (mm)", env.H, setEnv("H")),
    ]),
    section("Toe kick", [
      numField("Clearance (mm)", g.bottomClearanceHeight ?? 100, setG("bottomClearanceHeight", 0)),
      selectField("Style", g.bottomClearanceStyle || "style_1", (v) => job.setParams(cab.id, { ...p, globalSettings: { ...g, bottomClearanceStyle: v } }), [
        { id: "style_1", label: "Style 1" },
        { id: "style_2", label: "Style 2" },
      ]),
    ]),
    ...columnBlocks,
    addCol,
    section("Position", [
      numField("X (mm)", cab.pose.x, setPose("x"), { min: -1e6 }),
      numField("Y (mm)", cab.pose.y, setPose("y"), { min: -1e6 }),
      numField("Rotation (°)", cab.pose.rotZ || 0, (v) => job.setPose(cab.id, { rotZ: ((Math.round(v / 90) * 90) % 360 + 360) % 360 }), { step: 90, min: -1e6 }),
    ]),
    checks,
    el("div", { class: "panel-foot" }, [remove]),
  );
}

function renderLounge(cab, mod, result, { checks, remove }) {
  const p = cab.params;
  const env = mod.envelope(p);
  const setEnv = (k) => (v) => job.setParams(cab.id, mod.setEnvelope(p, { [k]: Math.max(mod.minSize[k], v) }));
  const setP = (k, min) => (v) => job.setParams(cab.id, { ...p, [k]: min == null ? v : Math.max(min, v) });
  const setPose = (k) => (v) => job.setPose(cab.id, { [k]: v });
  const styles = [
    { id: "I_SHAPE", label: "I" },
    { id: "L_SHAPE", label: "L" },
    { id: "U_SHAPE", label: "U" },
    { id: "PARALLEL", label: "Parallel" },
  ];
  const dimFields = [];
  if (p.style === "PARALLEL") {
    dimFields.push(numField("Total width (mm)", p.totalWidth, setP("totalWidth", mod.minSize.W)));
    dimFields.push(numField("Depth (mm)", p.depth, setP("depth", mod.minSize.D)));
    dimFields.push(numField("Each lounge (mm)", p.singleLoungeWidth, setP("singleLoungeWidth", 400)));
  } else if (p.style === "U_SHAPE") {
    dimFields.push(numField("Width (mm)", p.totalWidth || env.W, setP("totalWidth", mod.minSize.W)));
    dimFields.push(numField("Outer depth (mm)", p.depth || env.D, setP("depth", mod.minSize.D)));
    dimFields.push(numField("Run depth (mm)", p.mainDepth, setP("mainDepth", 200)));
  } else if (p.style === "L_SHAPE") {
    dimFields.push(numField("Main width (mm)", p.mainWidth, setP("mainWidth", 400)));
    dimFields.push(numField("Main depth (mm)", p.mainDepth, setP("mainDepth", 200)));
    dimFields.push(numField("L width (mm)", p.lWidth, setP("lWidth", 400)));
    dimFields.push(numField("L depth (mm)", p.lDepth, setP("lDepth", 400)));
    dimFields.push(selectField("L position", p.lPosition || "RIGHT", (v) => job.setParams(cab.id, { ...p, lPosition: v }), [
      { id: "LEFT", label: "Left" }, { id: "RIGHT", label: "Right" },
    ]));
    dimFields.push(selectField("L front access", p.lFrontAccess || "NONE", (v) => job.setParams(cab.id, { ...p, lFrontAccess: v }), [
      { id: "NONE", label: "None" }, { id: "DRAWER", label: "Drawer" }, { id: "FLAP", label: "Flap" },
    ]));
  } else {
    dimFields.push(numField("Length (mm)", p.mainWidth, setP("mainWidth", mod.minSize.W)));
    dimFields.push(numField("Depth (mm)", p.mainDepth, setP("mainDepth", mod.minSize.D)));
  }

  panel.replaceChildren(
    el("div", { class: "panel-head" }, [
      el("div", { class: "panel-title", text: `${mod.label}` }),
      el("div", { class: "panel-sub", text: `${cab.id} · ${result?.boards?.length || 0} boards` }),
    ]),
    mountSchematic(cab, mod, result),
    section("Layout", [
      selectField("Style", p.style || "I_SHAPE", (v) => job.setParams(cab.id, loungeWithStyle(p, v)), styles),
      numField("Height (mm)", p.height, setEnv("H")),
      checkField("Top lids", p.topLidEnabled !== false, (on) => job.setParams(cab.id, { ...p, topLidEnabled: on })),
      checkField("Wheel avoidance", !!p.wheelAvoidanceEnabled, (on) => job.setParams(cab.id, { ...p, wheelAvoidanceEnabled: on })),
      ...(p.wheelAvoidanceEnabled ? [
        numField("Avoidance depth (mm)", p.avoidanceDepth ?? 300, setP("avoidanceDepth", 0)),
        numField("Avoidance height (mm)", p.avoidanceHeight ?? 250, setP("avoidanceHeight", 0)),
      ] : []),
    ]),
    section("Footprint", dimFields),
    section("Position", [
      numField("X (mm)", cab.pose.x, setPose("x"), { min: -1e6 }),
      numField("Y (mm)", cab.pose.y, setPose("y"), { min: -1e6 }),
      numField("Rotation (°)", cab.pose.rotZ || 0, (v) => job.setPose(cab.id, { rotZ: ((Math.round(v / 90) * 90) % 360 + 360) % 360 }), { step: 90, min: -1e6 }),
    ]),
    checks,
    el("div", { class: "panel-foot" }, [remove]),
  );
}

function renderCabinet(cab) {
  if (geoDrag && geoDrag.cabId === cab.id && geoDrag.refresh) {
    geoDrag.refresh(cab, job.resultFor(cab.id));
    return;
  }
  const mod = getModule(cab.moduleId);
  const result = job.resultFor(cab.id);
  const env = mod.envelope(cab.params);
  const p = cab.params;
  const cpt = p.panelThickness ?? thickness(job.getStock(), "carcass");
  const interior = mod.panel === "tall" && result?.stacking?.functionalZoneTotal
    ? Math.round(result.stacking.functionalZoneTotal * 10) / 10
    : Math.round((env.H - 2 * cpt) * 10) / 10;

  const setEnv = (k) => (v) => job.setParams(cab.id, mod.setEnvelope(p, { [k]: Math.max(mod.minSize[k], v) }));
  const setParam = (k, min = 0) => (v) => job.setParams(cab.id, { ...p, [k]: Math.max(min, v) });
  const setPose = (k) => (v) => job.setPose(cab.id, { [k]: v });

  const zones = p.zones || [];
  const zoneRows = zones.map((z, i) => {
    const type = el("select", {
      onchange: (e) => {
        const next = zones.map((zz) => ({ ...zz }));
        next[i].type = e.target.value;
        if (mod.panel === "tall" && e.target.value === "double_door") next[i].verticalDivider = true;
        e.target.blur();
        const params = mod.panel === "tall" ? withTallFridgeDefaults({ ...p, zones: next }) : { ...p, zones: next };
        job.setParams(cab.id, params);
      },
    }, mod.zoneTypes.map((t) => el("option", { value: t.id, text: t.label, selected: t.id === z.type })));
    const height = el("input", { type: "number", value: z.height, step: 1, min: 0 });
    height.addEventListener("change", () => {
      const v = Number(height.value);
      if (!Number.isFinite(v) || v <= 0) { height.value = z.height; return; }
      // Changing one zone: the neighbour below (or above for the last) absorbs the difference.
      const next = zones.map((zz) => ({ ...zz }));
      const j = i < next.length - 1 ? i + 1 : i - 1;
      const delta = v - next[i].height;
      if (j >= 0 && next[j].height - delta >= 60) {
        next[i].height = v;
        next[j].height = Math.round((next[j].height - delta) * 10) / 10;
        job.setParams(cab.id, { ...p, zones: next });
      } else {
        height.value = z.height;
      }
    });
    const remove = el("button", { class: "icon", title: "Remove zone", text: "×", disabled: zones.length <= 1,
      onclick: () => {
        const next = zones.filter((_, k) => k !== i);
        job.setParams(cab.id, { ...p, zones: fitZones(next, interior) });
      } });
    return el("div", { class: "zone-row" }, [el("span", { class: "zone-idx", text: String(i + 1) }), type, height, remove]);
  });

  const addZone = el("button", { class: "tb wide", text: "+ Add zone", onclick: () => {
    // New zone takes up to 150 mm from the tallest existing zone.
    const next = zones.map((zz) => ({ ...zz }));
    const tallest = next.reduce((a, b) => (b.height > a.height ? b : a), next[0]);
    const take = Math.min(150, tallest.height - MIN_ZONE_HEIGHT);
    const zone = { id: `zone-${Date.now().toString(36)}`, type: "drawer", height: take };
    if (take >= MIN_ZONE_HEIGHT) {
      tallest.height = Math.round((tallest.height - take) * 10) / 10;
      next.push(zone);
      job.setParams(cab.id, { ...p, zones: next });
    } else {
      next.push({ ...zone, height: MIN_ZONE_HEIGHT });
      job.setParams(cab.id, { ...p, zones: fitZones(next, interior) });
    }
  } });

  const errors = result?.validation?.errors || [];
  const warnings = result?.validation?.warnings || [];

  const checks = errors.length || warnings.length
    ? el("div", { class: "panel-section" }, [
        el("div", { class: "sec-title", text: "Checks" }),
        ...errors.map((m) => el("div", { class: "msg err", text: m })),
        ...warnings.map((m) => el("div", { class: "msg warn", text: m })),
      ])
    : null;
  const remove = el("button", { class: "tb danger", text: "Remove cabinet", onclick: () => job.removeCabinet(cab.id) });

  // Nose slab (Bedroom): width and height come from the vehicle, only the depth is free;
  // the depth keeps the nose end fixed and moves the room-side face (like its D handle).
  const setNoseDepth = (v) => {
    const D = Math.max(mod.minSize.D, v);
    const shift = env.D - D;
    const a = ((cab.pose.rotZ || 0) * Math.PI) / 180;
    const before = job.snapshot();
    job.updateCabinet(cab.id, (c) => {
      c.params = mod.setEnvelope(c.params, { D });
      c.pose = { ...c.pose, x: c.pose.x - Math.sin(a) * shift, y: c.pose.y + Math.cos(a) * shift };
    });
    job.commitSnapshot(before);
  };
  const fromSpace = "Set by the vehicle: redefine the space to change it";
  const noseChildren = [
    el("div", { class: "panel-head" }, [
      el("div", { class: "panel-title", text: mod.label }),
      el("div", { class: "panel-sub", text: `${cab.id} · nose slab · solid volume` }),
    ]),
    section("Outer size (= nose slab)", [
      numField("Width (mm)", env.W, () => {}, { readOnly: fromSpace }),
      numField("From front (mm)", env.D, setNoseDepth),
      numField("Height at room face (mm)", env.H, () => {}, { readOnly: fromSpace }),
    ]),
    el("div", { class: "panel-section" }, [
      el("div", { class: "empty small", text: "One solid volume for now — tunnel boot, robes and overhead are partitioned inside it in a later version." }),
    ]),
    checks,
    el("div", { class: "panel-foot" }, [remove]),
  ];

  // Bed box: glued to the body (centre line, body face); W / D free, height = tunnel boot.
  const bedChildren = [
    el("div", { class: "panel-head" }, [
      el("div", { class: "panel-title", text: mod.label }),
      el("div", { class: "panel-sub", text: `${cab.id} · on the body's room face · centred · solid volume` }),
    ]),
    section("Size", [
      numField("Width (mm)", env.W, setEnv("W")),
      numField("Length from body (mm)", env.D, setEnv("D")),
      numField("Height (mm)", env.H, () => {}, { readOnly: "Tunnel boot height — set together with the body's boot later" }),
    ]),
    el("div", { class: "panel-section" }, [
      el("div", { class: "empty small", text: "Follows the Bedroom body: always centred on the van and against the body's room-side face. One solid volume for now." }),
    ]),
    checks,
    el("div", { class: "panel-foot" }, [remove]),
  ];

  const bedSideChildren = [
    el("div", { class: "panel-head" }, [
      el("div", { class: "panel-title", text: mod.label }),
      el("div", { class: "panel-sub", text: `${cab.id} · against the body · ${p.side === "right" ? "right" : "left"} wall · solid volume` }),
    ]),
    section("Size", [
      selectField("Side", p.side === "right" ? "right" : "left", (v) => job.setParams(cab.id, { ...p, side: v }), [
        { id: "left", label: "Left wall" }, { id: "right", label: "Right wall" },
      ]),
      numField("Width (mm)", env.W, setEnv("W")),
      numField("Length from body (mm)", env.D, setEnv("D")),
      numField("Height (mm)", env.H, setEnv("H")),
    ]),
    el("div", { class: "panel-section" }, [
      el("div", { class: "empty small", text: "Follows the Bedroom body and the chosen side wall. One solid volume for now. One table per side." }),
    ]),
    checks,
    el("div", { class: "panel-foot" }, [remove]),
  ];

  if (mod.panel === "ohc") {
    renderOverhead(cab, mod, result, { checks, remove });
    fillDrawer(result, errors, warnings);
    return;
  }
  if (mod.panel === "kitchen") {
    renderKitchen(cab, mod, result, { checks, remove });
    fillDrawer(result, errors, warnings);
    return;
  }
  if (mod.panel === "lounge") {
    renderLounge(cab, mod, result, { checks, remove });
    fillDrawer(result, errors, warnings);
    return;
  }
  if (mod.panel === "uohc") {
    renderUOverhead(cab, mod, result, { checks, remove });
    fillDrawer(result, errors, warnings);
    return;
  }

  const tallExtras = mod.panel === "tall" ? [
    section("Top / bottom", [
      selectField("Top", p.topSystem?.style || "style_1", (v) => {
        const topSystem = { ...(p.topSystem || {}), style: v };
        if (v === "style_2" && !(topSystem.height >= 60)) topSystem.height = 60;
        job.setParams(cab.id, { ...p, topSystem });
      }, [{ id: "style_1", label: "Style 1 (rail)" }, { id: "style_2", label: "Style 2 (solid)" }]),
      p.topSystem?.style === "style_2"
        ? numField("Top height (mm)", p.topSystem.height ?? 60, (v) => job.setParams(cab.id, { ...p, topSystem: { ...p.topSystem, height: Math.max(60, v) } }))
        : null,
      selectField("Bottom", p.bottomSystem?.style || "style_1", (v) => {
        const bottomSystem = { ...(p.bottomSystem || {}), style: v };
        if (v === "style_2" && !(bottomSystem.height >= 60)) bottomSystem.height = 60;
        job.setParams(cab.id, { ...p, bottomSystem });
      }, [{ id: "style_1", label: "Style 1 (rail)" }, { id: "style_2", label: "Style 2 (solid)" }]),
      p.bottomSystem?.style === "style_2"
        ? numField("Bottom height (mm)", p.bottomSystem.height ?? 60, (v) => job.setParams(cab.id, { ...p, bottomSystem: { ...p.bottomSystem, height: Math.max(60, v) } }))
        : null,
    ].filter(Boolean)),
    section("Avoidance", [
      checkField("Enabled", !!p.avoidance?.enabled, (on) => job.setParams(cab.id, { ...p, avoidance: { depth: 200, height: 400, ...(p.avoidance || {}), enabled: on } })),
      ...(p.avoidance?.enabled ? [
        numField("Depth (mm)", p.avoidance.depth ?? 200, (v) => job.setParams(cab.id, { ...p, avoidance: { ...p.avoidance, depth: Math.max(0, v) } })),
        numField("Height (mm)", p.avoidance.height ?? 400, (v) => job.setParams(cab.id, { ...p, avoidance: { ...p.avoidance, height: Math.max(0, v) } })),
      ] : []),
    ]),
  ] : [];

  const boxChildren = [
    el("div", { class: "panel-head" }, [
      el("div", { class: "panel-title", text: `${mod.label} cabinet` }),
      el("div", { class: "panel-sub", text: `${cab.id} · ${result?.boards?.length || 0} boards` }),
    ]),
    mountSchematic(cab, mod, result),
    section("Outer size (= box)", [
      numField("Width (mm)", env.W, setEnv("W")),
      numField("Depth (mm)", env.D, setEnv("D")),
      numField("Height (mm)", env.H, setEnv("H")),
    ]),
    section(mod.panel === "tall" ? `Zones · bottom → top · ${interior} mm` : `Zones · top → bottom · interior ${interior} mm`, [
      el("div", { class: "zone-list" }, zoneRows),
      addZone,
    ]),
    ...zones.flatMap((z, i) => {
      if (mod.panel !== "tall" || z.type !== "fridge") return [];
      const setFridge = (k) => (v) => {
        const next = zones.map((zz, j) => (j === i ? { ...zz, [k]: v } : { ...zz }));
        job.setParams(cab.id, withTallFridgeDefaults({ ...p, zones: next }));
      };
      return [section(`Fridge · zone ${i + 1}`, [
        numField("Appliance width (mm)", z.applianceWidthMm || 550, setFridge("applianceWidthMm")),
        numField("Appliance depth (mm)", z.applianceDepthMm || 580, setFridge("applianceDepthMm")),
        numField("Appliance height (mm)", z.applianceHeightMm || z.height, setFridge("applianceHeightMm")),
      ])];
    }),
    ...tallExtras,
    section("Position", [
      numField("X (mm)", cab.pose.x, setPose("x"), { min: -1e6 }),
      numField("Y (mm)", cab.pose.y, setPose("y"), { min: -1e6 }),
      numField("Rotation (°)", cab.pose.rotZ || 0, (v) => job.setPose(cab.id, { rotZ: ((Math.round(v / 90) * 90) % 360 + 360) % 360 }), { step: 90, min: -1e6 }),
    ]),
    section("Material", [
      el("div", { class: "kv" }, [el("span", { text: "Carcass" }), el("b", { text: p.carcassColorName || p.carcassColor || "White Stipple" })]),
      el("div", { class: "kv" }, [el("span", { text: "Door" }), el("b", { text: p.doorColorName || p.doorColor || "—" })]),
      numField("Carcass thickness", cpt, setParam("panelThickness", 1), { step: 0.5 }),
      numField("Front thickness", p.frontPanelThickness ?? thickness(job.getStock(), "door"), setParam("frontPanelThickness", 1), { step: 0.5 }),
      numField("Front clearance", p.frontClearance ?? 2.5, setParam("frontClearance", 0), { step: 0.5 }),
    ]),
    checks,
    el("div", { class: "panel-foot" }, [remove]),
  ];
  panel.replaceChildren(...(mod.placement === "nose" ? noseChildren : mod.placement === "bedBox" ? bedChildren : mod.placement === "bedSide" ? bedSideChildren : boxChildren).filter(Boolean));
  fillDrawer(result, errors, warnings);
}

/** Checks + Boards tabs of the bottom drawer for a generated cabinet. */
function fillDrawer(result, errors, warnings) {
  drawerChecks.replaceChildren(
    errors.length || warnings.length
      ? el("div", {}, [
          ...errors.map((m) => el("div", { class: "msg err", text: m })),
          ...warnings.map((m) => el("div", { class: "msg warn", text: m })),
        ])
      : el("div", { class: "empty ok", text: "All checks passed." }),
  );

  const boards = result?.boards || [];
  drawerBoards.replaceChildren(
    boards.length
      ? el("table", { class: "grid" }, [
          el("thead", {}, [el("tr", {}, ["ID", "Name", "Type", "L (mm)", "W (mm)", "T (mm)"].map((h) => el("th", { text: h })))]),
          el("tbody", {}, boards.map((b) => {
            const dx = b.x1 - b.x0, dy = b.y1 - b.y0, dz = b.z1 - b.z0;
            const dims = [dx, dy, dz].filter((_, k) => ["X", "Y", "Z"][k] !== b.thicknessAxis).sort((a, c) => c - a);
            return el("tr", {}, [
              el("td", { text: b.id }), el("td", { text: b.name }), el("td", { text: b.boardType }),
              el("td", { text: dims[0].toFixed(1) }), el("td", { text: dims[1].toFixed(1) }), el("td", { text: String(b.materialThickness) }),
            ]);
          })),
        ])
      : el("div", { class: "empty", text: "No boards — fix the checks first." }),
  );
}

function renderPlane(pl) {
  const AXIS = { x: "X (width)", y: "Y (depth)", z: "Z (height)" };
  panel.replaceChildren(
    el("div", { class: "panel-head" }, [
      el("div", { class: "panel-title", text: "Construction plane" }),
      el("div", { class: "panel-sub", text: pl.id }),
    ]),
    section("Offset", [
      el("div", { class: "kv" }, [el("span", { text: "From" }), el("b", { text: pl.from?.label || "—" })]),
      el("div", { class: "kv" }, [el("span", { text: "Distance" }), el("b", { text: `${Math.round(pl.offset)} mm` })]),
      el("div", { class: "kv" }, [el("span", { text: "Plane" }), el("b", { text: `${AXIS[pl.axis] || pl.axis} = ${Math.round(pl.value)}` })]),
    ]),
    el("div", { class: "panel-section" }, [
      el("div", { class: "empty small", text: "Intersections with walls, floor, ceiling and roof are snap points. Delete removes the plane." }),
    ]),
    el("div", { class: "panel-foot" }, [
      el("button", { class: "tb danger", text: "Remove plane", onclick: () => job.removePlane(pl.id) }),
    ]),
  );
  drawerChecks.replaceChildren(el("div", { class: "empty", text: "A construction plane has no checks." }));
  drawerBoards.replaceChildren(el("div", { class: "empty", text: "A construction plane has no boards." }));
}

export function renderPanel() {
  const sel = job.getSelected();
  // The wide editor page only while an OHC is selected; everything else uses the narrow panel.
  const wide = !!sel && usesGeometryPanel(getModule(sel.moduleId));
  panel.classList.toggle("wide", wide);
  app.classList.toggle("wide-right", wide);
  if (sel) renderCabinet(sel);
  else {
    const pl = job.getSelectedPlane();
    if (pl) renderPlane(pl);
    else renderSpace();
  }
}
