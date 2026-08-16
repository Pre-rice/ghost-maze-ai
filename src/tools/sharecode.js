import { WALL_TYPES } from '../engine/constants.js';
import { deflateRaw, inflateRaw } from 'pako';

/**
 * sharecode - 分享码编解码（Node 版，原游戏 src/core/dataSerializer.js v3 的移植）
 *
 * 与游戏侧字节格式完全一致（PROTOCOL_VERSION = 0x03，见 ghost-maze docs/protocol-v2.md）：
 * 版本头 → 宽/高 → modeByte → HP/体力 → endPos → (free 模式 customStartPos + activeCells 位图)
 * → 实体（鬼/钥匙/按钮）→ 墙体变长前缀码位流 + 参数独立队列（1 字节长度前缀）→ (多层扩展)。
 * 压缩：pako deflateRaw + base64url（Node Buffer 原生 base64url，与游戏端 btoa 替换等价）。
 *
 * 与旧 v1 移植的关键差异：
 *  - 带版本头 0x03，解码走确定性边界（越界/版本不符/流未耗尽 → 干净失败路径，无启发式）；
 *  - 墙体类型走变长前缀码（EMPTY 1bit / SOLID 2bit / DOOR 3bit / LOCKED 4bit / ONE_WAY 5bit /
 *    GLASS 6bit / LETTER_DOOR 7bit，类型 t = t 个 1 + 1 个 0），参数（LOCKED keys / ONE_WAY 方向 /
 *    LETTER_DOOR letter+state）入独立字节队列，紧跟位流 + 1 字节长度前缀；
 *  - 删除 v1 的 mapStartPos / playerStartLayer 残留字段（出生点由 mapDefinition._findPlayerStart 推导）；
 *  - 自由模式起点只编码 customStartPos（regular 模式不编码 startPos）。
 */

const PROTOCOL_VERSION = 0x03;

// --- 位流写入器（MSB-first） ---
class BitWriter {
    constructor() {
        this.buffer = [];
        this.acc = 0;
        this.bitCount = 0;
    }

    write(value, bits) {
        for (let i = bits - 1; i >= 0; i--) {
            this.acc = (this.acc << 1) | ((value >> i) & 1);
            this.bitCount++;
            if (this.bitCount === 8) {
                this.buffer.push(this.acc);
                this.acc = 0;
                this.bitCount = 0;
            }
        }
    }

    /** 位流对齐到字节边界（当前字节剩余低位补 0）——墙体全部扫描结束时调用 */
    flush() {
        if (this.bitCount > 0) {
            this.acc <<= (8 - this.bitCount);
            this.buffer.push(this.acc);
            this.acc = 0;
            this.bitCount = 0;
        }
    }
}

// --- 位流读取器（MSB-first，越界抛 RangeError → 上层统一失败路径） ---
class BitReader {
    constructor(bytes, startPtr) {
        this.bytes = bytes;
        this.bytePos = startPtr;
        this.bitPos = 0;
    }

    read(bits) {
        let value = 0;
        for (let i = 0; i < bits; i++) {
            if (this.bytePos >= this.bytes.length) throw new RangeError('分享码数据不足');
            value = (value << 1) | ((this.bytes[this.bytePos] >> (7 - this.bitPos)) & 1);
            this.bitPos++;
            if (this.bitPos === 8) {
                this.bitPos = 0;
                this.bytePos++;
            }
        }
        return value;
    }

    /** 丢弃当前字节剩余位，对齐到下一字节（与写端 flush 对称，墙体扫描结束时调用） */
    align() {
        if (this.bitPos > 0) {
            this.bytePos++;
            this.bitPos = 0;
        }
    }
}

// --- 方向编解码（上=0/下=1/左=2/右=3） ---
const dirToCode = (direction) => {
    if (!direction) return 3;
    if (direction.dy === -1) return 0;
    if (direction.dy === 1) return 1;
    if (direction.dx === -1) return 2;
    return 3;
};
const codeToDir = (code) => {
    if (code === 0) return { dx: 0, dy: -1 };
    if (code === 1) return { dx: 0, dy: 1 };
    if (code === 2) return { dx: -1, dy: 0 };
    return { dx: 1, dy: 0 };
};

// --- activeCells 位图（row-major 连续位，末字节补 0） ---
const pushBitArray = (buffer, activeCells, width, height) => {
    let bits = 0, bitCount = 0;
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const active = activeCells && activeCells[y] ? activeCells[y][x] : true;
            if (active) bits |= (1 << bitCount);
            bitCount++;
            if (bitCount === 8) { buffer.push(bits); bits = 0; bitCount = 0; }
        }
    }
    if (bitCount > 0) buffer.push(bits);
};
const readBitArray = (read, width, height) => {
    const rows = [];
    let bits = 0, bc = 8;
    for (let y = 0; y < height; y++) {
        const row = [];
        for (let x = 0; x < width; x++) {
            if (bc === 8) { bits = read(); bc = 0; }
            row.push((bits & (1 << bc)) !== 0);
            bc++;
        }
        rows.push(row);
    }
    return rows;
};

