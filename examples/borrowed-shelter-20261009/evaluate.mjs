import {WALL_TYPES as W} from '../../src/reference/engine.js';
import {createReferenceEnvironment} from '../../src/reference/environment.js';
import {solveFastMap} from '../../src/search/fast-solver.js';

export const budget={nodeBudget:220000,stateBudget:260000,budgetMs:5000};
export const referenceBudget={nodeBudget:500000,stateBudget:550000,budgetMs:40000};
export const proved=r=>r.status==='solved'&&r.optimality==='proven';
export const edges=map=>['h','v'].flatMap(axis=>map[axis+'Walls'].flatMap((row,y)=>row.map((wall,x)=>({axis,x,y,wall}))));
const press=letter=>({type:'press',letter});
const visit=(x,y)=>({type:'visit',layer:0,x,y});
const at=(x,y)=>({type:'ghost_at',layer:0,x,y});
const gate=(axis,x,y,state)=>({type:'gate',layer:0,axis,x,y,state});
const all=(...events)=>({type:'all',events});
export const temporary=all(press('B'),at(2,4),gate('h',2,4,'closed'),gate('v',2,4,'closed'));
export const upper=all(press('A'),visit(3,3),at(3,2),gate('h',3,3,'closed'));
export const corner=all(press('C'),visit(0,3),at(1,3),gate('v',1,3,'closed'));
export const reopen=all(press('A'),visit(1,2),gate('h',3,3,'open'));
export const final=all(press('B'),at(1,5),gate('v',2,3,'closed'));
export const constraints=[
    {id:'temporary_B_protection',sequence:[temporary]},
    {id:'right_A_protection',sequence:[upper]},
    {id:'C_relocation_after_temporary_B',sequence:[temporary,corner]},
    {id:'prepare_C_before_left_A_release',sequence:[corner,reopen]},
    {id:'release_previously_protected_area',sequence:[upper,gate('h',3,3,'open')]},
    {id:'release_then_B_takes_over',sequence:[upper,reopen,final]}
];

// 保留用途转换与保护交接；不锁定所选证书的完整先后顺序或鬼身份分工。
export function createEvaluator(){
    const cache=new Map();
    return map=>{
        const id=createReferenceEnvironment(map).mapId;if(cache.has(id))return cache.get(id);
        const finish=result=>{cache.set(id,result);return result;};
        if(map.initialStamina!==100||map.initialGhosts.length!==2||map.items.length!==2||
            edges(map).some(e=>[W.GLASS,W.ONE_WAY].includes(e.wall.type))||
            ![['h',3,3],['v',1,3],['h',2,4],['v',2,4],['v',2,3]].every(([axis,x,y])=>map[axis+'Walls'][y][x].type===W.LETTER_DOOR)||
            ![[0,3],[1,2],[1,3],[1,5],[2,4],[3,2],[3,3]].every(([x,y])=>map.activeCells[y]?.[x])||
            map.hWalls[2][3].type!==W.LOCKED||map.hWalls[2][3].keys!==2)
            return finish({accepted:false,reason:'changed_relation'});
        const baseline=solveFastMap(map,budget);if(!proved(baseline))return finish({accepted:false,reason:baseline.status==='unknown'?'unknown':'unsat'});
        const proofs=[];
        for(const condition of constraints){
            const result=solveFastMap(map,{...budget,restrictions:[condition]});
            if(result.status!=='proven_unsat')return finish({accepted:false,reason:result.status==='unknown'?'unknown':'relation_avoidable',condition,result});
            proofs.push({condition,result});
        }
        const reverse=structuredClone(map);reverse.initialGhosts.reverse();
        try{if(!createReferenceEnvironment(reverse).replay(baseline.solution.actions).state.isWon)return finish({accepted:false,reason:'order_sensitive'});}
        catch{return finish({accepted:false,reason:'order_sensitive'});}
        return finish({accepted:true,baseline,proofs});
    };
}
