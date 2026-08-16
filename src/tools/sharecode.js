import { WALL_TYPES } from '../engine/constants.js';
import { deflateRaw, inflateRaw } from 'pako';

/**
 * sharecode - 分享码编解码（Node 版，原游戏 dataSerializer.js 的移植）
 *
 * 与游戏侧字节格式完全一致（无版本号，向后兼容靠剩余字节启发式）：
 * 宽/高 → modeByte → HP/体力 → endPos → 起点+起始层 → (free 模式 activeCells 位图)
 * → 实体（鬼/钥匙/按钮）→ 墙体类型 nibble 压缩 → 参数队列 → (多层扩展)。
 * 压缩：pako deflateRaw + base64url（Node Buffer 原生编码，与游戏端 '-_' 替换等价）。
 */

// ---- 通用字节流工具 ----
function encodeBytes(bytes) {
    const compressed = deflateRaw(new Uint8Array(bytes));
    return Buffer.from(compressed).toString('base64url');
}

function decodeBytes(code) {
    const base64 = code.replace(/-/g, '+').replace(/_/g, '/');
    const buf = Buffer.from(base64, 'base64');
    return inflateRaw(new Uint8Array(buf));
}

function pushEntities(buffer, list, serializeFn) {
    buffer.push(list.length);
    list.forEach(serializeFn);
}

function dirCode(d) {
    if (d.dy === -1) return 0;
    if (d.dy === 1) return 1;
    if (d.dx === -1) return 2;
    return 3;
}

function dirFromCode(c) {
    if (c === 0) return { dx: 0, dy: -1 };
    if (c === 1) return { dx: 0, dy: 1 };
    if (c === 2) return { dx: -1, dy: 0 };
    return { dx: 1, dy: 0 };
}

/**
 * mapData JSON → 分享码（可直接粘贴进游戏加载）
 * @param {object} mapData - 与游戏 startGame(mapData) 同构的地图数据
 * @returns {{success: boolean, code?: string, error?: string}}
 */
