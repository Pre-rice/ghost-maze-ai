import fs from 'node:fs';
import assert from 'node:assert/strict';
import { buildMap } from './build.mjs';
import { analyzeMap } from './analyze.mjs';
import { auditActualEntry } from './entry-proof.mjs';
import { auditMap } from '../gallery-adjustments-20261014/verify.mjs';
import { groupMap } from '../reverse-gate-20261019/verify.mjs';

const read = name => JSON.parse(fs.readFileSync(new URL(name, import.meta.url)));
const map = buildMap(), stored = read('evidence.json');
assert.deepEqual(map, read('map.json')); assert.deepEqual(map, stored.map);
const qa = auditMap(map, stored.qa.mapCode), grouping = groupMap(map), analysis = analyzeMap(map);
const actualEntry = auditActualEntry(map, qa.routes.map(r => r.actions));
for (const name of ['mapId', 'ruleset', 'count', 'routes', 'cold', 'entry', 'physicalAudit', 'noEndSafeRoutes']) {
    assert.deepEqual(qa[name], stored.qa[name]);
}
assert.deepEqual(actualEntry, stored.actualEntry);
assert.equal(qa.allResult.totalActions, 37); assert.equal(qa.count, '7');
assert.equal(grouping.count, '7'); assert.deepEqual(grouping.routes, stored.grouping.routes);
assert.equal(qa.boundary.status, 'safe'); assert(qa.cold);
for (const [i, check] of analysis.checks.entries()) {
    assert.equal(check.result.status, 'proven_unsat');
    assert.deepEqual(check.result, stored.analysis.checks[i].result);
    assert.equal(check.name, stored.analysis.checks[i].name);
    assert.equal(check.avoidOverlap, stored.analysis.checks[i].avoidOverlap);
}
for (const [i, variant] of analysis.variants.entries()) {
    assert(variant.noEndReference); assert.deepEqual(variant, stored.analysis.variants[i]);
}
for (const [i, plan] of analysis.wrongPlans.entries()) {
    assert.equal(plan.result.status, 'proven_unsat'); assert.deepEqual(plan, stored.analysis.wrongPlans[i]);
}
assert(analysis.ordinary.completeOrders.coverageComplete);
for (const [i, query] of analysis.ordinary.queries.entries()) {
    assert.equal(query.result.status, stored.analysis.ordinary.queries[i].result.status);
    assert.deepEqual(query.actions, stored.analysis.ordinary.queries[i].actions);
}
console.log(JSON.stringify({ title: '回流', N: 37, raw: qa.count, groups: grouping.count,
    actualEntry, physicalAudit: qa.physicalAudit, humanQuality: null, gallerySelected: false }));
