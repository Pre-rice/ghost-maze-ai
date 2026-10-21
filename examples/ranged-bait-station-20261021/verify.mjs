import fs from 'node:fs';
import assert from 'node:assert/strict';
import { buildMap } from './build.mjs';
import { analyzeMap } from './analyze.mjs';
import { auditMap } from '../gallery-adjustments-20261014/verify.mjs';
import { groupMap } from '../reverse-gate-20261019/verify.mjs';

const read = name => JSON.parse(fs.readFileSync(new URL(name, import.meta.url)));
const map = buildMap(), stored = read('evidence.json'), analysis = analyzeMap(map);
assert.deepEqual(map, read('map.json')); assert.deepEqual(map, stored.map);
const qa = auditMap(map, stored.qa.mapCode), grouping = groupMap(map);
for (const name of ['mapId', 'ruleset', 'count', 'routes', 'cold', 'entry', 'physicalAudit', 'noEndSafeRoutes']) {
    assert.deepEqual(qa[name], stored.qa[name]);
}
assert.equal(qa.allResult.totalActions, 34); assert.equal(qa.boundary.status, 'safe');
assert(qa.cold && qa.entry.initialInteriorEqual && qa.entry.wholeOptimalRoutesInteriorEqual);
assert.deepEqual(grouping.routes, stored.grouping.routes);
for (const [index, check] of analysis.checks.entries()) {
    assert.equal(check.result.status, 'proven_unsat');
    assert.equal(check.name, stored.analysis.checks[index].name);
    assert.equal(check.avoidOverlap, stored.analysis.checks[index].avoidOverlap);
}
assert(analysis.ordinary.completeOrders.coverageComplete);
for (const [index, query] of analysis.ordinary.queries.entries()) {
    const old = stored.analysis.ordinary.queries[index];
    assert.equal(query.result.status, old.result.status);
    assert.equal(query.result.totalActions, old.result.totalActions);
    assert.deepEqual(query.actions, old.actions);
}
assert.equal(analysis.wrongPlans[0].result.status, 'solved');
assert.equal(analysis.wrongPlans[0].result.totalActions, 28);
assert.equal(analysis.wrongPlans[1].state.keys, 1);
assert.equal(analysis.wrongPlans[1].state.dead, false);
assert.equal(analysis.wrongPlans[1].result.status, 'proven_unsat');
console.log(JSON.stringify({ title: '丈量', N: 34, raw: qa.count, groups: grouping.count,
    cold: qa.cold, entry: qa.entry, physicalAudit: qa.physicalAudit, humanQuality: null, gallerySelected: false }));
