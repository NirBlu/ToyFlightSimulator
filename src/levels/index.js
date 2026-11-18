import livingRoom from "./livingRoom.js?v=13";
import frontLawn from "./frontLawn.js?v=13";
import toyRoom from "./toyRoom.js?v=13";
import parkingLot from "./parkingLot.js?v=13";
import megaMart from "./megaMart.js?v=13";

/**
 * Every level is a plain module: { id, name, short, tagline, icon, heroTitle,
 * objective, env, create(scene) }. create() returns the runtime level:
 * { furniture, architecture, colliders, pads, balls, groundZones, ground,
 *   bounds, spawn, spawnYaw, spawnPadId, targetPadId, update(time) }.
 * To add a level, write src/levels/myLevel.js and add it to this list.
 */
export const LEVELS = [livingRoom, frontLawn, toyRoom, parkingLot, megaMart];
export function getLevel(id) {
  return LEVELS.find((l) => l.id === id) || LEVELS[0];
}
