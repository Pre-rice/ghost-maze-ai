import fs from 'node:fs';
import assert from 'node:assert/strict';
import { buildMap } from './build.mjs';
import { analyzeMap } from './analyze.mjs';
import { auditMap } from '../gallery-adjustments-20261014/verify.mjs';
import { groupMap } from '../reverse-gate-20261019/verify.mjs';

const read = name => JSON.parse(fs.readFileSync(new URL(name, import.meta.url)));
const map = buildMap(), stored = read('evidence.json');
assert.deepEqual(map, read('map.json')); assert.deepEqual(map, stored.map);
const qa = auditMap(map, stored.qa.mapCode), grouping = groupMap(map), analysis = analyzeMap(map);
for (const name of ['mapId', 'ruleset', 'count', 'routes', 'cold', 'entry', 'physicalAudit', 'noEndSafeRoutes']) {
    assert.deepEqual(qa[name], stored.qa[name]);
}
assert.equal(qa.allResult.totalActions, 46); assert.equal(qa.count, '1');
assert.equal(grouping.count, '1'); assert.deepEqual(grouping.routes, stored.grouping.routes);
assert.equal(qa.boundary.status, 'safe');
assert(qa.cold && qa.entry.initialInteriorEqual && qa.entry.wholeOptimalRoutesInteriorEqual);
assert(qa.routes.every(route => route.trace.every(frame => frame.diagnostics.length === 0)));
for (const [index, check] of analysis.checks.entries()) {
    assert.equal(check.result.status, 'proven_unsat');
    assert.deepEqual(check.result, stored.analysis.checks[index].result);
    assert.equal(check.avoidOverlap, stored.analysis.checks[index].avoidOverlap);
}
for (const [index, plan] of analysis.wrongPlans.entries()) {
    assert.deepEqual(plan, stored.analysis.wrongPlans[index]);
    assert.equal(plan.result.status, 'proven_unsat');
}
assert(analysis.ordinary.completeOrders.coverageComplete);
for (const [index, query] of analysis.ordinary.queries.entries()) {
    assert.equal(query.result.status, stored.analysis.ordinary.queries[index].result.status);
    assert.deepEqual(query.actions, stored.analysis.ordinary.queries[index].actions);
}
console.log(JSON.stringify({ title: '门庭', N: 46, raw: qa.count, groups: grouping.count,
    cold: qa.cold, entry: qa.entry, physicalAudit: qa.physicalAudit,
    noPriorityContentions: true, humanQuality: null, gallerySelected: false }));
