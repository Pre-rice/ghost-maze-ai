import {createReferenceEnvironment}from'../../src/reference/environment.js';import{createBreadthFirstSearch}from'../../../ghost-maze/src/solver/breadthFirst.js';import{WALL_TYPES as W}from'../../src/reference/engine.js';
export function analyzeCore(map){
 const env=createReferenceEnvironment(map),l=map.layers[0],doors=[];for(const axis of['h','v'])for(let y=0;y<l[axis+'Walls'].length;y++)for(let x=0;x<l[axis+'Walls'][y].length;x++){const w=l[axis+'Walls'][y][x];if(w.type===W.LETTER_DOOR)doors.push({axis,x,y,letter:w.letter});}
 const A=doors.filter(d=>d.letter==='A'),B=doors.filter(d=>d.letter==='B'),end=l.endPos;
 const touchesEnd=d=>d.axis==='h'?d.x===end.x&&(d.y===end.y||d.y===end.y+1):d.y===end.y&&(d.x===end.x||d.x===end.x+1);
 const bottom=B.find(d=>!touchesEnd(d));if(A.length!==1||A[0].axis!=='h'||!bottom||l.ghosts.length!==2)return{status:'different_roles_requires_new_analysis'};
 const shade=s=>s.layerStates[0].wallStates[A[0].axis][A[0].y][A[0].x].currentState,
  bShade=s=>s.layerStates[0].wallStates[bottom.axis][bottom.y][bottom.x].currentState,
  aboveA=s=>s.layerStates[0].ghosts[1].x===A[0].x&&s.layerStates[0].ghosts[1].y===A[0].y-1,
  initial=l.ghosts[0];
 const predicates={protectUpperAtA:(b,a,n)=>shade(b)==='open'&&shade(n)==='closed'&&aboveA(b)&&aboveA(n),
  repositionWhileAClosed:(b,a,n)=>shade(b)==='closed'&&shade(n)==='closed'&&n.layerStates[0].ghosts[1].y<b.layerStates[0].ghosts[1].y,
  releaseWithUpperGuardAboveA:(b,a,n)=>bShade(b)==='closed'&&bShade(n)==='open'&&aboveA(b),
  rightGuardLeavesInitial:(b,a,n)=>b.layerStates[0].ghosts[0].x===initial.x&&b.layerStates[0].ghosts[0].y===initial.y&&(n.layerStates[0].ghosts[0].x!==initial.x||n.layerStates[0].ghosts[0].y!==initial.y),
  closeBWithBothAbove:(b,a,n)=>bShade(b)==='open'&&bShade(n)==='closed'&&b.layerStates[0].ghosts.every(g=>g.y<bottom.y)};
 const proofs=Object.entries(predicates).map(([label,forbid])=>{const search=createBreadthFirstSearch(env,{monitor:{initial:()=>[],advance:(p,b,a,n)=>forbid(b,a,n)?null:[]}});return{label,result:search.run({nodeBudget:100000,stateBudget:100000,budgetMs:30000}),alternative:search.firstActions()};});
 return{status:proofs.every(p=>p.result.status==='proven_unsat')?'all_five_relations_necessary':'alternatives_or_unknown',A:A[0],bottomB:bottom,proofs};
}

import fs from 'node:fs';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {auditMap} from '../gallery-adjustments-20261014/verify.mjs';
import {normalizeMapData,normalizeVoidWalls} from '../../src/reference/engine.js';
import {solveContinuation} from '../../src/design/continuation.js';

