// Defaults the first-pass panel must fill so a control change still generates.
// Does not change Fusion formulas.

const round1 = (v) => Math.round(v * 10) / 10;

/** Fridge zones need appliance mm; a type switch from the panel often omits them. */
export function withTallFridgeDefaults(params) {
  const W = Number(params.cabinetWidth) || 600;
  const zones = (params.zones || []).map((z) => {
    if (z.type !== "fridge") return z;
    return {
      ...z,
      applianceWidthMm: z.applianceWidthMm || Math.min(550, Math.max(400, round1(W - 61))),
      applianceDepthMm: z.applianceDepthMm || 580,
      applianceHeightMm: z.applianceHeightMm || z.height,
    };
  });
  return { ...params, zones };
}

function loungeEnvelope(params) {
  const style = params.style || "I_SHAPE";
  const H = params.height;
  if (style === "I_SHAPE") return { W: params.mainWidth, D: params.mainDepth, H };
  if (style === "PARALLEL") return { W: params.totalWidth, D: params.depth, H };
  if (style === "U_SHAPE") return { W: params.totalWidth || params.mainWidth, D: params.depth || params.mainDepth, H };
  return { W: params.mainWidth, D: Math.max(params.mainDepth || 0, params.lDepth || 0), H };
}

/** Keep the current box when the user changes I / L / Parallel / U. */
export function loungeWithStyle(params, style) {
  const env = loungeEnvelope(params);
  const next = { ...params, style };
  if (style === "PARALLEL") {
    next.totalWidth = round1(env.W);
    next.depth = round1(Math.max(env.D || 0, 400));
    const maxEach = Math.max(400, Math.floor((next.totalWidth - 100) / 2));
    next.singleLoungeWidth = Math.min(next.singleLoungeWidth || 1500, maxEach);
  } else if (style === "U_SHAPE") {
    next.totalWidth = round1(Math.max(env.W, 1200));
    next.depth = round1(Math.max(env.D || 0, 800));
    next.mainDepth = round1(params.mainDepth || Math.min(600, next.depth - 400));
  } else if (style === "L_SHAPE") {
    next.mainWidth = round1(params.mainWidth || env.W);
    next.mainDepth = round1(params.mainDepth || Math.min(env.D, 600) || env.D);
    next.lDepth = round1(Math.max(params.lDepth || 0, env.D, 400));
  } else {
    next.mainWidth = round1(env.W);
    next.mainDepth = round1(env.D);
  }
  return next;
}
