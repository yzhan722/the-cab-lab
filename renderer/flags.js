// Feature flags from the Electron preload (process env at launch).
// CABLAB_MIGRATED_GENERATORS=1 shows Tall / Base / Lounge on the module rail.
// Generators stay registered so a job that already has those cabinets still opens.

export const migratedGenerators = !!(
  typeof window !== "undefined"
  && window.cablab
  && window.cablab.flags
  && window.cablab.flags.migratedGenerators
);

export const MIGRATED_MODULE_IDS = ["generalTallCabinet", "kitchenCabinet", "loungeGenerator"];

/** Rail entries: Fusion-migrated modules stay planned until the flag is on. */
export function isRailModule(id) {
  if (MIGRATED_MODULE_IDS.includes(id)) return migratedGenerators;
  return true;
}