export function derive(){
    const parent=JSON.parse(fs.readFileSync(new URL('../prepared-sightline-20261016/map.json',import.meta.url)));
    const expected=structuredClone(parent),layer=expected.layers[0];
    layer.vWalls[2][3]={type:W.SOLID,keys:0};layer.hWalls[2][4]={type:W.EMPTY,keys:0};
    layer.vWalls[6][3]={type:W.EMPTY,keys:0};
    layer.buttons=layer.buttons.filter(b=>b.letter!=='B');
    layer.buttons.push({x:2,y:5,direction:{dx:-1,dy:0},letter:'B'});
    layer.endPos={x:3,y:7};layer.activeCells[7][3]=true;
    layer.hWalls[7][3]={type:W.LETTER_DOOR,keys:0,letter:'B',initialState:'open'};
    layer.hWalls[8][3]={type:W.SOLID,keys:0};layer.vWalls[7][3]={type:W.SOLID,keys:0};layer.vWalls[7][4]={type:W.SOLID,keys:0};
    const prototype=normalizeVoidWalls(normalizeMapData(expected));
    for(const x of[2,4]){layer.activeCells[7][x]=true;layer.hWalls[7][x]={type:W.EMPTY,keys:0};layer.hWalls[8][x]={type:W.SOLID,keys:0};}
    for(const x of[2,3,4,5])layer.vWalls[7][x]={type:W.SOLID,keys:0};
    return{parent,prototype,expected:normalizeVoidWalls(normalizeMapData(expected))};
}
export function verify(){
    const map=JSON.parse(fs.readFileSync(new URL('map.json',import.meta.url))),share=JSON.parse(fs.readFileSync(new URL('share.json',import.meta.url)));
    const {expected,prototype}=derive();assert.deepEqual(map,expected,'核对从回望原版的确切改动，不替换母图');
    const qa=auditMap(map,share.mapCode);assert.equal(qa.allResult.totalActions,38);assert.equal(qa.count,'1');
    assert(qa.cold&&qa.entry?.wholeOptimalRoutesInteriorEqual);assert.equal(qa.replayCode,share.replayCode);
    assert.deepEqual(qa.routes[0].controls,[{step:2,letter:'A',at:[4,5]},{step:19,letter:'A',at:[4,5]},{step:22,letter:'B',at:[2,5]},{step:35,letter:'B',at:[2,5]}]);
    const core=analyzeCore(map);assert.equal(core.status,'all_five_relations_necessary');
    const earlyPrefix=['L','L','U','U','U','U','R','R'];
    const lowerApproach=[...qa.actions.slice(0,27),'D','R'];
    const early=solveContinuation(map,earlyPrefix,{reference:true,nodeBudget:100000,budgetMs:10000});
    const closeApproach=solveContinuation(map,lowerApproach,{reference:true,nodeBudget:100000,budgetMs:10000});
    assert.equal(early.status,'proven_unsat');assert.equal(closeApproach.status,'proven_unsat');
    const prototypeQa=auditMap(prototype),routes=q=>q.routes.map(({replayCode,...r})=>r);
    assert.deepEqual(routes(qa),routes(prototypeQa));
    return{qa,core,earlyReleaseThenLead:early,lowerApproach:closeApproach,parentExactlyRecovered:true,
        aestheticFill:{cells:[[2,7],[4,7]],prototypeMapId:prototypeQa.mapId,allOptimalActionsAndGhostFramesUnchanged:true},humanQuality:null};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
    const fresh=verify(),stored=JSON.parse(fs.readFileSync(new URL('evidence.json',import.meta.url))),source=JSON.parse(fs.readFileSync(new URL('source.json',import.meta.url)));
    assert.equal(fresh.qa.mapId,stored.qa.mapId);if(fresh.qa.ruleset!==stored.qa.ruleset){
        const compatibility=JSON.parse(fs.readFileSync(new URL('../../data/manifests/death-display-compatibility-20261016.json',import.meta.url)));
        assert.equal(compatibility.previousRuleset,stored.qa.ruleset);assert.equal(compatibility.ruleset,fresh.qa.ruleset);
        assert(compatibility.checkedMaps.some(m=>m.mapId===fresh.qa.mapId&&m.allOptimalActionsUnchanged));
    }
    assert.deepEqual(fresh.qa.routes,stored.qa.routes);assert.deepEqual(fresh.core.proofs.map(p=>({label:p.label,status:p.result.status,discovered:p.result.discovered})),stored.core.proofs.map(p=>({label:p.label,status:p.result.status,discovered:p.result.discovered})));
    assert.equal(source.humanQuality,null);assert.equal(source.gallerySelection,null);
    console.log(JSON.stringify({mapId:fresh.qa.mapId,N:38,count:fresh.qa.count,cold:fresh.qa.cold,entry:fresh.qa.entry,physical:fresh.qa.physicalAudit,core:fresh.core.status,early:fresh.earlyReleaseThenLead.status,low:fresh.lowerApproach.status,aestheticFill:fresh.aestheticFill}));
}
