import fs from'node:fs';import assert from'node:assert/strict';import{fileURLToPath}from'node:url';
import{GameLogic,WALL_TYPES as W}from'../../src/reference/engine.js';
import{createReferenceEnvironment}from'../../src/reference/environment.js';
import{createBreadthFirstSearch}from'../../../ghost-maze/src/solver/breadthFirst.js';
import{auditPuzzleBoundaries}from'../../src/design/rule-boundaries.js';
import{auditMap}from'../gallery-adjustments-20261014/verify.mjs';
import{groupMap}from'../reverse-gate-20261019/verify.mjs';
import{assertExterior}from'../spatial-clearance-20261019/verify.mjs';
import{buildMap}from'./build.mjs';
const budget={nodeBudget:1000000,stateBudget:1000000,budgetMs:30000};
/** 已知解后的设计者核验，不能作为盲玩过程或真人体验。 */
export function analyzeMap(map,actions){
 const env=createReferenceEnvironment(map),m=structuredClone(map);m.layers[0].endPos=null;const noEnd=createReferenceEnvironment(m);
 const specs=[
 ['key-not-at-west-exterior',(h,s,a,n)=>s.player.keys===0&&n.player.keys>0&&n.layerStates[0].ghosts[0].x===1&&n.layerStates[0].ghosts[0].y===3?null:h],
 ['never-closed-north-exterior-after-key',(h,s,a,n)=>n.player.keys>0&&n.layerStates[0].ghosts[0].x===3&&n.layerStates[0].ghosts[0].y===1&&n.layerStates[0].wallStates.h[2][3].currentState==='closed'?null:h],
 ['ghost-not-released-after-key',(h,s,a,n)=>s.player.keys>0&&(s.layerStates[0].ghosts[0].x!==n.layerStates[0].ghosts[0].x||s.layerStates[0].ghosts[0].y!==n.layerStates[0].ghosts[0].y)?null:h],
 ['never-exterior',(h,s,a,n)=>n.layerStates[0].ghosts[0].x>=2&&n.layerStates[0].ghosts[0].y>=2?h:null],
 ['first-control-A',(h,s,a,n)=>{const control=s.player.x===n.player.x&&s.player.y===n.player.y;if(control&&!h[0])return s.player.x===3&&s.player.y===2?[1]:null;return control?[1]:h;}]
 ];
 const queries=specs.map(([name,advance])=>{const q=createBreadthFirstSearch(env,{monitor:{initial:()=>[0],advance:(h,s,a,n)=>n.isWon&&noEnd.step(s,a).isDead?null:advance(h,s,a,n)}}),result=q.run(budget);assert.notEqual(result.status,'unknown');return{name,result,actions:q.firstActions(),scope:'原图全部无伤无复活解；历史进完整键；终步去终点安全'};});
 const reductions=[],edits=[];
 for(const[axis,x,y]of[['h',3,2],['v',4,3],['v',2,3],['h',3,4]])for(const type of[W.EMPTY,W.SOLID,W.DOOR])edits.push([`gate-${axis}-${x}-${y}-type-${type}`,m=>m.layers[0][axis+'Walls'][y][x]={type,keys:0}]);
 for(let i=0;i<2;i++)edits.push(['remove-button-'+i,m=>m.layers[0].buttons.splice(i,1)]);
 edits.push(['goal-zero-no-key',m=>{m.layers[0].items=[];m.layers[0].vWalls[4][3]={type:W.LOCKED,keys:0};}]);
 for(let y=1;y<=4;y++)for(let x=1;x<=4;x++){
  const l=map.layers[0];if(l.ghosts.some(g=>g.x===x&&g.y===y)||l.items.some(g=>g.x===x&&g.y===y)||l.endPos.x===x&&l.endPos.y===y)continue;
  const copy=structuredClone(map);copy.layers[0].customStartPos={x,y};const e=createReferenceEnvironment(copy),s=e.initialState();if(s.layerStates[0].ghosts.some(g=>GameLogic._canGhostSeePlayer(g,s.player,e.mapDefinition.layers[0],s.layerStates[0])))continue;edits.push([`birth-${x}-${y}`,m=>m.layers[0].customStartPos={x,y}]);
 }
 for(const[name,edit]of edits){const m=structuredClone(map);edit(m);const e=createReferenceEnvironment(m),q=createBreadthFirstSearch(e),result=q.run(budget);assert.notEqual(result.status,'unknown');const row={name,result,actions:q.firstActions()};if(result.status==='solved')row.boundary=auditPuzzleBoundaries(m,budget).status;reductions.push(row);}
 const choices=[];let state=env.initialState();for(const[i,selected]of actions.entries()){
  const options=[];for(const a of env.actions){const n=env.step(state,a);if(n===state||n.isDead||n.isWon&&noEnd.step(state,a).isDead)continue;const q=createBreadthFirstSearch({...env,initialState:()=>n},{monitor:{initial:()=>[],advance:(h,s,a,n)=>n.isWon&&noEnd.step(s,a).isDead?null:h}}),result=q.run(budget);assert.notEqual(result.status,'unknown');options.push({a,selected:a===selected,result,suffix:q.firstActions()});}choices.push({step:i+1,p:[state.player.x,state.player.y],ghost:[state.layerStates[0].ghosts[0].x,state.layerStates[0].ghosts[0].y],prefix:actions.slice(0,i),options});state=env.step(state,selected);
 }
 return{humanQuality:null,queries,reductions,choices};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const map=JSON.parse(fs.readFileSync(new URL('map.json',import.meta.url))),old=JSON.parse(fs.readFileSync(new URL('evidence.json',import.meta.url)));assert.deepEqual(map,buildMap());assertExterior(map);
 const qa=auditMap(map),grouping=groupMap(map),analysis=analyzeMap(map,qa.actions);const stable=v=>JSON.parse(JSON.stringify(v,(k,value)=>['expanded','transitions','discovered','elapsedMs'].includes(k)?undefined:value));assert.deepEqual(stable({qa,grouping,analysis}),stable({qa:old.qa,grouping:old.grouping,analysis:old.analysis}));assert.equal(qa.allResult.totalActions,25);assert.equal(qa.count,'1');assert.equal(grouping.count,'1');assert(qa.cold&&qa.entry.initialInteriorEqual&&qa.entry.wholeOptimalRoutesInteriorEqual);assert.equal(qa.noEndSafeRoutes,1);
 console.log(JSON.stringify({title:'内外',N:25,rawOptimal:qa.count,ghostTrajectories:grouping.count,entry:qa.entry,physicalAudit:qa.physicalAudit,humanQuality:null,gallerySelected:false}));
}
