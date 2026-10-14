import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { GameLogic, actionFromName, WALL_TYPES as W, validateMapData, normalizeVoidWalls, DataSerializer, ReplaySerializer } from '../../src/reference/engine.js';
import { createReferenceEnvironment } from '../../src/reference/environment.js';
import { createSearchEnvironment } from '../../../ghost-maze/src/solver/searchEnvironment.js';
import { createBreadthFirstSearch } from '../../../ghost-maze/src/solver/breadthFirst.js';
import { solveFastMap } from '../../src/search/fast-solver.js';
import { solveReferenceMap } from '../../src/search/reference-solver.js';
import { auditPuzzleBoundaries } from '../../src/design/rule-boundaries.js';
import { assertButtonAttachments } from '../../src/design/button-support.js';

const dir=fileURLToPath(new URL('.',import.meta.url));
const map=JSON.parse(fs.readFileSync(dir+'/map.json'));
const budget={nodeBudget:250000,stateBudget:250000,budgetMs:30000};
assertButtonAttachments(map);assert(validateMapData(map).valid);
const env=createSearchEnvironment(map),re=createReferenceEnvironment(map);
const fast=solveFastMap(map,budget),reference=solveReferenceMap(map,budget);
assert.equal(fast.optimality,'proven');assert.equal(reference.optimality,'proven');
assert.equal(fast.solution.totalActions,19);assert.equal(reference.solution.totalActions,19);
const all=createBreadthFirstSearch(env,{allOptimal:true}),allOptimal=all.run(budget);
assert.equal(allOptimal.status,'solved');assert.equal(all.routeCount(),1n);
const actions=reference.solution.actions;
// 来源旁注只供审查；物理不读取它。跨层来源进入验证键，不能用层内编号替代。
const tagged={...env,initialState(){const s=env.initialState();s.layerStates.forEach((l,li)=>l.ghosts.forEach((g,i)=>g.researchOrigin=li+':'+i));return s;},
    stateKey(s){return env.stateKey(s)+'|roles:'+s.layerStates.map(l=>l.ghosts.map(g=>g.researchOrigin).join(',')).join(';');}};
const proofs=[];
for(const[name,monitor]of[
    ['without_upper_button',{initial:()=>[],advance:(p,b,a,n)=>b.player.layer===1&&b.player.x===3&&b.player.y===3&&a==='R'?null:p}],
    ['without_lower_reopening_after_upper_button',{initial:()=>[0],advance:(p,b,a,n)=>{
        const press=b.player.x===3&&b.player.y===3&&a==='R';
        if(p[0]&&press&&b.player.layer===0)return null;
        return[p[0]||(press&&b.player.layer===1)?1:0];
    }}]
]){const search=createBreadthFirstSearch(env,{monitor}),result=search.run(budget);assert.equal(result.status,'proven_unsat');proofs.push({name,...result,scope:'原图全部无伤无复活通关必要；按钮使用历史进入完整状态键，非删图证明'});}
const physical=(s,ignorePlayerLayer=false)=>JSON.stringify({p:[ignorePlayerLayer?null:s.player.layer,s.player.x,s.player.y,s.player.keys,s.player.hp],dead:s.isDead,won:s.isWon,
    layers:s.layerStates.map(l=>({g:l.ghosts.map(g=>[g.x,g.y]).sort((a,b)=>a[0]-b[0]||a[1]-b[1]),i:l.items,w:l.wallStates}))});
