import fs from 'node:fs';
import assert from 'node:assert/strict';
import { inspectSubmission } from '../user-gallery-20261019/verify.mjs';

const stored = JSON.parse(fs.readFileSync(new URL('evidence.json', import.meta.url)));
const source = JSON.parse(fs.readFileSync(new URL('source.json', import.meta.url)));
assert.equal(stored.mapCode, source.mapCode);
const fresh = inspectSubmission({ title: '门庭', slug: 'queue-separation', code: source.mapCode });
for (const key of ['mapCode', 'map', 'cells', 'ghosts', 'keys', 'width', 'height', 'defaultBoundaryAudit']) {
    assert.deepEqual(fresh[key], stored[key]);
}
for (const key of ['mapId', 'ruleset', 'cold', 'count', 'routes', 'entry', 'physicalAudit', 'noEndSafeRoutes']) {
    assert.deepEqual(fresh.qa[key], stored.qa[key]);
}
assert.deepEqual(fresh.grouping.routes, stored.grouping.routes);
assert.deepEqual(fresh.grouping.codes, stored.grouping.codes);
assert.equal(fresh.qa.allResult.totalActions, 79);
assert.equal(fresh.qa.count, '4'); assert.equal(fresh.grouping.count, '1');
console.log(JSON.stringify({ title: '门庭', N: 79, raw: fresh.qa.count, groups: fresh.grouping.count,
    cold: fresh.qa.cold, entry: fresh.qa.entry, allOptimalNoEnd: fresh.qa.noEndSafeRoutes,
    exactUserCodePreserved: true }));
