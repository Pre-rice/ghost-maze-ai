import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { createSearchEnvironment } from '../../../ghost-maze/src/solver/searchEnvironment.js';
import { createBreadthFirstSearch } from '../../../ghost-maze/src/solver/breadthFirst.js';
import { createReferenceEnvironment } from '../../src/reference/environment.js';
import { GameLogic, actionFromName, WALL_TYPES as W, validateMapData, normalizeVoidWalls, DataSerializer, ReplaySerializer } from '../../src/reference/engine.js';
import { solveFastMap } from '../../src/search/fast-solver.js';
import { solveReferenceMap } from '../../src/search/reference-solver.js';
import { auditPuzzleBoundaries } from '../../src/design/rule-boundaries.js';
import { assertButtonAttachments } from '../../src/design/button-support.js';
import { solveContinuation } from '../../src/design/continuation.js';

const dir=fileURLToPath(new URL('.',import.meta.url));
const map=JSON.parse(fs.readFileSync(dir+'/map.json'));
const budget={nodeBudget:250000,stateBudget:250000,budgetMs:30000};assertButtonAttachments(map);
const env=createSearchEnvironment(map),refEnv=createReferenceEnvironment(map);
const fast=solveFastMap(map,budget),reference=solveReferenceMap(map,budget);
assert.equal(fast.optimality,'proven');assert.equal(reference.optimality,'proven');assert.equal(fast.solution.totalActions,23);assert.equal(reference.solution.totalActions,23);
const all=createBreadthFirstSearch(env,{allOptimal:true}),allOptimal=all.run(budget);
assert.equal(allOptimal.status,'solved');assert.equal(all.routeCount(),1n);
const actions=reference.solution.actions,at=(s,i)=>s.layerStates[0].ghosts[i]?.x===4&&s.layerStates[0].ghosts[i]?.y===3;
const closed=s=>s.layerStates[0].wallStates.h[3][4].currentState==='closed';
const handoff={initial:()=>[0,0],advance(p,b,a,n){let[park,left]=p;
    if(closed(b)&&closed(n)&&at(b,0)&&at(n,0))park=1;
    if(park&&at(b,0)&&!at(n,0))left=1;
    if(left&&closed(b)&&closed(n)&&n.layerStates[0].ghosts.some((g,i)=>i>0&&at(b,i)&&at(n,i)))return null;return[park,left];}};
const position=(s,i,x,y)=>s.layerStates[0].ghosts[i]?.x===x&&s.layerStates[0].ghosts[i]?.y===y;
const initialBrake=(b,a,n)=>a==='U'&&b.player.x===4&&b.player.y===3&&n.player.x===4&&n.player.y===2&&
    position(b,0,4,4)&&position(n,0,4,3)&&position(b,1,3,3)&&position(n,1,3,3);
const proofs=[];
for(const[name,monitor]of[['without_stationary_exit_ghost_handoff',handoff],['without_initial_priority_brake',{initial:()=>[],advance:(p,b,a,n)=>initialBrake(b,a,n)?null:p}]]){
    const search=createBreadthFirstSearch(env,{monitor}),result=search.run(budget);assert.equal(result.status,'proven_unsat');proofs.push({name,...result,scope:'原图全部无伤无复活通关必要；历史进入完整键，非删改图证明'});
}
const noEnd=structuredClone(map);noEnd.layers[0].endPos=null;
for(const route of all.routes())assert(!createReferenceEnvironment(noEnd).replay(route).state.isDead);
const code=DataSerializer.generateShareCode(map),replay=ReplaySerializer.generateShareCode(map,actions);
assert(code.success&&replay.success);assert.deepEqual(DataSerializer.loadFromShareCode(code.code).data.mapData,map);
assert.deepEqual(ReplaySerializer.loadFromShareCode(map,replay.code).actions,actions);
const physical=s=>JSON.stringify({p:[s.player.x,s.player.y,s.player.layer,s.player.keys,s.player.hp],dead:s.isDead,won:s.isWon,
    layers:s.layerStates.map(l=>({g:l.ghosts.map(g=>[g.x,g.y]).sort((a,b)=>a[0]-b[0]||a[1]-b[1]),i:l.items,w:l.wallStates}))});
const permutations=[[0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0]];
const queue=[refEnv.initialState()],seen=new Set([refEnv.stateKey(queue[0])]);let checkedTransitions=0,compared=0;
for(let head=0;head<queue.length;head++){
    assert(queue.length<250000);const state=queue[head];if(state.isWon||state.isDead)continue;
    for(const a of refEnv.actions){const next=refEnv.step(state,a);checkedTransitions++;
        for(const permutation of permutations){const reordered=state.clone(),ghosts=reordered.layerStates[0].ghosts;
            reordered.layerStates[0].ghosts=permutation.map((i,j)=>({...ghosts[i],id:401-j*107}));
            assert.equal(physical(next),physical(refEnv.step(reordered,a)));compared++;
        }
        if(next===state||next.isDead)continue;const key=refEnv.stateKey(next);if(!seen.has(key)){seen.add(key);queue.push(next);}
    }
}
const entry=structuredClone(map);entry.layers[0].activeCells[1][6]=true;entry.layers[0].customStartPos={x:6,y:1};
entry.layers[0].hWalls[2][6]={type:W.ONE_WAY,keys:0,direction:{dx:0,dy:1}};
const entryEnv=createReferenceEnvironment(entry);
const interior=s=>JSON.stringify({p:[s.player.x,s.player.y,s.player.layer,s.player.keys,s.player.hp],dead:s.isDead,won:s.isWon,g:s.layerStates[0].ghosts,i:s.layerStates[0].items,
    walls:Object.fromEntries(['h','v'].map(axis=>[axis,s.layerStates[0].wallStates[axis].flatMap((row,y)=>row.flatMap((w,x)=>{
        const on=map.layers[0].activeCells;return on[y]?.[x]&&(axis==='h'?on[y-1]?.[x]:on[y]?.[x-1])?[[x,y,w]]:[];
    }))]))});
