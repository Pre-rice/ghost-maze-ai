import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {GameLogic,actionFromName,WALL_TYPES as W,DataSerializer,ReplaySerializer,validateMapData} from '../../src/reference/engine.js';
import {createReferenceEnvironment} from '../../src/reference/environment.js';
import {createSearchEnvironment} from '../../../ghost-maze/src/solver/searchEnvironment.js';
import {createBreadthFirstSearch} from '../../../ghost-maze/src/solver/breadthFirst.js';
import {solveReferenceMap} from '../../src/search/reference-solver.js';
import {solveFastMap} from '../../src/search/fast-solver.js';
import {solveContinuation} from '../../src/design/continuation.js';
import {auditPuzzleBoundaries} from '../../src/design/rule-boundaries.js';
import {assertButtonAttachments} from '../../src/design/button-support.js';

const directory=fileURLToPath(new URL('.',import.meta.url));
const budget={nodeBudget:600000,stateBudget:600000,budgetMs:30000};
const canonical=value=>JSON.parse(JSON.stringify(value));
const physical=s=>JSON.stringify({p:[s.player.layer,s.player.x,s.player.y,s.player.keys,s.player.hp],dead:s.isDead,won:s.isWon,l:s.layerStates.map(l=>({g:l.ghosts.map(g=>[g.x,g.y]).sort((a,b)=>a[0]-b[0]||a[1]-b[1]),i:l.items,w:l.wallStates}))});
const cross=(index,from,to)=>({type:'ghost_cross',layer:0,index,from:{x:from[0],y:from[1]},to:{x:to[0],y:to[1]}});

