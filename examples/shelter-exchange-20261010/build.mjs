import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync,appendFileSync} from 'node:fs';
import {DataSerializer,WALL_TYPES as W} from '../../src/reference/engine.js';
import {createReferenceEnvironment} from '../../src/reference/environment.js';
import {createFastEnvironment,physicalState} from '../../src/search/fast-environment.js';
import {solveFastMap} from '../../src/search/fast-solver.js';
import {solveReferenceMap} from '../../src/search/reference-solver.js';
import {assertButtonAttachments} from '../../src/design/button-support.js';
import {traceState,describeStep} from '../../src/review/trace-core.js';
import {budget,referenceBudget,constraints} from './evaluate.mjs';

const read=name=>JSON.parse(readFileSync(new URL(name,import.meta.url),'utf8'));
const save=(name,value)=>writeFileSync(new URL(name,import.meta.url),JSON.stringify(value,null,2)+'\n',{flag:'wx'});
const minimized=read('../../runs/position-relations-20261010/m-minimized.json');
const source=read('../../runs/position-relations-20261010/j-proposals.json').variants[0];
const map=minimized.map,env=createReferenceEnvironment(map),fast=createFastEnvironment(map);
assertButtonAttachments(map);
const checkpointDir=new URL('../../runs/shelter-exchange-20261010/build-checks/',import.meta.url);
mkdirSync(checkpointDir,{recursive:true});
// 已完成的检查排他保存；预算耗尽单独记为未知，恢复构建时只补缺失的检查。
function checked(name,run){
    const file=new URL(name+'.json',checkpointDir);
    if(existsSync(file)){const saved=JSON.parse(readFileSync(file,'utf8'));assert.equal(saved.mapId,env.mapId);return saved.result;}
    const result=run();appendFileSync(new URL('attempts.jsonl',checkpointDir),JSON.stringify({name,mapId:env.mapId,result})+'\n');
    if(result.status!=='unknown')writeFileSync(file,JSON.stringify({mapId:env.mapId,result},null,2)+'\n',{flag:'wx'});
    return result;
}
const quickBudget={...budget,budgetMs:30000},independentBudget={...referenceBudget,budgetMs:180000};
const baseline=checked('baseline-fast',()=>solveFastMap(map,quickBudget));
const reference=checked('baseline-reference',()=>solveReferenceMap(map,independentBudget));
assert.equal(baseline.status,'solved');assert.equal(baseline.optimality,'proven');assert.equal(reference.status,'solved');
assert.equal(baseline.solution.totalActions,reference.solution.totalActions);
console.log(JSON.stringify({check:'baseline',T:baseline.solution.totalActions,L:baseline.solution.movementCost}));
const proofs=[];for(const condition of constraints){const quick=checked(condition.id+'-fast',()=>solveFastMap(map,{...quickBudget,restrictions:[condition]}));
    const result=checked(condition.id+'-reference',()=>solveReferenceMap(map,{...independentBudget,restrictions:[condition]}));
    assert.equal(quick.status,'proven_unsat');assert.equal(result.status,'proven_unsat');assert(result.search.exhausted);
    proofs.push({condition,quick,reference:result});console.log(JSON.stringify({check:condition.id,states:result.search.discovered}));}
const encoded=DataSerializer.generateShareCode(map);assert(encoded.success);
const decoded=DataSerializer.loadFromShareCode(encoded.code);assert(decoded.success);
const{mapData,gameMode,initialHealth,initialStamina}=decoded.data;assertButtonAttachments(mapData);
const restored=createReferenceEnvironment({...mapData,gameMode,initialHealth,initialStamina});
const actions=baseline.solution.actions,trace=[],browserTrace=[];let a=env.initialState(),b=fast.initialState(),c=restored.initialState();
browserTrace.push({physical:traceState(c),seenCells:c.seenCells});
for(const action of actions){const before=a;a=env.step(a,action);b=fast.step(b,action);c=restored.step(c,action);
    assert(!a.isDead);assert.deepEqual(physicalState(a),physicalState(b));assert.deepEqual(physicalState(a),physicalState(c));assert.deepEqual(a.seenCells,c.seenCells);
    trace.push(describeStep(before,a,action,env.mapDefinition,W));browserTrace.push({physical:traceState(c),seenCells:c.seenCells});}
assert(a.isWon);
const reversed=structuredClone(map);reversed.initialGhosts.reverse();assert(createReferenceEnvironment(reversed).replay(actions).state.isWon);
const reverse=solveFastMap(reversed,quickBudget);assert.equal(reverse.status,'solved');assert.equal(reverse.solution.totalActions,actions.length);
assert(!createReferenceEnvironment({...map,endPos:null}).replay(actions).state.isDead);
assert(![...map.hWalls.flat(),...map.vWalls.flat()].some(w=>[W.GLASS,W.ONE_WAY].includes(w.type)));
const evidence={schemaVersion:1,date:'2026-10-10',mapId:env.mapId,decodedMapId:restored.mapId,ruleset:env.ruleset,
    familyId:'shelter-exchange-three-ghost-v1',splitGroup:'dual-loop-relay-v1',baseline,reference,proofs,trace,reverse,
    sharecode:encoded.code,source:{parent:'borrowed-shelter-wallfix-20261009',seed:1010293,index:4418,manualVariant:0,manualVariants:60},
    lineage:minimized.lineage,attempts:minimized.attempts,minimality:minimized.localMinimality,
    preservedFeatures:{ghostCount:3,itemCount:2,upperInnerLoop:[1,1],upperComplementaryDoors:[['h',1,1],['v',2,1]],
        scope:'保留三鬼角色与小回路的条件内精简，不是无条件局部最小或全局最小'},
    attachmentCheck:{unsupportedButtons:0,decodedUnsupportedButtons:0},humanQuality:null,status:'awaiting_user_review'};
save('source.json',{source:source.map,changes:source.changes,parentIndex:4418,manualVariant:0});save('map.json',map);save('evidence.json',evidence);
save('browser-trace.json',{mapId:restored.mapId,actions,trace:browserTrace});
save('manifest.json',{date:'2026-10-10',ruleset:env.ruleset,mapId:env.mapId,decodedMapId:restored.mapId,
    familyId:evidence.familyId,splitGroup:evidence.splitGroup,source:evidence.source,activeCells:map.activeCells.flat().filter(Boolean).length,
    ghostCount:3,itemCount:2,buttonCount:map.buttons.length,totalActions:actions.length,movementCost:baseline.solution.movementCost,
    initialStamina:100,sharecode:encoded.code,humanQuality:null});
console.log(JSON.stringify({check:'finished',T:actions.length,L:a.player.steps,stamina:a.player.stamina,shareLength:encoded.code.length}));
