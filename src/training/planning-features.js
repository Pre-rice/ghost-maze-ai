import { WALL_TYPES as W } from '../reference/engine.js';
import { createFastEnvironment } from '../search/fast-environment.js';
import { relaxedDistField } from '../search/relaxed-distance.js';

const dirs=[[0,-1],[1,0],[0,1],[-1,0]],actions=['U','R','D','L','STAIR'];
const finite=n=>Number.isFinite(n)?n:100;
const minimum=xs=>xs.length?Math.min(...xs):100;
const countAt=(list,x,y)=>list.filter(p=>p.x===x&&p.y===y).length;
const cell=(def,x,y)=>!!def.activeCells[y]?.[x];
const wall=(ls,x,y,dx,dy)=>dx?ls.wallStates.v[y]?.[x+(dx===1?1:0)]:ls.wallStates.h[y+(dy===1?1:0)]?.[x];

/** 全信息物理特征。没有mapId、家族、标题、动作步号、精确剩余成本或轨迹后缀。 */
export function createPlanningEncoder(map) {
    const fast=createFastEnvironment(map),md=fast.reference.mapDefinition,goalFields=relaxedDistField(fast.sim),cache=new WeakMap();
    const summarize=state=>{
        if(cache.has(state))return cache.get(state);
        const p=state.player,ls=state.layerStates[p.layer],def=md.layers[p.layer],features=[];
        const push=(...values)=>features.push(...values.map(finite));
        const ghosts=state.layerStates.flatMap((l,layer)=>l.ghosts.map(g=>({...g,layer}))),keys=state.layerStates.flatMap((l,layer)=>l.items.map(i=>({...i,layer}))),buttons=md.layers.flatMap((l,layer)=>l.initialEntities.buttons.map(b=>({...b,layer}))),ends=md.layers.flatMap((l,layer)=>l.initialEntities.endPos?[{...l.initialEntities.endPos,layer}]:[]);
        const dist=t=>Math.abs(t.x-p.x)+Math.abs(t.y-p.y)+4*Math.abs(t.layer-p.layer);
        push(p.keys,keys.length,ghosts.length,md.layerCount,finite(goalFields[p.layer][p.y][p.x]),minimum(keys.map(dist)),minimum(buttons.map(dist)),minimum(ends.map(dist)),state.isWon?1:0);
        const nearGhosts=ghosts.map(g=>({g,d:dist(g)})).sort((a,b)=>a.d-b.d||a.g.y-b.g.y||a.g.x-b.g.x);
        for(let i=0;i<4;i++){const row=nearGhosts[i];if(row)push(row.g.x-p.x,row.g.y-p.y,row.g.layer-p.layer,row.d,row.g.x===p.x?1:0,row.g.y===p.y?1:0);else push(0,0,0,100,0,0);}
        // 自身周围的可见物理格，不含观察记录；墙只编码真实类型和资源缺口。
        for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){
            const x=p.x+dx,y=p.y+dy;push(cell(def,x,y)?1:0,countAt(ls.ghosts,x,y),countAt(ls.items,x,y),countAt(def.initialEntities.buttons,x,y),def.initialEntities.endPos?.x===x&&def.initialEntities.endPos?.y===y?1:0,md.stairs.some(s=>s.layer===p.layer&&s.x===x&&s.y===y)?1:0);
        }
        for(const [dx,dy] of dirs){const w=wall(ls,p.x,p.y,dx,dy);for(let type=0;type<=6;type++)push(w?.type===type?1:0);push(w?.type===W.LETTER_DOOR&&w.currentState==='open'?1:0,w?.type===W.LOCKED?Math.max(0,w.keys-p.keys):0);}
        // 按与玩家的距离排序控制组，不输入字母名称或鬼的不可见编号。
        const groups=new Map();
        for(const b of buttons){if(!groups.has(b.letter))groups.set(b.letter,{buttons:[],doors:[]});groups.get(b.letter).buttons.push(b);}
        state.layerStates.forEach((l,layer)=>{for(const axis of ['h','v'])l.wallStates[axis].forEach((row,y)=>row.forEach((w,x)=>{if(w.type===W.LETTER_DOOR){if(!groups.has(w.letter))groups.set(w.letter,{buttons:[],doors:[]});groups.get(w.letter).doors.push({x,y,layer,open:w.currentState==='open'});}}));});
        const ordered=[...groups.values()].map(g=>({...g,d:minimum(g.buttons.map(dist))})).sort((a,b)=>a.d-b.d||a.doors.length-b.doors.length);
        for(let i=0;i<4;i++){const g=ordered[i];if(g)push(g.buttons.length,g.doors.length,g.doors.filter(d=>d.open).length,g.d,minimum(g.doors.map(dist)));else push(0,0,0,100,100);}
        cache.set(state,features);return features;
    };
    return {dimension:null,summarize,encode(before,action,after){const a=summarize(before),b=summarize(after),p=before.player,q=after.player;return [...actions.map(token=>token===action?1:0),q.x-p.x,q.y-p.y,q.layer-p.layer,p.x===q.x&&p.y===q.y&&p.layer===q.layer?1:0,q.keys-p.keys,...a,...b];},relaxed:state=>finite(goalFields[state.player.layer][state.player.y][state.player.x])};
}