export function generateShareCode(mapData) {
    try {
        if (!Number.isInteger(mapData.width) || !Number.isInteger(mapData.height)) {
            return { success: false, error: '地图尺寸无效。' };
        }
        const { width, height } = mapData;
        const buffer = [];

        // 头部
        buffer.push(width, height);
        let modeByte = (mapData.gameMode === 'exploration' ? 0 : 1);
        if (mapData.editorMode === 'free') modeByte |= 2;
        if (mapData.multiLayerMode) modeByte |= 4;
        if (mapData.multiLayerMode && mapData.layers && mapData.layers.length > 0) modeByte |= 8;
        buffer.push(modeByte);

        buffer.push(mapData.initialHealth ?? 5);
        buffer.push(((mapData.initialStamina ?? 100) >> 8) & 0xFF, (mapData.initialStamina ?? 100) & 0xFF);

        if (mapData.endPos) buffer.push(mapData.endPos.x, mapData.endPos.y);
        else buffer.push(0xFF, 0xFF);

        const mapStart = mapData.customStartPos || mapData.startPos || { x: 1, y: height - 2 };
        buffer.push(typeof mapStart?.x === 'number' ? mapStart.x : 0xFF);
        buffer.push(typeof mapStart?.y === 'number' ? mapStart.y : 0xFF);
        buffer.push((typeof mapData.playerStartLayer === 'number' ? mapData.playerStartLayer : 0) & 0xFF);

        if (mapData.editorMode === 'free') {
            if (mapData.customStartPos) buffer.push(mapData.customStartPos.x, mapData.customStartPos.y);
            else buffer.push(0xFF, 0xFF);
            let bits = 0, bitCount = 0;
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    if (mapData.activeCells?.[y]?.[x]) bits |= (1 << bitCount);
                    bitCount++;
                    if (bitCount === 8) { buffer.push(bits); bits = 0; bitCount = 0; }
                }
            }
            if (bitCount > 0) buffer.push(bits);
        }

        pushEntities(buffer, mapData.initialGhosts || [], g => buffer.push(g.x, g.y));
        pushEntities(buffer, mapData.items || [], i => buffer.push(i.x, i.y));
        pushEntities(buffer, mapData.buttons || [], b => {
            buffer.push(b.x, b.y, dirCode(b.direction), b.letter.charCodeAt(0));
        });

        const typeNibbles = [];
        const paramsQueue = [];
        const processWall = (wall) => {
            if (!wall) wall = { type: WALL_TYPES.EMPTY };
            const wt = (typeof wall.type === 'number') ? wall.type : WALL_TYPES.EMPTY;
            typeNibbles.push(wt);
            if (wt === WALL_TYPES.LOCKED) paramsQueue.push(wall.keys || 0);
            else if (wt === WALL_TYPES.ONE_WAY) paramsQueue.push(dirCode(wall.direction || { dx: 1, dy: 0 }));
            else if (wt === WALL_TYPES.LETTER_DOOR) {
                paramsQueue.push(wall.letter ? wall.letter.charCodeAt(0) : 0);
                paramsQueue.push(wall.initialState === 'open' ? 1 : 0);
            }
        };
        for (let y = 0; y <= height; y++) for (let x = 0; x < width; x++) processWall(mapData.hWalls[y][x]);
        for (let y = 0; y < height; y++) for (let x = 0; x <= width; x++) processWall(mapData.vWalls[y][x]);
        for (let i = 0; i < typeNibbles.length; i += 2) {
            const t1 = typeNibbles[i];
            const t2 = (i + 1 < typeNibbles.length) ? typeNibbles[i + 1] : 0;
            buffer.push((t1 << 4) | t2);
        }
        paramsQueue.forEach(p => buffer.push(p));

        // 多层扩展（阶段一不产生，保留格式兼容）
        if (mapData.multiLayerMode && mapData.layers && mapData.layers.length > 0) {
            buffer.push(mapData.layerCount);
            const stairs = mapData.stairs || [];
            buffer.push(stairs.length);
            stairs.forEach(s => buffer.push(s.x, s.y, s.layer, s.direction === 'up' ? 0 : 1));
            for (let layerIdx = 1; layerIdx < mapData.layerCount; layerIdx++) {
                const layer = mapData.layers[layerIdx] || {};
                let bits = 0, bitCount = 0;
                for (let y = 0; y < height; y++) {
                    for (let x = 0; x < width; x++) {
                        if (layer.activeCells?.[y]?.[x]) bits |= (1 << bitCount);
                        bitCount++;
                        if (bitCount === 8) { buffer.push(bits); bits = 0; bitCount = 0; }
                    }
                }
                if (bitCount > 0) buffer.push(bits);
                if (layer.customStartPos) buffer.push(layer.customStartPos.x, layer.customStartPos.y);
                else buffer.push(0xFF, 0xFF);
                if (layer.endPos) buffer.push(layer.endPos.x, layer.endPos.y);
                else buffer.push(0xFF, 0xFF);
                pushEntities(buffer, layer.buttons || [], b => buffer.push(b.x, b.y, dirCode(b.direction), b.letter.charCodeAt(0)));
                pushEntities(buffer, layer.ghosts || [], g => buffer.push(g.x, g.y));
                pushEntities(buffer, layer.items || [], i => buffer.push(i.x, i.y));
                const layerNibbles = [];
                const layerParams = [];
                const pl = (wall) => {
                    if (!wall) wall = { type: WALL_TYPES.EMPTY };
                    const wt = (typeof wall.type === 'number') ? wall.type : WALL_TYPES.EMPTY;
                    layerNibbles.push(wt);
                    if (wt === WALL_TYPES.LOCKED) layerParams.push(wall.keys || 0);
                    else if (wt === WALL_TYPES.ONE_WAY) layerParams.push(dirCode(wall.direction || { dx: 1, dy: 0 }));
                    else if (wt === WALL_TYPES.LETTER_DOOR) {
                        layerParams.push(wall.letter ? wall.letter.charCodeAt(0) : 0);
                        layerParams.push(wall.initialState === 'open' ? 1 : 0);
                    }
                };
                for (let y = 0; y <= height; y++) for (let x = 0; x < width; x++) pl(layer.hWalls?.[y]?.[x]);
                for (let y = 0; y < height; y++) for (let x = 0; x <= width; x++) pl(layer.vWalls?.[y]?.[x]);
                for (let i = 0; i < layerNibbles.length; i += 2) {
                    const t1 = layerNibbles[i];
                    const t2 = (i + 1 < layerNibbles.length) ? layerNibbles[i + 1] : 0;
                    buffer.push((t1 << 4) | t2);
                }
                layerParams.forEach(p => buffer.push(p));
            }
        }

        return { success: true, code: encodeBytes(buffer) };
    } catch (e) {
        console.error('generateShareCode 失败:', e);
        return { success: false, error: `生成分享码时发生错误：${e.message}` };
    }
}

