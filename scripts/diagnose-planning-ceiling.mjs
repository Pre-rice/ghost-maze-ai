import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';

const [source,output]=process.argv.slice(2);if(!output)throw new Error('用法：node scripts/diagnose-planning-ceiling.mjs <graph> <新结果文件>');assert(!existsSync(output),'拒绝覆盖结果');
const manifest=JSON.parse(readFileSync(source+'/manifest.json')),records=[];
for(const r of manifest.records){const file='graphs/'+r.mapId+'.json',bytes=readFileSync(source+'/'+file);if(manifest.graphFiles)assert.equal(createHash('sha256').update(bytes).digest('hex'),manifest.graphFiles[file]);const {nodes}=JSON.parse(bytes),g=new Array(nodes.length).fill(Infinity),queue=[0];g[0]=0;
 for(let head=0;head<queue.length;head++){const i=queue[head];for(const e of nodes[i].edges){assert(nodes[i].h<=1+nodes[e.to].h,'下界不一致，不能沿用本推导');if(!Number.isFinite(g[e.to])){g[e.to]=g[i]+1;queue.push(e.to);}}}
 const mandatory=nodes.filter((n,i)=>g[i]+n.h<nodes[0].distance).length;records.push({title:r.title,mapId:r.mapId,optimal:nodes[0].distance,mandatoryLowerF:mandatory});
}
writeFileSync(output,JSON.stringify({role:'admissible_frontier_ceiling_not_model_performance',proof:'一致下界下，f严格小于最优成本的所有可达局面在最优A*终止前必须展开；学习仅排序同f无法省去它们',mandatoryExpanded:records.reduce((s,r)=>s+r.mandatoryLowerF,0),maps:records},null,2)+'\n');
