import fs from 'node:fs';
import {DataSerializer} from '../../../../src/reference/engine.js';
import {createReferenceEnvironment} from '../../../../src/reference/environment.js';
import {createBreadthFirstSearch} from '../../../../../ghost-maze/src/solver/breadthFirst.js';
import {auditPuzzleBoundaries} from '../../../../src/design/rule-boundaries.js';
import {inspectGhostInfluence} from '../../../../src/design/ghost-influence.js';
const root=new URL('./',import.meta.url),map=JSON.parse(fs.readFileSync(new URL('../../levels/72/revisions/v01/map.json',import.meta.url))),budget={nodeBudget:750000,stateBudget:750000,budgetMs:30000};
map.layers[0].ghosts.push({x:5,y:3,id:1});
const e=createReferenceEnvironment(map),q=createBreadthFirstSearch(e,{allOptimal:true}),result=q.run(budget),boundary=result.status==='solved'?auditPuzzleBoundaries(map,budget):null;
let s=e.initialState();const trace=[];for(const[i,a]of(q.firstActions()??[]).entries()){const n=e.step(s,a);trace.push({step:i+1,a,p:[n.player.layer,n.player.x,n.player.y],g:n.layerStates.map(l=>l.ghosts.map(g=>[g.x,g.y])),keys:n.player.keys,influence:inspectGhostInfluence(e,s,a,n)});s=n;}
const old=JSON.parse(fs.readFileSync(new URL('../../levels/72/revisions/v01/evidence.json',root))).actions;let oldState=e.initialState(),failure=null;for(const[i,a]of old.entries()){oldState=e.step(oldState,a);if(oldState.isDead){failure={step:i+1,a,p:[oldState.player.layer,oldState.player.x,oldState.player.y]};break;}}
const o={createdOn:'2026-11-17',humanQuality:null,map,mapId:e.mapId,mapCode:DataSerializer.generateShareCode(map).code,result,count:q.routeCount().toString(),actions:q.firstActions(),boundary,trace,old31Failure:failure};fs.writeFileSync(new URL('prototype.json',root),JSON.stringify(o,null,2)+'\n');
console.log(JSON.stringify({result,count:o.count,boundary:boundary?.status,old31Failure:failure,trace:trace.map(t=>({...t,influence:t.influence.kind}))}));
