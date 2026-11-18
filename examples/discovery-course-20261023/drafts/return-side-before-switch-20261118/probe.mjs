import assert from 'node:assert/strict';
import fs from 'node:fs';
import { room } from '../../build.mjs';
import { WALL_TYPES as W, DataSerializer } from '../../../../src/reference/engine.js';
import { createReferenceEnvironment } from '../../../../src/reference/environment.js';
import { createBreadthFirstSearch } from '../../../../../ghost-maze/src/solver/breadthFirst.js';

const budget = { nodeBudget: 400000, stateBudget: 400000, budgetMs: 30000 };
export const origin = room(6, 3, {
    start: [1,2], end: [0,0], ghosts: [[2,0]], items: [[5,0]],
    buttons: [[1,1,0,1,'B'], [4,1,0,1,'A']],
    edges: [
        ['v',1,0,W.SOLID], ['h',0,1,W.LOCKED,{keys:1}],
        ['v',1,1,W.LETTER_DOOR,{letter:'B',initialState:'closed'}],
        ['h',0,2,W.SOLID], ['h',1,2,W.SOLID], ['h',4,2,W.SOLID],
        ['v',5,0,W.SOLID], ['h',5,1,W.LETTER_DOOR,{letter:'B',initialState:'open'}],
        ['h',4,1,W.LETTER_DOOR,{letter:'A',initialState:'open'}],
        ['v',3,2,W.ONE_WAY,{direction:{dx:1,dy:0}}]
    ]
});

function walk(env, actions) {
    let state = env.initialState();
    const frames = [];
    for (const action of actions) {
        const next = env.step(state, action);
        const g = next.layerStates[0].ghosts[0];
        frames.push({ action, p:[next.player.x,next.player.y], g:[g.x,g.y], keys:next.player.keys });
        if (next === state || next.isDead) return { frames, failure:next.isDead?'death':'invalid' };
        state = next;
    }
    return { frames, won:state.isWon };
}

export function assess(map, mode, manual) {
    const env = createReferenceEnvironment(map);
    const mapNoEnd = structuredClone(map);
    mapNoEnd.layers[0].endPos = null;
    const noEnd = createReferenceEnvironment(mapNoEnd);
    const query = createBreadthFirstSearch(env, mode === 'native' ? {allOptimal:true} : { monitor:{
        initial: () => [],
        advance(history, before, action, after) {
            if (after.isWon && noEnd.step(before, action).isDead) return null;
            if (mode === 'no_forward_crossing' && before.player.x === 2 && before.player.y === 2 && action === 'R') return null;
            if (mode === 'no_right_button' && action === 'D' && before.player.x === 4 && before.player.y === 1) return null;
            return history;
        }
    }});
    const result = query.run(budget);
    assert.ok(['solved','proven_unsat'].includes(result.status));
    const actions = query.firstActions();
    let noEndSafe = 0;
    for (const route of query.routes()) if (!walk(noEnd,route).failure) noEndSafe++;
    return {mode,result,actions,count:query.routeCount().toString(),noEndSafe,
        manual:manual && walk(env,manual)};
}

// 各手画对照只保存分享码；需要构图继续修改时，从同一物理引擎解码。
export function saveTrials(file, report) {
    const compact = JSON.stringify(report, (key,value) => {
        if (key === 'witness') return undefined;
        if (!value?.map?.layers) return value;
        const { map, ...fields } = value;
        return { ...fields, mapCode:DataSerializer.generateShareCode(map).code };
    }, 2);
    fs.writeFileSync(new URL(file,import.meta.url), compact+'\n');
}
export function readTrials(file) {
    return JSON.parse(fs.readFileSync(new URL(file,import.meta.url)), (key,value) => {
        if (!value?.mapCode) return value;
        const decoded=DataSerializer.loadFromShareCode(value.mapCode);
        assert.ok(decoded.success);
        return {...value,map:decoded.data.mapData};
    });
}
function recordInitialPair() {
    const hand = 'RRRRUUDLULLRRDDLLLDLU'.split('');
const rows = [];
for (const name of ['arrow','ordinary']) {
    const map = structuredClone(origin);
    if (name === 'ordinary') map.layers[0].vWalls[2][3] = {type:W.DOOR,keys:0};
    const checks = ['native','no_right_button'].map(mode => assess(map,mode,mode==='native'?hand:null));
    rows.push({name,map,mapCode:DataSerializer.generateShareCode(map).code,checks});
}
saveTrials('evidence.json',{humanQuality:null,rows});
console.log(rows.map(r=>[r.name,r.checks.map(c=>[c.mode,c.result.status,c.result.totalActions,c.count,c.noEndSafe,c.actions?.join(''),c.manual?.won,c.manual?.failure])]).map(JSON.stringify).join('\n'));
}
if (import.meta.main) recordInitialPair();
