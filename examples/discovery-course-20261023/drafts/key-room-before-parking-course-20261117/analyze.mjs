import fs from 'node:fs';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {createReferenceEnvironment} from '../../../../src/reference/environment.js';
import {createBreadthFirstSearch} from '../../../../../ghost-maze/src/solver/breadthFirst.js';
import {inspectGhostInfluence} from '../../../../src/design/ghost-influence.js';
export function analyzeParking(map){
const e=createReferenceEnvironment(map),nm=structuredClone(map);nm.layers.forEach(l=>l.endPos=null);
const no=createReferenceEnvironment(nm),budget={nodeBudget:750000,stateBudget:750000,budgetMs:30000},where=(s,id)=>s.layerStates.flatMap((l,k)=>l.ghosts.filter(g=>g.id===id).map(g=>[k,g.x,g.y]))[0],same=(a,b)=>a.join(',')===b.join(',');
const tagged={...e,initialState(){const s=e.initialState();s.layerStates[0].ghosts[0].id=10;s.layerStates[1].ghosts[0].id=20;return s;},stateKey:s=>e.stateKey(s)+'|'+JSON.stringify([where(s,10),where(s,20)])},rows=[];
for(const name of ['no_actual_influence','no_ghost_migration','no_actual_and_no_migration','lower_always_lower','upper_always_upper','upper_changes_layer','swap_end_layers','never_first_hold','never_second_hold','lower_up_before_key','lower_up_after_key','both_end_upper','both_end_lower','never_upper_shortcut','never_lower_arrow']){
 const q=createBreadthFirstSearch(tagged,{monitor:{initial:()=>[0,0,0],advance(h,b,a,n){
  if(n.isWon&&no.step(b,a).isDead)return null;
  if(n.layerStates.some(l=>new Set(l.ghosts.map(g=>g.x+','+g.y)).size!==l.ghosts.length))return null;
  const lb=where(b,10),ln=where(n,10),ub=where(b,20),un=where(n,20),lm=lb[0]!==ln[0],um=ub[0]!==un[0],f=inspectGhostInfluence(e,b,a,n),motion=f.kind==='motion',lowerUp=lm&&ln[0]===1,history=[Number(h[0]||lowerUp&&b.player.keys===0),Number(h[1]||lowerUp&&b.player.keys>0),Number(h[2]||um)];
  const first=motion&&f.changes.some(c=>same(c.from,[0,2,2])&&same(c.actual,[0,2,2])&&same(c.alone,[1,2,2])),second=motion&&f.changes.some(c=>same(c.from,[1,4,2])&&same(c.actual,[1,4,2])&&same(c.alone,[0,4,2]));
  if(['no_actual_influence','no_actual_and_no_migration'].includes(name)&&f.kind!=='none'||['no_ghost_migration','no_actual_and_no_migration'].includes(name)&&(lm||um)||name==='lower_always_lower'&&ln[0]!==0||name==='upper_always_upper'&&un[0]!==1||name==='never_first_hold'&&first||name==='never_second_hold'&&second)return null;
  if(name==='never_upper_shortcut'&&b.player.layer===1&&b.player.x===2&&b.player.y===3&&a==='R'||name==='never_lower_arrow'&&b.player.layer===0&&b.player.x===2&&b.player.y===3&&a==='U')return null;
  if(n.isWon&&(name==='lower_up_before_key'&&!history[0]||name==='lower_up_after_key'&&!history[1]||name==='both_end_upper'&&(ln[0]!==1||un[0]!==1)||name==='both_end_lower'&&(ln[0]!==0||un[0]!==0)||name==='upper_changes_layer'&&!history[2]||name==='swap_end_layers'&&(ln[0]!==1||un[0]!==0)))return null;
  return history;
 }}}),result=q.run(budget);assert(['solved','proven_unsat'].includes(result.status));rows.push({name,result,actions:q.firstActions()});
}
return {mapId:e.mapId,ruleset:e.ruleset,humanQuality:null,scope:'原图事件约束，角色坐标与迁层取物历史进入完整键；排除非死亡重合与终点掩盖死亡。与删改箭头是不同证据。',rows};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const root=new URL('./',import.meta.url),saved=JSON.parse(fs.readFileSync(new URL('prototype.json',root))),out=analyzeParking(saved.map);
 fs.writeFileSync(new URL('complete-plans.json',root),JSON.stringify(out,null,2)+'\n');
 console.log(JSON.stringify(out.rows.map(r=>({name:r.name,status:r.result.status,T:r.result.totalActions}))));
}
