export const LAYER_Z_INDEX = {
  dropdown: 10,
  emergencyBackButton: 30,
  placesOverlay: 9999,
} as const;

const ELEVATION_DROPDOWN = 10;
const ELEVATION_EMERGENCY_BACK_BUTTON = 8;
const ELEVATION_PLACES_OVERLAY = 999;

export const LAYER_ELEVATION = {
  dropdown: ELEVATION_DROPDOWN,
  emergencyBackButton: ELEVATION_EMERGENCY_BACK_BUTTON,
  placesOverlay: ELEVATION_PLACES_OVERLAY,
} as const;