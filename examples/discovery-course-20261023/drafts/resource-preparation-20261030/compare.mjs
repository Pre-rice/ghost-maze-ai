import fs from 'node:fs';import assert from 'node:assert/strict';
import {createReferenceEnvironment}from'../../../../src/reference/environment.js';
import {createBreadthFirstSearch}from'../../../../../ghost-maze/src/solver/breadthFirst.js';
const root=new URL('.',import.meta.url);
const original=JSON.parse(fs.readFileSync(new URL('../../levels/56/revisions/v01/map.json',import.meta.url)));
const candidate=JSON.parse(fs.readFileSync(new URL('../../levels/56/map.json',import.meta.url)));
const changed=structuredClone(original);changed.layers[0].hWalls[4][4].keys=1;changed.layers[0].vWalls[1][5].keys=1;assert.deepEqual(changed,candidate);
const a=createReferenceEnvironment(original),b=createReferenceEnvironment(candidate),budget={nodeBudget:500000,stateBudget:500000,budgetMs:20000};
const noEnd=m=>{const n=structuredClone(m);n.layers[0].endPos=null;return createReferenceEnvironment(n);},an=noEnd(original),bn=noEnd(candidate);
const overlap=s=>s.layerStates.some(l=>new Set(l.ghosts.map(g=>g.x+','+g.y)).size!==l.ghosts.length);
const sig=s=>JSON.stringify({p:[s.player.layer,s.player.x,s.player.y,s.player.keys,s.player.hp],g:s.layerStates.map(l=>l.ghosts.map(g=>[g.x,g.y])),items:s.layerStates.map(l=>l.items),w:s.layerStates.map(l=>['h','v'].map(axis=>l.wallStates[axis].map((row,y)=>row.map((w,x)=>[w.type,(axis==='h'&&x===4&&y===4||axis==='v'&&x===5&&y===1)?'QUALIFICATION':w.keys,w.letter??null,w.currentState??null,w.direction??null])))),dead:s.isDead,won:s.isWon});
function continuation(env,no,state,avoid){
 if(state.isDead||avoid&&overlap(state))return{status:'unsafe'};
 if(state.isWon)return{status:'solved',actions:[]};
 const q=createBreadthFirstSearch({...env,initialState:()=>state.clone()},{monitor:{initial:()=>[],advance:(h,b,act,n)=>avoid&&overlap(n)||n.isWon&&no.step(b,act).isDead?null:h}});
 const result=q.run(budget);return{...result,actions:q.firstActions()};
}
const results=[];
for(const avoidOverlap of[false,true]){
 const first={a:a.initialState(),b:b.initialState(),prefix:[]},queue=[first],seen=new Set([a.stateKey(first.a)+'|'+b.stateKey(first.b)]),divergences=[];let transitions=0;
 assert.equal(sig(first.a),sig(first.b));
 for(let i=0;i<queue.length;i++){
  assert(queue.length<10000);const row=queue[i];if(row.a.isWon||row.a.isDead)continue;
  for(const act of a.actions){
   transitions++;const aa=a.step(row.a,act),bb=b.step(row.b,act),av=aa!==row.a,bv=bb!==row.b;
   const as=!aa.isDead&&!(avoidOverlap&&overlap(aa))&&(!aa.isWon||!an.step(row.a,act).isDead),bs=!bb.isDead&&!(avoidOverlap&&overlap(bb))&&(!bb.isWon||!bn.step(row.b,act).isDead);
   if(sig(aa)!==sig(bb)||av!==bv||as!==bs){
    const ac=!av?{status:'invalid'}:!as?{status:'unsafe'}:continuation(a,an,aa,avoidOverlap),bc=!bv?{status:'invalid'}:!bs?{status:'unsafe'}:continuation(b,bn,bb,avoidOverlap);
    assert(!['solved','unknown'].includes(ac.status));assert(!['solved','unknown'].includes(bc.status));
    divergences.push({prefix:row.prefix,action:act,originalValid:av,candidateValid:bv,originalAfter:ac,candidateAfter:bc,before:continuation(a,an,row.a,avoidOverlap)});continue;
   }
   if(!av||!as||aa.isWon)continue;
   const key=a.stateKey(aa)+'|'+b.stateKey(bb);if(!seen.has(key)){seen.add(key);queue.push({a:aa,b:bb,prefix:[...row.prefix,act]});}
  }
 }
 results.push({avoidOverlap,matchedStates:queue.length,transitions,divergences});
 console.log(JSON.stringify({avoidOverlap,states:queue.length,transitions,divergences:divergences.map(d=>({prefix:d.prefix.join(''),action:d.action,old:d.originalAfter.status,new:d.candidateAfter.status,before:d.before.status}))}));
}
const stored=JSON.parse(fs.readFileSync(new URL('complete-comparison.json',root)));assert.equal(stored.sourceMapId,a.mapId);assert.equal(stored.candidateMapId,b.mapId);assert.equal(stored.ruleset,a.ruleset);assert.deepEqual(stored.results,results);
