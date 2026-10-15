import {createPlanningEncoder} from './planning-features.js';
import {createReferenceEnvironment} from '../reference/environment.js';
import {GameLogic} from '../reference/engine.js';

/** 目标停位是明确给定的题目条件；不输入必须腾位的答案、锚点身份或精确距离。 */
export function createParkedEncoder(map,targets){
    const base=createPlanningEncoder(map,{version:3}),env=createReferenceEnvironment(map),md=env.mapDefinition,cache=new WeakMap();
    if(md.layerCount!==1||md.layers[0].initialEntities.ghosts.length!==2||targets.length!==2||new Set(targets.map(t=>`${t.layer},${t.x},${t.y}`)).size!==2||targets.some(t=>t.layer!==0||!md.layers[0].activeCells[t.y]?.[t.x]))throw new TypeError('停位任务仅支持单层双鬼和两个不同活动格目标');
    const occupied=(s,t)=>s.layerStates[0].ghosts.some(g=>g.x===t.x&&g.y===t.y);
    const reached=s=>targets.every(t=>occupied(s,t));
    const lower=s=>{const [a,b]=s.layerStates[0].ghosts,dist=(g,t)=>Math.abs(g.x-t.x)+Math.abs(g.y-t.y);return Math.ceil(Math.min(dist(a,targets[0])+dist(b,targets[1]),dist(a,targets[1])+dist(b,targets[0]))/2);};
    const summarize=s=>{if(cache.has(s))return cache.get(s);const p=s.player,l=s.layerStates[0],features=[];for(const t of targets)features.push(t.x-p.x,t.y-p.y,occupied(s,t)?1:0);const ghosts=[...l.ghosts].sort((a,b)=>(Math.abs(a.x-p.x)+Math.abs(a.y-p.y))-(Math.abs(b.x-p.x)+Math.abs(b.y-p.y))||a.y-b.y||a.x-b.x);for(const g of ghosts)for(const t of targets){const path=GameLogic._findShortestPath(g,t,md.layers[0],l);features.push(t.x-g.x,t.y-g.y,Math.abs(t.x-g.x)+Math.abs(t.y-g.y),path?path.length-1:100,GameLogic._canGhostSeePlayer(g,t,md.layers[0],l)?1:0);}features.push(lower(s),targets.filter(t=>occupied(s,t)).length,reached(s)?1:0);cache.set(s,features);return features;};
    return {reached,lower,summarize,encode(before,action,after){return [...base.encode(before,action,after),...summarize(before),...summarize(after)];},extension(before,after){return [...summarize(before),...summarize(after)];}};
}
