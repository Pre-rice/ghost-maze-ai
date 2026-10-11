import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createReferenceEnvironment} from '../../src/reference/environment.js';
import {createFastEnvironment,physicalState} from '../../src/search/fast-environment.js';
import {solveReferenceMap} from '../../src/search/reference-solver.js';
import {solveFastMap} from '../../src/search/fast-solver.js';
import {DataSerializer,WALL_TYPES as W} from '../../src/reference/engine.js';
import { traceState } from '../../src/review/trace-core.js';
import { describeStep } from '../../src/review/step-description.js';
import {budget,referenceBudget,constraints,edges,proved} from './evaluate.mjs';

// 使用已完成的精简输出，不重跑提案，不覆盖历史证据。
const save=(name,value)=>writeFileSync(new URL(name,import.meta.url),JSON.stringify(value,null,2)+'\n',{flag:'wx'});
const source=JSON.parse(readFileSync(new URL('source.json',import.meta.url)));
const minimized=JSON.parse(readFileSync(new URL('../../runs/nonlinear-20261009/minimized-n13.json',import.meta.url)));
const {map,evaluation}=minimized,env=createReferenceEnvironment(map),fast=createFastEnvironment(map);
assert.equal(minimized.localMinimality.unresolved,0);
const actions=evaluation.baseline.solution.actions;
const reference=solveReferenceMap(map,referenceBudget);assert(proved(reference));assert.equal(reference.solution.totalActions,actions.length);
console.log(JSON.stringify({check:'reference_baseline',T:actions.length,states:reference.search.discovered}));
const proofs=[];
for(const condition of constraints){
    const result=solveReferenceMap(map,{...referenceBudget,restrictions:[condition]});
    assert.equal(result.status,'proven_unsat',condition.id);assert(result.search.exhausted);
    proofs.push({condition,quick:evaluation.proofs.find(p=>p.condition.id===condition.id).result,reference:result});
    console.log(JSON.stringify({check:condition.id,states:result.search.discovered}));
}
const ablations=[];
for(const edge of edges(map).filter(e=>![W.EMPTY,W.SOLID].includes(e.wall.type)))for(const type of [W.EMPTY,W.SOLID]){
    const changed=structuredClone(map);changed[edge.axis+'Walls'][edge.y][edge.x]={type,keys:0};
    const quick=solveFastMap(changed,budget),result=solveReferenceMap(changed,referenceBudget);
    assert.equal(result.status,quick.status);assert.notEqual(result.status,'unknown');
    if(result.solution)assert.equal(result.solution.totalActions,quick.solution.totalActions);
    ablations.push({edit:{...edge,type},quick,reference:result});
    console.log(JSON.stringify({check:'wall_ablation',axis:edge.axis,x:edge.x,y:edge.y,type,status:result.status,T:result.solution?.totalActions}));
}
const singleGhost=[];
for(let index=0;index<2;index++){const changed=structuredClone(map);changed.initialGhosts.splice(index,1);const result=solveReferenceMap(changed,referenceBudget);assert.notEqual(result.status,'unknown');singleGhost.push({removed:index,result});}
const noGhost=solveFastMap(map,{...budget,withGhosts:false});assert(proved(noGhost));
const encoded=DataSerializer.generateShareCode(map);assert(encoded.success);
const decoded=DataSerializer.loadFromShareCode(encoded.code);assert(decoded.success);
const {mapData,gameMode,initialHealth}=decoded.data;
const restored=createReferenceEnvironment({...mapData,gameMode,initialHealth});
let a=env.initialState(),b=fast.initialState(),c=restored.initialState();
assert.deepEqual(physicalState(a),physicalState(c));
const trace=[],browserTrace=[{physical:traceState(c),seenCells:c.seenCells}];
for(const action of actions){const before=a;a=env.step(a,action);b=fast.step(b,action);c=restored.step(c,action);
    assert(!a.isDead);assert.deepEqual(physicalState(a),physicalState(b));assert.deepEqual(physicalState(a),physicalState(c));assert.deepEqual(a.seenCells,c.seenCells);
    trace.push(describeStep(before,a,action,env.mapDefinition,W));browserTrace.push({physical:traceState(c),seenCells:c.seenCells});
}
assert(a.isWon);
const reverse=structuredClone(map);reverse.initialGhosts.reverse();const reversed=createReferenceEnvironment(reverse).replay(actions);assert(reversed.state.isWon);
const noEnd=createReferenceEnvironment({...map,endPos:null}).replay(actions);assert(!noEnd.state.isDead);
const replaced=structuredClone(map);for(const e of edges(replaced))if(e.wall.type===W.GLASS)replaced[e.axis+'Walls'][e.y][e.x]={type:W.SOLID,keys:0};assert.deepEqual(replaced,map);
const evidence={schemaVersion:1,date:'2026-10-09',ruleset:env.ruleset,mapId:env.mapId,decodedMapId:restored.mapId,
    familyId:'reversible-shelter-return-v1',splitGroup:'dual-loop-relay-v1',provenance:source.provenance,
    solution:evaluation.baseline,reference,proofs,ablations,singleGhost,noGhost,
    minimality:minimized.localMinimality,lineage:minimized.lineage,attempts:minimized.attempts,complexity:minimized.complexity,
    trace,sharecode:encoded.code,exitWithoutGoal:physicalState(noEnd.state),ghostOrder:{originalCertificateWinsAfterReversal:true,final:physicalState(reversed.state)},
    glassIndependence:{glassCount:0,exactMapIdentity:true,replacementMapId:createReferenceEnvironment(replaced).mapId,scope:'all_strategies_same_map_and_rules'},
    initialVisibility:{knowledgeStrategyProven:false},humanQuality:null,status:'awaiting_user_review'};
save('map.json',map);save('evidence.json',evidence);save('browser-trace.json',{mapId:restored.mapId,actions,trace:browserTrace});
save('manifest.json',[{mapId:env.mapId,ruleset:env.ruleset,cells:minimized.complexity[0],ghosts:2,buttons:map.buttons.length,keys:2,actions:actions.length,sharecode:encoded.code,familyId:evidence.familyId,splitGroup:evidence.splitGroup,status:evidence.status}]);
console.log(JSON.stringify({check:'finished',cells:minimized.complexity[0],T:actions.length,L:env.replay(actions).movementCost,word:trace.map(t=>t.button??'').join(''),shareLength:encoded.code.length}));
