import { createReferenceEnvironment } from '../reference/environment.js';
import { WALL_TYPES as W } from '../reference/engine.js';
import { applyEdit } from './edits.js';
import { assertButtonAttachments } from './button-support.js';

function edits(map) {
    const proposals = [];
    for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) if (map.activeCells[y][x]) proposals.push({ type: 'cell', x, y });
    for (const field of ['initialGhosts', 'items', 'buttons']) for (let index = 0; index < map[field].length; index++) proposals.push({ type: 'remove_entity', field, index });
    for (const axis of ['h', 'v']) map[axis + 'Walls'].forEach((row, y) => row.forEach((wall, x) => {
        const a = axis === 'h' ? map.activeCells[y - 1]?.[x] : map.activeCells[y]?.[x - 1];
        const b = map.activeCells[y]?.[x];
        if (!a || !b) return;
        for (const type of [W.SOLID, W.EMPTY]) if (wall.type !== type) proposals.push({ type: 'wall', axis, x, y, wall: { type, keys: 0 } });
    }));
    return proposals;
}

function change(map, edit) {
    if (edit.type !== 'remove_entity') return applyEdit(map, edit);
    const candidate = structuredClone(map); candidate[edit.field].splice(edit.index, 1);
    createReferenceEnvironment(candidate); return candidate;
}

export function designComplexity(map, evidence) {
    const cells = map.activeCells.flat().filter(Boolean).length;
    const entities = map.initialGhosts.length + map.items.length + map.buttons.length;
    const special = [...map.hWalls.flat(), ...map.vWalls.flat()].filter(w => ![W.EMPTY, W.SOLID].includes(w.type)).length;
    let interiorSolidWalls = 0;
    for (const axis of ['h', 'v']) map[axis + 'Walls'].forEach((row, y) => row.forEach((wall, x) => {
        const a = axis === 'h' ? map.activeCells[y - 1]?.[x] : map.activeCells[y]?.[x - 1];
        if (a && map.activeCells[y]?.[x] && wall.type === W.SOLID) interiorSolidWalls++;
    }));
    return [cells, entities, special, evidence.solution.totalActions, interiorSolidWalls];
}
const lower = (a, b) => { for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] < b[i]; return false; };

/** 保留显式机制条件的逐项精简；最后一轮给出声明编辑集合内的局部不可简化证据。 */
export function minimizeDesign(source, evaluate) {
    assertButtonAttachments(source);
    let map = structuredClone(source), evaluation = evaluate(map);
    if (!evaluation.accepted) throw new Error('初始候选不满足保留条件');
    const lineage = [], passes = [];
    let score = designComplexity(map, evaluation.baseline), attempts = 0;
    for (;;) {
        const audit = []; let accepted = false;
        for (const edit of edits(map)) {
            attempts++;
            let candidate;
            try { candidate = change(map, edit); }
            catch (error) { audit.push({ edit, outcome: 'invalid', reason: error.message }); continue; }
            const result = evaluate(candidate);
            if (!result.accepted) { audit.push({ edit, outcome: result.reason }); continue; }
            const nextScore = designComplexity(candidate, result.baseline);
            if (!lower(nextScore, score)) { audit.push({ edit, outcome: 'not_simpler', score: nextScore }); continue; }
            lineage.push({ parentMapId: createReferenceEnvironment(map).mapId, mapId: createReferenceEnvironment(candidate).mapId, edit, before: score, after: nextScore });
            map = candidate; evaluation = result; score = nextScore; accepted = true; break;
        }
        passes.push({ tested: audit.length, accepted });
        if (!accepted) return { map, evaluation, complexity: score, lineage, attempts, passes,
            localMinimality: { scope: 'remove_one_cell_or_entity_or_replace_one_wall_with_empty_or_solid', audit,
                unresolved: audit.filter(a => a.outcome === 'unknown').length, globalMinimumProven: false } };
    }
}
