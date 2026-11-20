import fs from 'node:fs';
import { room } from '../../build.mjs';
import { WALL_TYPES as W } from '../../../../src/reference/engine.js';
import { assessOpening } from './shapes.mjs';
const cells=Array.from({length:12},(_,i)=>[i%4,Math.floor(i/4)]).filter(([x,y])=>!(x===2&&y===1));
const params={start:[2,2],end:[3,1],ghosts:[[3,0]]};
const cases={
    bay:room(4,3,{...params,cells}),
    split:room(4,3,{...params,cells,edges:[['v',1,1,W.SOLID]]}),
    upper:room(4,3,{...params,cells:cells.filter(([x,y])=>x||y!==2)}),
    lower:room(4,3,{...params,cells:cells.filter(([x,y])=>x||y!==0)})
};
const records=Object.fromEntries(Object.entries(cases).map(([name,map])=>[name,assessOpening(map)]));
fs.writeFileSync(new URL('side-bay.json',import.meta.url),JSON.stringify(records,null,2)+'\n');
for(const [name,r]of Object.entries(records))console.log(name,r.cells,r.T,r.best.length,r.best.filter(b=>b.safe).length,r.queries.map(q=>q.mode+'='+q.T).join(' '));
