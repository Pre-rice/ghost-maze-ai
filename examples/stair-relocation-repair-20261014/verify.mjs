import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { solveFastMap } from '../../src/search/fast-solver.js';
import { solveReferenceMap } from '../../src/search/reference-solver.js';
import { createReferenceEnvironment } from '../../src/reference/environment.js';
import { DataSerializer, ReplaySerializer, normalizeVoidWalls, validateMapData } from '../../src/reference/engine.js';
import { createSearchEnvironment } from '../../../ghost-maze/src/solver/searchEnvironment.js';
import { createBreadthFirstSearch } from '../../../ghost-maze/src/solver/breadthFirst.js';
import { auditPuzzleBoundaries } from '../../src/design/rule-boundaries.js';

const map = JSON.parse(readFileSync(new URL('./map.json', import.meta.url)));
const source = JSON.parse(readFileSync(new URL('./source.json', import.meta.url)));
const share = JSON.parse(readFileSync(new URL('./share.json', import.meta.url)));
assert.equal(source.humanQuality, null); assert.equal(source.humanReviewOfRepair, null);
assert.equal(createHash('sha256').update(readFileSync(new URL('../../'+source.originalFile, import.meta.url))).digest('hex'), source.originalFileSha256);
const budget = { nodeBudget: 100000, stateBudget: 100000, budgetMs: 30000 };
const env = createSearchEnvironment(map), fast = solveFastMap(map, budget), reference = solveReferenceMap(map, budget);
assert.equal(fast.optimality, 'proven'); assert.equal(reference.optimality, 'proven');
assert.equal(fast.solution.totalActions, 19); assert.equal(reference.solution.totalActions, 19);
assert.deepEqual(fast.solution.actions, share.actions);
const search = createBreadthFirstSearch(env, { allOptimal: true });
assert.equal(search.run(budget).status, 'solved'); assert.equal(search.routeCount(), 1n);
const noEnd = structuredClone(map); noEnd.layers[1].endPos = null;
const noEndEnv = createReferenceEnvironment(noEnd);
for (const route of search.routes()) noEndEnv.replay(route);
for (const max of [0,1]) {
    const monitor = { initial: () => [0], advance(p, before, _action, after) {
        const count = p[0] + Math.abs(after.layerStates[1].ghosts.length-before.layerStates[1].ghosts.length);
        return count > max ? null : [count];
    } };
    assert.equal(createBreadthFirstSearch(env, { monitor }).run(budget).status, 'proven_unsat');
}
assert.equal(auditPuzzleBoundaries(map, { nodeBudget:100000, budgetMs:30000 }).status, 'safe');
const encoded = DataSerializer.generateShareCode(map); assert(encoded.success);
assert.equal(encoded.code, share.mapCode);
assert.deepEqual(DataSerializer.loadFromShareCode(encoded.code).data.mapData, map);
const replay = ReplaySerializer.generateShareCode(map, share.actions); assert(replay.success);
assert.equal(replay.code, share.replayCode);
assert.deepEqual(ReplaySerializer.loadFromShareCode(map, replay.code).actions, share.actions);
const first = env.initialState();
for (const action of env.actions) {
    const next = env.step(first, action); if (next === first) continue;
    assert(!next.isDead); assert.deepEqual(next.layerStates.map(l => l.ghosts), first.layerStates.map(l => l.ghosts));
}
// 真正走过指定入口，不以编辑器摆出生点代替入场验证。
const entry = structuredClone(map); entry.layers[0].activeCells[4][1] = true;
entry.layers[0].vWalls[4][2] = { type:4, keys:0, direction:{ dx:1,dy:0 } };
entry.layers[0].customStartPos = { x:1,y:4 };
const enteredEnv = createSearchEnvironment(entry), entered = enteredEnv.step(enteredEnv.initialState(), 'R');
const projection = state => JSON.stringify({
    p:[state.player.layer,state.player.x,state.player.y,state.player.hp,state.player.keys],
    g:state.layerStates.map(l=>l.ghosts),i:state.layerStates.map(l=>l.items),dead:state.isDead,won:state.isWon,
    w:state.layerStates.map((l,li)=>Object.fromEntries(['h','v'].map(axis=>[axis,
        l.wallStates[axis].flatMap((row,y)=>row.flatMap((w,x)=> {
            const active=map.layers[li].activeCells;
            return active[y]?.[x]&&(axis==='h'?active[y-1]?.[x]:active[y]?.[x-1])?[[x,y,w]]:[];
        }))])))
});
assert.equal(projection(entered), projection(first));
let actual=entered, unit=first;
for(const a of share.actions){actual=enteredEnv.step(actual,a);unit=env.step(unit,a);assert.equal(projection(actual),projection(unit));}
const noButton = structuredClone(map); noButton.layers[1].buttons=[];
assert.equal(solveFastMap(noButton,budget).status, 'proven_unsat');
const economy=[];
map.layers.forEach((layer,li)=>layer.activeCells.forEach((row,y)=>row.forEach((on,x)=>{
    if(!on||layer.customStartPos?.x===x&&layer.customStartPos.y===y||layer.endPos?.x===x&&layer.endPos.y===y||
        layer.ghosts.some(g=>g.x===x&&g.y===y)||layer.buttons.some(b=>b.x===x&&b.y===y)||
        map.stairs.some(s=>s.layer===li&&s.x===x&&s.y===y))return;
    const edit=structuredClone(map);edit.layers[li].activeCells[y][x]=false;
    const valid=validateMapData(normalizeVoidWalls(edit));assert(valid.valid);
    const result=solveFastMap(valid.mapData,budget);assert.notEqual(result.status,'unknown');
    if(result.status==='solved')assert(result.solution.totalActions<19, '删格不得保留同一谜题和原最短关系');
    economy.push({layer:li,x,y,status:result.status,T:result.solution?.totalActions});
})));
console.log(JSON.stringify({title:'楼间',role:'selected_intro_repair',T:19,optimalCount:'1',allWinsRequireAtLeastTwoGhostTransfers:true,
    originalPreserved:true,actualColdEntry:true,allOptimalNoEndSafe:true,economy,mapCode:share.mapCode,replayCode:share.replayCode}));
