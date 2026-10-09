import { createReferenceEnvironment } from '../reference/environment.js';
import { WALL_TYPES as W } from '../reference/engine.js';
import { assertButtonAttachments } from './button-support.js';

/** 编辑器限定单层 free 原始地图；复制输入后校验物理数据与按钮依附。 */
export function applyEdit(source, edit) {
    if (source.editorMode !== 'free' || source.layerCount !== 1 || source.layers?.length) throw new TypeError('编辑器目前只支持顶层单层 free 地图');
    const map = structuredClone(source), { x, y } = edit;
    const cell = () => {
        if (!Number.isInteger(x) || !Number.isInteger(y) || !map.activeCells[y]?.[x]) throw new TypeError('编辑位置不是活动格');
    };
    if (edit.type === 'wall') {
        if (!['h', 'v'].includes(edit.axis) || !Number.isInteger(x) || !Number.isInteger(y) || !map[`${edit.axis}Walls`][y]?.[x]) throw new TypeError('墙位置非法');
        map[`${edit.axis}Walls`][y][x] = structuredClone(edit.wall);
    } else if (edit.type === 'goal') {
        cell(); map.endPos = { x, y };
    } else if (edit.type === 'ghost') {
        cell();
        if (!Number.isInteger(edit.index) || edit.index < 0 || edit.index >= map.initialGhosts.length) throw new TypeError('鬼索引非法');
        map.initialGhosts[edit.index] = { ...map.initialGhosts[edit.index], x, y };
    } else if (edit.type === 'key') {
        cell();
        const index = map.items.findIndex(item => item.x === x && item.y === y);
        if (index < 0) map.items.push({ x, y, type: 'key' });
        else map.items.splice(index, 1);
    } else if (edit.type === 'button') {
        cell();
        const index = map.buttons.findIndex(button => button.x === x && button.y === y);
        if (index < 0) map.buttons.push({ x, y, letter: edit.letter, direction: structuredClone(edit.direction) });
        else map.buttons.splice(index, 1);
    } else if (edit.type === 'cell') {
        if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || x >= map.width || y < 0 || y >= map.height) throw new TypeError('格子越界');
        map.activeCells[y][x] = !map.activeCells[y][x];
        const set = (wall, neighbor) => { wall.type = map.activeCells[y][x] && neighbor ? W.EMPTY : W.SOLID; };
        // 格子切换会重置四边；放在实体下方的删除操作由地图校验拒绝。
        map.hWalls[y][x] = { type: W.SOLID, keys: 0 }; set(map.hWalls[y][x], map.activeCells[y - 1]?.[x]);
        map.hWalls[y + 1][x] = { type: W.SOLID, keys: 0 }; set(map.hWalls[y + 1][x], map.activeCells[y + 1]?.[x]);
        map.vWalls[y][x] = { type: W.SOLID, keys: 0 }; set(map.vWalls[y][x], map.activeCells[y][x - 1]);
        map.vWalls[y][x + 1] = { type: W.SOLID, keys: 0 }; set(map.vWalls[y][x + 1], map.activeCells[y][x + 1]);
    } else throw new TypeError('未知编辑类型');
    createReferenceEnvironment(map);
    assertButtonAttachments(map);
    return map;
}

export function seededRandom(seed) {
    if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new TypeError('seed 必须为 uint32');
    let state = seed;
    return () => {
        state = (state + 0x6D2B79F5) | 0;
        let value = Math.imul(state ^ state >>> 15, 1 | state);
        value ^= value + Math.imul(value ^ value >>> 7, 61 | value);
        return ((value ^ value >>> 14) >>> 0) / 4294967296;
    };
}

/** 无谜题模板的底层提案器：可跨越暂时无解的中间态；不声称均匀采样地图空间。 */
export function proposeEdit(map, random) {
    const pick = values => values[Math.floor(random() * values.length)];
    const cells = map.activeCells.flatMap((row, y) => row.flatMap((active, x) => active ? [{ x, y }] : []));
    const edges = cells.flatMap(({ x, y }) => [
        ...(map.activeCells[y][x + 1] ? [{ axis: 'v', x: x + 1, y }] : []),
        ...(map.activeCells[y + 1]?.[x] ? [{ axis: 'h', x, y: y + 1 }] : [])
    ]);
    const type = pick(['cell', 'goal', 'key', 'button', ...(edges.length ? ['wall'] : []), ...(map.initialGhosts.length ? ['ghost'] : [])]);
    if (type === 'cell') return { type, x: Math.floor(random() * map.width), y: Math.floor(random() * map.height) };
    const pos = pick(cells);
    if (type === 'goal' || type === 'key') return { type, ...pos };
    if (type === 'ghost') return { type, ...pos, index: Math.floor(random() * map.initialGhosts.length) };
    const direction = pick([{ dx: 0, dy: -1 }, { dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }]);
    if (type === 'button') return { type, ...pos, letter: pick(['A', 'B']), direction };
    const wall = pick([
        { type: W.EMPTY, keys: 0 }, { type: W.SOLID, keys: 0 }, { type: W.GLASS, keys: 0 }, { type: W.DOOR, keys: 0 },
        { type: W.LOCKED, keys: 1 }, { type: W.ONE_WAY, direction },
        { type: W.LETTER_DOOR, letter: pick(['A', 'B']), initialState: pick(['open', 'closed']) }
    ]);
    return { type, ...pick(edges), wall };
}