export function verifyMap(map){
    assertButtonAttachments(map);assert(validateMapData(map).valid);
    const env=createReferenceEnvironment(map),reference=solveReferenceMap(map,budget),fast=solveFastMap(map,budget);
    assert.equal(reference.status,'solved');assert.equal(fast.status,'solved');assert.equal(reference.solution.totalActions,40);assert.equal(fast.solution.totalActions,40);
    const all=createBreadthFirstSearch(createSearchEnvironment(map),{allOptimal:true}),allResult=all.run(budget);
    assert.equal(allResult.status,'solved');assert.equal(allResult.totalActions,40);assert.equal(all.routeCount(),12n);
    const specs=[
        [{id:'first_ghost_right_bay',sequence:[cross(0,[5,4],[5,5])]}],
        [{id:'goal_guard_left_bay',sequence:[cross(1,[2,4],[2,5])]}],
        [{id:'right_then_A_then_left',sequence:[cross(0,[5,4],[5,5]),{type:'press',letter:'A'},cross(1,[2,4],[2,5])]}],
        [{id:'outside_left_north',sequence:[cross(0,[3,4],[3,5])]},{id:'outside_left_east',sequence:[cross(0,[4,5],[3,5])]}],
        [{id:'closed_right_protection',sequence:[{type:'all',events:[{type:'ghost_at',layer:0,x:5,y:5},{type:'gate',layer:0,axis:'h',x:5,y:5,state:'closed'}]}]}]
    ];
    const proofs=specs.map(restrictions=>{
        const result=solveReferenceMap(map,{...budget,restrictions});assert.equal(result.status,'proven_unsat');
        return {restrictions,result};
    });
    const prefix=['U','L','D','R','L','D','R','U','U','U','U','L','L','R','D','L','D','L'];
    const continuations=[false,true].map(reference=>{
        const result=solveContinuation(map,prefix,{nodeBudget:600000,budgetMs:30000,reference});assert.equal(result.status,'proven_unsat');return result;
    });
    const initial=env.initialState();assert(initial.layerStates[0].ghosts.every(g=>!GameLogic._canGhostSeePlayer(g,initial.player,env.mapDefinition.layers[0],initial.layerStates[0])));
    const queue=[initial],seen=new Set([env.stateKey(initial)]);let transitions=0,compared=0;
    for(let head=0;head<queue.length;head++){
        assert(queue.length<600000);const state=queue[head];if(state.isWon||state.isDead)continue;
        for(const action of env.actions){
            const next=env.step(state,action);transitions++;
            for(const reverse of[false,true]){
                const altered=state.clone();if(reverse)altered.layerStates[0].ghosts.reverse();altered.layerStates[0].ghosts.forEach((g,i)=>g.id=713-i*421);
                assert.equal(physical(next),physical(env.step(altered,action)));compared++;
            }
            if(next===state||next.isDead)continue;const key=env.stateKey(next);if(!seen.has(key)){seen.add(key);queue.push(next);}
        }
    }
    const encoded=DataSerializer.generateShareCode(map);assert(encoded.success);const decodedMap=DataSerializer.loadFromShareCode(encoded.code);assert(decodedMap.success);assert.deepEqual(decodedMap.data.mapData,map);
    const decodedEnv=createReferenceEnvironment(decodedMap.data.mapData);
    const noEnd=structuredClone(map);noEnd.layers[0].endPos=null;const noEndEnv=createReferenceEnvironment(noEnd);
    const entryMap=structuredClone(map);entryMap.layers[0].activeCells[4][1]=true;entryMap.layers[0].customStartPos={x:1,y:4};entryMap.layers[0].vWalls[4][2]={type:W.ONE_WAY,keys:0,direction:{dx:1,dy:0}};
    const entryEnv=createReferenceEnvironment(entryMap);
    const interior=s=>JSON.stringify({p:[s.player.layer,s.player.x,s.player.y,s.player.keys,s.player.hp],dead:s.isDead,won:s.isWon,g:s.layerStates.map(l=>l.ghosts.map(g=>[g.x,g.y])),i:s.layerStates.map(l=>l.items),w:s.layerStates.map((l,li)=>Object.fromEntries(['h','v'].map(axis=>[axis,l.wallStates[axis].flatMap((row,y)=>row.flatMap((w,x)=>{const active=map.layers[li].activeCells;return active[y]?.[x]&&(axis==='h'?active[y-1]?.[x]:active[y]?.[x-1])?[[x,y,w]]:[];}))])))});
    const routeTraces=[],optimalSolutions=[];
    for(const actions of all.routes()){
        const replay=ReplaySerializer.generateShareCode(map,actions);assert(replay.success);assert.deepEqual(ReplaySerializer.loadFromShareCode(map,replay.code).actions,actions);
        let state=env.initialState(),entered=entryEnv.step(entryEnv.initialState(),'R'),decoded=decodedEnv.initialState();assert.equal(interior(state),interior(entered));
        const trace=[];for(const[i,action]of actions.entries()){
            const diagnostics=[];state=GameLogic.calculateNextState(state,actionFromName(action),env.mapDefinition,{trails:false,visibility:false,ghostDiagnostics:diagnostics});entered=entryEnv.step(entered,action);decoded=decodedEnv.step(decoded,action);
            assert.equal(interior(state),interior(entered));assert.equal(physical(state),physical(decoded));
            trace.push({step:i+1,action,p:[state.player.layer,state.player.x,state.player.y],ghosts:state.layerStates.map(l=>l.ghosts.map(g=>[g.x,g.y])),diagnostics});
        }
        assert(state.isWon&&!state.isDead);assert(!noEndEnv.replay(actions).state.isDead);
        routeTraces.push({actions,replayCode:replay.code,trace});optimalSolutions.push({actions,replayCode:replay.code});
    }
    const boundary=auditPuzzleBoundaries(map,budget);assert.equal(boundary.status,'safe');
    return canonical({mapId:env.mapId,ruleset:env.ruleset,humanQuality:null,reference,fast,allResult,optimalCount:'12',proofs,wrongPlan:{prefix,continuations},boundary,
        physicalAudit:{reachable:queue.length,transitions,permutations:2,compared,includesFatalActions:true},entry:{external:[0,1,4],action:'R',internal:[0,2,4],keys:0,externalGhosts:0,wholeOptimalRoutesInteriorEqual:true},cold:true,noEndSafeRoutes:12,routeTraces,optimalSolutions,mapCode:encoded.code,replayCode:routeTraces[0].replayCode,actions:routeTraces[0].actions});
}

if(process.argv[1]===fileURLToPath(import.meta.url)){
    const map=JSON.parse(fs.readFileSync(directory+'map.json')),stored=JSON.parse(fs.readFileSync(directory+'evidence.json')),source=JSON.parse(fs.readFileSync(directory+'source.json')),share=JSON.parse(fs.readFileSync(directory+'share.json'));
    const fresh=verifyMap(map);assert.equal(source.humanQuality,null);assert.equal(fresh.mapId,stored.mapId);assert.equal(fresh.ruleset,stored.ruleset);
    assert.deepEqual(fresh.routeTraces,stored.routeTraces);assert.deepEqual(fresh.optimalSolutions,share.optimalSolutions);assert.equal(fresh.mapCode,share.mapCode);
    console.log(JSON.stringify({T:40,count:'12',proofs:fresh.proofs.map(p=>p.result.status),wrongPlan:fresh.wrongPlan.continuations.map(c=>c.status),boundary:fresh.boundary.status,entry:fresh.entry,physicalAudit:fresh.physicalAudit}));
}
