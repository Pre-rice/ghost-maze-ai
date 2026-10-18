import fs from 'node:fs';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {WALL_TYPES as W,normalizeMapData,normalizeVoidWalls,ReplaySerializer} from '../../src/reference/engine.js';
import {createSearchEnvironment} from '../../../ghost-maze/src/solver/searchEnvironment.js';
import {createBreadthFirstSearch} from '../../../ghost-maze/src/solver/breadthFirst.js';
import {ghostFrame,createTrajectoryGroups} from '../../../ghost-maze/src/solver/trajectoryGroups.js';
import {auditMap} from './audit.mjs';
const read=name=>JSON.parse(fs.readFileSync(new URL(name,import.meta.url)));
const budget={nodeBudget:1000000,stateBudget:1000000,budgetMs:30000};

/** 格子/通路重建，不另写物理规则。保存容器8×8，活动区6×6。 */
export function derive(){
 const wall=(type,extra={})=>({type,keys:0,...extra});
 const l={activeCells:Array.from({length:8},(_,y)=>Array.from({length:8},(_,x)=>x>=1&&x<=6&&y>=1&&y<=6)),hWalls:Array.from({length:9},()=>Array.from({length:8},()=>wall(W.SOLID))),vWalls:Array.from({length:8},()=>Array.from({length:9},()=>wall(W.SOLID))),ghosts:[{x:3,y:3,id:0},{x:4,y:3,id:1},{x:2,y:5,id:2},{x:4,y:4,id:3}],items:[{x:2,y:4,type:'key'}],buttons:[{x:1,y:6,direction:{dx:0,dy:1},letter:'A'},{x:6,y:1,direction:{dx:0,dy:-1},letter:'B'}],customStartPos:{x:6,y:6},endPos:{x:1,y:1}};
 for(let y=1;y<=6;y++)for(let x=1;x<=6;x++){
  if(x<6&&([1,6].includes(y)||(x>=2&&x<5&&y>=2&&y<=5)))l.vWalls[y][x+1]=wall(W.EMPTY);
  if(y<6&&([1,6].includes(x)||(y>=2&&y<5&&x>=2&&x<=5)))l.hWalls[y+1][x]=wall(W.EMPTY);
 }
 l.vWalls[1][2]=wall(W.LOCKED,{keys:1});l.hWalls[2][1]=wall(W.SOLID);
 l.hWalls[2][3]=wall(W.EMPTY);l.hWalls[6][3]=wall(W.EMPTY);l.vWalls[3][2]=wall(W.EMPTY);
 l.vWalls[3][6]=wall(W.LETTER_DOOR,{letter:'A',initialState:'closed'});
 l.vWalls[4][6]=wall(W.LETTER_DOOR,{letter:'A',initialState:'open'});
 l.vWalls[4][2]=wall(W.LETTER_DOOR,{letter:'B',initialState:'closed'});
 l.vWalls[5][6]=wall(W.DOOR);
 return normalizeVoidWalls(normalizeMapData({width:8,height:8,editorMode:'free',gameMode:'death-loop',initialHealth:5,multiLayerMode:false,layerCount:1,layers:[l],stairs:[]}));
}

