import fs from 'node:fs';
import assert from 'node:assert/strict';
import {DataSerializer} from '../../../../src/reference/engine.js';
import {createReferenceEnvironment} from '../../../../src/reference/environment.js';
import {createBreadthFirstSearch} from '../../../../../ghost-maze/src/solver/breadthFirst.js';
import {inspectGhostInfluence} from '../../../../src/design/ghost-influence.js';

const root=new URL('./',import.meta.url),budget={nodeBudget:500000,stateBudget:500000,budgetMs:20000};
const original=JSON.parse(fs.readFileSync(new URL('../../levels/72/revisions/v01/map.json',root))),saved=JSON.parse(fs.readFileSync(new URL('construction.json',root)));
const m=DataSerializer.loadFromShareCode(saved.rows[0].mapCode).data.mapData,e=createReferenceEnvironment(m);
const noMap=structuredClone(m);noMap.layers.forEach(l=>l.endPos=null);
const no=createReferenceEnvironment(noMap),where=(s,id)=>s.layerStates.flatMap((l,k)=>l.ghosts.filter(g=>g.id===id).map(g=>[k,g.x,g.y]))[0];
const tagged={...e,initialState(){const s=e.initialState();s.layerStates[0].ghosts[0].id=10;s.layerStates[1].ghosts[0].id=20;return s;},stateKey:s=>e.stateKey(s)+'|'+JSON.stringify([where(s,10),where(s,20)])};
const rows=[];
for(const name of ['no_actual_influence','upper_never_changes_layer','first_A_before_upper_migration']){
 const q=createBreadthFirstSearch(tagged,{monitor:{initial:()=>[0,0,0],advance(h,b,a,n){
  if(n.isWon&&no.step(b,a).isDead)return null;
  if(n.layerStates.some(l=>new Set(l.ghosts.map(g=>g.x+','+g.y)).size<l.ghosts.length))return null;
  const was=where(b,20),now=where(n,20),migration=was[0]!==now[0],press=b.player.layer===1&&b.player.x===3&&b.player.y===3&&a==='U';
  const hist=[Number(h[0]||migration),Number(h[1]||press),Number(h[2]||press&&!h[1]&&!h[0])];
  if(name==='no_actual_influence'&&inspectGhostInfluence(e,b,a,n).kind==='motion'||name==='upper_never_changes_layer'&&migration)return null;
  if(n.isWon&&name==='first_A_before_upper_migration'&&!hist[2])return null;
  return hist;
 }}}),result=q.run(budget);rows.push({name,result,actions:q.firstActions()});
 assert(['solved','proven_unsat'].includes(result.status));
}
// 原37步方案的首次下右梯后，实际走过下湾再回原位；不依赖最佳所经格猜测。
const originalAnalysis=JSON.parse(fs.readFileSync(new URL('../stair-relay-course-20261031/analysis.json',root)));
const ordinary=originalAnalysis.rows.find(x=>x.name==='no_actual_influence').actions;
const env=createReferenceEnvironment(original),prefix=ordinary.slice(0,8),loop=['R','D','L','L','L','U','R','R'];
const before=env.replay(prefix).state,after=env.replay([...prefix,...loop]).state;
assert.equal(env.stateKey(before),env.stateKey(after));
assert(env.replay([...prefix,...loop,...ordinary.slice(8)]).state.isWon);
const output={mapId:e.mapId,humanQuality:null,scope:'三个完整历史条件，角色位置及首按/迁层旗标入键，排除非死亡重合及终点保护。另实走原图无影响方案下湾回环。',rows,quietBay:{sourceMapId:env.mapId,prefix,loop,physicalStateKeyEqual:true,totalActions:ordinary.length+loop.length,won:true}};
fs.writeFileSync(new URL('complete-plans.json',root),JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({rows:rows.map(r=>({name:r.name,status:r.result.status,T:r.result.totalActions})),quietBay:output.quietBay}));
