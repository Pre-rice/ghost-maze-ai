import fs from 'node:fs';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {WALL_TYPES as W, normalizeMapData, normalizeVoidWalls, ReplaySerializer} from '../../src/reference/engine.js';
import {createReferenceEnvironment} from '../../src/reference/environment.js';
import {createBreadthFirstSearch} from '../../../ghost-maze/src/solver/breadthFirst.js';
import {ghostFrame, createTrajectoryGroups} from '../../../ghost-maze/src/solver/trajectoryGroups.js';
import {auditMap} from '../gallery-adjustments-20261014/verify.mjs';
import {solveContinuation} from '../../src/design/continuation.js';

const budget = {nodeBudget:200000, stateBudget:200000, budgetMs:10000};
const read = name => JSON.parse(fs.readFileSync(new URL(name, import.meta.url)));

// 从公开的格子／元件表重建；没有另一份游戏物理。
export function derive() {
    const wall = (type, extra = {}) => ({type, keys:0, ...extra});
    const letter = initialState => wall(W.LETTER_DOOR, {letter:'A', initialState});
    const layer = {
        activeCells:Array.from({length:8}, () => Array(8).fill(false)),
        hWalls:Array.from({length:9}, () => Array.from({length:8}, () => wall(W.SOLID))),
        vWalls:Array.from({length:8}, () => Array.from({length:9}, () => wall(W.SOLID))),
        ghosts:[{x:3,y:5,id:0}, {x:5,y:5,id:1}],
        items:[{x:5,y:4,type:'key'}],
        buttons:[{x:4,y:2,direction:{dx:0,dy:-1},letter:'A'}, {x:5,y:4,direction:{dx:1,dy:0},letter:'A'}],
        customStartPos:{x:2,y:3}, endPos:{x:2,y:6}
    };
    for (let y=2; y<=6; y++) for (let x=2; x<=5; x++) {
        layer.activeCells[y][x] = true;
        if (y>2) layer.hWalls[y][x] = wall(W.EMPTY);
        if (x>2) layer.vWalls[y][x] = wall(W.EMPTY);
    }
    layer.hWalls[3][4] = letter('closed');
    layer.hWalls[4][4] = wall(W.ONE_WAY, {direction:{dx:0,dy:1}});
    layer.hWalls[5][2] = letter('closed');
    layer.hWalls[5][4] = letter('closed');
    layer.hWalls[6][2] = wall(W.LOCKED, {keys:1});
    for (const x of [3,4,5]) layer.hWalls[6][x] = wall(W.SOLID);
    layer.vWalls[2][4] = wall(W.DOOR);
    layer.vWalls[2][5] = wall(W.SOLID);
    layer.vWalls[3][5] = letter('open');
    layer.vWalls[4][3] = wall(W.DOOR);
    layer.vWalls[5][3] = wall(W.SOLID);
    layer.vWalls[5][4] = wall(W.SOLID);
    layer.vWalls[5][5] = wall(W.ONE_WAY, {direction:{dx:1,dy:0}});
    return normalizeVoidWalls(normalizeMapData({
        width:8, height:8, editorMode:'free', gameMode:'death-loop', initialHealth:5,
        multiLayerMode:false, layerCount:1, layers:[layer], stairs:[]
    }));
}

export function analyzeControls(map) {
    const env = createReferenceEnvironment(map);
    // 监控真实门态变化；历史进入完整搜索键，连续使用同一位置只算一段。
    const rows = [];
    for (const label of ['onlyUpper','onlyFar','atMostTwoRuns','firstFromFar']) {
        const search = createBreadthFirstSearch(env, {monitor:{
            initial:() => ['',0],
            advance:(progress, before, action, next) => {
                if (before.layerStates[0].wallStates.h[3][4].currentState === next.layerStates[0].wallStates.h[3][4].currentState) return progress;
                const face = before.player.x===4 && before.player.y===2 && action==='U' ? 'upper' : 'far';
                if (label==='onlyUpper' && face!=='upper' || label==='onlyFar' && face!=='far' || label==='firstFromFar' && !progress[1] && face!=='far') return null;
                const updated = face===progress[0] ? progress : [face,progress[1]+1];
                return label==='atMostTwoRuns' && updated[1]>2 ? null : updated;
            }
        }});
        rows.push({label, result:search.run(budget), alternative:search.firstActions()});
    }
    return rows;
}

export function verify() {
    const map = read('map.json'), share = read('share.json');
    assert.deepEqual(map, derive());
    const cells = map.layers[0].activeCells;
    const active = (x,y) => !!cells[y]?.[x];
    for (let y=0;y<=map.height;y++) for (let x=0;x<map.width;x++) {
        if (active(x,y)!==active(x,y-1)) assert.equal(map.layers[0].hWalls[y][x].type,W.SOLID);
    }
    for (let y=0;y<map.height;y++) for (let x=0;x<=map.width;x++) {
        if (active(x,y)!==active(x-1,y)) assert.equal(map.layers[0].vWalls[y][x].type,W.SOLID);
    }
    const qa = auditMap(map, share.mapCode);
    assert.equal(qa.allResult.totalActions, 34);
    assert.equal(qa.count, '4');
    assert(qa.cold && qa.entry?.wholeOptimalRoutesInteriorEqual);
    assert.equal(qa.replayCode, share.replayCode);
    for (const route of qa.routes) assert.deepEqual(route.controls, [
        {step:12,letter:'A',at:[4,2]}, {step:20,letter:'A',at:[5,4]}, {step:26,letter:'A',at:[4,2]}
    ]);
    const controls = analyzeControls(map);
    assert(controls.every(p => p.result.status==='proven_unsat'));
    const env = createReferenceEnvironment(map);
    const search = createBreadthFirstSearch(env, {allOptimal:true,classifyState:ghostFrame});
    assert.equal(search.run(budget).status, 'solved');
    const groups = createTrajectoryGroups(search.optimalGraph());
    const grouping = groups.run(budget);
    assert.equal(grouping.status, 'solved');
    assert.equal(grouping.count, '2');
    const groupReplayCodes = [...groups.routes()].map(actions => {
        assert(env.replay(actions).state.isWon);
        const encoded = ReplaySerializer.generateShareCode(map, actions);
        assert(encoded.success);
        return encoded.code;
    });
    assert.deepEqual(groupReplayCodes, share.groupReplayCodes);
    const early = solveContinuation(map, ['U','R','R','U'], {reference:true,nodeBudget:200000,budgetMs:10000});
    assert.equal(early.status, 'proven_unsat');
    return {qa, controls, grouping, groupReplayCodes, earlyUpperWithoutPreparing:early,
        role:'physical_QA_not_human_quality', humanQuality:null};
}

if (process.argv[1]===fileURLToPath(import.meta.url)) {
    const result = verify(), stored = read('evidence.json'), source = read('source.json');
    assert.equal(result.qa.ruleset, stored.qa.ruleset);
    assert.deepEqual(result.qa.routes, stored.qa.routes);
    assert.deepEqual(result.controls, stored.controls);
    assert.equal(source.humanQuality, null);
    assert.equal(source.gallerySelection, null);
    console.log(JSON.stringify({mapId:result.qa.mapId,N:34,ghostTimingGroups:result.grouping.count,
        boundary:result.qa.boundary.status,cold:result.qa.cold,entry:result.qa.entry,
        controls:result.controls.map(p=>({label:p.label,status:p.result.status})),
        physical:result.qa.physicalAudit,early:result.earlyUpperWithoutPreparing.status}));
}
