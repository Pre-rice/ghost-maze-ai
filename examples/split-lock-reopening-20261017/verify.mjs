import fs from 'node:fs';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {WALL_TYPES as W,normalizeMapData,normalizeVoidWalls,ReplaySerializer} from '../../src/reference/engine.js';
import {createReferenceEnvironment} from '../../src/reference/environment.js';
import {createBreadthFirstSearch} from '../../../ghost-maze/src/solver/breadthFirst.js';
import {ghostFrame,createTrajectoryGroups} from '../../../ghost-maze/src/solver/trajectoryGroups.js';
import {GameLogic,actionFromName} from '../../src/reference/engine.js';
import {auditMap} from '../gallery-adjustments-20261014/verify.mjs';
import {solveContinuation} from '../../src/design/continuation.js';
const budget={nodeBudget:500000,stateBudget:500000,budgetMs:30000};
const read=name=>JSON.parse(fs.readFileSync(new URL(name,import.meta.url)));

/** 从公开元件表重建；物理仍仅来自本体。 */
export function derive(){
 const wall=(type,extra={})=>({type,keys:0,...extra}),letter=initialState=>wall(W.LETTER_DOOR,{letter:'A',initialState});
 const l={activeCells:Array.from({length:8},()=>Array(8).fill(false)),hWalls:Array.from({length:9},()=>Array.from({length:8},()=>wall(W.SOLID))),vWalls:Array.from({length:8},()=>Array.from({length:9},()=>wall(W.SOLID))),ghosts:[{x:1,y:1,id:0},{x:0,y:1,id:1}],items:[{x:5,y:2,type:'key'}],buttons:[{x:2,y:1,letter:'A',direction:{dx:0,dy:-1}},{x:5,y:1,letter:'A',direction:{dx:1,dy:0}}],customStartPos:{x:3,y:0},endPos:{x:4,y:0}};
 const cells=[[3,0],[4,0],[5,0]];for(const y of[1,2])for(let x=0;x<=5;x++)cells.push([x,y]);for(const y of[3,4])for(let x=0;x<=3;x++)cells.push([x,y]);
 for(const[x,y]of cells)l.activeCells[y][x]=true;
 for(const[x,y]of cells){if(l.activeCells[y]?.[x+1])l.vWalls[y][x+1]=wall(W.EMPTY);if(l.activeCells[y+1]?.[x])l.hWalls[y+1][x]=wall(W.EMPTY);}
 l.vWalls[0][4]=wall(W.SOLID);l.vWalls[0][5]=wall(W.LOCKED,{keys:1});l.hWalls[1][4]=wall(W.SOLID);
 l.vWalls[1][3]=letter('open');l.vWalls[1][5]=letter('open');l.hWalls[1][5]=letter('open');l.hWalls[2][4]=letter('open');l.hWalls[2][2]=letter('closed');
 l.vWalls[2][3]=wall(W.DOOR);l.vWalls[2][5]=wall(W.ONE_WAY,{direction:{dx:-1,dy:0}});
 return normalizeVoidWalls(normalizeMapData({width:8,height:8,editorMode:'free',gameMode:'death-loop',initialHealth:5,multiLayerMode:false,layerCount:1,layers:[l],stairs:[]}));
}

