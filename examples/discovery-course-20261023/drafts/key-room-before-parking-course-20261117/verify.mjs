import fs from 'node:fs';
import assert from 'node:assert/strict';
import {buildLevel} from '../../build.mjs';
import {DataSerializer} from '../../../../src/reference/engine.js';
import {createReferenceEnvironment} from '../../../../src/reference/environment.js';
import {createBreadthFirstSearch} from '../../../../../ghost-maze/src/solver/breadthFirst.js';
import {auditPuzzleBoundaries} from '../../../../src/design/rule-boundaries.js';
import {inspectGhostInfluence} from '../../../../src/design/ghost-influence.js';
import {auditMultilayerMap} from '../../multilayer-audit.mjs';
import {auditEntryPath} from '../../entry-path.mjs';
import {solveContinuation} from '../../../../src/design/continuation.js';
import {analyzeParking} from './analyze.mjs';
const root=new URL('./',import.meta.url),read=n=>JSON.parse(fs.readFileSync(new URL(n,root))),task=read('final-task.json'),map=read('../../levels/72/map.json'),e=createReferenceEnvironment(map),budget={nodeBudget:750000,stateBudget:750000,budgetMs:30000};
assert.deepEqual(map,task.map);assert.deepEqual(map,buildLevel('72'));assert.equal(e.mapId,task.qa.mapId);
const qa=auditMultilayerMap(map,read('../../levels/72/share.json').mapCode);assert.equal(qa.allResult.totalActions,27);assert.equal(qa.count,'1');assert.equal(qa.noEndSafeRoutes,1);assert.deepEqual(qa.actions,task.qa.actions);
assert.deepEqual(auditEntryPath(map,qa.routes,task.entryPath),task.qa.entry);
const stored=read('complete-plans.json'),fresh=analyzeParking(map),sig=r=>[r.name,r.result.status,r.result.totalActions,r.actions];assert.deepEqual(fresh.rows.map(sig),stored.rows.map(sig));
const economy=read('economy.json');for(const row of [...economy.changes,...economy.deletions]){const m=DataSerializer.loadFromShareCode(row.mapCode).data.mapData,env=createReferenceEnvironment(m),q=createBreadthFirstSearch(env,{allOptimal:true}),answer=q.run(budget);assert.equal(env.mapId,row.mapId);assert.equal(answer.status,row.result.status);assert.equal(answer.totalActions,row.result.totalActions);assert.equal(q.routeCount().toString(),row.count);if(row.boundary)assert.equal(auditPuzzleBoundaries(m,budget).status,row.boundary.status);}
const nm=structuredClone(map);nm.layers.forEach(l=>l.endPos=null);const no=createReferenceEnvironment(nm),w=read('wrongs.json');for(const r of w.prefixes){const answer=solveContinuation(map,r.prefix,budget);assert.equal(answer.status,r.fast.status);if(answer.actions){assert.equal(r.prefix.length+answer.actions.length,r.total);assert(!no.replay([...r.prefix,...answer.actions]).state.isDead);}}for(const r of w.deaths)assert(e.step(e.replay(r.prefix).state,r.action).isDead);for(const r of w.invalids){const s=e.replay(r.prefix).state;assert.equal(e.step(s,r.action),s);}
const cr=read('compact-review.json'),ce=createReferenceEnvironment(read('compact.json').map);let state=ce.initialState();for(const a of cr.compact.noActualActions){const n=ce.step(state,a);assert.notEqual(n,state);assert(!n.isDead);assert.equal(inspectGhostInfluence(ce,state,a,n).kind,'none');state=n;}assert(state.isWon);const cn=structuredClone(read('compact.json').map);cn.layers.forEach(l=>l.endPos=null);assert(!createReferenceEnvironment(cn).replay(cr.compact.noActualActions).state.isDead);let old=e.initialState(),failure;for(const[i,a]of cr.chosen25.mirroredAttempt.entries()){old=e.step(old,a);if(old.isDead){failure=i+1;break;}}assert.equal(failure,21);
console.log(JSON.stringify({id:'72',revision:2,cells:25,T:27,raw:1,completeQueries:15,allOptimalNoEnd:1,actualEntry:task.qa.entry.allInternalSuccessorsEqual,legalSingleDeletions:16,compact24RejectedByNoInfluence34:true,humanQuality:null}));