// --- 墙体位流：变长前缀码（类型 t = t 个 1 + 1 个 0，t=0 即 EMPTY 直接 0）；
//     参数（LOCKED/ONE_WAY/LETTER_DOOR）入独立字节队列，随后 + 1 字节长度前缀 ---
const writeWallType = (w, type) => {
    for (let i = 0; i < type; i++) w.write(1, 1);
    w.write(0, 1);
};

const writeWall = (wall, w, params) => {
    if (!wall) wall = { type: WALL_TYPES.EMPTY };
    const wt = typeof wall.type === 'number' ? wall.type : WALL_TYPES.EMPTY;
    writeWallType(w, wt);
    if (wt === WALL_TYPES.LOCKED) {
        params.push(wall.keys || 0);
    } else if (wt === WALL_TYPES.ONE_WAY) {
        params.push(dirToCode(wall.direction));
    } else if (wt === WALL_TYPES.LETTER_DOOR) {
        params.push(wall.letter ? wall.letter.charCodeAt(0) : 0);
        params.push(wall.initialState === 'open' ? 1 : 0);
    }
};

const readWallType = (r) => {
    let t = 0;
    while (true) {
        if (r.read(1) === 1) {
            if (++t > 6) throw new RangeError('分享码墙类型码非法');
        } else break;
    }
    return t;
};

const readWallWithType = (type, takeParam) => {
    const wall = { type, keys: 0 };
    if (type === WALL_TYPES.LOCKED) {
        wall.keys = takeParam();
    } else if (type === WALL_TYPES.ONE_WAY) {
        wall.direction = codeToDir(takeParam());
    } else if (type === WALL_TYPES.LETTER_DOOR) {
        const letter = takeParam();
        wall.letter = String.fromCharCode(letter);
        wall.initialState = takeParam() === 1 ? 'open' : 'closed';
        wall.currentState = wall.initialState;
    }
    return wall;
};

// ---- 压缩 / 解压（pako + base64url） ----
function encodeBytes(bytes) {
    const compressed = deflateRaw(new Uint8Array(bytes));
    return Buffer.from(compressed).toString('base64url');
}

function decodeBytes(code) {
    const base64 = code.replace(/-/g, '+').replace(/_/g, '/');
    const buf = Buffer.from(base64, 'base64');
    return inflateRaw(new Uint8Array(buf));
}

/**
 * mapData JSON → 分享码（v3，与游戏端字节级一致）
 * @param {object} sourceData - 完整地图数据（hWalls/vWalls/实体/模式字段；gameMode/initialHealth/initialStamina）
 * @returns {{success: boolean, code?: string, error?: string}}
 */
