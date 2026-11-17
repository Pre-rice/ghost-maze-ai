import fs from 'node:fs';
import assert from 'node:assert/strict';
import {auditMap} from '../../../gallery-adjustments-20261014/verify.mjs';
import {auditEntryPath} from '../../entry-path.mjs';
const root=new URL('./',import.meta.url),s=JSON.parse(fs.readFileSync(new URL('prototype.json',root))),qa=auditMap(s.map,s.mapCode);assert.equal(qa.allResult.totalActions,22);assert.equal(qa.count,'28');assert.equal(qa.noEndSafeRoutes,28);const entryPath={external:[0,0,3],externalCells:[[0,3]],actions:['R']},entry=auditEntryPath(s.map,qa.routes,entryPath);fs.writeFileSync(new URL('final-task.json',root),JSON.stringify({map:s.map,qa:{...qa,entry},entryPath,humanQuality:null},null,2)+'\n');console.log(JSON.stringify({T:22,raw:28,physicalAudit:qa.physicalAudit,entry:entry.allInternalSuccessorsEqual}));
