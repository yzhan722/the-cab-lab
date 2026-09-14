# Migration report — PARTIAL

Target repository: **The Cab Lab** (`the-cab-lab`), not Custom Flat-Pack.
The PRD named CFP; the product owner corrected the target before this branch.

Human stamps: A–F as recommended; Tall / Base / Lounge rail entries feature-flagged, default **off**.

## Baselines

```text
SOURCE_SHA=89bedb204c5aabe839409a62d56609f2ef86ce20
TARGET_BASE_SHA=3657cbe080b77e4d7db1b67b750cd34b499b1f5d
FINAL_BRANCH=feat/generator-migration-all-modules
NODE=v22.19.0
```

## Outcome

**PARTIAL.** Round 0–1 (inventory, native copies, first-pass boards in Cab Lab 3D, gated rail) are in. Fusion UI surface, every scenario fixture, and human 3D QA remain.

This is the first pass: three new generators produce boards; existing Small / OHC / Bedroom / Bed Box stay green; rail entries stay planned unless `CABLAB_MIGRATED_GENERATORS=1`.

## Implemented

### General Tall

Native copy of Fusion `modules/generalTallCabinet/`. Default 2000×600×584 mm, three zones (bottom → top). Fridge is a zone. Fronts concatenated for 3D in `renderer/displayBoards.js`.

### Overhead

**Not migrated.** Cab Lab OHC already has LED groove, rangehood, and final assembled pose. Fusion `89bedb2` has neither LED nor rangehood (`INTENTIONAL_DIVERGENCE`).

### Kitchen

Native copy of `modules/kitchenCabinet/`. Default one 800×560×720 left-door column. `kitchen_base.json` oracle fixture. V-panel machining prefs stay on params (decision D). V-panel placement uses YZ profile bbox.

### Lounge

Native copy of `modules/loungeGenerator/`. Default `I_SHAPE`. I/L/PARALLEL compared to the oracle at 0.01 mm. `U_SHAPE` is offered in the panel but Fusion itself still runs the L path at this SHA.

## Cab Lab wiring

- `build-generators.js` entries for `generalTall`, `kitchen`, `lounge`
- `renderer/modules.js` envelope / dividers / defaults
- `renderer/panel.js` first-pass editors (tall styles + avoidance; kitchen columns; lounge style)
- `preload.js` `flags.migratedGenerators` from `CABLAB_MIGRATED_GENERATORS`
- Rail: planned unless the flag is `1`

## Tests

```text
npm run test:generators → PASS (11 suites)
  smallCabinet, overheadCabinet (Cab Lab OHC, including LED + rangehood),
  generalTall (stacking, boundary, overlap, fridge, regression, generator),
  lounge generator.test.ts,
  first-pass (existing + new modules + U→L),
  oracle-parity (0.01 mm native vs vendored Fusion)
npm run build:generators → PASS
```

Decision F: 3D visual QA left to a human.

## Known differences

See `docs/generator-migration/parity-matrix.md`.

## Remaining (not this pass)

- Full Fusion palette (hinges, locks, exterior sides, wheel avoidances, V-panel machining UI)
- Human 3D QA of placed Tall / Base / Lounge
- U-overhead module
- Replacing Cab Lab OHC with Fusion 89bedb2 (must not happen)
