import fs from 'node:fs';
import {definitions} from './build.mjs';
const root=new URL('./',import.meta.url),read=p=>JSON.parse(fs.readFileSync(new URL(p,root))),order=read('course-order.json');
let text=fs.readFileSync(new URL('README.md',root),'utf8'),a=text.indexOf('| 关 |'),b=text.indexOf('\n## 每关',a),table='| 关 | 主要发现／作用 | 来源 | 格 / 最优步 |\n| --- | --- | --- | --- |\n',newCount=0,reused=0;
for(const[id,i]of order.map((id,i)=>[id,i])){
 const d=definitions.find(d=>d.id===id),m=read(`levels/${id}/map.json`),q=read(`levels/${id}/evidence.json`);if(d.galleryTitle)reused++;else newCount++;
 table+=`| [${i+1}](levels/${id}/source.json) | ${d.newDiscovery.split('；')[0]} | ${d.galleryTitle?'《'+d.galleryTitle+'》课程变式':'新设计'} | ${m.layers[0].activeCells.flat().filter(Boolean).length} / ${q.allResult.totalActions} |\n`;
}
text=text.slice(0,a)+table+'\n'+text.slice(b);text=text.replace(/现为\d+关的首条试验线路[^。]*。/,`现为${order.length}关的首条试验线路，${newCount}张新设计、${reused}张已确认图的复用或课程变式。`);fs.writeFileSync(new URL('README.md',root),text);
const status=new URL('../../docs/status.md',root);let current=fs.readFileSync(status,'utf8');current=current.replace(/目前公开\d+关，[^；]*；/,`目前公开${order.length}关，${newCount}张新设计、${reused}张已确认图的复用或课程变式；`);fs.writeFileSync(status,current);
console.log(JSON.stringify({levels:order.length,newCount,reused}));