export function analyze(map){
 const env=createSearchEnvironment(map),button=(b,s,letter)=>b.player.x===s.player.x&&b.player.y===s.player.y&&map.layers[0].buttons.some(c=>c.letter===letter&&c.x===b.player.x&&c.y===b.player.y);
 const run=(name,e=env,monitor)=>{const q=createBreadthFirstSearch(e,{monitor}),result=q.run(budget);return{name,result,actions:q.firstActions()};},queries=[];
 for(const letter of['A','B'])queries.push(run('without-'+letter,env,{initial:()=>[],advance:(p,b,a,s)=>button(b,s,letter)?null:p}));
 // 诊断角色按公开初位对应；不参与引擎规则或移动裁定。
 const role=(x,y)=>map.layers[0].ghosts.findIndex(g=>g.x===x&&g.y===y),north=role(3,3),middle=role(4,3),corner=role(2,5);
 queries.push(run('never-park-origin-3-3-at-5-5',env,{initial:()=>[],advance:(p,b,a,s)=>s.layerStates[0].ghosts[north].x===5&&s.layerStates[0].ghosts[north].y===5?null:p}));
 queries.push(run('first-A-without-paired-parking',env,{initial:()=>[0,0],advance:(p,b,a,s)=>{const gs=s.layerStates[0].ghosts,paired=p[1]||gs[north].x===5&&gs[north].y===5&&gs[corner].x===4&&gs[corner].y===5;if(!p[0]&&button(b,s,'A'))return paired?null:[1,0];return[p[0],paired?1:0];}}));
 for(const target of['A','B'])queries.push(run('first-'+target+'-without-west-draw-of-origin-4-3',env,{initial:()=>[0,0],advance:(p,b,a,s)=>{const west=p[1]||s.layerStates[0].ghosts[middle].x<4;if(!p[0]&&button(b,s,target))return west?null:[1,0];return[p[0],west?1:0];}}));
 const pre=structuredClone(map);for(const axis of['h','v'])for(const row of pre.layers[0][axis+'Walls'])for(const w of row)if(w.type===W.LETTER_DOOR)w.initialState=w.initialState==='open'?'closed':'open';queries.push(run('both-groups-in-reference-final-state-at-start',createSearchEnvironment(pre)));
 const counter=read('evidence.json').firstLoss;
 const at=prefix=>{let state=env.initialState();for(const a of prefix){const next=env.step(state,a);assert(next!==state&&!next.isDead);state=next;}return state;};
 const bad=at(counter.firstLoss.prefix),good=at(counter.comparison.correctPrefix);
 const lost=run('natural-plan-first-lost-future',{...env,initialState:()=>bad}),retained=run('same-player-and-walls-with-calibrated-ghost',{...env,initialState:()=>good});
 assert.deepEqual([bad.player.x,bad.player.y],[good.player.x,good.player.y]);assert.deepEqual(bad.layerStates[0].wallStates,good.layerStates[0].wallStates);
 assert.deepEqual(bad.layerStates[0].ghosts.map((g,i)=>g.x!==good.layerStates[0].ghosts[i].x||g.y!==good.layerStates[0].ghosts[i].y),[false,true,false,false]);
 return{queries,lost,retained};
}

export function verify(){
 const map=read('map.json'),source=read('source.json'),stored=read('evidence.json'),share=read('share.json');assert.deepEqual(map,derive());assert.equal(source.humanQuality,null);assert.equal(source.gallerySelection,null);
 const plans=analyze(map);for(const p of plans.queries){const expected=p.name==='first-A-without-west-draw-of-origin-4-3'||p.name==='both-groups-in-reference-final-state-at-start'?'solved':'proven_unsat';assert.equal(p.result.status,expected,p.name);}assert.equal(plans.lost.result.status,'proven_unsat');assert.equal(plans.retained.result.status,'solved');assert.equal(plans.retained.result.totalActions,28);
 const qa=auditMap(map,share.mapCode);assert.equal(qa.mapId,source.mapId);assert.equal(qa.mapId,stored.qa.mapId);assert.equal(qa.ruleset,stored.qa.ruleset);assert.equal(qa.allResult.totalActions,58);assert.equal(qa.count,'2');assert(qa.cold&&qa.entry.wholeOptimalRoutesInteriorEqual);assert.equal(qa.noEndSafeRoutes,2);assert.equal(qa.physicalAudit.permutations,24);assert.deepEqual(qa.routes,stored.qa.routes);assert.deepEqual(qa.physicalAudit,stored.qa.physicalAudit);
 const env=createSearchEnvironment(map),all=createBreadthFirstSearch(env,{allOptimal:true,classifyState:ghostFrame});assert.equal(all.run(budget).status,'solved');const groups=createTrajectoryGroups(all.optimalGraph()),grouping=groups.run(budget);assert.equal(grouping.status,'solved');assert.equal(grouping.count,'2');
 const codes=[...groups.routes()].map(actions=>{const r=ReplaySerializer.generateShareCode(map,actions);assert(r.success);return r.code;});assert.deepEqual(codes,share.groupReplayCodes);
 return{qa,plans,grouping};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){const r=verify();console.log(JSON.stringify({mapId:r.qa.mapId,T:58,groups:r.grouping.count,boundary:r.qa.boundary.status,cold:r.qa.cold,entry:r.qa.entry,physical:r.qa.physicalAudit}));}
