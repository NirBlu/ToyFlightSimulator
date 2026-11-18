import livingRoom from "./livingRoom.js?v=14";
import frontLawn from "./frontLawn.js?v=14";
import toyRoom from "./toyRoom.js?v=14";
import parkingLot from "./parkingLot.js?v=14";
import megaMart from "./megaMart.js?v=14";
import apartmentLobby from "./apartmentLobby.js?v=14";

/**
 * Every level is a plain module: { id, name, short, tagline, icon, heroTitle,
 * objective, env, create(scene) }. create() returns the runtime level:
 * { furniture, architecture, colliders, pads, balls, groundZones, ground,
 *   bounds, spawn, spawnYaw, spawnPadId, targetPadId, update(time) }.
 * To add a level, write src/levels/myLevel.js and add it to this list.
 */
export const LEVELS = [livingRoom, frontLawn, toyRoom, parkingLot, megaMart, apartmentLobby];
export function getLevel(id) {
  return LEVELS.find((l) => l.id === id) || LEVELS[0];
}