export function analyze(map){
 const env=createReferenceEnvironment(map),rows=[];
 const run=(label,monitor,environment=env)=>{const s=createBreadthFirstSearch(environment,{monitor});return{label,result:s.run(budget),actions:s.firstActions()};};
 for(const count of[0,1,2])rows.push(run('firstCapture'+count,{initial:()=>[0],advance:(p,b,a,n)=>{const press=b.player.x===n.player.x&&b.player.y===n.player.y;if(press&&!p[0]&&b.layerStates[0].ghosts.filter(g=>g.y===1&&[3,4].includes(g.x)).length!==count)return null;const seen=p[0]||Number(press);return n.isWon&&!seen?null:[seen];}}));
 rows.push(run('withoutA',{initial:()=>[],advance:(p,b,a,n)=>b.player.x===n.player.x&&b.player.y===n.player.y?null:[]}));
 // 自由鬼的历史角色进入完整键；编号仅追踪来源，不参与物理裁定。
 rows.push(run('neverReactivateOutsideGhost',{initial:()=>[0,-1],advance:(p,b,a,n)=>{const press=b.player.x===n.player.x&&b.player.y===n.player.y;if(p[0]){const x=b.layerStates[0].ghosts.find(g=>g.id===p[1]),z=n.layerStates[0].ghosts.find(g=>g.id===p[1]);if(x.x!==z.x||x.y!==z.y)return null;}if(press&&!p[0]){const f=n.layerStates[0].ghosts.filter(g=>g.y!==1||![3,4].includes(g.x));return f.length===1?[1,f[0].id]:null;}return n.isWon&&!p[0]?null:p;}}));
 const diagnostics=new WeakMap(),step=(s,a)=>{const d=[],n=GameLogic.calculateNextState(s,actionFromName(a),env.mapDefinition,{trails:false,visibility:false,ghostDiagnostics:d});diagnostics.set(n,d);return n;};
 rows.push(run('withoutVisiblePriority',{initial:()=>[],advance:(p,b,a,n)=>diagnostics.get(n).some(d=>d.decision==='visible_target_priority')?null:[]},{...env,step}));
 const fullPrefix=['D','R','R','R'],fullyLocked=solveContinuation(map,fullPrefix,{reference:true,nodeBudget:500000,budgetMs:30000});
 let dead=env.initialState();for(const a of[...fullPrefix,'D','L']){const n=env.step(dead,a);assert(n!==dead&&!n.isDead);dead=n;}
 const blockedReturn={prefix:[...fullPrefix,'D','L'],player:[dead.player.x,dead.player.y],safeNext:env.actions.filter(a=>{const n=env.step(dead,a);return n!==dead&&!n.isDead;})};
 assert.deepEqual(blockedReturn.safeNext,[]);
 return{rows,fullyLocked,blockedReturn,scope:'完整原图、无伤无复活；非最优重合未额外禁止，未知不当无解',humanQuality:null};
}

export function verifyMap(map){
 assert.deepEqual(map,derive());const l=map.layers[0],active=(x,y)=>!!l.activeCells[y]?.[x];
 for(let y=0;y<=map.height;y++)for(let x=0;x<map.width;x++)if(active(x,y)!==active(x,y-1))assert.equal(l.hWalls[y][x].type,W.SOLID);
 for(let y=0;y<map.height;y++)for(let x=0;x<=map.width;x++)if(active(x,y)!==active(x-1,y))assert.equal(l.vWalls[y][x].type,W.SOLID);
 const qa=auditMap(map);assert.equal(qa.reference.solution.totalActions,37);assert.equal(qa.count,'6');assert(qa.cold&&qa.entry.wholeOptimalRoutesInteriorEqual);assert.equal(qa.noEndSafeRoutes,6);
 const plans=analyze(map);for(const p of plans.rows)assert.equal(p.result.status,p.label==='firstCapture1'?'solved':'proven_unsat');assert.equal(plans.fullyLocked.status,'proven_unsat');
 const env=createReferenceEnvironment(map),all=createBreadthFirstSearch(env,{allOptimal:true,classifyState:ghostFrame});assert.equal(all.run(budget).status,'solved');const groups=createTrajectoryGroups(all.optimalGraph()),grouping=groups.run(budget);assert.equal(grouping.status,'solved');assert.equal(grouping.count,'6');
 const groupReplayCodes=[...groups.routes()].map(actions=>{assert(env.replay(actions).state.isWon);const encoded=ReplaySerializer.generateShareCode(map,actions);assert(encoded.success);return encoded.code;});
 return{qa,plans,grouping,groupReplayCodes,humanQuality:null,role:'physical_QA_not_human_quality'};
}

if(process.argv[1]===fileURLToPath(import.meta.url)){
 const map=read('map.json'),source=read('source.json'),stored=read('evidence.json'),share=read('share.json'),result=verifyMap(map);
 assert.equal(source.humanQuality,null);assert.equal(source.gallerySelection,null);assert.equal(result.qa.mapCode,share.mapCode);assert.equal(result.qa.replayCode,share.replayCode);assert.deepEqual(result.groupReplayCodes,share.groupReplayCodes);assert.deepEqual(result.qa.routes,stored.qa.routes);assert.equal(result.qa.ruleset,stored.qa.ruleset);
 console.log(JSON.stringify({mapId:result.qa.mapId,N:37,ghostTimingGroups:result.grouping.count,boundary:result.qa.boundary.status,cold:result.qa.cold,entry:result.qa.entry,physical:result.qa.physicalAudit,restrictions:result.plans.rows.map(p=>({label:p.label,status:p.result.status})),fullyLocked:result.plans.fullyLocked.status}));
}
