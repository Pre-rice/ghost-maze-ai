import fs from 'node:fs';
import assert from 'node:assert/strict';
import { buildMap } from './build.mjs';
import { analyzeMap } from './analyze.mjs';
import { auditActualEntry } from './entry-proof.mjs';
import { auditMap } from '../gallery-adjustments-20261014/verify.mjs';
import { groupMap } from '../reverse-gate-20261019/verify.mjs';

const read = name => JSON.parse(fs.readFileSync(new URL(name, import.meta.url)));
const map = buildMap(), stored = read('evidence.json'), share = read('share.json');
assert.deepEqual(map, read('map.json')); assert.deepEqual(map, stored.map);
const qa = auditMap(map, share.mapCode), grouping = groupMap(map), analysis = analyzeMap(map);
const actualEntry = auditActualEntry(map, qa.routes.map(route => route.actions));
for (const name of ['mapId', 'ruleset', 'count', 'routes', 'cold', 'entry', 'physicalAudit', 'noEndSafeRoutes']) {
    assert.deepEqual(qa[name], stored.qa[name]);
}
assert.equal(qa.allResult.totalActions, 32); assert.equal(qa.count, '1');
assert.equal(grouping.count, '1'); assert.deepEqual(grouping.routes, stored.grouping.routes);
assert.equal(qa.boundary.status, 'safe'); assert(qa.cold);
assert(qa.entry.initialInteriorEqual && qa.entry.wholeOptimalRoutesInteriorEqual);
assert.deepEqual(analysis, stored.analysis);
assert.deepEqual(actualEntry, stored.actualEntry);
for (const check of analysis.checks.slice(0, 3)) assert.equal(check.result.status, 'proven_unsat');
assert.equal(analysis.checks[3].result.totalActions, 44);
assert(analysis.variants.find(variant => variant.mode === 'ordinary').trace.every(frame => frame.g[0] !== 6));
assert.equal(share.replayCode, qa.replayCode);
assert(qa.routes[0].trace.every(frame => frame.diagnostics.length === 0));
console.log(JSON.stringify({ title: '进退', N: 32, raw: qa.count, groups: grouping.count,
    actualEntry, physicalAudit: qa.physicalAudit, humanQuality: null, gallerySelected: false }));
