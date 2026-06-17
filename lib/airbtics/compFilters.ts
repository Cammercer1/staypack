type AirbticsComp = Record<string, unknown>;

const ROOM_TYPES_TO_EXCLUDE = new Set([
  "hotel_room",
  "private_room",
  "shared_room",
]);

function normalizeRoomType(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

export function isEntireHomeComp(comp: AirbticsComp) {
  const roomType = normalizeRoomType(comp.room_type);

  if (!roomType) {
    return true;
  }

  return !ROOM_TYPES_TO_EXCLUDE.has(roomType);
}

export function isRoomTypeComp(comp: AirbticsComp) {
  return ROOM_TYPES_TO_EXCLUDE.has(normalizeRoomType(comp.room_type));
}

export function filterEntireHomeComps<T extends AirbticsComp>(comps: T[]) {
  return comps.filter(isEntireHomeComp);
}