/**
 * 分享码 → mapData（验证/试玩前置检查用，确认编解码闭环）
 */
export function loadFromShareCode(code) {
    try {
        const inflated = decodeBytes(code);
        let ptr = 0;
        const read = () => inflated[ptr++];

        const width = read();
        const height = read();
        const modeByte = read();
        const gameMode = (modeByte & 1) === 0 ? 'exploration' : 'death-loop';
        const editorMode = (modeByte & 2) === 0 ? 'regular' : 'free';
        const multiLayerMode = (modeByte & 4) !== 0;
        const layerExt = (modeByte & 8) !== 0;

        const initialHealth = read();
        const initialStamina = (read() << 8) | read();

        const ex = read(), ey = read();
        const endPos = ex !== 0xFF ? { x: ex, y: ey } : null;

        let mapStartPos = null;
        let playerStartLayer = 0;
        if (ptr + 2 < inflated.length) {
            const msx = read(), msy = read();
            if (msx !== 0xFF) mapStartPos = { x: msx, y: msy };
            playerStartLayer = read();
        }

        let customStartPos = null;
        let activeCells = editorMode === 'free' ? [] : Array.from({ length: height }, () => Array(width).fill(true));
        if (editorMode === 'free') {
            const csx = read(), csy = read();
            if (csx !== 0xFF) customStartPos = { x: csx, y: csy };
            let bits = 0, bc = 8;
            for (let y = 0; y < height; y++) {
                const row = [];
                for (let x = 0; x < width; x++) {
                    if (bc === 8) { bits = read(); bc = 0; }
                    row.push((bits & (1 << bc)) !== 0);
                    bc++;
                }
                activeCells.push(row);
            }
        }

        const readEntities = (createFn) => {
            const count = read();
            const list = [];
            for (let i = 0; i < count; i++) list.push(createFn());
            return list;
        };
        const initialGhosts = readEntities(() => ({ x: read(), y: read() }));
        const items = readEntities(() => ({ x: read(), y: read(), type: 'key' }));
        const buttons = readEntities(() => {
            const x = read(), y = read(), d = read(), letter = String.fromCharCode(read());
            return { x, y, direction: dirFromCode(d), letter };
        });

        const totalWalls = (height + 1) * width + height * (width + 1);
        const packedTypes = inflated.subarray(ptr, ptr + Math.ceil(totalWalls / 2));
        ptr += Math.ceil(totalWalls / 2);
        let wallCounter = 0;
        const readNextWall = () => {
            const byte = packedTypes[Math.floor(wallCounter / 2)];
            const type = (wallCounter % 2 === 0) ? (byte >> 4) & 0x0F : byte & 0x0F;
            wallCounter++;
            const wall = { type, keys: 0 };
            if (type === 3) wall.keys = read();
            else if (type === 4) wall.direction = dirFromCode(read());
            else if (type === 6) {
                wall.letter = String.fromCharCode(read());
                wall.initialState = read() === 1 ? 'open' : 'closed';
                wall.currentState = wall.initialState;
            }
            return wall;
        };
        const hWalls = Array.from({ length: height + 1 }, () => Array.from({ length: width }, readNextWall));
        const vWalls = Array.from({ length: height }, () => Array.from({ length: width + 1 }, readNextWall));

        let layerCount = 1, stairs = [], layers = [];
        if (multiLayerMode && ptr < inflated.length) {
            layerCount = read();
            stairs = readEntities(() => ({ x: read(), y: read(), layer: read(), direction: read() === 0 ? 'up' : 'down' }));
            layers.push({ hWalls, vWalls, activeCells, ghosts: initialGhosts, items, buttons, stairs: stairs.filter(s => s.layer === 0), endPos, customStartPos });
            for (let li = 1; li < layerCount; li++) {
                const la = [];
                let bits = 0, bc = 8;
                for (let y = 0; y < height; y++) {
                    const row = [];
                    for (let x = 0; x < width; x++) {
                        if (bc === 8) { bits = read(); bc = 0; }
                        row.push((bits & (1 << bc)) !== 0);
                        bc++;
                    }
                    la.push(row);
                }
                const lcsx = read(), lcsy = read();
                let layerEndPos = null, layerButtons = [];
                if (layerExt) {
                    const lex = read(), ley = read();
                    if (lex !== 0xFF) layerEndPos = { x: lex, y: ley };
                    layerButtons = readEntities(() => {
                        const x = read(), y = read(), d = read(), letter = String.fromCharCode(read());
                        return { x, y, direction: dirFromCode(d), letter };
                    });
                }
                const layerGhosts = readEntities(() => ({ x: read(), y: read() }));
                const layerItems = readEntities(() => ({ x: read(), y: read(), type: 'key' }));
                const lp = inflated.subarray(ptr, ptr + Math.ceil(totalWalls / 2));
                ptr += Math.ceil(totalWalls / 2);
                let lwc = 0;
                const readLayerWall = () => {
                    const byte = lp[Math.floor(lwc / 2)];
                    const type = (lwc % 2 === 0) ? (byte >> 4) & 0x0F : byte & 0x0F;
                    lwc++;
                    const wall = { type, keys: 0 };
                    if (type === 3) wall.keys = read();
                    else if (type === 4) wall.direction = dirFromCode(read());
                    else if (type === 6) {
                        wall.letter = String.fromCharCode(read());
                        wall.initialState = read() === 1 ? 'open' : 'closed';
                        wall.currentState = wall.initialState;
                    }
                    return wall;
                };
                const lhWalls = Array.from({ length: height + 1 }, () => Array.from({ length: width }, readLayerWall));
                const lvWalls = Array.from({ length: height }, () => Array.from({ length: width + 1 }, readLayerWall));
                layers.push({ hWalls: lhWalls, vWalls: lvWalls, activeCells: la, ghosts: layerGhosts, items: layerItems, buttons: layerButtons, stairs: stairs.filter(s => s.layer === li), endPos: layerEndPos, customStartPos: lcsx !== 0xFF ? { x: lcsx, y: lcsy } : null });
            }
        }

        const mapData = { width, height, hWalls, vWalls, endPos, initialGhosts, items, buttons, editorMode, customStartPos, activeCells, multiLayerMode, layerCount, layers, stairs, mapStartPos, playerStartLayer };
        return { success: true, data: { mapData, gameMode, initialHealth, initialStamina } };
    } catch (e) {
        console.error('loadFromShareCode 失败:', e);
        return { success: false, error: `分享码无效或已损坏：${e.message}` };
    }
}
