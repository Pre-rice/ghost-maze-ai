import assert from 'node:assert/strict';
import { createReferenceEnvironment } from '../../src/reference/environment.js';
import { createFastEnvironment, physicalState } from '../../src/search/fast-environment.js';
import { assertButtonAttachments } from '../../src/design/button-support.js';
import { WALL_TYPES as W } from '../../src/reference/engine.js';

// 外部监控查找第一次 B 早于开门的胜利；物理迁移不变，历史标志参与去重。
export function firstBBeforeGate(map, { reference = false, nodeBudget = 100000, budgetMs = 10000 } = {}) {
    const fast = createFastEnvironment(map), env = reference ? fast.reference : fast;
    const queue = [{ state: env.initialState(), seenB: false, parent: -1, action: null }];
    const seen = new Set([env.stateKey(queue[0].state) + '|false']), started = Date.now();
    let expanded = 0;
    for (let head = 0; head < queue.length; head++) {
        if (expanded >= nodeBudget || Date.now() - started >= budgetMs) return { status: 'unknown', reason: 'budget', expanded, discovered: seen.size };
        const node = queue[head]; expanded++;
        if (node.state.isWon && node.seenB) {
            const actions = [];
            for (let i = head; queue[i].parent >= 0; i = queue[i].parent) actions.push(queue[i].action);
            actions.reverse(); fast.reference.replay(actions);
            return { status: 'solved', actions, expanded, discovered: seen.size };
        }
        for (const action of fast.reference.actions) {
            const next = env.step(node.state, action);
            if (next === node.state || next.isDead) continue;
            const opened = node.state.layerStates[0].wallStates.h[7][4].type === W.LOCKED && next.layerStates[0].wallStates.h[7][4].type === W.EMPTY;
            if (opened && !node.seenB) continue;
            const seenB = node.seenB || (action === 'R' && node.state.player.x === 4 && node.state.player.y === 3);
            const key = env.stateKey(next) + '|' + seenB;
            if (seen.has(key)) continue;
            seen.add(key); queue.push({ state: next, seenB, parent: head, action });
        }
    }
    return { status: 'proven_unsat', reason: 'frontier_exhausted', expanded, discovered: seen.size,
        algorithm: reference ? 'reference_bfs_first_B_before_gate' : 'fast_bfs_first_B_before_gate', elapsedMs: Date.now() - started };
}

export function checkEntry(map, actions) {
    const exterior = structuredClone(map);
    exterior.activeCells[4][1] = true;
    exterior.hWalls[4][1] = { type: W.ONE_WAY, direction: { dx: 0, dy: -1 }, keys: 0 };
    exterior.startPos = exterior.customStartPos = { x: 1, y: 4 };
    assertButtonAttachments(exterior);
    const inner = createReferenceEnvironment(map), outer = createReferenceEnvironment(exterior);
    const initial = physicalState(inner.initialState());
    // 入门边及三条纯外部边不属于单元内部；仅扣除外部进场的一次有效操作。
    const excludedEdges = [['h', 1, 4], ['h', 1, 5], ['v', 1, 4], ['v', 2, 4]];
    const project = state => {
        const p = physicalState(state); p.player.steps--;
        for (const [axis, x, y] of excludedEdges) p.layers[0].wallStates[axis][y][x] = structuredClone(initial.layers[0].wallStates[axis][y][x]);
        return p;
    };
    let a = inner.initialState(), b = outer.step(outer.initialState(), 'U');
    assert.deepEqual(project(b), physicalState(a));
    const initialComparison = { unit: physicalState(a), entered: project(b) }, trace = [];
    for (const [i, action] of actions.entries()) {
        a = inner.step(a, action); b = outer.step(b, action);
        assert.deepEqual(project(b), physicalState(a));
        trace.push({ step: i + 1, player: [a.player.x, a.player.y], ghosts: a.layerStates[0].ghosts.map(g => [g.x, g.y]), keys: a.player.keys });
    }
    assert(a.isWon && b.isWon);
    assert(!createReferenceEnvironment({ ...exterior, endPos: null }).replay(['U', ...actions]).state.isDead);
    return { exterior, actions: ['U', ...actions], exteriorMapId: outer.mapId,
        entry: { from: [1, 4], to: [1, 3], action: 'U', wall: { axis: 'h', x: 1, y: 4 } },
        excludedEdges, initialComparison, trace,
        checks: { buttonsAttached: true, entryDoesNotMoveGhosts: true, physicalInitialParity: true, perStepParity: true, withoutGoalSafe: true },
        scope: '原机关初态、零入场钥匙、区外无其他鬼的指定单向入口；验证实际进场与参考路线，不声称任意外部局面兼容' };
}
