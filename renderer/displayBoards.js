// Fusion generators emit carcass, fronts and (kitchen) V-panels separately;
// lounge emits panels/lids with a `placement` box. Cab Lab 3D draws `result.boards`
// with x0..z1 (and optional profileVector). This adapter does not change formulas.

function num(v, d = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

function yzRange(profile) {
  if (!Array.isArray(profile) || profile.length < 2) return { y0: 0, y1: 1, z0: 0, z1: 1 };
  let y0 = Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const pt of profile) {
    const y = num(pt[0]), z = num(pt[1]);
    y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    z0 = Math.min(z0, z); z1 = Math.max(z1, z);
  }
  if (!Number.isFinite(y0)) return { y0: 0, y1: 1, z0: 0, z1: 1 };
  return { y0, y1, z0, z1 };
}

function thicknessAxis(plane) {
  if (plane === "YZ") return "X";
  if (plane === "XZ") return "Y";
  return "Z";
}

function profileVector(plane, outer) {
  if (!Array.isArray(outer) || outer.length < 3) return undefined;
  return outer.map((pt) => {
    const a = num(pt[0]), b = num(pt[1]);
    if (plane === "YZ") return { y: a, z: b };
    if (plane === "XZ") return { x: a, z: b };
    return { x: a, y: b };
  });
}

function asValidation(result) {
  const errors = result?.validation?.errors ?? result?.errors ?? [];
  const warnings = [
    ...(result?.validation?.warnings ?? []),
    ...(result?.warnings ?? []),
  ];
  return { errors, warnings };
}

function loungeToBoard(p) {
  const pl = p.placement || {};
  const plane = p.profilePlane || "XY";
  const kind = String(p.kind || "");
  const isFront = kind === "front_panel" || kind === "cabinet_door";
  return {
    id: p.id,
    name: p.name || p.id,
    category: isFront ? "front_panel" : "carcass",
    boardType: kind || p.id,
    materialThickness: num(p.thickness, p.materialThickness),
    profilePlane: plane,
    thicknessAxis: thicknessAxis(plane),
    x0: num(pl.x0), x1: num(pl.x1),
    y0: num(pl.y0), y1: num(pl.y1),
    z0: num(pl.z0), z1: num(pl.z1),
    profileVector: profileVector(plane, p.outer),
  };
}

export function displayGeneralTall(result) {
  const fronts = (result.frontPanels || []).map((fp) => ({
    id: fp.id,
    name: fp.id,
    category: "front_panel",
    boardType: fp.resolvedType || "front",
    materialThickness: num(fp.thickness),
    profilePlane: "XZ",
    thicknessAxis: "Y",
    x0: fp.x0, x1: fp.x1, y0: fp.y0, y1: fp.y1, z0: fp.z0, z1: fp.z1,
    zoneId: fp.zoneId,
    lockCutout: fp.lockCutout,
  }));
  return { ...result, boards: [...(result.boards || []), ...fronts], validation: asValidation(result) };
}

export function displayKitchen(result) {
  const boards = [];
  for (const b of result.boards || []) {
    const plane = b.profilePlane || "XY";
    const pv = Array.isArray(b.profileXY) && b.profileXY.length >= 3
      ? b.profileXY.map(([x, y]) => ({ x: num(x), y: num(y) }))
      : undefined;
    boards.push({
      ...b,
      name: b.name || b.id,
      category: b.category || "carcass",
      boardType: b.boardType || b.type || b.id,
      profileVector: pv,
      thicknessAxis: b.thicknessAxis || thicknessAxis(plane),
    });
  }
  for (const fp of result.frontPanels || []) {
    boards.push({
      id: fp.id,
      name: fp.id,
      category: "front_panel",
      boardType: fp.type || "front",
      materialThickness: num(fp.thickness),
      profilePlane: "XZ",
      thicknessAxis: "Y",
      x0: fp.x0, x1: fp.x1, y0: fp.y0, y1: fp.y1, z0: fp.z0, z1: fp.z1,
    });
  }
  for (const v of result.vPanels || []) {
    const yz = yzRange(v.yzProfile);
    boards.push({
      id: v.id,
      name: v.id,
      category: "carcass",
      boardType: "v_panel",
      materialThickness: num(v.materialThickness, 16),
      profilePlane: "YZ",
      thicknessAxis: "X",
      x0: v.x0, x1: v.x1, y0: yz.y0, y1: yz.y1, z0: yz.z0, z1: yz.z1,
      profileVector: Array.isArray(v.yzProfile) ? v.yzProfile.map(([y, z]) => ({ y: num(y), z: num(z) })) : undefined,
    });
  }
  return { ...result, boards, validation: asValidation(result) };
}

export function displayLounge(result) {
  const boards = [
    ...(result.panels || []).map(loungeToBoard),
    ...(result.lids || []).map(loungeToBoard),
  ];
  return { ...result, boards, validation: asValidation(result) };
}
