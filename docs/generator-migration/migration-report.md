# Migration report — PARTIAL

Target repository: **The Cab Lab** (`the-cab-lab`), not Custom Flat-Pack.
The PRD named CFP; the product owner corrected the target before this branch.

Human stamps: A–F as recommended. Tall / Base / Lounge are normal rail modules (same as Small). `CABLAB_MIGRATED_GENERATORS=0` hides those three if needed.

## Baselines

```text
SOURCE_SHA=89bedb204c5aabe839409a62d56609f2ef86ce20
TARGET_BASE_SHA=3657cbe080b77e4d7db1b67b750cd34b499b1f5d
FINAL_BRANCH=feat/generator-migration-all-modules
NODE=v22.19.0
```

## Outcome

**PARTIAL.** Round 0–1 (inventory, native copies, first-pass boards in Cab Lab 3D, gated rail) are in. Fusion UI surface, every scenario fixture, and human 3D QA remain.

This is the first pass: three new generators produce boards; existing Small / OHC / Bedroom / Bed Box stay green. Tall / Base / Lounge use the same rail + panel path as Small (no extra geometry branch). Hide them with `CABLAB_MIGRATED_GENERATORS=0`.

## Implemented

### General Tall

Native copy of Fusion `modules/generalTallCabinet/`. Default 2000×600×584 mm, three zones (bottom → top). Fridge is a zone. Fronts concatenated for 3D in `renderer/displayBoards.js`.

### Overhead

**Not migrated.** Cab Lab OHC already has LED groove, rangehood, and final assembled pose. Fusion `89bedb2` has neither LED nor rangehood (`INTENTIONAL_DIVERGENCE`).

### Kitchen

Native copy of `modules/kitchenCabinet/`. Default one 800×560×720 left-door column. `kitchen_base.json` oracle fixture. V-panel machining prefs stay on params (decision D). V-panel placement uses YZ profile bbox.

### Lounge

Native copy of `modules/loungeGenerator/`. Default `I_SHAPE`. I/L/PARALLEL compared to the oracle at 0.01 mm. Cab Lab `U_SHAPE` is three I-shape runs (`generateUShapeLoungeGeometry`); Fusion at this SHA still falls through to L (`INTENTIONAL_DIVERGENCE`). Placement is a floor polyline (I / L / U / Parallel), not a one-shot AABB.

## Cab Lab wiring

- `build-generators.js` entries for `generalTall`, `kitchen`, `lounge`
- `renderer/modules.js` envelope / dividers / defaults
- `renderer/panel.js` first-pass editors (tall styles + avoidance; kitchen columns; lounge I/L/U/Parallel) plus the 2D schematic
- Lounge rail group + `renderer/loungePlace.js` polyline
- `preload.js` `flags.migratedGenerators` from `CABLAB_MIGRATED_GENERATORS`
- Rail: Tall / Base / Lounge are live; `CABLAB_MIGRATED_GENERATORS=0` hides them

## Tests

```text
npm run test:generators → PASS (15 suites)
  smallCabinet, overheadCabinet (Cab Lab OHC, including LED + rangehood),
  generalTall (stacking, boundary, overlap, fridge, regression, generator),
  lounge generator.test.ts (including Cab Lab U = three I runs),
  first-pass (existing + new modules + U three-run),
  oracle-parity (0.01 mm native vs vendored Fusion; U excluded),
  simulate-user-modules, panel-options, u-overhead, lounge-place
npm run build:generators → PASS
```

Decision F: 3D visual QA left to a human.

## Known differences

See `docs/generator-migration/parity-matrix.md`.

## Remaining (not this pass)

- Full Fusion palette (hinges, locks, exterior sides, wheel avoidances, V-panel machining UI)
- Human 3D QA of placed Tall / Base / Lounge
- Replacing Cab Lab OHC with Fusion 89bedb2 (must not happen)