export function generateShareCode(sourceData) {
    try {
        if (!Number.isInteger(sourceData.width) || !Number.isInteger(sourceData.height) ||
            sourceData.width <= 0 || sourceData.width > 64 ||
            sourceData.height <= 0 || sourceData.height > 64) {
            return { success: false, error: '地图尺寸无效。' };
        }

        const { width: w, height: h } = sourceData;
        const buffer = [];

        // 头部：版本号 + 宽高 + 模式
        buffer.push(PROTOCOL_VERSION, w, h);
        let modeByte = (sourceData.gameMode === 'exploration' ? 0 : 1);
        if (sourceData.editorMode === 'free') modeByte |= 2;
        if (sourceData.multiLayerMode) modeByte |= 4;
        buffer.push(modeByte);

        buffer.push(sourceData.initialHealth || 0);
        buffer.push((sourceData.initialStamina >> 8) & 0xFF, sourceData.initialStamina & 0xFF);

        // 终点
        if (sourceData.endPos) {
            buffer.push(sourceData.endPos.x, sourceData.endPos.y);
        } else {
            buffer.push(0xFF, 0xFF);
        }

        // 自由模式：起点 + activeCells 位图
        if (sourceData.editorMode === 'free') {
            if (sourceData.customStartPos) {
                buffer.push(sourceData.customStartPos.x, sourceData.customStartPos.y);
            } else {
                buffer.push(0xFF, 0xFF);
            }
            pushBitArray(buffer, sourceData.activeCells, w, h);
        }

        // 实体（第 0 层）
        const pushEntities = (list, serializeFn) => {
            buffer.push((list || []).length);
            (list || []).forEach(serializeFn);
        };
        pushEntities(sourceData.initialGhosts, g => buffer.push(g.x, g.y));
        pushEntities(sourceData.items, i => buffer.push(i.x, i.y));
        pushEntities(sourceData.buttons, b => {
            buffer.push(b.x, b.y);
            buffer.push(dirToCode(b.direction));
            buffer.push(b.letter.charCodeAt(0));
        });

        // 墙体位流（第 0 层）：变长前缀码连续打包，全部墙体结束后 flush 一次；参数独立字节队列
        const writeWallStream = (hWalls, vWalls) => {
            const wallWriter = new BitWriter();
            const wallParams = [];
            for (let y = 0; y <= h; y++) {
                for (let x = 0; x < w; x++) writeWall(hWalls[y][x], wallWriter, wallParams);
            }
            for (let y = 0; y < h; y++) {
                for (let x = 0; x <= w; x++) writeWall(vWalls[y][x], wallWriter, wallParams);
            }
            wallWriter.flush();
            buffer.push(...wallWriter.buffer);
            // 参数队列带 1 字节长度前缀：多层时每层参数之后还有其他数据，
            // 长度前缀让解码端能精确定界本层参数（线性、零启发式）
            buffer.push(wallParams.length, ...wallParams);
        };
        writeWallStream(sourceData.hWalls, sourceData.vWalls);

        // 多层：层数与楼梯 + 各层完整数据
        if (sourceData.multiLayerMode && sourceData.layerCount > 0) {
            buffer.push(sourceData.layerCount);
            const stairs = sourceData.stairs || [];
            pushEntities(stairs, s => {
                buffer.push(s.x, s.y, s.layer);
                buffer.push(s.direction === 'up' ? 0 : 1);
            });

            for (let layerIdx = 1; layerIdx < sourceData.layerCount; layerIdx++) {
                const layer = sourceData.layers[layerIdx] || {};
                pushBitArray(buffer, layer.activeCells, w, h);

                if (layer.customStartPos) buffer.push(layer.customStartPos.x, layer.customStartPos.y);
                else buffer.push(0xFF, 0xFF);

                if (layer.endPos) buffer.push(layer.endPos.x, layer.endPos.y);
                else buffer.push(0xFF, 0xFF);

                pushEntities(layer.buttons, b => {
                    buffer.push(b.x, b.y);
                    buffer.push(dirToCode(b.direction));
                    buffer.push(b.letter.charCodeAt(0));
                });
                pushEntities(layer.ghosts, g => buffer.push(g.x, g.y));
                pushEntities(layer.items, i => buffer.push(i.x, i.y));

                writeWallStream(layer.hWalls, layer.vWalls);
            }
        }

        const compressed = deflateRaw(new Uint8Array(buffer));
        return { success: true, code: Buffer.from(compressed).toString('base64url') };
    } catch (e) {
        console.error('generateShareCode 失败:', e);
        return { success: false, error: '生成分享码时发生错误。' };
    }
}

/**
 * 分享码 → mapData（v3）。解码为纯线性位流：版本号校验 + 逐字段读取，
 * 墙体位流长度可按尺寸公式预计算、参数队列由长度前缀直接定位；
 * 任何越界/队列多余/流未耗尽立即抛 RangeError 由统一 catch 转成干净失败路径。
 * @param {string} code - 分享码字符串
 * @returns {{success: boolean, data?: {mapData: object, gameMode: string, initialHealth: number, initialStamina: number}, error?: string}}
 */
