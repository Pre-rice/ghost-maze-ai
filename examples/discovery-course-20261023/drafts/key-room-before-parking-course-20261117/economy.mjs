import fs from 'node:fs';
import assert from 'node:assert/strict';
import {DataSerializer,normalizeVoidWalls,validateMapData,WALL_TYPES as W} from '../../../../src/reference/engine.js';
import {createReferenceEnvironment} from '../../../../src/reference/environment.js';
import {createBreadthFirstSearch} from '../../../../../ghost-maze/src/solver/breadthFirst.js';
import {auditPuzzleBoundaries} from '../../../../src/design/rule-boundaries.js';
const root=new URL('./',import.meta.url),map=JSON.parse(fs.readFileSync(new URL('prototype.json',root))).map,budget={nodeBudget:500000,stateBudget:500000,budgetMs:20000},changes=[],deletions=[];
function check(m,name){m=normalizeVoidWalls(m);assert(validateMapData(m).valid);const e=createReferenceEnvironment(m),q=createBreadthFirstSearch(e,{allOptimal:true}),result=q.run(budget);assert(['solved','proven_unsat'].includes(result.status));const boundary=result.status==='solved'?auditPuzzleBoundaries(m,budget):null;return{name,mapId:e.mapId,mapCode:DataSerializer.generateShareCode(m).code,result,count:q.routeCount().toString(),actions:q.firstActions(),boundary};}
for(const[li,axis,x,y,label]of[[1,'v',3,3,'upper'],[0,'h',2,3,'lower']])for(const[type,name]of[[W.SOLID,'solid'],[W.DOOR,'ordinary'],[W.EMPTY,'empty']]){const m=structuredClone(map);m.layers[li][axis+'Walls'][y][x]={type,keys:0};changes.push(check(m,label+'_'+name));}
for(const[li,l]of map.layers.entries())for(const[y,r]of l.activeCells.entries())for(const[x,on]of r.entries())if(on&&!([l.customStartPos,l.endPos,...l.ghosts,...l.items,...map.stairs.filter(s=>s.layer===li)].some(p=>p?.x===x&&p?.y===y))){
 const m=structuredClone(map),ll=m.layers[li];ll.activeCells[y][x]=false;for(const[a,xx,yy]of[['h',x,y],['h',x,y+1],['v',x,y],['v',x+1,y]])ll[a+'Walls'][yy][xx]={type:W.SOLID,keys:0};
 if(validateMapData(m).valid)deletions.push(check(m,[li,x,y].join(',')));
}
fs.writeFileSync(new URL('economy.json',root),JSON.stringify({mapId:createReferenceEnvironment(map).mapId,humanQuality:null,scope:'当前25格新任务的六项明确门替代与全部合法非实体单删；不是重复原72的十四单删，也不是全局最小证明。',changes,deletions},null,2)+'\n');
console.log(JSON.stringify({changes:changes.map(r=>({name:r.name,T:r.result.totalActions,status:r.result.status,boundary:r.boundary?.status})),deletions:deletions.map(r=>({name:r.name,T:r.result.totalActions,status:r.result.status,boundary:r.boundary?.status}))}));
