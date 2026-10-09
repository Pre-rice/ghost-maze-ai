import { createReferenceEnvironment } from '../../src/reference/environment.js';
import { solveFastMap } from '../../src/search/fast-solver.js';
import { WALL_TYPES as W } from '../../src/reference/engine.js';
import { trace } from './discover.mjs';

export const BUDGET = { nodeBudget: 100000, stateBudget: 100000, budgetMs: 10000 };
export const proved = r => r.status === 'solved' && r.optimality === 'proven';
export const edges = map => ['h','v'].flatMap(axis => map[axis+'Walls'].flatMap((row,y) => row.map((wall,x) => ({axis,x,y,wall}))));
export const constraints = ['A','B'].flatMap(letter => [
    { id: 'third_' + letter, sequence: Array.from({length:3},()=>({type:'press',letter})) },
    { id: 'return_' + letter, sequence: [letter,letter==='A'?'B':'A',letter].map(letter=>({type:'press',letter})) }
]);

// 保留本候选的具体组合关系；这是候选审查，不是通用趣味评分。
export function createEvaluator() {
    const cache = new Map();
    return map => {
        const id = createReferenceEnvironment(map).mapId;
        if (cache.has(id)) return cache.get(id);
        const finish = e => { cache.set(id,e); return e; };
        const wallEdges = edges(map);
        if (wallEdges.some(e=>e.wall.type===W.GLASS) || map.buttons.length!==2 || new Set(map.buttons.map(b=>b.letter)).size!==2 || map.initialGhosts.length!==1) return finish({accepted:false,reason:'changed_scope'});
        const baseline = solveFastMap(map,BUDGET);
        if (!proved(baseline)) return finish({accepted:false,reason:baseline.status==='proven_unsat'?'unsat':'unknown'});
        const t = trace(map,baseline.solution.actions);
        if (['A','B'].some(letter=>t.word.filter(x=>x===letter).length<3)) return finish({accepted:false,reason:'simple_button_word'});
        const proofs = [];
        for (const condition of constraints) {
            const result = solveFastMap(map,{...BUDGET,restrictions:[condition]});
            if (result.status!=='proven_unsat') return finish({accepted:false,reason:result.status==='unknown'?'unknown':'sequence_avoidable'});
            proofs.push({condition,result});
        }
        const noGhost = solveFastMap(map,{...BUDGET,withGhosts:false});
        if (!proved(noGhost) || baseline.solution.totalActions-noGhost.solution.totalActions<10) return finish({accepted:false,reason:'weak_ghost_effect'});
        const doors = wallEdges.filter(e=>e.wall.type===W.DOOR);
        if (doors.length!==1) return finish({accepted:false,reason:'changed_parking_door'});
        const contrasts=[];
        for (const type of [W.EMPTY,W.SOLID]) {
            const changed=structuredClone(map),edge=doors[0]; changed[edge.axis+'Walls'][edge.y][edge.x]={type,keys:0};
            const result=solveFastMap(changed,BUDGET);
            if(result.status!=='proven_unsat')return finish({accepted:false,reason:result.status==='unknown'?'unknown':'parking_door_redundant'});
            contrasts.push({edit:{axis:edge.axis,x:edge.x,y:edge.y,type},result});
        }
        return finish({accepted:true,baseline,trace:t,proofs,noGhost,contrasts});
    };
}
