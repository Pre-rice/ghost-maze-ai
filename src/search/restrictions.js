import { actionFromName } from '../reference/environment.js';
import { WALL_TYPES as W } from '../reference/engine.js';

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
    const compile = event => {
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