let entered=entryEnv.step(entryEnv.initialState(),'D'),unit=refEnv.initialState();assert.equal(interior(entered),interior(unit));
const trace=[];const decodedEnv=createReferenceEnvironment(DataSerializer.loadFromShareCode(code.code).data.mapData);let decoded=decodedEnv.initialState();
for(const [i,a] of actions.entries()){
    const before=unit,diagnostics=[];unit=GameLogic.calculateNextState(unit,actionFromName(a),refEnv.mapDefinition,{trails:false,visibility:false,ghostDiagnostics:diagnostics});
    entered=entryEnv.step(entered,a);decoded=decodedEnv.step(decoded,a);assert.equal(interior(entered),interior(unit));assert.equal(physical(decoded),physical(unit));
    trace.push({step:i+1,action:a,p:[unit.player.x,unit.player.y],ghosts:unit.layerStates[0].ghosts.map(g=>[g.x,g.y]),A:unit.layerStates[0].wallStates.h[3][4].currentState,
        initialBrake:initialBrake(before,a,unit),diagnostics});
}
assert(unit.isWon&&!unit.isDead);
const contrast=[];
const compare=(edit,description)=>{
    const checked=validateMapData(normalizeVoidWalls(edit));assert(checked.valid,checked.error);
    const a=solveFastMap(checked.mapData,budget),b=solveReferenceMap(checked.mapData,budget);assert.equal(a.status,b.status);assert.notEqual(a.status,'unknown');
    if(a.status==='solved')assert.equal(a.solution.totalActions,b.solution.totalActions);
    contrast.push({edit:description,status:a.status,T:a.solution?.totalActions,actions:b.solution?.actions});
};
for(let i=0;i<3;i++){const edit=structuredClone(map);edit.layers[0].ghosts.splice(i,1);compare(edit,{removeGhost:i});}
const noButton=structuredClone(map);noButton.layers[0].buttons=[];compare(noButton,{removeButton:'A'});
for(const type of [W.EMPTY,W.SOLID]){const edit=structuredClone(map);edit.layers[0].hWalls[3][4]={type,keys:0};compare(edit,{removeAGate:type});}
const layer=map.layers[0];
for(let y=0;y<8;y++)for(let x=0;x<8;x++){
    if(!layer.activeCells[y][x]||[layer.customStartPos,layer.endPos,...layer.ghosts,...layer.buttons].some(p=>p?.x===x&&p.y===y))continue;
    const edit=structuredClone(map);edit.layers[0].activeCells[y][x]=false;compare(edit,{removeCell:[x,y]});
}
const continuations=[];
for(const[name,prefix]of[['natural_left_lure',['D','U']],['only_bottom_ghost',['L','L','U','U','U','U','U','U']],['planned_setup',actions.slice(0,6)]]){
    const a=solveContinuation(map,prefix,{nodeBudget:250000,budgetMs:30000}),b=solveContinuation(map,prefix,{nodeBudget:250000,budgetMs:30000,reference:true});assert.equal(a.status,b.status);assert.notEqual(a.status,'unknown');continuations.push({name,fast:a,reference:b});
}
const boundary=auditPuzzleBoundaries(map,{nodeBudget:250000,budgetMs:30000});assert.equal(boundary.status,'safe');
const report={mapId:refEnv.mapId,ruleset:refEnv.ruleset,humanQuality:null,fast,reference,allOptimal,count:all.routeCount().toString(),proofs,trace,contrast,continuations,boundary,
    permutationAudit:{reachable:queue.length,checkedTransitions,permutations:6,compared,includesFatalActions:true},
    entry:{external:[6,1],action:'D',internal:[6,2],keys:0,externalGhosts:0,ANorth:'closed',wholeRouteInteriorEqual:true},
    mapCode:code.code,replayCode:replay.code,actions};
const stored=JSON.parse(fs.readFileSync(dir+'/evidence.json'));
const source=JSON.parse(fs.readFileSync(dir+'/source.json'));assert.equal(source.humanQuality,null);
assert.equal(stored.mapId,report.mapId);assert.equal(stored.ruleset,report.ruleset);assert.deepEqual(stored.actions,actions);
const share=JSON.parse(fs.readFileSync(dir+'/share.json'));assert.equal(share.mapCode,code.code);assert.equal(share.replayCode,replay.code);
console.log(JSON.stringify({T:23,count:report.count,proofs,permutationAudit:report.permutationAudit,continuations:continuations.map(c=>({name:c.name,status:c.reference.status})),contrast:contrast.map(c=>({edit:c.edit,status:c.status,T:c.T})),boundary:boundary.status,mapCode:code.code,replayCode:replay.code}));