const queue=[tagged.initialState()],seen=new Set([tagged.stateKey(queue[0])]);let transitions=0,compared=0;
for(let head=0;head<queue.length;head++){
    assert(queue.length<250000);const state=queue[head];if(state.isWon||state.isDead)continue;
    for(const a of env.actions){const next=tagged.step(state,a);transitions++;
        const plain=state.clone();plain.layerStates.forEach(l=>l.ghosts.forEach(g=>delete g.researchOrigin));
        assert.equal(physical(next),physical(re.step(plain,a)));compared++;
        for(const reverse of [false,true]){const shuffled=state.clone();shuffled.layerStates.forEach((l,li)=>{
            if(reverse)l.ghosts.reverse();l.ghosts.forEach((g,i)=>g.id=991-(li*2+i)*137);
        });assert.equal(physical(next),physical(tagged.step(shuffled,a)));compared++;}
        if(next===state||next.isDead)continue;const key=tagged.stateKey(next);if(!seen.has(key)){seen.add(key);queue.push(next);}
    }
}
let state=re.initialState();const states=[state],trace=[];
for(const[i,a]of actions.entries()){
    const before=state,diagnostics=[];state=GameLogic.calculateNextState(state,actionFromName(a),re.mapDefinition,{trails:false,visibility:false,ghostDiagnostics:diagnostics});states.push(state);
    trace.push({step:i+1,action:a,p:[state.player.layer,state.player.x,state.player.y],ghosts:state.layerStates.map(l=>l.ghosts.map(g=>[g.x,g.y])),diagnostics});
}
assert(state.isWon&&!state.isDead);
const upper=states[5],lower=states[12];assert.equal(physical(upper,true),physical(lower,true));assert.equal(upper.player.layer,1);assert.equal(lower.player.layer,0);
const upperThird=re.step(upper,'R'),lowerThird=re.step(lower,'R');assert(upperThird.isDead);assert(!lowerThird.isDead);
assert.deepEqual(lowerThird.layerStates.map(l=>l.ghosts.map(g=>[g.x,g.y])),lower.layerStates.map(l=>l.ghosts.map(g=>[g.x,g.y])));
const noEnd=structuredClone(map);noEnd.layers[1].endPos=null;for(const route of all.routes())assert(!createReferenceEnvironment(noEnd).replay(route).state.isDead);
const share=DataSerializer.generateShareCode(map),replay=ReplaySerializer.generateShareCode(map,actions);assert(share.success&&replay.success);
assert.deepEqual(DataSerializer.loadFromShareCode(share.code).data.mapData,map);assert.deepEqual(ReplaySerializer.loadFromShareCode(map,replay.code).actions,actions);
const decoded=createReferenceEnvironment(DataSerializer.loadFromShareCode(share.code).data.mapData);let ds=decoded.initialState();
for(const[i,a]of actions.entries()){ds=decoded.step(ds,a);assert.equal(physical(ds),physical(states[i+1]));}
const entry=structuredClone(map);entry.layers[0].activeCells[3][2]=true;entry.layers[0].customStartPos={x:2,y:3};
entry.layers[0].vWalls[3][3]={type:W.ONE_WAY,keys:0,direction:{dx:1,dy:0}};
const enteredEnv=createReferenceEnvironment(entry);
const interior=s=>JSON.stringify({p:[s.player.layer,s.player.x,s.player.y,s.player.keys,s.player.hp],dead:s.isDead,won:s.isWon,
    layers:s.layerStates.map((l,li)=>({g:l.ghosts.map(g=>[g.x,g.y]),i:l.items,w:Object.fromEntries(['h','v'].map(axis=>[axis,l.wallStates[axis].flatMap((row,y)=>row.flatMap((w,x)=>{
        const on=map.layers[li].activeCells;return on[y]?.[x]&&(axis==='h'?on[y-1]?.[x]:on[y]?.[x-1])?[[x,y,w]]:[];
    }))]))}))});
