import fs from 'node:fs';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {verify as verifySource} from '../../../suspended-exit-20261015/verify.mjs';
import {buildLevel} from '../../build.mjs';
import {auditEntryPath} from '../../entry-path.mjs';
import {createReferenceEnvironment} from '../../../../src/reference/environment.js';
const root=new URL('.',import.meta.url);
export function verify(){
 const map=buildLevel('55'),original=JSON.parse(fs.readFileSync(new URL('../../../suspended-exit-20261015/map.json',import.meta.url))),prior=JSON.parse(fs.readFileSync(new URL('../../../suspended-exit-20261015/evidence.json',import.meta.url)));
 assert.deepEqual(map,original,'课程不改研究原图');
 // 原入口脚本最后刻意锁定2026-10-15证书，不能改旧证据使它看似当前通过。
 const fresh=verifySource();assert.notEqual(fresh.qa.ruleset,prior.qa.ruleset);assert.equal(fresh.qa.mapId,prior.qa.mapId);assert.deepEqual(fresh.qa.routes,prior.qa.routes);
 assert.deepEqual(fresh.necessity.map(x=>[x.name,x.status]),prior.necessity.map(x=>[x.name,x.status]));
 for(const row of fresh.continuations)assert.equal(row.reference.status,'proven_unsat');
 const entry=auditEntryPath(map,fresh.qa.routes,{external:[0,7,1],externalCells:[[7,1]],actions:['L','L']});
 return{sourceRevision:{oldRuleset:prior.qa.ruleset,currentRuleset:fresh.qa.ruleset,mapUnchanged:true,allOriginalOptimalActionsPreserved:true,oldSourceScriptFinalLockMismatchExpected:true},qa:fresh.qa,necessity:fresh.necessity,continuations:fresh.continuations,contrast:fresh.contrast,entry,humanQuality:null,scope:'现行共同引擎复验；旧原图与2026-10-15证据不覆盖，无真人过程或质量推断'};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const fresh=verify(),stored=JSON.parse(fs.readFileSync(new URL('current-evidence.json',root)));
 for(const key of ['sourceRevision','necessity','contrast','entry'])assert.deepEqual(fresh[key],stored[key]);
 assert.deepEqual(fresh.qa.routes,stored.qa.routes);console.log(JSON.stringify({T:fresh.qa.allResult.totalActions,count:fresh.qa.count,ruleset:fresh.qa.ruleset,events:fresh.necessity.map(x=>[x.name,x.status]),wrongPlans:fresh.continuations.map(x=>[x.name,x.reference.status]),entry:fresh.entry.allInternalSuccessorsEqual}));
}
