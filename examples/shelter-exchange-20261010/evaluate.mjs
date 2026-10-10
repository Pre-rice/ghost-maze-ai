import {createReferenceEnvironment} from '../../src/reference/environment.js';
import {solveFastMap} from '../../src/search/fast-solver.js';
import {assertButtonAttachments} from '../../src/design/button-support.js';
import {WALL_TYPES as W} from '../../src/reference/engine.js';

export const budget={nodeBudget:300000,stateBudget:360000,budgetMs:7000};
export const referenceBudget={nodeBudget:450000,stateBudget:500000,budgetMs:55000};
const press=letter=>({type:'press',letter}),gate=(axis,x,y,state)=>({type:'gate',layer:0,axis,x,y,state});
const at=(x,y)=>({type:'ghost_at',layer:0,x,y}),all=(...events)=>({type:'all',events});
export const temporary=all(press('B'),at(2,4),gate('v',2,4,'closed'));
export const corner=all(press('C'),at(1,3),gate('v',1,3,'closed'));
export const upper=all(press('B'),at(2,2),gate('v',2,2,'closed'));
export const constraints=[
    {id:'temporary_B_protection',sequence:[temporary]},
    {id:'relocation_after_temporary_protection',sequence:[temporary,corner]},
    {id:'shared_protection_position_reused',sequence:[temporary,corner,temporary]},
    {id:'upper_parking_before_completion',sequence:[upper]},
    {id:'B_pull_then_capture',sequence:[all(press('B'),gate('v',2,4,'open'),at(2,4)),temporary]}
];

// 保留位置换手关系；不固定证书中的鬼身份、A 的次数或唯一完整顺序。
export function createEvaluator(){
    const cache=new Map();
    return map=>{
        const id=createReferenceEnvironment(map).mapId;if(cache.has(id))return cache.get(id);
        const done=value=>{cache.set(id,value);return value;};
        try{assertButtonAttachments(map);}catch{return done({accepted:false,reason:'unsupported_button'});}
        if(map.initialStamina!==100||map.initialGhosts.length!==3||map.items.length!==2||
            [...map.hWalls.flat(),...map.vWalls.flat()].some(w=>[W.GLASS,W.ONE_WAY].includes(w.type))||
            ![['v',2,4],['v',1,3],['v',2,2]].every(([axis,x,y])=>map[axis+'Walls'][y][x].type===W.LETTER_DOOR)||
            ![[2,4],[1,3],[2,2],[1,1]].every(([x,y])=>map.activeCells[y]?.[x])||
            ![['h',1,1],['v',2,1]].every(([axis,x,y])=>map[axis+'Walls'][y][x].type===W.LETTER_DOOR))return done({accepted:false,reason:'changed_relation'});
        const baseline=solveFastMap(map,budget);if(baseline.status!=='solved'||baseline.optimality!=='proven')return done({accepted:false,reason:baseline.status==='unknown'?'unknown':'unsat'});
        const proofs=[];
        for(const condition of constraints){const result=solveFastMap(map,{...budget,restrictions:[condition]});
            if(result.status!=='proven_unsat')return done({accepted:false,reason:result.status==='unknown'?'unknown':'relation_avoidable',condition,result});
            proofs.push({condition,result});}
        const reverse=structuredClone(map);reverse.initialGhosts.reverse();
        try{if(!createReferenceEnvironment(reverse).replay(baseline.solution.actions).state.isWon)return done({accepted:false,reason:'order_sensitive'});}catch{return done({accepted:false,reason:'order_sensitive'});}
        return done({accepted:true,baseline,proofs});
    };
}
