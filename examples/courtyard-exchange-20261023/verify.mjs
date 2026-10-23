import fs from 'node:fs';
import assert from 'node:assert/strict';
import { buildMap } from './build.mjs';
import { analyzeMap } from './analyze.mjs';
import { auditMap } from '../gallery-adjustments-20261014/verify.mjs';
import { groupMap } from '../reverse-gate-20261019/verify.mjs';
import { ReplaySerializer } from '../../src/reference/engine.js';

const read = name => JSON.parse(fs.readFileSync(new URL(name, import.meta.url)));
const map = buildMap(), stored = read('evidence.json'), share = read('share.json');
assert.deepEqual(map, read('map.json')); assert.deepEqual(map, stored.map);
const qa = auditMap(map, stored.qa.mapCode), grouping = groupMap(map), analysis = analyzeMap(map);
for (const name of ['mapId', 'ruleset', 'count', 'routes', 'cold', 'entry', 'physicalAudit', 'noEndSafeRoutes']) {
    assert.deepEqual(qa[name], stored.qa[name]);
}
assert.equal(qa.allResult.totalActions, 24); assert.equal(qa.count, '10');
assert.equal(grouping.count, '10'); assert.deepEqual(grouping.routes, stored.grouping.routes);
assert.equal(qa.boundary.status, 'safe'); assert(qa.cold);
assert(qa.entry.initialInteriorEqual && qa.entry.wholeOptimalRoutesInteriorEqual);
assert(qa.routes.every(route => route.trace.some(frame =>
    frame.diagnostics.some(diagnostic => diagnostic.decision === 'visible_target_priority'))),
    '禁用事件查询必须有原生正例，不能读取不存在的状态诊断字段');
assert.deepEqual(analysis.checks, stored.analysis.checks);
assert.deepEqual(analysis.variants, stored.analysis.variants);
assert.deepEqual(analysis.wrongPlans, stored.analysis.wrongPlans);
assert.equal(analysis.ordinary.conclusion, stored.analysis.ordinary.conclusion);
for (const [i, query] of analysis.ordinary.queries.entries()) {
    assert.deepEqual(query.result, stored.analysis.ordinary.queries[i].result);
    assert.deepEqual(query.actions, stored.analysis.ordinary.queries[i].actions);
}
assert.equal(share.mapCode, qa.mapCode);
assert.deepEqual(share.replayCodes, grouping.routes.map(actions => ReplaySerializer.generateShareCode(map, actions).code));
console.log(JSON.stringify({ title: '换庭', N: 24, raw: qa.count, groups: grouping.count,
    entry: qa.entry, physicalAudit: qa.physicalAudit, humanQuality: null, gallerySelected: false }));
