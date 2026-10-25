import assert from 'node:assert/strict';
import {WALL_TYPES as W,normalizeMapData,normalizeVoidWalls} from '../../src/reference/engine.js';
import {createReferenceEnvironment} from '../../src/reference/environment.js';

/** 指定真正外侧路径，仅增加外部格与单向入场边；物理后继仍由本体计算。 */
export function auditEntryPath(map,routes,{external,externalCells,actions}){
 assert.equal(map.layers[0].customStartPos!=null,true,'指定入场仍从第零层出生点开始');
 const layer=map.layers[0],points=[];
 for(let y=0;y<map.height;y++)for(let x=0;x<map.width;x++)if(layer.activeCells[y][x])points.push([x,y]);
 const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
 assert(external[0]===0&&externalCells.some(([x,y])=>x===external[1]&&y===external[2]));
 assert(external[1]<Math.min(...xs)||external[1]>Math.max(...xs)||external[2]<Math.min(...ys)||external[2]>Math.max(...ys),'路径必须从原包络外起步');
 const enteredMap=structuredClone(map),l=enteredMap.layers[0],outside=new Set(externalCells.map(p=>p.join(',')));
 const edge=(from,to)=>({axis:from[0]===to[0]?'h':'v',x:Math.max(from[0],to[0]),y:Math.max(from[1],to[1])});
 for(const[x,y]of externalCells){assert(x>=0&&x<map.width&&y>=0&&y<map.height&&!layer.activeCells[y][x]);l.activeCells[y][x]=true;for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){const e=edge([x,y],[x+dx,y+dy]);l[e.axis+'Walls'][e.y][e.x]={type:W.SOLID,keys:0};}}
 let pos=[external[1],external[2]],entrances=0;const deltas={U:[0,-1],D:[0,1],L:[-1,0],R:[1,0]};
 for(const a of actions){const[dx,dy]=deltas[a]??[];assert(Number.isInteger(dx)&&Number.isInteger(dy));const next=[pos[0]+dx,pos[1]+dy];assert(l.activeCells[next[1]]?.[next[0]]);if(outside.has(pos.join(','))){const e=edge(pos,next);l[e.axis+'Walls'][e.y][e.x]=outside.has(next.join(','))?{type:W.EMPTY,keys:0}:{type:W.ONE_WAY,keys:0,direction:{dx,dy}};if(!outside.has(next.join(',')))entrances++;}else assert(!outside.has(next.join(',')),'入场路径不可再次离开单元');pos=next;}
 assert.equal(entrances,1);assert.deepEqual(pos,[layer.customStartPos.x,layer.customStartPos.y]);l.customStartPos={x:external[1],y:external[2]};
 const unit=createReferenceEnvironment(map),entered=createReferenceEnvironment(normalizeVoidWalls(normalizeMapData(enteredMap)));
 const interiorEdges=map.layers.map(layer=>{const edges=[];for(const axis of ['h','v'])layer[axis+'Walls'].forEach((row,y)=>row.forEach((w,x)=>{if(layer.activeCells[y]?.[x]&&(axis==='h'?layer.activeCells[y-1]?.[x]:layer.activeCells[y]?.[x-1]))edges.push([axis,x,y]);}));return edges;});
 const physical=s=>JSON.stringify({p:[s.player.layer,s.player.x,s.player.y,s.player.hp,s.player.keys],dead:s.isDead,won:s.isWon,layers:s.layerStates.map((l,li)=>({g:l.ghosts.map(g=>[g.x,g.y]).sort((a,b)=>a[0]-b[0]||a[1]-b[1]),items:l.items,walls:interiorEdges[li].map(([a,x,y])=>l.wallStates[a][y][x])}))});
 let arrival=entered.initialState();for(const a of actions){const next=entered.step(arrival,a);assert(next!==arrival&&!next.isDead);arrival=next;}assert.equal(physical(arrival),physical(unit.initialState()));
 const queue=[[unit.initialState(),arrival]],seen=new Set([unit.stateKey(unit.initialState())]);let transitions=0;
 for(let i=0;i<queue.length;i++){assert(queue.length<1000000);const[a,b]=queue[i];if(a.isDead||a.isWon)continue;for(const action of unit.actions){const n=unit.step(a,action),m=entered.step(b,action);assert.equal(physical(n),physical(m));transitions++;if(n===a||n.isDead)continue;const key=unit.stateKey(n);if(!seen.has(key)){seen.add(key);queue.push([n,m]);}}}
 for(const r of routes){let a=unit.initialState(),b=arrival;for(const action of r.actions){a=unit.step(a,action);b=entered.step(b,action);assert.equal(physical(a),physical(b));}assert(a.isWon&&b.isWon);}
 const noEnd=structuredClone(enteredMap);noEnd.layers.forEach(l=>l.endPos=null);const ne=createReferenceEnvironment(normalizeVoidWalls(normalizeMapData(noEnd)));for(const r of routes)assert(!ne.replay([...actions,...r.actions]).state.isDead);
 return{external,actions,externalCells,internal:[0,...pos],keys:0,externalGhosts:0,actualExternalStartOutsideEnvelope:true,exteriorSealedExceptEntrance:true,initialInteriorEqual:true,afterGhosts:arrival.layerStates.map(l=>l.ghosts.map(g=>[g.x,g.y])),wholeOptimalRoutesInteriorEqual:true,allInternalSuccessorsEqual:{states:queue.length,transitions,includesFatalActions:true},noEndSafeRoutes:routes.length,scope:'只声明所列外侧路径、零钥匙与无外部鬼；不声称任意外部局面均适用'};
}
