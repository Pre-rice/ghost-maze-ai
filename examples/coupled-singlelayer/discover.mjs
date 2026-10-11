// 探索性提案脚本；筛选只产生待审候选，不是趣味评分。
// 旧提案使用带随机比较器的 sort，不是均匀洗牌；复现依赖相同 Node/V8 行为。
import {smallMap} from '../../src/design/grid.js';
import {WALL_TYPES as W} from '../../src/reference/engine.js';
import {solveFastMap} from '../../src/search/fast-solver.js';
import {createFastEnvironment} from '../../src/search/fast-environment.js';
import {seededRandom} from '../../src/design/edits.js';
import {writeFileSync,mkdirSync} from 'node:fs';
const rnd=seededRandom(930261),pick=a=>a[Math.floor(rnd()*a.length)];
const cells=[];for(let y=1;y<=5;y++)for(let x=1;x<=5;x++)cells.push([x,y]);
mkdirSync('runs/coupled-search',{recursive:true});
let accepted=0,solved=0,unknown=0;
for(let i=0;i<40000;i++){
 const shuffle=[...cells].sort(()=>rnd()-.5),[start,end,g1,g2,b1,b2]=shuffle;
 const m=smallMap(cells,start,end,100);
 m.initialGhosts=[{x:g1[0],y:g1[1],id:0},{x:g2[0],y:g2[1],id:1}];
 const edges=[];
 for(const[x,y]of cells){if(x<5)edges.push(['v',x+1,y]);if(y<5)edges.push(['h',x,y+1]);}
 for(const [a,x,y]of edges)if(rnd()<.36)m[a+'Walls'][y][x]={type:W.SOLID,keys:0};
 m.buttons=[b1,b2].map(([x,y],n)=>({x,y,letter:n?'B':'A',direction:{dx:0,dy:-1}}));
 for(let j=0;j<6;j++){const[a,x,y]=pick(edges);m[a+'Walls'][y][x]={type:W.LETTER_DOOR,letter:j%2?'A':'B',initialState:rnd()<.5?'open':'closed'};}
 const r=solveFastMap(m,{nodeBudget:5000,stateBudget:9000,budgetMs:70});
 if(r.status==='unknown')unknown++;
 if(r.status!=='solved')continue;solved++;
 const env=createFastEnvironment(m);let s=env.initialState(),presses=[];
 for(const a of r.solution.actions){const n=env.step(s,a);if(n!==s&&s.player.x===n.player.x&&s.player.y===n.player.y&&s.player.layer===n.player.layer)presses.push(m.buttons.find(b=>b.x===s.player.x&&b.y===s.player.y).letter);s=n;}
 if(r.solution.totalActions<18 || presses.length<3 || !presses.includes('A') || !presses.includes('B'))continue;
 const ng=solveFastMap(m,{withGhosts:false,nodeBudget:5000,stateBudget:9000,budgetMs:70});
 if(ng.status!=='solved'||r.solution.totalActions-ng.solution.totalActions<5)continue;
 const name=`candidate-${i}`;
 writeFileSync('runs/coupled-search/'+name+'.json',JSON.stringify(m));
 writeFileSync('runs/coupled-search/'+name+'-proof.json',JSON.stringify(r));
 console.log(JSON.stringify({name,T:r.solution.totalActions,ng:ng.solution.totalActions,presses:presses.join(''),actions:r.solution.actions.join('')}));accepted++;
 if(accepted>=12)break;
 if(i%100===0)console.log('progress',i);
}
console.log({accepted,solved,unknown});

