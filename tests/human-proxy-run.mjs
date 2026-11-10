/** Sweep the human proxies over levels on the model (dev tool, not a test).
 *
 *   node tests/human-proxy-run.mjs [level|all] [runs=12] [persona|all] [--json out.json]
 *
 * Prints per level and persona: clears, median / p90 deaths and clear time,
 * the death heat map (4-column bins, most deaths first) and quit-risk spots
 * (a bin where one run died 3+ times; "stuck@col" = a run that never cleared). */
import { writeFileSync } from "node:fs";
import * as M from "../model.mjs";
import { LEVEL_IDS } from "../levels/index.mjs";
import { PERSONAS, runModel, summarize } from "./human-proxy.mjs";

const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const jsonAt = process.argv.indexOf("--json");
const levels = !args[0] || args[0] === "all" ? LEVEL_IDS : args[0].split(",");
const runs = Number(args[1] || 12);
const personas = !args[2] || args[2] === "all" ? Object.keys(PERSONAS) : args[2].split(",");
const out = {};
for (const id of levels) {
  out[id] = {};
  for (const persona of personas) {
    const t0 = Date.now();
    const results = [];
    for (let seed = 1; seed <= runs; seed++) results.push(runModel(M, id, persona, seed));
    const s = summarize(results);
    out[id][persona] = { ...s, results: results.map(({ seed, won, time, deaths, deathList }) => ({ seed, won, time, deaths, cols: deathList.map((d) => `${d.col}${d.reason[0]}`).join(" ") })) };
    console.log(`${id} ${PERSONAS[persona].label.padEnd(11)} clear ${s.cleared}/${s.runs}  deaths med ${s.deathsMedian} p90 ${s.deathsP90}  hearts lost med ${s.damageMedian} p90 ${s.damageP90} (cards ${s.hitsMedian})  chain max ${s.chainMax}  time med ${s.timeMedian}s p90 ${s.timeP90}s  heat ${JSON.stringify(s.heat)}  quit ${JSON.stringify(s.quitRisk)}  (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  }
}
if (jsonAt > 0) writeFileSync(process.argv[jsonAt + 1], JSON.stringify(out, null, 1));
