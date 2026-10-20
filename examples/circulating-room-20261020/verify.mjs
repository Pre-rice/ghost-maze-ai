import fs from 'node:fs';import assert from 'node:assert/strict';import{fileURLToPath}from'node:url';
import{GameLogic,actionFromName,WALL_TYPES as W}from'../../src/reference/engine.js';
import{createReferenceEnvironment}from'../../src/reference/environment.js';
import{createBreadthFirstSearch}from'../../../ghost-maze/src/solver/breadthFirst.js';
import{auditPuzzleBoundaries}from'../../src/design/rule-boundaries.js';
import{auditMap}from'../gallery-adjustments-20261014/verify.mjs';
import{groupMap}from'../reverse-gate-20261019/verify.mjs';
import{assertExterior}from'../spatial-clearance-20261019/verify.mjs';
import{buildMap}from'./build.mjs';
const budget={nodeBudget:1000000,stateBudget:1000000,budgetMs:30000};
/** 已知解后的工程分析，不是自主试玩或真人思考记录。历史约束进完整键。 */
export function analyzeMap(map,actions){
 const env=createReferenceEnvironment(map),copy=structuredClone(map);copy.layers[0].endPos=null;const noEnd=createReferenceEnvironment(copy);
 const diagnostic=(s,a)=>{const d=[];GameLogic.calculateNextState(s,actionFromName(a),env.mapDefinition,{trails:false,visibility:false,ghostDiagnostics:d});return d;};
 const wins=(s,a,id)=>diagnostic(s,a).some(d=>d.decision==='visible_target_priority'&&d.contenders.some(c=>c.seesAfter&&c.from.x===s.layerStates[0].ghosts[id].x&&c.from.y===s.layerStates[0].ghosts[id].y));
 const specs=[
  ['key-before-second-west-entry',(h,s,a,n)=>{const entry=s.player.x===1&&s.player.y===3&&n.player.x===2&&n.player.y===3,c=Math.min(2,h[0]+Number(entry));return s.player.keys===0&&n.player.keys>0&&c>=2?null:[c];}],
  ['left-never-returns-north-after-south-before-key',(h,s,a,n)=>{const g=n.layerStates[0].ghosts[0],south=h[0]||g.y>=4?1:0;return h[0]&&s.player.keys===0&&g.y<=3?null:[south];}],
  ['left-never-reoccupies-key-after-south-before-key',(h,s,a,n)=>{const g=n.layerStates[0].ghosts[0],south=h[0]||g.y>=4?1:0;return h[0]&&s.player.keys===0&&g.x===3&&g.y===3?null:[south];}],
  ['right-never-leaves-inner-room',(h,s,a,n)=>{const g=n.layerStates[0].ghosts[1];return g.x>=2&&g.x<=4&&g.y>=2&&g.y<=5?h:null;}],
  ['no-priority',(h,s,a)=>diagnostic(s,a).some(d=>d.decision==='visible_target_priority')?null:h],
  ...[0,1,2].map(i=>['ghost-'+i+'-never-wins-priority',(h,s,a)=>wins(s,a,i)?null:h])
 ];
 const queries=specs.map(([name,advance])=>{const q=createBreadthFirstSearch(env,{monitor:{initial:()=>[0],advance:(h,s,a,n)=>n.isWon&&noEnd.step(s,a).isDead?null:advance(h,s,a,n)}}),result=q.run(budget);assert.notEqual(result.status,'unknown');return{name,result,actions:q.firstActions(),scope:'原图全部无伤无复活解；允许非最优重合；终步去终点安全；历史进完整键'};});
 const prefix=[...actions.slice(0,23),'R'],start=env.replay(prefix).state;assert.equal(start.player.keys,1);
 const q=createBreadthFirstSearch({...env,initialState:()=>start},{monitor:{initial:()=>[],advance:(h,s,a,n)=>n.isWon&&noEnd.step(s,a).isDead?null:h}}),early=q.run(budget);assert.equal(early.status,'proven_unsat');
 const choices=[];let state=env.initialState();for(const[i,selected]of actions.entries()){
  const options=[];for(const a of env.actions){const n=env.step(state,a);if(n===state||n.isDead||n.isWon&&noEnd.step(state,a).isDead)continue;const q=createBreadthFirstSearch({...env,initialState:()=>n},{monitor:{initial:()=>[],advance:(h,s,a,n)=>n.isWon&&noEnd.step(s,a).isDead?null:h}}),result=q.run(budget);assert.notEqual(result.status,'unknown');options.push({a,selected:a===selected,result,suffix:q.firstActions()});}choices.push({step:i+1,p:[state.player.x,state.player.y],g:state.layerStates[0].ghosts.map(g=>[g.x,g.y]),prefix:actions.slice(0,i),options});state=env.step(state,selected);
 }
 const reductions=[];const edits=[];
 for(const[axis,x,y]of[['h',2,6],['h',4,6],['v',5,3],['v',2,4],['v',2,5]])edits.push([`open-${axis}-${x}-${y}`,m=>m.layers[0][axis+'Walls'][y][x]={type:W.EMPTY,keys:0}]);
 for(const[axis,x,y]of[['v',5,2],['h',3,6],['v',2,3],['v',5,4],['v',5,5]])edits.push([`close-${axis}-${x}-${y}`,m=>m.layers[0][axis+'Walls'][y][x]={type:W.SOLID,keys:0}]);
 for(let i=0;i<3;i++)edits.push(['remove-ghost-'+i,m=>{m.layers[0].ghosts.splice(i,1);m.layers[0].ghosts.forEach((g,id)=>g.id=id);}]);
 for(const[x,y]of[[2,2],[3,2],[4,2],[2,5],[3,5],[4,5]])edits.push([`key-${x}-${y}`,m=>m.layers[0].items=[{x,y,type:'key'}]]);
 for(const[name,edit]of edits){const m=structuredClone(map);edit(m);const env=createReferenceEnvironment(m),q=createBreadthFirstSearch(env),result=q.run(budget);assert.notEqual(result.status,'unknown');const row={name,result,actions:q.firstActions()};if(result.status==='solved')row.boundary=auditPuzzleBoundaries(m,budget).status;reductions.push(row);}
 return{humanQuality:null,queries,earlyKeyAttempt:{prefix,result:early,actions:q.firstActions(),scope:'指定实际前缀；不能代替全局取物次序查询'},choices,reductions};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const map=JSON.parse(fs.readFileSync(new URL('map.json',import.meta.url))),old=JSON.parse(fs.readFileSync(new URL('evidence.json',import.meta.url)));assert.deepEqual(buildMap(),map);assertExterior(map);
 const qa=auditMap(map),grouping=groupMap(map),analysis=analyzeMap(map,qa.actions);
 const stable=v=>JSON.parse(JSON.stringify(v,(k,value)=>['expanded','transitions','discovered','elapsedMs'].includes(k)?undefined:value));assert.deepEqual(stable({qa,grouping,analysis}),stable({qa:old.qa,grouping:old.grouping,analysis:old.analysis}));
 assert.equal(qa.allResult.totalActions,45);assert.equal(qa.count,'4');assert.equal(grouping.count,'4');assert(qa.cold&&qa.entry.initialInteriorEqual&&qa.entry.wholeOptimalRoutesInteriorEqual);assert.equal(qa.noEndSafeRoutes,4);
 console.log(JSON.stringify({title:'巡回',N:45,rawOptimal:qa.count,ghostTrajectories:grouping.count,entry:qa.entry,physicalAudit:qa.physicalAudit,humanQuality:null,gallerySelected:false}));
}
