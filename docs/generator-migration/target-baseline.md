# Target baseline

- SOURCE_SHA=`89bedb204c5aabe839409a62d56609f2ef86ce20`
- TARGET_BASE_SHA=`3657cbe080b77e4d7db1b67b750cd34b499b1f5d` (`main` product commit)
- Branch=`feat/generator-migration-all-modules`
- App: Electron + Three.js (`the-cab-lab`)
- Scripts: `npm start`, `npm run build:generators`, `npm run test:generators`

## TARGET_ARCHITECTURE_DRIFT

The PRD text names Custom Flat-Pack (`yzhan722/custom-flat-pack-platform`) as the target. The product owner corrected that: **this work lands in The Cab Lab**, not CFP.

Cab Lab contract (`.cursor/rules/cab-lab-core.mdc`):

- Geometry from `job.json` only
- Generators live in `generators/*/generator.ts` → esbuild `renderer/gen/*.js`
- Envelope **is** outer-size params; `renderer/modules.js` maps W/D/H + dividers
- 3D only displays boards; no booleans
- Units mm, Z up, origin front-left floor; fronts at negative local Y

There is no CFP `DesignSpec` / `compileCabinet` / `engineeringHash` / catalog templates. Dispatch is the module registry. Feature flag is `CABLAB_MIGRATED_GENERATORS=1` (Electron process env via `preload.js`), default off so Tall / Base / Lounge stay planned on the rail.

## Already-wired modules (must not regress)

`smallCabinet`, `overheadCabinet`, `bedroom`, `bedBox`.

OHC in Cab Lab is **ahead** of Fusion `89bedb2` (LED groove, rangehood, final assembled pose). It is not replaced.

## Baseline tests

Existing self-running `generators/smallCabinet/generator.test.ts` and `generators/overheadCabinet/generator.test.ts`. After this branch: `npm run test:generators`.
