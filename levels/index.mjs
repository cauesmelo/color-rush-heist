/** World 1 "Green Forest": the six levels in play order. Each level module
 * exports one frozen level (levels/builder.mjs defineLevel). The campaign
 * (campaign.mjs) owns unlock order and saves; the model only plays one level. */
import L11 from "./1-1.mjs";
import L12 from "./1-2.mjs";
import L13 from "./1-3.mjs";
import L14 from "./1-4.mjs";
import L15 from "./1-5.mjs";
import L16 from "./1-6.mjs";

export const LEVELS = Object.freeze([L11, L12, L13, L14, L15, L16]);
export const LEVEL_IDS = Object.freeze(LEVELS.map((level) => level.id));
const byId = new Map(LEVELS.map((level) => [level.id, level]));
export const getLevel = (id) => byId.get(id) || null;