export function loadFromShareCode(code) {
    if (!code) {
        return { success: false, error: '请输入分享码。' };
    }
    try {
        const inflated = decodeBytes(code);
        let ptr = 0;
        const read = () => {
            if (ptr >= inflated.length) throw new RangeError('分享码数据不足');
            return inflated[ptr++];
        };

        // 版本号校验（v1/v2 旧码首字节几乎必然 != 0x03 → 干净报错）
        const version = read();
        if (version !== PROTOCOL_VERSION) {
            return { success: false, error: '分享码版本不支持。' };
        }

        const width = read();
        const height = read();
        if (!Number.isInteger(width) || width <= 0 || width > 64 ||
            !Number.isInteger(height) || height <= 0 || height > 64) {
            return { success: false, error: '分享码无效或已损坏。' };
        }

        const modeByte = read();
        const gameMode = (modeByte & 1) === 0 ? 'exploration' : 'death-loop';
        const editorMode = (modeByte & 2) === 0 ? 'regular' : 'free';
        const multiLayerMode = (modeByte & 4) !== 0;

        const initialHealth = read();
        const initialStamina = (read() << 8) | read();

        const ex = read();
        const ey = read();
        const endPos = (ex !== 0xFF) ? { x: ex, y: ey } : null;

        let customStartPos = null;
        let activeCells;
        if (editorMode === 'free') {
            const csx = read();
            const csy = read();
            if (csx !== 0xFF) customStartPos = { x: csx, y: csy };
            activeCells = readBitArray(read, width, height);
        } else {
            activeCells = Array(height).fill(null).map(() => Array(width).fill(true));
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
            const x = read(), y = read(), dirCode = read(), letter = String.fromCharCode(read());
            return { x, y, direction: codeToDir(dirCode), letter };
        });

        // 墙体位流（第 0 层）：变长前缀码。先逐墙读类型（墙数 = (h+1)*w + h*(w+1) 精确计数），
        // 位流读完后对齐到字节边界 → 读 1 字节参数长度前缀精确定界本层参数，
        // 再按扫描顺序为需要参数的墙依次取参。本层参数之后的字节属于后续层数据。
        const readWallStream = () => {
            const bitReader = new BitReader(inflated, ptr);
            const types = [];
            const totalWalls = (height + 1) * width + height * (width + 1);
            for (let i = 0; i < totalWalls; i++) types.push(readWallType(bitReader));
            bitReader.align();
            ptr = bitReader.bytePos;
            const paramLen = read();
            const paramsArr = [...inflated.subarray(ptr, ptr + paramLen)];
            if (paramsArr.length !== paramLen) throw new RangeError('分享码参数队列长度不足');
            ptr += paramLen;
            let paramIdx = 0;
            const takeParam = () => {
                if (paramIdx >= paramsArr.length) throw new RangeError('分享码参数队列不足');
                return paramsArr[paramIdx++];
            };
            let ti = 0;
            const hWalls = [];
            for (let y = 0; y <= height; y++) {
                const row = [];
                for (let x = 0; x < width; x++) row.push(readWallWithType(types[ti++], takeParam));
                hWalls.push(row);
            }
            const vWalls = [];
            for (let y = 0; y < height; y++) {
                const row = [];
                for (let x = 0; x <= width; x++) row.push(readWallWithType(types[ti++], takeParam));
                vWalls.push(row);
            }
            if (paramIdx !== paramsArr.length) throw new RangeError('分享码参数队列未耗尽');
            return { hWalls, vWalls };
        };
        const { hWalls, vWalls } = readWallStream();

        let layerCount = 1;
        let stairs = [];
        let layers = [];

        if (multiLayerMode) {
            layerCount = read();
            stairs = readEntities(() => ({ x: read(), y: read(), layer: read(), direction: read() === 0 ? 'up' : 'down' }));

            layers.push({ hWalls, vWalls, activeCells, ghosts: initialGhosts, items, buttons, stairs: stairs.filter(s => s.layer === 0), endPos, customStartPos });

            for (let layerIdx = 1; layerIdx < layerCount; layerIdx++) {
                const layerActiveCells = readBitArray(read, width, height);

                const lcsx = read();
                const lcsy = read();
                const layerCustomStartPos = lcsx !== 0xFF ? { x: lcsx, y: lcsy } : null;

                const lex = read();
                const ley = read();
                const layerEndPos = lex !== 0xFF ? { x: lex, y: ley } : null;

                const layerButtons = readEntities(() => {
                    const x = read(), y = read(), dirCode = read(), letter = String.fromCharCode(read());
                    return { x, y, direction: codeToDir(dirCode), letter };
                });
                const layerGhosts = readEntities(() => ({ x: read(), y: read() }));
                const layerItems = readEntities(() => ({ x: read(), y: read(), type: 'key' }));

                const layerStream = readWallStream();

                layers.push({ hWalls: layerStream.hWalls, vWalls: layerStream.vWalls, activeCells: layerActiveCells, ghosts: layerGhosts, items: layerItems, buttons: layerButtons, stairs: stairs.filter(s => s.layer === layerIdx), endPos: layerEndPos, customStartPos: layerCustomStartPos });
            }
        }

        // 全部字段读完后，流必须恰好耗尽（多余字节 = 无效码，兜底确定性边界）
        if (ptr !== inflated.length) throw new RangeError('分享码多余数据');

        const mapData = { width, height, hWalls, vWalls, endPos, initialGhosts, items, buttons, editorMode, customStartPos, activeCells, multiLayerMode, layerCount, layers, stairs };

        return { success: true, data: { mapData, gameMode, initialHealth, initialStamina } };
    } catch (e) {
        console.error('loadFromShareCode 失败:', e);
        return { success: false, error: '分享码无效或已损坏。' };
    }
}
