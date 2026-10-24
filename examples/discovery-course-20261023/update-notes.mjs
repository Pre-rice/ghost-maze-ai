import fs from 'node:fs';
import {definitions} from './build.mjs';
const root=new URL('./',import.meta.url),read=p=>JSON.parse(fs.readFileSync(new URL(p,root))),order=read('course-order.json');
let text=fs.readFileSync(new URL('README.md',root),'utf8'),a=text.indexOf('| 关 |'),b=text.indexOf('\n## 每关',a),table='| 关 | 设计关键 | 来源 | 格 / 最优步 |\n| --- | --- | --- | --- |\n',newCount=0,reused=0,variants=0;
if(a<0||b<0)throw Error('目录缺少关序表或说明分界，保留原文并停止更新');
for(const[id,i]of order.map((id,i)=>[id,i])){
 const d=definitions.find(d=>d.id===id),m=read(`levels/${id}/map.json`),q=read(`levels/${id}/evidence.json`);if(d.galleryTitle||d.researchTitle)reused++;else if(d.variantOf)variants++;else newCount++;
 table+=`| [${i+1}](levels/${id}/source.json) | ${d.newDiscovery.split('；')[0]} | ${d.galleryTitle?'《'+d.galleryTitle+'》课程变式':d.researchTitle?'《'+d.researchTitle+'》研究稿适配（未评价）':d.variantOf?'课程迁移变式':'课程专用图'} | ${m.layers[0].activeCells.flat().filter(Boolean).length} / ${q.allResult.totalActions} |\n`;
}
const summary=[newCount&&`${newCount}张课程专用图`,variants&&`${variants}张课程迁移变式`,reused&&`${reused}张既有图的复用或课程变式`].filter(Boolean).join('、');
text=text.slice(0,a)+table+'\n'+text.slice(b);text=text.replace(/现为\d+关的(?:首条试验线路|重排版本)[^。]*。/,`现为${order.length}关的重排版本，${summary}。`);fs.writeFileSync(new URL('README.md',root),text);
const status=new URL('../../docs/status.md',root);let current=fs.readFileSync(status,'utf8');current=current.replace(/目前公开\d+关，[^；]*；/,`目前公开${order.length}关，${summary}；`);fs.writeFileSync(status,current);
console.log(JSON.stringify({levels:order.length,newCount,variants,reused}));
