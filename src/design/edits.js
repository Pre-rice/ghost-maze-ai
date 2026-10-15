import { createReferenceEnvironment } from '../reference/environment.js';
import { WALL_TYPES as W, validateMapData } from '../reference/engine.js';
import { assertButtonAttachments } from './button-support.js';

/** 取得单层自由地图的编辑层，保留现行层格式或历史平铺形状。 */
export function singleLayerView(source) {
    if (!source || source.editorMode !== 'free' || source.layerCount !== 1 || source.multiLayerMode || (source.layers?.length ?? 0) > 1) {
        throw new TypeError('编辑搜索目前只支持单层 free 地图');
    }
    const layer = source.layers?.length ? source.layers[0] : source;
    const ghostField = layer === source ? 'initialGhosts' : 'ghosts';
    return { layer, ghostField };
}

/** 原始冲突先由权威入口拒绝，不抽取某层后丢掉另一份数据。 */
export function applyEdit(source, edit) {
    singleLayerView(source);
    const checked = validateMapData(source, { requireEnd: false });
    if (!checked.valid) throw new TypeError(`地图无效：${checked.error}`);
    const map = structuredClone(source), { x, y } = edit, { layer, ghostField } = singleLayerView(map);
    // 先从同一权威装配结果开始；旧虚空残留不能在扩展地图时改变编辑语义。
    const canonical = checked.mapData.layers[0];
    for (const field of ['hWalls', 'vWalls', 'activeCells', 'items', 'buttons', 'endPos', 'customStartPos']) {
        layer[field] = structuredClone(canonical[field]);
    }
    layer[ghostField] = structuredClone(canonical.ghosts);
    const cell = () => {
        if (!Number.isInteger(x) || !Number.isInteger(y) || !layer.activeCells[y]?.[x]) throw new TypeError('编辑位置不是活动格');
    };
    if (edit.type === 'wall') {
        if (!['h', 'v'].includes(edit.axis) || !Number.isInteger(x) || !Number.isInteger(y) || !layer[`${edit.axis}Walls`][y]?.[x]) throw new TypeError('墙位置非法');
        layer[`${edit.axis}Walls`][y][x] = structuredClone(edit.wall);
    } else if (edit.type === 'goal') {
        cell(); layer.endPos = { x, y };
    } else if (edit.type === 'ghost') {
        cell();
        if (!Number.isInteger(edit.index) || edit.index < 0 || edit.index >= layer[ghostField].length) throw new TypeError('鬼索引非法');
        layer[ghostField][edit.index] = { ...layer[ghostField][edit.index], x, y };
    } else if (edit.type === 'key') {
        cell();
        const index = layer.items.findIndex(item => item.x === x && item.y === y);
        if (index < 0) layer.items.push({ x, y, type: 'key' });
        else layer.items.splice(index, 1);
    } else if (edit.type === 'button') {
        cell();
        const index = layer.buttons.findIndex(button => button.x === x && button.y === y);
        if (index < 0) layer.buttons.push({ x, y, letter: edit.letter, direction: structuredClone(edit.direction) });
        else layer.buttons.splice(index, 1);
    } else if (edit.type === 'remove_entity') {
        if (!['initialGhosts', 'ghosts', 'items', 'buttons'].includes(edit.field)) throw new TypeError('实体字段非法');
        const field = ['initialGhosts', 'ghosts'].includes(edit.field) ? ghostField : edit.field;
        if (!Number.isInteger(edit.index) || edit.index < 0 || edit.index >= layer[field].length) throw new TypeError('实体索引非法');
        layer[field].splice(edit.index, 1);
    } else if (edit.type === 'cell') {
        if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || x >= map.width || y < 0 || y >= map.height) throw new TypeError('格子越界');
        layer.activeCells[y][x] = !layer.activeCells[y][x];
        const set = (wall, neighbor) => { wall.type = layer.activeCells[y][x] && neighbor ? W.EMPTY : W.SOLID; };
        // 格子切换会重置四边；放在实体下方的删除操作由地图校验拒绝。
        layer.hWalls[y][x] = { type: W.SOLID, keys: 0 }; set(layer.hWalls[y][x], layer.activeCells[y - 1]?.[x]);
        layer.hWalls[y + 1][x] = { type: W.SOLID, keys: 0 }; set(layer.hWalls[y + 1][x], layer.activeCells[y + 1]?.[x]);
        layer.vWalls[y][x] = { type: W.SOLID, keys: 0 }; set(layer.vWalls[y][x], layer.activeCells[y][x - 1]);
        layer.vWalls[y][x + 1] = { type: W.SOLID, keys: 0 }; set(layer.vWalls[y][x + 1], layer.activeCells[y][x + 1]);
    } else throw new TypeError('未知编辑类型');
    // 已经证明相同的历史第零层副本随显式编辑同步；冲突原件在编辑前已拒绝。
    if (map.layers?.length && map.hWalls) {
        for (const field of ['hWalls', 'vWalls', 'activeCells', 'items', 'buttons', 'endPos']) {
            if (Object.hasOwn(map, field)) map[field] = structuredClone(layer[field]);
        }
        if (Object.hasOwn(map, 'initialGhosts')) map.initialGhosts = structuredClone(layer.ghosts);
    }
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
    const { layer, ghostField } = singleLayerView(map), ghosts = layer[ghostField] ?? [];
    const pick = values => values[Math.floor(random() * values.length)];
    const cells = layer.activeCells.flatMap((row, y) => row.flatMap((active, x) => active ? [{ x, y }] : []));
    const edges = cells.flatMap(({ x, y }) => [
        ...(layer.activeCells[y][x + 1] ? [{ axis: 'v', x: x + 1, y }] : []),
        ...(layer.activeCells[y + 1]?.[x] ? [{ axis: 'h', x, y: y + 1 }] : [])
    ]);
    const type = pick(['cell', 'goal', 'key', 'button', ...(edges.length ? ['wall'] : []), ...(ghosts.length ? ['ghost'] : [])]);
    if (type === 'cell') return { type, x: Math.floor(random() * map.width), y: Math.floor(random() * map.height) };
    const pos = pick(cells);
    if (type === 'goal' || type === 'key') return { type, ...pos };
    if (type === 'ghost') return { type, ...pos, index: Math.floor(random() * ghosts.length) };
    const direction = pick([{ dx: 0, dy: -1 }, { dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }]);
    if (type === 'button') return { type, ...pos, letter: pick(['A', 'B']), direction };
    const wall = pick([
        { type: W.EMPTY, keys: 0 }, { type: W.SOLID, keys: 0 }, { type: W.GLASS, keys: 0 }, { type: W.DOOR, keys: 0 },
        { type: W.LOCKED, keys: 1 }, { type: W.ONE_WAY, direction },
        { type: W.LETTER_DOOR, letter: pick(['A', 'B']), initialState: pick(['open', 'closed']) }
    ]);
    return { type, ...pick(edges), wall };
}
