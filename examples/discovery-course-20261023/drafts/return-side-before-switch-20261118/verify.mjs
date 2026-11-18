import fs from 'node:fs';
import assert from 'node:assert/strict';
import { buildLevel } from '../../build.mjs';
import { createReferenceEnvironment } from '../../../../src/reference/environment.js';
import { audit } from './final.mjs';
import { plans } from './plans.mjs';
import { parkedBeforeKey } from './early-parking.mjs';
import { readTrials } from './probe.mjs';
const read = name => JSON.parse(fs.readFileSync(new URL(name,import.meta.url)));
const fresh=audit(), stored=read('final-task.json');
assert.deepEqual(fresh.map,stored.map);
assert.deepEqual(fresh.map,buildLevel('78'));
assert.deepEqual(fresh.qa.routes,stored.qa.routes);
assert.deepEqual(fresh.qa.physicalAudit,stored.qa.physicalAudit);
assert.deepEqual(fresh.qa.entry,stored.qa.entry);
assert.deepEqual(fresh.plans,stored.plans);
const comparison=readTrials('fold-goal.json').entries, historical=read('plans.json');
for (const r of comparison.filter(r=>r.name==='ordinary'||r.name==='arrow')) {
    const expected=historical.find(s=>s.name===r.name && s.layout===r.layout);
    assert.deepEqual(plans(r.map),expected.queries);
}
const keyGate=structuredClone(fresh.map);keyGate.layers[0].hWalls[1][5]={type:0,keys:0};
assert.deepEqual([parkedBeforeKey(fresh.map),parkedBeforeKey(keyGate)],read('early-parking.json'));
const env=createReferenceEnvironment(fresh.map);
const noGoal=structuredClone(fresh.map);noGoal.layers[0].endPos=null;
const withoutGoal=createReferenceEnvironment(noGoal);
for (const row of fresh.plans.filter(r=>r.status==='solved')) {
    assert.ok(env.replay(row.actions).state.isWon);
    assert.equal(withoutGoal.replay(row.actions).state.isDead,false);
}
console.log('放行：18步、20步实困、提前引动26步，普通门对照、钥匙房与实际入场复核通过。');
