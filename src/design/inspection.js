import { GameLogic, WALL_TYPES as W, actionFromName } from '../reference/engine.js';
import { createReferenceEnvironment } from '../reference/environment.js';
import { describeStep } from '../review/step-description.js';
import { traceState } from '../review/trace-core.js';

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const position = p => [p.layer, p.x, p.y];
const arrow = d => d?.dx === 1 ? '>' : d?.dx === -1 ? '<' : d?.dy === 1 ? 'v' : '^';
const wallName = w => w.type === W.EMPTY ? '空边' : w.type === W.SOLID ? '墙' :
    w.type === W.DOOR ? '普通门' : w.type === W.LOCKED ? '数字门' :
    w.type === W.ONE_WAY ? '单向门' : w.type === W.GLASS ? '玻璃' : '字母门';
const wallData = w => ({ type: w.type, keys: w.type === W.LOCKED ? w.keys ?? 0 : 0,
    letter: w.type === W.LETTER_DOOR ? w.letter : null,
    state: w.type === W.LETTER_DOOR ? w.currentState : null,
    direction: w.type === W.ONE_WAY ? { ...w.direction } : null });

function wallChanges(before, after) {
    return before.layerStates.flatMap((layer, li) => ['h', 'v'].flatMap(axis =>
        layer.wallStates[axis].flatMap((row, y) => row.flatMap((w, x) => {
            const a = wallData(w), b = wallData(after.layerStates[li].wallStates[axis][y][x]);
            return same(a, b) ? [] : [{ layer: li, axis, x, y, before: a, after: b }];
        }))));
}

/** 文字图来自规范化层与实际局面；虚空边按本体的不可通行边界显示。 */
export function inspectBoards(definition, state) {
    return definition.layers.map((layer, li) => {
        const cells = layer.activeCells.flatMap((row, y) => row.flatMap((v, x) => v ? [[x, y]] : []));
        const ghosts = state.layerStates[li].ghosts;
        const entities = {
            player: state.player.layer === li ? position(state.player) : null,
            goal: layer.initialEntities.endPos,
            ghosts: ghosts.map(g => [g.x, g.y]),
            items: state.layerStates[li].items.map(i => [i.x, i.y, i.type]),
            buttons: layer.initialEntities.buttons.map(b => ({ x: b.x, y: b.y,
                letter: b.letter, direction: { ...b.direction } })),
            stairs: definition.stairs.filter(s => s.layer === li).map(s => ({ ...s }))
        };
        const walls = ['h', 'v'].flatMap(axis => state.layerStates[li].wallStates[axis].flatMap(
            (row, y) => row.flatMap((w, x) => w.type > W.SOLID ?
                [{ axis, x, y, name: wallName(w), ...wallData(w) }] : [])));
        if (!cells.length) return { layer: li, bounds: null, lines: ['（空层）'], entities, walls };
        const xs = cells.map(p => p[0]), ys = cells.map(p => p[1]);
        const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
        const at = (x, y) => layer.activeCells[y]?.[x] === true;
        const label = (x, y) => {
            if (!at(x, y)) return '';
            const tags = [];
            if (state.player.layer === li && state.player.x === x && state.player.y === y) tags.push('P');
            if (entities.goal?.x === x && entities.goal.y === y) tags.push('E');
            const count = ghosts.filter(g => g.x === x && g.y === y).length;
            if (count) tags.push(count > 1 ? 'G' + count : 'G');
            if (entities.items.some(i => i[0] === x && i[1] === y)) tags.push('K');
            for (const b of entities.buttons) if (b.x === x && b.y === y) tags.push('b' + b.letter);
            if (entities.stairs.some(s => s.x === x && s.y === y)) tags.push('S');
            return tags.join('') || '.';
        };
        const width = Math.max(3, ...cells.map(([x, y]) => label(x, y).length + 2));
        const marker = (axis, x, y) => {
            const adjacent = axis === 'h' ? at(x, y - 1) || at(x, y) : at(x - 1, y) || at(x, y);
            if (!adjacent) return ' ';
            const inside = axis === 'h' ? at(x, y - 1) && at(x, y) : at(x - 1, y) && at(x, y);
            if (!inside) return axis === 'h' ? '-' : '|';
            const w = state.layerStates[li].wallStates[axis][y][x];
            if (w.type === W.EMPTY) return ' ';
            if (w.type === W.SOLID) return axis === 'h' ? '-' : '|';
            if (w.type === W.LETTER_DOOR) return w.currentState === 'open' ? w.letter.toLowerCase() : w.letter;
            if (w.type === W.LOCKED) return w.keys < 10 ? String(w.keys) : 'n';
            if (w.type === W.ONE_WAY) return arrow(w.direction);
            return w.type === W.DOOR ? 'd' : ':';
        };
        const lines = ['     ' + Array.from({ length: maxX - minX + 1 },
            (_, i) => String(minX + i).padStart(width) + ' ').join('')];
        for (let y = minY; y <= maxY + 1; y++) {
            lines.push('    +' + Array.from({ length: maxX - minX + 1 },
                (_, i) => marker('h', minX + i, y).repeat(width)).join('+') + '+');
            if (y <= maxY) {
                lines.push(String(y).padStart(3) + ' ' + Array.from({ length: maxX - minX + 1 }, (_, i) => {
                    const x = minX + i, text = label(x, y), left = Math.floor((width - text.length) / 2);
                    return marker('v', x, y) + ' '.repeat(left) + text + ' '.repeat(width - text.length - left);
                }).join('') + marker('v', maxX + 1, y));
            }
        }
        return { layer: li, bounds: { minX, maxX, minY, maxY }, lines, entities, walls };
    });
}

