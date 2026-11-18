import fs from 'node:fs';
import { WALL_TYPES as W, normalizeVoidWalls } from '../../../../src/reference/engine.js';
import { solveContinuation } from '../../../../src/design/continuation.js';
import { createReferenceEnvironment } from '../../../../src/reference/environment.js';
import { assess } from './probe.mjs';
import { build } from './final.mjs';
const map=build(), base=map.layers[0], env=createReferenceEnvironment(map);
const results=[];
function evaluate(name,variant) {
    const c=assess(variant,'native');
    results.push({name,status:c.result.status,T:c.result.totalActions,count:c.count,noEndSafe:c.noEndSafe,actions:c.actions});
}
for (const [axis,x,y,role] of [['h',4,1,'trap'],['h',5,1,'key'],['h',1,1,'goal_A'],['v',1,0,'goal_1']]) {
    const m=structuredClone(map);m.layers[0][axis+'Walls'][y][x]={type:W.EMPTY,keys:0};evaluate('open_'+role,m);
}
const occupied=[base.customStartPos,base.endPos,...base.buttons,...base.ghosts,...base.items];
for (const [y,row] of base.activeCells.entries()) for (const [x,active] of row.entries()) {
    if(!active||occupied.some(p=>p.x===x&&p.y===y))continue;
    const m=structuredClone(map), l=m.layers[0];l.activeCells[y][x]=false;
    for(const [a,xx,yy] of [['h',x,y],['h',x,y+1],['v',x,y],['v',x+1,y]])l[a+'Walls'][yy][xx]={type:W.SOLID,keys:0};
    evaluate('remove_'+x+'_'+y,normalizeVoidWalls(m));
}
const best=assess(map,'native').actions;
const prefixes=['U','UD','RR','RRURDD','RRURRUDL','RRURRUDLD','RRURRUDLDL','RRUUL','RRURRUDLULL'];
const wrongs={continuations:[],deaths:[],invalids:[]};
for(const prefix of prefixes) {
    try {env.replay([...prefix]);} catch {continue;}
    const result=solveContinuation(map,[...prefix],{reference:true,budgetMs:10000,nodeBudget:100000});
    wrongs.continuations.push({prefix,result:result.status,actions:result.actions,T:result.actions&&prefix.length+result.actions.length});
}
for(const size of [0,1,2,6,8,12,15]) {
    const prefix=best.slice(0,size), state=env.replay(prefix).state;
    for(const action of env.actions) {
        const next=env.step(state,action);
        if(next.isDead)wrongs.deaths.push({prefix,action});
        if(next===state)wrongs.invalids.push({prefix,action});
    }
}
fs.writeFileSync(new URL('economy.json',import.meta.url),JSON.stringify({results,wrongs},null,2)+'\n');
console.log(results.map(r=>[r.name,r.T]).map(JSON.stringify).join(' '));
console.log(wrongs.continuations.map(r=>[r.prefix,r.result,r.T]));
