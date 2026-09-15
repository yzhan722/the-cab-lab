// Feature flags from the Electron preload.
// Tall / Base / Lounge are normal rail modules (same as Small).
// CABLAB_MIGRATED_GENERATORS=0 hides them if a job must not show the new entries.

export const migratedGenerators = !(
  typeof window !== "undefined"
  && window.cablab
  && window.cablab.flags
  && window.cablab.flags.migratedGenerators === false
);

export const MIGRATED_MODULE_IDS = ["generalTallCabinet", "kitchenCabinet", "loungeGenerator"];

/** All registered modules appear on the rail except when the hide-flag is set. */
export function isRailModule(id) {
  if (MIGRATED_MODULE_IDS.includes(id)) return migratedGenerators;
  return true;
}