/** 只重放明确给定的动作，不求解、不复活；第一处无效／死亡／通关即停止。 */
export function inspectPuzzle(input, { actions } = {}) {
    const map = input?.map ?? input;
    // 仅保留旧工具已经读取的确切录制字段，不猜测 prefix、suffix 或任意 actions 的含义。
    const recorded = actions === undefined ? input?.solution?.solution?.actions ?? [] : actions;
    if (!Array.isArray(recorded)) throw new TypeError('动作文件必须是动作名称数组');
    const env = createReferenceEnvironment(map), initial = env.initialState();
    let state = initial, status = state.isDead ? 'dead' : state.isWon ? 'won' : 'complete', performed = 0;
    const frames = [];
    for (let i = 0; i < recorded.length && !state.isDead && !state.isWon; i++) {
        const token = recorded[i];
        let action;
        try { action = actionFromName(token); }
        catch (error) {
            frames.push({ step: i + 1, action: token, valid: false, error: error.message });
            status = 'invalid_action'; break;
        }
        const conflicts = [], next = GameLogic.calculateNextState(state, action, env.mapDefinition,
            { trails: false, visibility: false, ghostDiagnostics: conflicts });
        if (next === state) {
            frames.push({ step: i + 1, action: token, valid: false, error: '动作未改变局面' });
            status = 'invalid_action'; break;
        }
        const description = describeStep(state, next, token, env.mapDefinition, W);
        frames.push({ step: i + 1, action: token, valid: true, ...description,
            keysBefore: state.player.keys, keysAfter: next.player.keys,
            wallChanges: wallChanges(state, next), conflicts });
        performed++; state = next;
        if (state.isDead) { status = 'dead'; break; }
        if (state.isWon) { status = 'won'; break; }
    }
    return {
        mapId: env.mapId, ruleset: env.ruleset,
        scope: '共同引擎物理走法核对；不求解、不复活、不评价趣味。层号和坐标从0起。',
        initial: traceState(initial), initialBoards: inspectBoards(env.mapDefinition, initial),
        frames, final: traceState(state), finalBoards: inspectBoards(env.mapDefinition, state),
        execution: { status, requestedActions: recorded.length, attemptedActions: frames.length,
            performedActions: performed, remainingActions: recorded.slice(frames.length) }
    };
}

export function formatInspection(report) {
    const lines = ['图例：P玩家 G鬼 K钥匙 E终点 b字母按钮 S楼梯；.空方格，空白为虚空；d普通门 n多位数字门；字母大写关／小写开，箭头为单向门。'];
    const boards = (title, values) => {
        lines.push(title);
        for (const layer of values) {
            lines.push('层 ' + layer.layer, ...layer.lines);
            lines.push(JSON.stringify({ entities: layer.entities, specialWalls: layer.walls }));
        }
    };
    boards('初态', report.initialBoards);
    for (const frame of report.frames) {
        if (!frame.valid) { lines.push(String(frame.step) + ' ' + String(frame.action) + ' 无效：' + frame.error); continue; }
        lines.push(String(frame.step) + ' ' + frame.action + ' ' + frame.label +
            ' P' + JSON.stringify(frame.playerBefore) + '→' + JSON.stringify(frame.playerAfter) +
            ' G' + JSON.stringify(frame.ghostsBefore) + '→' + JSON.stringify(frame.ghostsAfter) +
            ' 钥匙' + frame.keysBefore + '→' + frame.keysAfter +
            (frame.wallChanges.length ? ' 门变更' + JSON.stringify(frame.wallChanges) : '') +
            (frame.conflicts.length ? ' 争位' + JSON.stringify(frame.conflicts) : '') +
            (frame.isDead ? ' 死亡' : frame.isWon ? ' 通关' : ''));
    }
    if (report.frames.length) boards('停止时局面（死亡不复活）', report.finalBoards);
    lines.push('执行结果 ' + JSON.stringify(report.execution));
    return lines.join('\n');
}
