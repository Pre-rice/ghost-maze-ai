import { MapDefinition } from '../reference/engine.js';
import { getButtonHotspotAtPos } from '../../vendor/ghost-maze/src/core/pathfinding.js';

/** 按钮依附校验复用本体编辑器热点规则；地图边界也视为实际墙面。 */
export function findUnsupportedButtons(map) {
    const def = new MapDefinition(map);
    return def.layers.flatMap((layer, layerIndex) => layer.initialEntities.buttons.flatMap((button, index) => {
        const { dx, dy } = button.direction;
        const hotspot = getButtonHotspotAtPos(button.x + 0.5 + dx * 0.4, button.y + 0.5 + dy * 0.4, {
            cellSize: 1, width: def.width, height: def.height, editorMode: def.editorMode,
            activeCells: layer.activeCells, hWalls: layer.initialWalls.h, vWalls: layer.initialWalls.v
        });
        return hotspot?.x === button.x && hotspot?.y === button.y &&
            hotspot.direction.dx === dx && hotspot.direction.dy === dy ? [] : [{ layer: layerIndex, index, ...button }];
    }));
}

export function assertButtonAttachments(map) {
    const invalid = findUnsupportedButtons(map);
    if (invalid.length) {
        const b = invalid[0];
        throw new TypeError(`第 ${b.layer} 层 (${b.x},${b.y}) 的 ${b.letter} 按钮未依附可放置的墙面`);
    }
}
