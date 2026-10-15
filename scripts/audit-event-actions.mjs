import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {enumeratePlanningGraph} from '../src/training/planning-graph.js';
import {sameDynamicSituation} from '../src/training/event-actions.js';

const[library,output]=process.argv.slice(2);if(!output)throw new Error('用法：node scripts/audit-event-actions.mjs <verified-library> <新输出>');
assert(!existsSync(output));const sha=file=>createHash('sha256').update(readFileSync(file)).digest('hex'),read=file=>JSON.parse(readFileSync(file)),summary=read(library+'/summary.json');
mkdirSync(output,{recursive:true});
const records=[];
for(const record of summary.records){
    const source=read(library+'/'+record.mapId+'/manifest.json');
    const graph=enumeratePlanningGraph(source.map);assert.equal(graph.status,'exhausted');assert.equal(graph.distance[0],record.shortest);
    let quiet=0,events=0;for(const node of graph.nodes)for(const edge of node.edges){if(sameDynamicSituation(node.state,graph.nodes[edge.to].state))quiet++;else events++;}
    let i=0,referenceQuiet=0,referenceEvents=0;
    const route=source.solution?.actions??source.actions??record.actions;
    // 最短参考只按精确标签取一条；用于审计事件比例，绝不当玩家质量记录。
    const actions=[];
    while(!graph.nodes[i].state.isWon){const e=graph.nodes[i].edges.find(e=>graph.distance[e.to]===graph.distance[i]-1);assert(e);if(sameDynamicSituation(graph.nodes[i].state,graph.nodes[e.to].state))referenceQuiet++;else referenceEvents++;actions.push(e.action);i=e.to;}
    const result={title:record.title,mapId:record.mapId,states:graph.nodes.length,shortest:graph.distance[0],quietEdges:quiet,eventEdges:events,referenceQuiet,referenceEvents,reference:actions};records.push(result);console.log(JSON.stringify(result));
}
writeFileSync(output+'/summary.json',JSON.stringify({role:'event_action_representation_audit_not_quality',librarySha256:sha(library+'/summary.json'),sourceSha256:sha(new URL(import.meta.url)),helperSha256:sha(new URL('../src/training/event-actions.js',import.meta.url)),records},null,2)+'\n');
