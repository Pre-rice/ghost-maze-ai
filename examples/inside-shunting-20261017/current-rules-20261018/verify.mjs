import fs from 'node:fs';
import assert from 'node:assert/strict';
import { auditMap } from '../../gallery-adjustments-20261014/verify.mjs';
const map = JSON.parse(fs.readFileSync(new URL('../map.json', import.meta.url)));
const stored = JSON.parse(fs.readFileSync(new URL('evidence.json', import.meta.url)));
const share = JSON.parse(fs.readFileSync(new URL('share.json', import.meta.url)));
const fresh = auditMap(map, share.mapCode);
assert.equal(fresh.mapId, stored.mapId);
assert.equal(fresh.ruleset, stored.ruleset);
assert.equal(fresh.allResult.totalActions, 70);
assert.equal(fresh.count, '4');
assert.equal(fresh.boundary.status, 'safe');
assert(fresh.cold && fresh.entry?.initialInteriorEqual && fresh.entry.wholeOptimalRoutesInteriorEqual);
assert.deepEqual(fresh.routes, stored.routes);
assert.deepEqual(fresh.physicalAudit, stored.physicalAudit);
assert.equal(fresh.noEndSafeRoutes, 4);
console.log(JSON.stringify({ title: '调度', N: 70, count: fresh.count, boundary: fresh.boundary.status,
    entry: fresh.entry, physical: fresh.physicalAudit, noEndSafe: fresh.noEndSafeRoutes,
    scope: '当前规则物理验收；人的肯定由独立真实反馈给出' }));