let entered=enteredEnv.step(enteredEnv.initialState(),'R');assert.equal(interior(entered),interior(states[0]));
for(const[i,a]of actions.entries()){entered=enteredEnv.step(entered,a);assert.equal(interior(entered),interior(states[i+1]));}
const contrasts=[];
const compare=(edit,description)=>{
    const checked=validateMapData(normalizeVoidWalls(edit));assert(checked.valid,checked.error);
    const a=solveFastMap(checked.mapData,budget),b=solveReferenceMap(checked.mapData,budget);assert.equal(a.status,b.status);assert.notEqual(a.status,'unknown');
    if(a.status==='solved')assert.equal(a.solution.totalActions,b.solution.totalActions);
    contrasts.push({edit:description,status:a.status,T:a.solution?.totalActions,actions:b.solution?.actions});
};
for(let li=0;li<2;li++){
    if(map.layers[li].ghosts.length){const noGhost=structuredClone(map);noGhost.layers[li].ghosts=[];compare(noGhost,{removeGhostLayer:li});}
    const noButton=structuredClone(map);noButton.layers[li].buttons=[];compare(noButton,{removeButtonLayer:li});
    for(const axis of ['h','v'])for(let y=0;y<map.layers[li][axis+'Walls'].length;y++)for(let x=0;x<map.layers[li][axis+'Walls'][y].length;x++){
        const wall=map.layers[li][axis+'Walls'][y][x];if(![W.LETTER_DOOR,W.DOOR].includes(wall.type))continue;
        for(const type of [W.EMPTY,W.SOLID]){const edit=structuredClone(map);edit.layers[li][axis+'Walls'][y][x]={type,keys:0};compare(edit,{layer:li,axis,x,y,from:wall,to:type});}
    }
    const layer=map.layers[li];for(let y=0;y<8;y++)for(let x=0;x<8;x++){
        if(!layer.activeCells[y][x]||[layer.customStartPos,layer.endPos,...layer.ghosts,...layer.buttons,...map.stairs.filter(s=>s.layer===li)].some(p=>p?.x===x&&p.y===y))continue;
        const edit=structuredClone(map);edit.layers[li].activeCells[y][x]=false;compare(edit,{removeCell:[li,x,y]});
    }
}
assert.equal(re.initialState().layerStates[0].ghosts.length,0);
const boundary=auditPuzzleBoundaries(map,{nodeBudget:250000,budgetMs:30000});assert.equal(boundary.status,'safe');
const report={humanQuality:null,mapId:re.mapId,ruleset:re.ruleset,fast,reference,allOptimal,count:all.routeCount().toString(),proofs,trace,
    physicalAudit:{reachable:queue.length,transitions,compared,sourceAnnotationsIgnorePhysics:true,reverseOrderAndRenumber:true,includesFatalActions:true},
    controlFaceContrast:{upperPrefix:actions.slice(0,5),lowerPrefix:actions.slice(0,12),sameGhostsGatesXYKeysHealth:true,difference:'玩家可见楼层',upperThirdA:'dead',lowerThirdA:'safe_ghosts_unchanged'},
    entry:{external:[0,2,3],action:'R',internal:[0,3,3],keys:0,externalGhosts:0,wholeRouteInteriorEqual:true},
    trimmedSpawn:{position:[0,3,3],cold:true,reason:'删冗余下层鬼与两格走廊后，出生直接放在下层按钮，无突出出生格'},
    contrasts,boundary,actions,mapCode:share.code,replayCode:replay.code};
const stored=JSON.parse(fs.readFileSync(dir+'/evidence.json'));
const source=JSON.parse(fs.readFileSync(dir+'/source.json'));
assert.equal(source.humanQuality,null);assert.equal(stored.mapId,report.mapId);assert.equal(stored.ruleset,report.ruleset);
assert.deepEqual(stored.actions,actions);assert.deepEqual(stored.proofs.map(p=>[p.name,p.status]),proofs.map(p=>[p.name,p.status]));
const storedShare=JSON.parse(fs.readFileSync(dir+'/share.json'));assert.equal(storedShare.mapCode,report.mapCode);assert.equal(storedShare.replayCode,report.replayCode);
console.log(JSON.stringify({...report,fast:undefined,reference:undefined,trace:undefined,contrasts:contrasts.map(c=>({edit:c.edit,status:c.status,T:c.T})),boundary:boundary.status}));
