import fs from 'node:fs';
import assert from 'node:assert/strict';
import {auditMultilayerMap} from '../../multilayer-audit.mjs';
import {auditEntryPath} from '../../entry-path.mjs';
const root=new URL('./',import.meta.url),s=JSON.parse(fs.readFileSync(new URL('prototype.json',root))),qa=auditMultilayerMap(s.map,s.mapCode);
assert.equal(qa.allResult.totalActions,27);assert.equal(qa.count,'1');assert.equal(qa.noEndSafeRoutes,1);
const entryPath={external:[0,1,4],externalCells:[[1,4]],actions:['U','U']},entry=auditEntryPath(s.map,qa.routes,entryPath);
fs.writeFileSync(new URL('final-task.json',root),JSON.stringify({map:s.map,qa:{...qa,entry},entryPath,humanQuality:null},null,2)+'\n');
console.log(JSON.stringify({mapId:qa.mapId,T:27,allOptimal:qa.count,noEnd:qa.noEndSafeRoutes,cold:qa.cold,physicalAudit:qa.physicalAudit,entry:entry.allInternalSuccessorsEqual}));
