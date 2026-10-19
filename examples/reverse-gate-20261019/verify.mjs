import fs from'node:fs';import assert from'node:assert/strict';
import{WALL_TYPES as W,GameLogic,actionFromName}from'../../src/reference/engine.js';
import{createReferenceEnvironment}from'../../src/reference/environment.js';
import{createBreadthFirstSearch}from'../../../ghost-maze/src/solver/breadthFirst.js';
import{auditPuzzleBoundaries}from'../../src/design/rule-boundaries.js';
import{buildMap}from'./build.mjs';
import {fileURLToPath} from 'node:url';
import {createTrajectoryGroups,ghostFrame} from '../../../ghost-maze/src/solver/trajectoryGroups.js';
import {auditMap} from '../gallery-adjustments-20261014/verify.mjs';
import {assertExterior} from '../spatial-clearance-20261019/verify.mjs';

/** 原图全解允许非最优重合；历史标志进完整键，终步另查去终点安全。 */
export function analyzeMap(map,actions){
const env=createReferenceEnvironment(map),copy=structuredClone(map);copy.layers[0].endPos=null;const noEnd=createReferenceEnvironment(copy),budget={nodeBudget:1000000,stateBudget:1000000,budgetMs:30000};
const diagnostics=(s,a)=>{const d=[];GameLogic.calculateNextState(s,actionFromName(a),env.mapDefinition,{trails:false,visibility:false,ghostDiagnostics:d});return d;};
const wins=(s,a,winner)=>diagnostics(s,a).some(d=>d.decision==='visible_target_priority'&&d.contenders.some(c=>c.seesAfter&&c.from.x===s.layerStates[0].ghosts[winner].x&&c.from.y===s.layerStates[0].ghosts[winner].y));
const specs=[
 ['zero-never-opened',(h,s,a,n)=>n.layerStates[0].wallStates.h[5][5].type===W.LOCKED?h:null],
 ['zero-first-opening-not-from-above',(h,s,a,n)=>s.layerStates[0].wallStates.h[5][5].type===W.LOCKED&&n.layerStates[0].wallStates.h[5][5].type===W.EMPTY&&s.player.y<5?null:h],
 ['key-before-opening-zero',(h,s,a,n)=>s.player.keys===0&&s.layerStates[0].wallStates.h[5][5].type===W.LOCKED&&n.layerStates[0].wallStates.h[5][5].type===W.EMPTY?null:h],
 ['no-priority',(h,s,a,n)=>diagnostics(s,a).some(d=>d.decision==='visible_target_priority')?null:h],
 ['right-guard-never-wins-middle',(h,s,a,n)=>wins(s,a,0)?null:h],
 ['middle-never-wins-right-guard',(h,s,a,n)=>wins(s,a,1)?null:h],
 ['right-guard-not-below-zero-before-key',(h,s,a,n)=>s.player.keys===0&&n.layerStates[0].ghosts[0].y>=5?null:h],
 ['right-guard-never-reenters-key-room-before-key',(h,s,a,n)=>{const g=n.layerStates[0].ghosts[0],left=h[0]||g.y>=3?1:0;return left&&s.player.keys===0&&g.y<3?null:[left];}]
];
const queries=specs.map(([name,advance])=>{const q=createBreadthFirstSearch(env,{monitor:{initial:()=>[0],advance:(h,s,a,n)=>n.isWon&&noEnd.step(s,a).isDead?null:advance(h,s,a,n)}}),result=q.run(budget);assert.notEqual(result.status,'unknown');return{name,result,actions:q.firstActions(),scope:'原图全部无伤无复活通关，允许非最优重合；历史位进完整键；去终点终步安全'};});
const changes=[];
for(const[type,name]of[[W.EMPTY,'empty'],[W.SOLID,'solid'],[W.DOOR,'ordinary']])changes.push(['zero-'+name,m=>m.layers[0].hWalls[5][5]={type,keys:0}]);
for(const[x,y]of[[3,1],[4,1],[5,3]])changes.push([`open-v-${x}-${y}`,m=>m.layers[0].vWalls[y][x]={type:W.EMPTY,keys:0}]);
for(let i=0;i<2;i++)changes.push(['remove-ghost-'+i,m=>{m.layers[0].ghosts.splice(i,1);m.layers[0].ghosts.forEach((g,id)=>g.id=id);}]);
for(const[x,y]of[[4,2],[5,2]])changes.push([`key-${x}-${y}`,m=>m.layers[0].items=[{x,y,type:'key'}]]);
changes.push(['goal-one-empty',m=>m.layers[0].hWalls[2][3]={type:W.EMPTY,keys:0}]);
const reductions=changes.map(([name,edit])=>{const m=structuredClone(map);edit(m);const e=createReferenceEnvironment(m),q=createBreadthFirstSearch(e),result=q.run(budget),r={name,map:m,result,actions:q.firstActions()};assert.notEqual(result.status,'unknown');if(result.status==='solved'){r.boundary=auditPuzzleBoundaries(m,budget);const n=structuredClone(m);n.layers[0].endPos=null;try{createReferenceEnvironment(n).replay(r.actions);r.noEnd=true;}catch{r.noEnd=false;}}return r;});
const choices=[];let s=env.initialState();
for(const[i,selected]of actions.entries()){
 const options=[];for(const a of env.actions){const n=env.step(s,a);if(n===s||n.isDead||n.isWon&&noEnd.step(s,a).isDead)continue;const q=createBreadthFirstSearch({...env,initialState:()=>n},{monitor:{initial:()=>[],advance:(h,b,c,d)=>d.isWon&&noEnd.step(b,c).isDead?null:h}}),result=q.run(budget);assert.notEqual(result.status,'unknown');options.push({a,selected:a===selected,result,suffix:q.firstActions()});}choices.push({step:i+1,p:[s.player.x,s.player.y],prefix:actions.slice(0,i),options});s=env.step(s,selected);
}

 return {humanQuality:null,queries,reductions,choices};
}
export function groupMap(map){
 const budget={nodeBudget:1000000,stateBudget:1000000,budgetMs:30000};
 const q=createBreadthFirstSearch(createReferenceEnvironment(map),{allOptimal:true,classifyState:ghostFrame});assert.equal(q.run(budget).status,'solved');
 const g=createTrajectoryGroups(q.optimalGraph()),result=g.run(budget);assert.equal(result.status,'solved');return {...result,routes:[...g.routes()]};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const map=JSON.parse(fs.readFileSync(new URL('map.json',import.meta.url))),old=JSON.parse(fs.readFileSync(new URL('evidence.json',import.meta.url)));
 assert.deepEqual(buildMap(),map);assertExterior(map);
 const qa=auditMap(map),grouping=groupMap(map),analysis=analyzeMap(map,qa.actions);
 for(const key of ['mapId','ruleset','count','mapCode','replayCode','cold'])assert.equal(qa[key],old.qa[key]);
 assert.equal(qa.allResult.totalActions,22);assert.equal(qa.count,'24');
 for(const key of ['routes','physicalAudit','entry'])assert.deepEqual(qa[key],old.qa[key]);
 assert(qa.cold&&qa.entry.initialInteriorEqual&&qa.entry.wholeOptimalRoutesInteriorEqual);assert.equal(qa.noEndSafeRoutes,Number(qa.count));
 assert.equal(grouping.count,'24');assert.deepEqual(grouping.routes,old.grouping.routes);
 const stable=value=>JSON.parse(JSON.stringify(value,(key,v)=>['expanded','transitions','discovered','elapsedMs'].includes(key)?undefined:v));
 assert.deepEqual(stable(analysis),stable(old.analysis));
 console.log(JSON.stringify({title:'逆渡',N:22,rawOptimal:qa.count,ghostTrajectories:grouping.count,cold:qa.cold,entry:qa.entry,physicalAudit:qa.physicalAudit,humanQuality:null,gallerySelected:false}));
}
