import { WALL_TYPES as W,GameLogic } from '../reference/engine.js';
import { createFastEnvironment } from '../search/fast-environment.js';
import { relaxedDistField } from '../search/relaxed-distance.js';

const dirs=[[0,-1],[1,0],[0,1],[-1,0]],actions=['U','R','D','L','STAIR'];
const finite=n=>Number.isFinite(n)?n:100;
const minimum=xs=>xs.length?Math.min(...xs):100;
const countAt=(list,x,y)=>list.filter(p=>p.x===x&&p.y===y).length;
const cell=(def,x,y)=>!!def.activeCells[y]?.[x];
const wall=(ls,x,y,dx,dy)=>dx?ls.wallStates.v[y]?.[x+(dx===1?1:0)]:ls.wallStates.h[y+(dy===1?1:0)]?.[x];
export const PLANNING_FEATURE_VERSION=3;

/** 全信息物理特征。没有mapId、家族、标题、动作步号、精确剩余成本或轨迹后缀。 */
export function createPlanningEncoder(map,{version=PLANNING_FEATURE_VERSION}={}) {
    if(![1,2,3].includes(version))throw new TypeError('未知求解特征版本');
    const fast=createFastEnvironment(map),md=fast.reference.mapDefinition,goalFields=relaxedDistField(fast.sim),cache=new WeakMap();
    const spatial=(a,b)=>a.layer-b.layer||a.y-b.y||a.x-b.x||String(a.axis??'').localeCompare(String(b.axis??''));
    const allButtons=md.layers.flatMap((l,layer)=>l.initialEntities.buttons.map(b=>({...b,layer}))).sort(spatial),dynamicWalls=[];
    md.layers.forEach((l,layer)=>{for(const axis of ['h','v'])l.initialWalls[axis].forEach((row,y)=>row.forEach((w,x)=>{if([W.LETTER_DOOR,W.LOCKED].includes(w.type))dynamicWalls.push({...w,layer,axis,x,y});}));});dynamicWalls.sort(spatial);
    const letters=[...new Set([...allButtons,...dynamicWalls].filter(t=>t.letter).sort(spatial).map(t=>t.letter))],groupId=t=>t.letter?letters.indexOf(t.letter)+1:0;
    if(version>=2&&(dynamicWalls.length>16||allButtons.length>16||md.stairs.length>8||md.layers.flatMap(l=>l.initialEntities.ghosts).length>4||md.layers.flatMap(l=>l.initialEntities.items).length>8||md.layers.filter(l=>l.initialEntities.endPos).length>4))throw new RangeError('当前实验编码容量不足，必须扩容并重训，不能静默截断地图');
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
        if(version>=2){
            // 显式保留每扇动态门：同字母反相初态和远处已消耗数字门不能压成总数。
            for(let i=0;i<16;i++){const d=dynamicWalls[i];if(d){const w=state.layerStates[d.layer].wallStates[d.axis][d.y][d.x];push(1,d.x-p.x,d.y-p.y,d.layer-p.layer,d.axis==='h'?0:1,d.type,w.type,d.initialState==='open'?1:0,w.currentState==='open'?1:0,w.keys??0,groupId(d));}else push(...Array(11).fill(0));}
            for(let i=0;i<16;i++){const b=allButtons[i];if(b)push(1,b.x-p.x,b.y-p.y,b.layer-p.layer,b.direction?.dx??0,b.direction?.dy??0,groupId(b));else push(...Array(7).fill(0));}
            const tokens=(list,limit,extra=()=>[])=>{const sorted=[...list].sort(spatial);for(let i=0;i<limit;i++){const t=sorted[i];if(t)push(1,t.x-p.x,t.y-p.y,t.layer-p.layer,...extra(t));else push(...Array(4+(list===md.stairs?1:0)).fill(0));}};
            tokens(keys,8);tokens(ends,4);tokens(md.stairs,8,t=>[t.direction==='up'?1:-1]);
            for(const [dx,dy] of dirs){const w=wall(ls,p.x,p.y,dx,dy);push(w?.direction?.dx??0,w?.direction?.dy??0);}
        }
        if(version>=3){
            // 只取当前可见关系，直接调用唯一引擎的视线／鬼通路；不是未来动作或答案。
            const see=(g,t)=>g.layer===t.layer&&GameLogic._canGhostSeePlayer(g,t,md.layers[g.layer],state.layerStates[g.layer])?1:0;
            const path=(g,t)=>g.layer===t.layer?GameLogic._findShortestPath(g,t,md.layers[g.layer],state.layerStates[g.layer]):null;
            const cost=(g,t)=>{const route=path(g,t);return route?route.length-1:100;};
            for(let i=0;i<4;i++){const g=nearGhosts[i]?.g;
                if(g){const route=path(g,p),next=route?.[1],occupied=next?countAt(state.layerStates[g.layer].ghosts,next.x,next.y):0;push(see(g,p),route?route.length-1:100,next?next.x-g.x:0,next?next.y-g.y:0,occupied,see(g,p)&&occupied?1:0);for(let j=0;j<16;j++){const b=allButtons[j];if(b)push(see(g,b),cost(g,b));else push(0,100);}push(minimum(ends.map(e=>cost(g,e))));}
                else {push(0,100,0,0,0,0);for(let j=0;j<16;j++)push(0,100);push(100);}
            }
            for(let i=0;i<4;i++)for(let j=i+1;j<4;j++){const a=nearGhosts[i]?.g,b=nearGhosts[j]?.g;if(a&&b)push(see(a,b),cost(a,b));else push(0,100);}
        }
        cache.set(state,features);return features;
    };
    return {version,summarize,encode(before,action,after){const a=summarize(before),b=summarize(after),p=before.player,q=after.player;return [...actions.map(token=>token===action?1:0),q.x-p.x,q.y-p.y,q.layer-p.layer,p.x===q.x&&p.y===q.y&&p.layer===q.layer?1:0,q.keys-p.keys,...a,...b];},relaxed:state=>finite(goalFields[state.player.layer][state.player.y][state.player.x])};
}
