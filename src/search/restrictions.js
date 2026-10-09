import { actionFromName } from '../reference/environment.js';
import { WALL_TYPES as W, GameLogic } from '../reference/engine.js';
import { makeSimulator, step as compactStep } from '../validate/simulator.js';

const fail = message => { throw new TypeError(`反事实条件：${message}`); };
function fields(value, names) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) fail('必须为对象');
    if (Object.keys(value).some(key => !names.includes(key))) fail('包含未知字段');
    if (names.some(key => !Object.hasOwn(value, key))) fail('缺少字段');
}

/** 禁止有序子序列；一次成功动作最多推进一项，监控进度必须参与搜索去重。 */
export function compileRestrictions(def, input = []) {
    if (!Array.isArray(input)) fail('restrictions 必须为数组');
    const specs = structuredClone(input), ids = new Set();
    let compactSimulator;
    const compile = event => {
        if (event?.type === 'locked_opened') {
            fields(event, ['type', 'layer', 'axis', 'x', 'y']);
            if (![event.layer, event.x, event.y].every(Number.isInteger) || !['h', 'v'].includes(event.axis) ||
                def.layers[event.layer]?.initialWalls[event.axis]?.[event.y]?.[event.x]?.type !== W.LOCKED) fail('开锁事件位置不是数字门');
            return (before, _action, after) => (before.layerStates || before.layers)[event.layer].wallStates[event.axis][event.y][event.x].type === W.LOCKED &&
                (after.layerStates || after.layers)[event.layer].wallStates[event.axis][event.y][event.x].type === W.EMPTY;
        }
        if (event?.type === 'ghost_cross') {
            fields(event, ['type', 'layer', 'index', 'from', 'to']);
            const valid = p => p && Number.isInteger(p.x) && Number.isInteger(p.y) && def.layers[event.layer]?.activeCells[p.y]?.[p.x];
            if (!Number.isInteger(event.layer) || !Number.isInteger(event.index) || event.index < 0 ||
                event.index >= (def.layers[event.layer]?.initialEntities.ghosts.length ?? 0) || !valid(event.from) || !valid(event.to) ||
                Math.abs(event.from.x - event.to.x) + Math.abs(event.from.y - event.to.y) !== 1) fail('鬼跨边事件非法');
            return (before, _action, after) => {
                const a = (before.layerStates || before.layers)[event.layer].ghosts[event.index];
                const b = (after.layerStates || after.layers)[event.layer].ghosts[event.index];
                return a.x === event.from.x && a.y === event.from.y && b.x === event.to.x && b.y === event.to.y;
            };
        }
        if (event?.type === 'pickup_key') {
            fields(event, ['type']);
            return (before, _action, after) => after.player.keys > before.player.keys;
        }
        if (event?.type === 'press') {
            fields(event, ['type', 'letter']);
            if (typeof event.letter !== 'string' || !/^[A-Za-z]$/.test(event.letter)) fail('按钮字母非法');
            return (before, action) => {
                const p = before.player, move = actionFromName(action);
                return move.type === 'MOVE' && def.layers[p.layer].initialEntities.buttons.find(b =>
                    b.x === p.x && b.y === p.y &&
                    b.direction.dx === move.payload.dx && b.direction.dy === move.payload.dy)?.letter === event.letter;
            };
        }
        if (event?.type === 'player_stationary') {
            fields(event, ['type']);
            return (before, _action, after) => before.player.layer === after.player.layer &&
                before.player.x === after.player.x && before.player.y === after.player.y;
        }
        if (event?.type === 'nearest_ghost_distance') {
            fields(event, ['type', 'phase', 'distance']);
            if (!['before', 'after'].includes(event.phase) || !Number.isSafeInteger(event.distance) || event.distance < 0) fail('鬼距离事件非法');
            // 当前层鬼的最小曼哈顿距离，是状态事实，不代表路径距离、视野或跨步个体身份。
            return (before, _action, after) => {
                const state = event.phase === 'before' ? before : after, p = state.player;
                const ghosts = (state.layerStates || state.layers)[p.layer].ghosts;
                return Math.min(...ghosts.map(g => Math.abs(g.x - p.x) + Math.abs(g.y - p.y))) === event.distance;
            };
        }
        if (event?.type === 'ghost_blocked') {
            fields(event, ['type', 'index']);
            if (def.layerCount !== 1 || !Number.isInteger(event.index) || event.index < 0 ||
                event.index >= def.layers[0].initialEntities.ghosts.length) fail('挡鬼事件仅支持单层有效鬼索引');
            return (before, action, after) => {
                const layers = before.layerStates || before.layers, nextLayers = after.layerStates || after.layers;
                const ghost = layers[0].ghosts[event.index], actual = nextLayers[0].ghosts[event.index];
                if (layers[0].ghosts.length < 2 || !ghost || !actual || actual.x !== ghost.x || actual.y !== ghost.y) return false;
                let withoutOthers;
                if (before.layerStates) {
                    const copy = before.clone(); copy.layerStates[0].ghosts = [copy.layerStates[0].ghosts[event.index]];
                    withoutOthers = GameLogic.calculateNextState(copy, actionFromName(action), def).layerStates[0].ghosts[0];
                } else {
                    compactSimulator ??= makeSimulator(def);
                    const copy = { ...before, layers: [{ ...layers[0], ghosts: [{ ...ghost }] }] };
                    withoutOthers = compactStep(copy, actionFromName(action), compactSimulator).layers[0].ghosts[0];
                }
                // 同一步只移除其他鬼作局部诊断；实际搜索地图、墙态与后继均保持真实规则。
                return withoutOthers.x !== ghost.x || withoutOthers.y !== ghost.y;
            };
        }
        if (event?.type === 'visit' || event?.type === 'ghost_at') {
            fields(event, ['type', 'layer', 'x', 'y']);
            if (![event.layer, event.x, event.y].every(Number.isInteger) || !def.layers[event.layer]?.activeCells[event.y]?.[event.x]) fail('事件位置不在活动格');
            return (_before, _action, after) => event.type === 'visit'
                ? after.player.layer === event.layer && after.player.x === event.x && after.player.y === event.y
                : (after.layerStates || after.layers)[event.layer].ghosts.some(g => g.x === event.x && g.y === event.y);
        }
        if (event?.type === 'gate') {
            fields(event, ['type', 'layer', 'axis', 'x', 'y', 'state']);
            if (![event.layer, event.x, event.y].every(Number.isInteger) || !['h', 'v'].includes(event.axis) ||
                def.layers[event.layer]?.initialWalls[event.axis]?.[event.y]?.[event.x]?.type !== W.LETTER_DOOR ||
                !['open', 'closed'].includes(event.state)) fail('字母门事件非法');
            return (_before, _action, after) => (after.layerStates || after.layers)[event.layer].wallStates[event.axis][event.y][event.x].currentState === event.state;
        }
        if (event?.type === 'all') {
            fields(event, ['type', 'events']);
            if (!Array.isArray(event.events) || !event.events.length) fail('all 需要非空 events');
            const tests = event.events.map(compile);
            return (...args) => tests.every(test => test(...args));
        }
        fail('未知事件类型');
    };
    const tests = specs.map(spec => {
        fields(spec, ['id', 'sequence']);
        if (typeof spec.id !== 'string' || !spec.id || ids.has(spec.id)) fail('id 为空或重复');
        ids.add(spec.id);
        if (!Array.isArray(spec.sequence) || !spec.sequence.length) fail('sequence 不能为空');
        return spec.sequence.map(compile);
    });
    return {
        specs, initial: () => specs.map(() => 0),
        advance(progress, before, action, after) {
            const next = progress.slice();
            for (let i = 0; i < tests.length; i++) {
                if (tests[i][next[i]](before, action, after)) next[i]++;
                if (next[i] === tests[i].length) return null;
            }
            return next;
        }
    };
}

/** 原引擎逐步检查证书；拒绝物理可通关、但违反反事实条件的路径。 */
export function replayRestricted(env, actions, restrictions = []) {
    const monitor = compileRestrictions(env.mapDefinition, restrictions);
    const result = env.replay(actions);
    let state = env.initialState(), progress = monitor.initial();
    for (const action of actions) {
        const next = env.step(state, action);
        progress = monitor.advance(progress, state, action, next);
        if (progress === null) throw new Error('证书违反反事实条件');
        state = next;
    }
    return result;
}
