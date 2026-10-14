import fs from 'node:fs';import assert from 'node:assert/strict';import {fileURLToPath} from 'node:url';
import {auditMap} from '../gallery-adjustments-20261014/verify.mjs';
import {forbidRecruitedCorner} from '../map-adjustment-candidates-20261014/recruited-core.mjs';
import {aiMaps} from '../../../ghost-maze/src/maps/ai-gallery.js';
const root=fileURLToPath(new URL('.',import.meta.url)),read=p=>JSON.parse(fs.readFileSync(p)),index=read(root+'index.json');
for(const row of index.maps){const folder=root+row.id+'/',map=read(folder+'map.json'),stored=read(folder+'evidence.json'),source=read(folder+'source.json'),fresh=auditMap(map,row.mapCode);
 assert.equal(source.humanQuality,null);assert.equal(fresh.mapId,row.mapId);assert.equal(fresh.ruleset,index.ruleset);assert.deepEqual(fresh.routes,stored.routes);assert.deepEqual(fresh.entry,stored.entry);assert(fresh.cold&&fresh.entry.initialInteriorEqual);
 const gallery=aiMaps.find(r=>r.title===row.title);for(const key of ['mapCode','replayCode','cells','ghosts','keys'])assert.equal(gallery[key],row[key]);
 if(row.id==='reborrow-narrow-wall')assert.equal(forbidRecruitedCorner(map).result.status,'proven_unsat');
 console.log(JSON.stringify({title:row.title,T:fresh.allResult.totalActions,count:fresh.count,boundary:fresh.boundary.status,cold:fresh.cold,actualEntry:fresh.entry.actions}));
}
assert.equal(aiMaps.length,13);
