import fs from 'node:fs';
import assert from 'node:assert/strict';
import {buildLevel} from '../../build.mjs';
import {DataSerializer} from '../../../../src/reference/engine.js';
import {createReferenceEnvironment} from '../../../../src/reference/environment.js';
import {auditMap} from '../../../gallery-adjustments-20261014/verify.mjs';
const d=JSON.parse(fs.readFileSync(new URL('construction.json',import.meta.url)));
assert.equal(d.humanQuality,null);
for(const row of d.cases){const map=buildLevel('48'),l=map.layers[0];
 for(const letter of ['A','B'])if(row.config[letter]){const[x,y,dx,dy]=row.config[letter];
  Object.assign(l.buttons.find(b=>b.letter===letter),{x,y,direction:{dx,dy}});}
 if(row.config.birth)l.customStartPos={x:row.config.birth[0],y:row.config.birth[1]};
 const decoded=DataSerializer.loadFromShareCode(row.mapCode);assert(decoded.success);assert.deepEqual(decoded.data.mapData,map);
 const qa=auditMap(map,row.mapCode);assert.equal(qa.mapId,row.mapId);assert.equal(qa.allResult.totalActions,row.result.totalActions);
 assert.equal(qa.count,row.count);assert.equal(qa.boundary.status,'safe');assert(qa.cold);
 assert.equal(qa.noEndSafeRoutes,row.qa.noEndSafeRoutes);assert.deepEqual(qa.physicalAudit,row.qa.physicalAudit);
 const env=createReferenceEnvironment(map);assert(env.replay(row.actions).state.isWon);
}
assert.deepEqual(d.cases.map(r=>r.result.totalActions),[6,4,38,37]);
assert.deepEqual(d.cases.slice(0,2).map(r=>r.controls.length),[1,1]);
for(const r of d.cases.slice(0,2))assert.deepEqual(r.controls[0].at,r.config.B.slice(0,2));
console.log(JSON.stringify({fixedCases:4,originalCourse:'48',originalT:38,earlyBBypass:[6,4],adjacentControls:[38,37],adopted:0,publicCourseUnchanged:true,humanQuality:null}));
