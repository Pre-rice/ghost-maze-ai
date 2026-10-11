import { validateMapData as validateCurrent, WALL_TYPES } from '../reference/engine.js';

/** 旧阶段筛选保留为工具选项，结构合法性始终使用本体校验。 */
export function validateMapData(source, opts = {}) {
    const current = validateCurrent(source);
    if (!current.valid) return { valid: false, errors: [current.error] };
    const errors = [], map = current.mapData;
    if (opts.stage1Only !== false) {
        if (map.layerCount > 1 || map.stairs.length) errors.push('阶段一禁止多层与楼梯');
        for (const layer of map.layers) {
            if (layer.buttons.length) errors.push('阶段一禁止按钮');
            if ([...layer.hWalls.flat(), ...layer.vWalls.flat()].some(wall => wall.type > WALL_TYPES.LOCKED)) errors.push('阶段一禁止单向门、玻璃和字母门');
        }
    }
    return { valid: errors.length === 0, errors };
}
